package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type VillageSummary struct {
	ID           string `json:"id"`
	Slug         string `json:"slug"`
	CustomDomain string `json:"custom_domain"`
	Name         string `json:"name"`
	DistrictName string `json:"district_name"`
	RegencyName  string `json:"regency_name"`
	LeaderTitle  string `json:"leader_title"`
	LeaderName   string `json:"leader_name"`
	IsActive     bool   `json:"is_active"`
	Residents    int    `json:"residents"`
	Dusuns       int    `json:"dusuns"`
}

func (s *Store) ListVillages(ctx context.Context) ([]VillageSummary, error) {
	rows, err := s.Pool.Query(ctx, `
SELECT v.id::text, v.slug, COALESCE(v.custom_domain,''), v.name, v.district_name, v.regency_name,
       v.leader_title, v.leader_name, v.is_active,
       (SELECT COUNT(*) FROM residents r WHERE r.village_id=v.id AND r.status='AKTIF'),
       (SELECT COUNT(*) FROM dusuns d WHERE d.village_id=v.id)
FROM villages v ORDER BY v.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []VillageSummary
	for rows.Next() {
		var v VillageSummary
		if err := rows.Scan(&v.ID, &v.Slug, &v.CustomDomain, &v.Name, &v.DistrictName, &v.RegencyName,
			&v.LeaderTitle, &v.LeaderName, &v.IsActive, &v.Residents, &v.Dusuns); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

type NewVillage struct {
	Slug             string
	CustomDomain     string
	Name             string
	DistrictName     string
	RegencyName      string
	ProvinceName     string
	LeaderTitle      string
	LeaderName       string
	HamletTerm       string
	HamletLeaderTerm string
	Dusuns           []string
}

var ErrConflict = errors.New("data sudah ada")

func (s *Store) CreateVillage(ctx context.Context, n NewVillage) (string, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var id string
	err = tx.QueryRow(ctx, `
INSERT INTO villages (slug, custom_domain, name, district_name, regency_name, province_name,
                      leader_title, leader_name, hamlet_term, hamlet_leader_term)
VALUES ($1, NULLIF($2,''), $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id::text`,
		n.Slug, n.CustomDomain, n.Name, n.DistrictName, n.RegencyName, n.ProvinceName,
		n.LeaderTitle, n.LeaderName, n.HamletTerm, n.HamletLeaderTerm).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			return "", ErrConflict
		}
		return "", err
	}
	for _, d := range n.Dusuns {
		if _, err := tx.Exec(ctx, `INSERT INTO dusuns (village_id, name) VALUES ($1::uuid,$2)`, id, d); err != nil {
			return "", err
		}
	}
	return id, tx.Commit(ctx)
}

func (s *Store) DusunBelongsToVillage(ctx context.Context, dusunID, villageID string) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM dusuns WHERE id=$1::uuid AND village_id=$2::uuid)`,
		dusunID, villageID).Scan(&ok)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return ok, err
}

// Audit writes a sanitized audit record. details must never contain secrets.
func (s *Store) Audit(ctx context.Context, villageID, userID, action, entityType, entityID, ip string) {
	_, _ = s.Pool.Exec(ctx, `
INSERT INTO audit_logs (village_id, user_id, action, entity_type, entity_id, ip_address)
VALUES (NULLIF($1,'')::uuid, NULLIF($2,'')::uuid, $3, $4, NULLIF($5,''), NULLIF($6,''))`,
		villageID, userID, action, entityType, entityID, ip)
}
