package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	KindAccess  = "access"
	KindRefresh = "refresh"

	AccessTTL  = 30 * time.Minute
	RefreshTTL = 14 * 24 * time.Hour
)

type Claims struct {
	Kind      string   `json:"kind"`
	VillageID string   `json:"village_id,omitempty"`
	DusunID   string   `json:"dusun_id,omitempty"`
	Username  string   `json:"username"`
	FullName  string   `json:"full_name"`
	Roles     []string `json:"roles"`
	jwt.RegisteredClaims
}

func (c *Claims) HasRole(role string) bool {
	for _, r := range c.Roles {
		if r == role {
			return true
		}
	}
	return false
}

func (c *Claims) HasAnyRole(roles ...string) bool {
	for _, r := range roles {
		if c.HasRole(r) {
			return true
		}
	}
	return false
}

type Manager struct {
	secret []byte
}

func NewManager(secret string) (*Manager, error) {
	if len(secret) < 32 {
		return nil, errors.New("JWT_SECRET_KEY minimal 32 karakter")
	}
	return &Manager{secret: []byte(secret)}, nil
}

// Issue signs a token of the given kind for the user.
func (m *Manager) Issue(kind, userID, villageID, dusunID, username, fullName string, roles []string) (string, time.Time, error) {
	ttl := AccessTTL
	if kind == KindRefresh {
		ttl = RefreshTTL
	}
	now := time.Now()
	exp := now.Add(ttl)
	claims := Claims{
		Kind:      kind,
		VillageID: villageID,
		DusunID:   dusunID,
		Username:  username,
		FullName:  fullName,
		Roles:     roles,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			Issuer:    "sideci",
		},
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	return signed, exp, err
}

// Parse validates signature, expiry, issuer and token kind.
func (m *Manager) Parse(token, wantKind string) (*Claims, error) {
	claims := &Claims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		return m.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("sideci"), jwt.WithExpirationRequired())
	if err != nil || !parsed.Valid {
		return nil, fmt.Errorf("token tidak valid")
	}
	if claims.Kind != wantKind {
		return nil, fmt.Errorf("jenis token salah")
	}
	return claims, nil
}

func HashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), 12)
	return string(b), err
}

func CheckPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// DummyHash is compared when a username does not exist, to keep timing uniform.
var DummyHash, _ = bcrypt.GenerateFromPassword([]byte("sideci-dummy-password"), 12)
