package config

import (
	"os"
	"strings"
)

type Config struct {
	AppEnv            string
	HTTPPort          string
	DatabaseURL       string
	JWTSecretKey      string
	AllowedOrigins    []string
	DefaultTenantSlug string
	MigrationsDir     string
	AutoMigrate       bool
	CookieSecure      bool

	// Bootstrap akun superadmin pertama (hanya dipakai bila tabel users masih kosong).
	BootstrapSuperadminUser string
	BootstrapSuperadminPass string
}

func Load() Config {
	loadDotEnv(".env")
	originsRaw := getenv("ALLOWED_ORIGINS", "http://localhost:3000")
	var origins []string
	for _, o := range strings.Split(originsRaw, ",") {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	env := getenv("APP_ENV", "development")
	isDev := env == "development"

	return Config{
		AppEnv:                  env,
		HTTPPort:                getenv("HTTP_PORT", "8080"),
		DatabaseURL:             getenv("DATABASE_URL", ""),
		JWTSecretKey:            getenv("JWT_SECRET_KEY", ""),
		AllowedOrigins:          origins,
		DefaultTenantSlug:       getenv("DEFAULT_TENANT_SLUG", "ringdikit"),
		MigrationsDir:           getenv("MIGRATIONS_DIR", "migrations"),
		AutoMigrate:             getenv("AUTO_MIGRATE", boolStr(isDev)) == "true",
		CookieSecure:            getenv("COOKIE_SECURE", boolStr(!isDev)) == "true",
		BootstrapSuperadminUser: getenv("BOOTSTRAP_SUPERADMIN_USERNAME", ""),
		BootstrapSuperadminPass: getenv("BOOTSTRAP_SUPERADMIN_PASSWORD", ""),
	}
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

func getenv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && strings.TrimSpace(val) != "" {
		return strings.TrimSpace(val)
	}
	return fallback
}

func loadDotEnv(path string) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		k := strings.TrimSpace(parts[0])
		v := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		if _, exists := os.LookupEnv(k); !exists && k != "" {
			_ = os.Setenv(k, v)
		}
	}
}
