package middleware_test

import (
	"testing"
	"time"

	"github.com/rey1024/sideci/backend/internal/middleware"
)

func TestRateLimiter(t *testing.T) {
	l := middleware.NewRateLimiter(3, time.Minute)
	for i := 0; i < 3; i++ {
		if !l.Allow("1.1.1.1") {
			t.Fatalf("percobaan %d harus diizinkan", i+1)
		}
	}
	if l.Allow("1.1.1.1") {
		t.Fatal("percobaan ke-4 harus diblokir")
	}
	if !l.Allow("2.2.2.2") {
		t.Fatal("IP lain tidak boleh terkena limit")
	}
}
