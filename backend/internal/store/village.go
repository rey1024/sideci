package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type VillageProfile struct {
	ID               string
	Slug             string
	Name             string
	DistrictName     string
	RegencyName      string
	ProvinceName     string
	PostalCode       string
	LeaderTitle      string
	LeaderName       string
	HamletTerm       string
	HamletLeaderTerm string
	OfficeAddress    string
	OfficePhone      string
	OfficeEmail      string
	WelcomeQuote     string
}

var ErrNotFound = errors.New("tidak ditemukan")

// VillageBySlug returns an active village by slug or custom domain.
func (s *Store) VillageBySlug(ctx context.Context, slug string) (*VillageProfile, error) {
	const q = `
SELECT id::text, slug, name, district_name, regency_name, province_name,
       COALESCE(postal_code,''), leader_title, leader_name, hamlet_term, hamlet_leader_term,
       COALESCE(office_address,''), COALESCE(office_phone,''), COALESCE(office_email,''),
       COALESCE(profile_config->>'welcome_quote','')
FROM villages
WHERE is_active = TRUE AND (slug = $1 OR custom_domain = $1)`
	var v VillageProfile
	err := s.Pool.QueryRow(ctx, q, slug).Scan(
		&v.ID, &v.Slug, &v.Name, &v.DistrictName, &v.RegencyName, &v.ProvinceName,
		&v.PostalCode, &v.LeaderTitle, &v.LeaderName, &v.HamletTerm, &v.HamletLeaderTerm,
		&v.OfficeAddress, &v.OfficePhone, &v.OfficeEmail, &v.WelcomeQuote,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &v, err
}

type Count struct {
	Label string
	Count int
}

type DusunCount struct {
	Name  string
	Count int
}

type VillageStats struct {
	TotalResidents  int
	TotalHouseholds int
	Male            int
	Female          int
	Dusuns          []DusunCount
	Education       []Count
	Marital         []Count
}

// VillageStats returns aggregate-only statistics for ACTIVE residents (no PII).
func (s *Store) VillageStats(ctx context.Context, villageID string) (*VillageStats, error) {
	st := &VillageStats{}
	err := s.Pool.QueryRow(ctx, `
SELECT COUNT(*),
       COUNT(*) FILTER (WHERE gender='L'),
       COUNT(*) FILTER (WHERE gender='P'),
       COUNT(DISTINCT household_id)
FROM residents WHERE village_id=$1 AND status='AKTIF'`, villageID).
		Scan(&st.TotalResidents, &st.Male, &st.Female, &st.TotalHouseholds)
	if err != nil {
		return nil, err
	}

	rows, err := s.Pool.Query(ctx, `
SELECT d.name, COUNT(r.id)
FROM dusuns d
LEFT JOIN residents r ON r.dusun_id=d.id AND r.village_id=d.village_id AND r.status='AKTIF'
WHERE d.village_id=$1
GROUP BY d.name ORDER BY COUNT(r.id) DESC`, villageID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var d DusunCount
		if err := rows.Scan(&d.Name, &d.Count); err != nil {
			rows.Close()
			return nil, err
		}
		st.Dusuns = append(st.Dusuns, d)
	}
	rows.Close()

	st.Education, err = s.groupCount(ctx, `
SELECT COALESCE(education,'-'), COUNT(*) FROM residents
WHERE village_id=$1 AND status='AKTIF' GROUP BY 1 ORDER BY 2 DESC`, villageID)
	if err != nil {
		return nil, err
	}
	st.Marital, err = s.groupCount(ctx, `
SELECT marital_status, COUNT(*) FROM residents
WHERE village_id=$1 AND status='AKTIF' GROUP BY 1 ORDER BY 2 DESC`, villageID)
	return st, err
}

func (s *Store) groupCount(ctx context.Context, q, villageID string) ([]Count, error) {
	rows, err := s.Pool.Query(ctx, q, villageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Count
	for rows.Next() {
		var c Count
		if err := rows.Scan(&c.Label, &c.Count); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
