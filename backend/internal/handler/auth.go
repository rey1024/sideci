package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/rey1024/sideci/backend/internal/auth"
	"github.com/rey1024/sideci/backend/internal/middleware"
	"github.com/rey1024/sideci/backend/internal/store"
)

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type sessionUser struct {
	ID        string   `json:"id"`
	Username  string   `json:"username"`
	FullName  string   `json:"full_name"`
	VillageID string   `json:"village_id,omitempty"`
	DusunID   string   `json:"dusun_id,omitempty"`
	Roles     []string `json:"roles"`
}

const genericLoginError = "Username atau kata sandi salah"

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	ip := clientIP(r)
	if !s.loginLimiter.Allow(ip) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "Terlalu banyak percobaan login. Coba lagi sebentar lagi."})
		return
	}

	var req loginRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan tidak valid"})
		return
	}
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	req.Password = strings.TrimSpace(req.Password)
	if req.Username == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Username dan kata sandi wajib diisi"})
		return
	}

	u, err := s.Store.UserByUsername(r.Context(), req.Username)
	if err != nil {
		// Samakan waktu respons agar username tidak dapat ditebak.
		auth.CheckPassword(string(auth.DummyHash), req.Password)
		s.Store.Audit(r.Context(), "", "", "LOGIN_FAILED", "user", "", ip)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": genericLoginError})
		return
	}
	if !auth.CheckPassword(u.PasswordHash, req.Password) || !u.IsActive {
		s.Store.Audit(r.Context(), u.VillageID, u.ID, "LOGIN_FAILED", "user", u.ID, ip)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": genericLoginError})
		return
	}

	// Isolasi tenant: akun desa hanya boleh login pada domain desanya sendiri.
	if u.VillageID != "" {
		tenantVillageID, err := s.Store.VillageIDBySlug(r.Context(), middleware.TenantSlugFromContext(r.Context()))
		if err != nil || tenantVillageID != u.VillageID {
			s.Store.Audit(r.Context(), u.VillageID, u.ID, "LOGIN_TENANT_MISMATCH", "user", u.ID, ip)
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": genericLoginError})
			return
		}
	}

	if err := s.issueSession(w, r, u); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal membuat sesi"})
		return
	}
	s.Store.Audit(r.Context(), u.VillageID, u.ID, "LOGIN_SUCCESS", "user", u.ID, ip)
	writeJSON(w, http.StatusOK, map[string]any{"user": toSessionUser(u)})
}

func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	c, err := r.Cookie(middleware.RefreshCookie)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Sesi berakhir, silakan login kembali"})
		return
	}
	claims, err := s.Auth.Parse(c.Value, auth.KindRefresh)
	if err != nil {
		s.clearSession(w, r)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Sesi berakhir, silakan login kembali"})
		return
	}
	// Muat ulang dari DB agar perubahan role / penonaktifan akun langsung berlaku.
	u, err := s.Store.UserByID(r.Context(), claims.Subject)
	if err != nil || !u.IsActive {
		s.clearSession(w, r)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Sesi berakhir, silakan login kembali"})
		return
	}
	if err := s.issueSession(w, r, u); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memperbarui sesi"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": toSessionUser(u)})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.clearSession(w, r)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	c := middleware.ClaimsFromContext(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{"user": sessionUser{
		ID: c.Subject, Username: c.Username, FullName: c.FullName,
		VillageID: c.VillageID, DusunID: c.DusunID, Roles: c.Roles,
	}})
}

func toSessionUser(u *store.AuthUser) sessionUser {
	return sessionUser{
		ID: u.ID, Username: u.Username, FullName: u.FullName,
		VillageID: u.VillageID, DusunID: u.DusunID, Roles: u.Roles,
	}
}

func (s *Server) cookieSecureFor(r *http.Request) bool {
	if !s.CookieSecure {
		return false
	}
	if r.TLS != nil {
		return true
	}
	proto := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")))
	return proto == "" || strings.HasPrefix(proto, "https")
}

func (s *Server) issueSession(w http.ResponseWriter, r *http.Request, u *store.AuthUser) error {
	at, atExp, err := s.Auth.Issue(auth.KindAccess, u.ID, u.VillageID, u.DusunID, u.Username, u.FullName, u.Roles)
	if err != nil {
		return err
	}
	rt, rtExp, err := s.Auth.Issue(auth.KindRefresh, u.ID, u.VillageID, u.DusunID, u.Username, u.FullName, u.Roles)
	if err != nil {
		return err
	}
	sec := s.cookieSecureFor(r)
	http.SetCookie(w, &http.Cookie{
		Name: middleware.AccessCookie, Value: at, Path: "/", Expires: atExp,
		HttpOnly: true, Secure: sec, SameSite: http.SameSiteLaxMode,
	})
	http.SetCookie(w, &http.Cookie{
		Name: middleware.RefreshCookie, Value: rt, Path: "/api/v1/auth", Expires: rtExp,
		HttpOnly: true, Secure: sec, SameSite: http.SameSiteLaxMode,
	})
	return nil
}

func (s *Server) clearSession(w http.ResponseWriter, r *http.Request) {
	sec := s.cookieSecureFor(r)
	for _, c := range []struct{ name, path string }{
		{middleware.AccessCookie, "/"},
		{middleware.RefreshCookie, "/api/v1/auth"},
	} {
		http.SetCookie(w, &http.Cookie{
			Name: c.name, Value: "", Path: c.path, Expires: time.Unix(0, 0), MaxAge: -1,
			HttpOnly: true, Secure: sec, SameSite: http.SameSiteLaxMode,
		})
	}
}
