package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rey1024/sideci/backend/internal/auth"
	"github.com/rey1024/sideci/backend/internal/config"
	"github.com/rey1024/sideci/backend/internal/handler"
	"github.com/rey1024/sideci/backend/internal/middleware"
	"github.com/rey1024/sideci/backend/internal/store"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	am, err := auth.NewManager(cfg.JWTSecretKey)
	if err != nil {
		log.Fatalf("konfigurasi auth: %v", err)
	}

	if cfg.AutoMigrate {
		if err := store.RunMigrations(ctx, cfg.DatabaseURL, cfg.MigrationsDir); err != nil {
			log.Fatalf("migrasi database: %v", err)
		}
		log.Println("[SIDECI API] migrasi database selesai")
	}

	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("koneksi database: %v", err)
	}
	defer st.Close()

	bootstrapSuperadmin(ctx, st, cfg)

	mux := http.NewServeMux()
	srv := handler.NewServer(cfg.AppEnv, st, am, cfg.CookieSecure)
	srv.RegisterRoutes(mux)

	customDomains := map[string]string{
		"ringdikit.desa.id": "ringdikit",
	}

	rootHandler := middleware.WithCORS(cfg.AllowedOrigins)(
		middleware.WithTenant(cfg.DefaultTenantSlug, customDomains)(
			middleware.Authenticate(am)(mux),
		),
	)

	httpServer := &http.Server{
		Addr:              ":" + cfg.HTTPPort,
		Handler:           rootHandler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("[SIDECI API] listening on :%s (env=%s)", cfg.HTTPPort, cfg.AppEnv)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server failed: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(shutdownCtx)
	log.Println("[SIDECI API] stopped cleanly")
}

// bootstrapSuperadmin membuat superadmin pertama dari environment bila belum ada user.
// Kata sandi tidak pernah dicetak ke log.
func bootstrapSuperadmin(ctx context.Context, st *store.Store, cfg config.Config) {
	if cfg.BootstrapSuperadminUser == "" || cfg.BootstrapSuperadminPass == "" {
		return
	}
	n, err := st.UserCount(ctx)
	if err != nil || n > 0 {
		return
	}
	if len(cfg.BootstrapSuperadminPass) < 10 {
		log.Println("[SIDECI API] BOOTSTRAP_SUPERADMIN_PASSWORD terlalu pendek (min 10), dilewati")
		return
	}
	hash, err := auth.HashPassword(cfg.BootstrapSuperadminPass)
	if err != nil {
		log.Printf("[SIDECI API] gagal membuat hash bootstrap: %v", err)
		return
	}
	if _, err := st.CreateUser(ctx, "", "", cfg.BootstrapSuperadminUser, "Superadmin Platform", hash, []string{"superadmin"}); err != nil {
		log.Printf("[SIDECI API] gagal membuat superadmin bootstrap: %v", err)
		return
	}
	log.Printf("[SIDECI API] superadmin awal '%s' dibuat", cfg.BootstrapSuperadminUser)
}
