package auth_test

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rey1024/sideci/backend/internal/auth"
)

const secret = "unit-test-secret-minimum-32-characters!!"

func TestNewManagerRejectsShortSecret(t *testing.T) {
	if _, err := auth.NewManager("short"); err == nil {
		t.Fatal("secret pendek harus ditolak")
	}
}

func TestIssueAndParseRoundTrip(t *testing.T) {
	m, _ := auth.NewManager(secret)
	tok, _, err := m.Issue(auth.KindAccess, "u1", "v1", "d1", "user", "User", []string{"operator_persuratan", "operator_kependudukan"})
	if err != nil {
		t.Fatal(err)
	}
	c, err := m.Parse(tok, auth.KindAccess)
	if err != nil {
		t.Fatal(err)
	}
	if c.Subject != "u1" || c.VillageID != "v1" || c.DusunID != "d1" || !c.HasRole("operator_persuratan") {
		t.Fatalf("klaim tidak sesuai: %+v", c)
	}
	if _, err := m.Parse(tok, auth.KindRefresh); err == nil {
		t.Fatal("jenis token salah harus ditolak")
	}
}

func TestParseRejectsTamperedAndExpired(t *testing.T) {
	m, _ := auth.NewManager(secret)
	other, _ := auth.NewManager("another-secret-minimum-32-characters-xx")
	tok, _, _ := other.Issue(auth.KindAccess, "u1", "v1", "", "u", "U", nil)
	if _, err := m.Parse(tok, auth.KindAccess); err == nil {
		t.Fatal("token dengan secret lain harus ditolak")
	}

	expired := auth.Claims{
		Kind: auth.KindAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "u1",
			Issuer:    "sideci",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
		},
	}
	signed, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, expired).SignedString([]byte(secret))
	if _, err := m.Parse(signed, auth.KindAccess); err == nil {
		t.Fatal("token kedaluwarsa harus ditolak")
	}

	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, expired).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if _, err := m.Parse(none, auth.KindAccess); err == nil {
		t.Fatal("algoritma none harus ditolak")
	}
}

func TestPasswordHashing(t *testing.T) {
	h, err := auth.HashPassword("kata-sandi-kuat-123")
	if err != nil {
		t.Fatal(err)
	}
	if !auth.CheckPassword(h, "kata-sandi-kuat-123") || auth.CheckPassword(h, "salah") {
		t.Fatal("verifikasi password tidak sesuai")
	}
}
