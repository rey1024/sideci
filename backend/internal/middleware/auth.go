package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/rey1024/sideci/backend/internal/auth"
)

const (
	AccessCookie  = "sideci_at"
	RefreshCookie = "sideci_rt"
)

const claimsKey ctxKey = "claims"

func ClaimsFromContext(ctx context.Context) *auth.Claims {
	c, _ := ctx.Value(claimsKey).(*auth.Claims)
	return c
}

// Authenticate attaches claims when a valid access cookie / bearer token is present.
// It never rejects: protection is applied per route by RequireRoles.
func Authenticate(m *auth.Manager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := ""
			if c, err := r.Cookie(AccessCookie); err == nil {
				token = c.Value
			} else if h := r.Header.Get("Authorization"); len(h) > 7 && h[:7] == "Bearer " {
				token = h[7:]
			}
			if token != "" {
				if claims, err := m.Parse(token, auth.KindAccess); err == nil {
					r = r.WithContext(context.WithValue(r.Context(), claimsKey, claims))
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// RequireRoles allows the request only for authenticated users holding any of roles.
// With no roles it requires only authentication.
func RequireRoles(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromContext(r.Context())
			if claims == nil {
				writeErr(w, http.StatusUnauthorized, "Silakan login terlebih dahulu")
				return
			}
			if len(roles) > 0 && !claims.HasAnyRole(roles...) {
				writeErr(w, http.StatusForbidden, "Anda tidak memiliki hak akses")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
