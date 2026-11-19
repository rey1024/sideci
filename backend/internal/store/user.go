package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type AuthUser struct {
	ID           string
	VillageID    string // empty for superadmin
	DusunID      string // empty unless kepala_dusun
	Username     string
	FullName     string
	PasswordHash string
	IsActive     bool
	Roles        []string
}

// UserByUsername loads a user with roles for login.
func (s *Store) UserByUsername(ctx context.Context, username string) (*AuthUser, error) {
	var u AuthUser
	err := s.Pool.QueryRow(ctx, `
SELECT id::text, COALESCE(village_id::text,''), COALESCE(dusun_id::text,''),
       username, full_name, password_hash, is_active
FROM users WHERE username=$1`, username).
		Scan(&u.ID, &u.VillageID, &u.DusunID, &u.Username, &u.FullName, &u.PasswordHash, &u.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, s.loadRoles(ctx, &u)
}

// UserByID loads a user with roles (used to refresh session claims).
func (s *Store) UserByID(ctx context.Context, id string) (*AuthUser, error) {
	var u AuthUser
	err := s.Pool.QueryRow(ctx, `
SELECT id::text, COALESCE(village_id::text,''), COALESCE(dusun_id::text,''),
       username, full_name, password_hash, is_active
FROM users WHERE id=$1::uuid`, id).
		Scan(&u.ID, &u.VillageID, &u.DusunID, &u.Username, &u.FullName, &u.PasswordHash, &u.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, s.loadRoles(ctx, &u)
}

func (s *Store) loadRoles(ctx context.Context, u *AuthUser) error {
	rows, err := s.Pool.Query(ctx, `SELECT role_code FROM user_roles WHERE user_id=$1::uuid ORDER BY role_code`, u.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var r string
		if err := rows.Scan(&r); err != nil {
			return err
		}
		u.Roles = append(u.Roles, r)
	}
	return rows.Err()
}

// CreateUser inserts a user and its roles in one transaction.
func (s *Store) CreateUser(ctx context.Context, villageID, dusunID, username, fullName, passwordHash string, roles []string) (string, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var id string
	err = tx.QueryRow(ctx, `
INSERT INTO users (village_id, dusun_id, username, full_name, password_hash)
VALUES (NULLIF($1,'')::uuid, NULLIF($2,'')::uuid, $3, $4, $5) RETURNING id::text`,
		villageID, dusunID, username, fullName, passwordHash).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			return "", ErrConflict
		}
		return "", err
	}
	for _, r := range roles {
		if _, err := tx.Exec(ctx, `INSERT INTO user_roles (user_id, role_code) VALUES ($1::uuid,$2)`, id, r); err != nil {
			return "", err
		}
	}
	return id, tx.Commit(ctx)
}

// UserExists reports whether any user exists (used for first-run bootstrap).
func (s *Store) UserCount(ctx context.Context) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) VillageIDBySlug(ctx context.Context, slug string) (string, error) {
	var id string
	err := s.Pool.QueryRow(ctx, `SELECT id::text FROM villages WHERE slug=$1`, slug).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return id, err
}
