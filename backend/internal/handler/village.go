package handler

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/rey1024/sideci/backend/internal/auth"
	"github.com/rey1024/sideci/backend/internal/domain"
	"github.com/rey1024/sideci/backend/internal/middleware"
	"github.com/rey1024/sideci/backend/internal/store"
)

type Server struct {
	AppEnv       string
	Store        *store.Store
	Auth         *auth.Manager
	CookieSecure bool

	loginLimiter *middleware.RateLimiter

	cacheMu sync.Mutex
	cache   map[string]cachedOverview
}

type cachedOverview struct {
	data    domain.PublicVillageOverview
	expires time.Time
}

func NewServer(appEnv string, st *store.Store, am *auth.Manager, cookieSecure bool) *Server {
	return &Server{
		AppEnv:       appEnv,
		Store:        st,
		Auth:         am,
		CookieSecure: cookieSecure,
		loginLimiter: middleware.NewRateLimiter(8, time.Minute),
		cache:        make(map[string]cachedOverview),
	}
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	authed := middleware.RequireRoles()
	superOnly := middleware.RequireRoles("superadmin")
	villageAdmin := middleware.RequireRoles("admin_desa")
	popReader := middleware.RequireRoles("admin_desa", "operator_kependudukan", "operator_persuratan", "kepala_dusun", "kepala_desa")
	popOperator := middleware.RequireRoles("admin_desa", "operator_kependudukan")
	letterOperator := middleware.RequireRoles("admin_desa", "operator_persuratan", "operator_kependudukan")
	subCreator := middleware.RequireRoles("admin_desa", "operator_kependudukan", "kepala_dusun")

	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /api/v1/health", s.handleHealth)

	// Publik
	mux.HandleFunc("GET /api/v1/public/village", s.handlePublicVillage)
	mux.HandleFunc("POST /api/v1/public/letters", s.handlePublicLetterSubmit)
	mux.HandleFunc("GET /api/v1/public/verify/{token}", s.handleVerifyQR)

	// Autentikasi
	mux.HandleFunc("POST /api/v1/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/v1/auth/refresh", s.handleRefresh)
	mux.HandleFunc("POST /api/v1/auth/logout", s.handleLogout)
	mux.Handle("GET /api/v1/auth/me", authed(http.HandlerFunc(s.handleMe)))

	// Kependudukan, Smart SIAK Importer, & Validasi Dusun-Desa (Milestone 2)
	mux.Handle("GET /api/v1/population/stats", popReader(http.HandlerFunc(s.handlePopulationStats)))
	mux.Handle("GET /api/v1/dusuns", popReader(http.HandlerFunc(s.handleListDusuns)))
	mux.Handle("GET /api/v1/households", popReader(http.HandlerFunc(s.handleListHouseholds)))
	mux.Handle("GET /api/v1/residents", popReader(http.HandlerFunc(s.handleListResidents)))
	mux.Handle("GET /api/v1/residents/{id}", popReader(http.HandlerFunc(s.handleGetResidentDetail)))
	mux.Handle("POST /api/v1/residents", popOperator(http.HandlerFunc(s.handleUpsertResident)))
	mux.Handle("PUT /api/v1/residents/{id}", popOperator(http.HandlerFunc(s.handleUpdateResident)))
	mux.Handle("DELETE /api/v1/residents/{id}", popOperator(http.HandlerFunc(s.handleDeleteResident)))
	mux.Handle("POST /api/v1/residents/{id}/events", popOperator(http.HandlerFunc(s.handleRecordResidentEvent)))
	mux.Handle("POST /api/v1/residents/import-xlsx", popOperator(http.HandlerFunc(s.handleImportSIAKXLSX)))

	mux.Handle("GET /api/v1/submissions", popReader(http.HandlerFunc(s.handleListSubmissions)))
	mux.Handle("POST /api/v1/submissions", subCreator(http.HandlerFunc(s.handleCreateSubmission)))
	mux.Handle("POST /api/v1/submissions/{id}/review", popOperator(http.HandlerFunc(s.handleReviewSubmission)))

	// Studio Persuratan Desa (PDF & DOCX, Buku Register, Unggah TTD Basah / TTE)
	mux.Handle("GET /api/v1/letters", popReader(http.HandlerFunc(s.handleListLetters)))
	mux.Handle("POST /api/v1/letters", letterOperator(http.HandlerFunc(s.handleCreateLetter)))
	mux.Handle("GET /api/v1/letters/{id}/docx", popReader(http.HandlerFunc(s.handleDownloadLetterDOCX)))
	mux.Handle("GET /api/v1/letters/{id}/pdf", popReader(http.HandlerFunc(s.handleDownloadLetterPDF)))
	mux.Handle("POST /api/v1/letters/{id}/upload-signed", letterOperator(http.HandlerFunc(s.handleUploadSignedLetter)))
	mux.Handle("GET /api/v1/letters/{id}/signed-file", popReader(http.HandlerFunc(s.handleDownloadSignedLetterFile)))

	// Anjungan Kiosk Mandiri, Pemetaan RFID KTP-el <-> NIK, & Buku Tamu Digital
	mux.Handle("GET /api/v1/kiosk/lookup", popReader(http.HandlerFunc(s.handleKioskLookup)))
	mux.Handle("GET /api/v1/kiosk/rfid-mappings", popReader(http.HandlerFunc(s.handleListRFIDMappings)))
	mux.Handle("POST /api/v1/kiosk/rfid-mappings", letterOperator(http.HandlerFunc(s.handleBindRFIDMapping)))
	mux.Handle("GET /api/v1/kiosk/guestbook", popReader(http.HandlerFunc(s.handleListGuestbook)))
	mux.Handle("POST /api/v1/kiosk/guestbook", letterOperator(http.HandlerFunc(s.handleCreateGuestbook)))
	mux.Handle("POST /api/v1/kiosk/guestbook/{id}/feedback", letterOperator(http.HandlerFunc(s.handleSubmitGuestbookFeedback)))

	// Superadmin platform
	mux.Handle("GET /api/v1/admin/villages", superOnly(http.HandlerFunc(s.handleAdminListVillages)))
	mux.Handle("POST /api/v1/admin/villages", superOnly(http.HandlerFunc(s.handleAdminCreateVillage)))
	mux.Handle("POST /api/v1/admin/users", superOnly(http.HandlerFunc(s.handleAdminCreateUser)))

	// Admin desa: kelola akun staf desanya sendiri
	mux.Handle("POST /api/v1/village/users", villageAdmin(http.HandlerFunc(s.handleVillageCreateUser)))
}

func (s *Server) InvalidateAllVillageCache() {
	s.cacheMu.Lock()
	s.cache = make(map[string]cachedOverview)
	s.cacheMu.Unlock()
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	status := "ok"
	dbStatus := "not_configured"
	if s.Store != nil {
		dbStatus = "ok"
		if err := s.Store.Pool.Ping(r.Context()); err != nil {
			status = "degraded"
			dbStatus = "down"
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   status,
		"service":  "sideci-backend",
		"env":      s.AppEnv,
		"database": dbStatus,
	})
}

func (s *Server) handlePublicVillage(w http.ResponseWriter, r *http.Request) {
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	slug := middleware.TenantSlugFromContext(r.Context())

	s.cacheMu.Lock()
	if c, ok := s.cache[slug]; ok && time.Now().Before(c.expires) {
		s.cacheMu.Unlock()
		writeJSON(w, http.StatusOK, c.data)
		return
	}
	s.cacheMu.Unlock()

	v, err := s.Store.VillageBySlug(r.Context(), slug)
	if err != nil {
		if err == store.ErrNotFound {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Desa belum terdaftar pada platform SIDECI"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	st, err := s.Store.VillageStats(r.Context(), v.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}

	overview := domain.PublicVillageOverview{
		Slug:             v.Slug,
		Name:             "Desa " + v.Name,
		DistrictName:     v.DistrictName,
		RegencyName:      v.RegencyName,
		ProvinceName:     v.ProvinceName,
		PostalCode:       v.PostalCode,
		LeaderTitle:      v.LeaderTitle,
		LeaderName:       v.LeaderName,
		HamletTerm:       v.HamletTerm,
		HamletLeaderTerm: v.HamletLeaderTerm,
		OfficeAddress:    v.OfficeAddress,
		OfficePhone:      v.OfficePhone,
		OfficeEmail:      v.OfficeEmail,
		WelcomeQuote:     v.WelcomeQuote,
		TotalResidents:   st.TotalResidents,
		TotalHouseholds:  st.TotalHouseholds,
		MaleCount:        st.Male,
		FemaleCount:      st.Female,
	}
	for _, d := range st.Dusuns {
		pct := 0.0
		if st.TotalResidents > 0 {
			pct = float64(d.Count) * 100 / float64(st.TotalResidents)
		}
		overview.Dusuns = append(overview.Dusuns, domain.DusunStat{
			Name:       v.HamletTerm + " " + d.Name,
			Residents:  d.Count,
			Percentage: pct,
		})
	}
	for _, c := range st.Education {
		overview.EducationSummary = append(overview.EducationSummary, domain.CategoryStat{Label: c.Label, Count: c.Count})
	}
	for _, c := range st.Marital {
		overview.MaritalSummary = append(overview.MaritalSummary, domain.CategoryStat{Label: c.Label, Count: c.Count})
	}

	s.cacheMu.Lock()
	s.cache[slug] = cachedOverview{data: overview, expires: time.Now().Add(5 * time.Minute)}
	s.cacheMu.Unlock()

	writeJSON(w, http.StatusOK, overview)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return strings.TrimSpace(strings.Split(fwd, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
