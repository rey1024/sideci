package middleware

import (
	"context"
	"net"
	"net/http"
	"strings"
)

type ctxKey string

const tenantSlugKey ctxKey = "tenant_slug"

func TenantSlugFromContext(ctx context.Context) string {
	if val, ok := ctx.Value(tenantSlugKey).(string); ok && val != "" {
		return val
	}
	return "ringdikit"
}

// WithTenant resolves the active village tenant from X-Tenant-Slug, X-Tenant-Host, or Host header.
func WithTenant(defaultSlug string, customDomains map[string]string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			slug := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Tenant-Slug")))
			if slug == "" {
				rawHost := r.Header.Get("X-Tenant-Host")
				if rawHost == "" {
					rawHost = r.Host
				}
				slug = ResolveSlugFromHost(rawHost, defaultSlug, customDomains)
			}
			ctx := context.WithValue(r.Context(), tenantSlugKey, slug)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func ResolveSlugFromHost(rawHost, defaultSlug string, customDomains map[string]string) string {
	host := strings.ToLower(strings.TrimSpace(rawHost))
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	if host == "" || host == "localhost" || net.ParseIP(host) != nil || strings.HasPrefix(host, "api-") || strings.HasPrefix(host, "api.") {
		return defaultSlug
	}
	if mapped, ok := customDomains[host]; ok {
		return mapped
	}
	parts := strings.Split(host, ".")
	if len(parts) >= 2 && parts[0] != "www" && parts[0] != "sideci" && parts[0] != "staging-sideci" {
		return parts[0]
	}
	return defaultSlug
}

func WithCORS(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if _, ok := allowed[origin]; ok || strings.HasSuffix(origin, ".sideci.reisys.id") {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-Slug, X-Tenant-Host")
					w.Header().Set("Access-Control-Allow-Credentials", "true")
				}
			}
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
