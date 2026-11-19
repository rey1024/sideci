package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/rey1024/sideci/backend/internal/importer"
)

type DusunItem struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	HeadName   string `json:"head_name"`
	Residents  int    `json:"residents"`
	Households int    `json:"households"`
}

func (s *Store) ListDusuns(ctx context.Context, villageID string) ([]DusunItem, error) {
	rows, err := s.Pool.Query(ctx, `
SELECT d.id::text, d.name, COALESCE(d.head_name,''),
       (SELECT COUNT(*) FROM residents r WHERE r.dusun_id=d.id AND r.village_id=d.village_id AND r.status='AKTIF'),
       (SELECT COUNT(*) FROM households h WHERE h.dusun_id=d.id AND h.village_id=d.village_id)
FROM dusuns d
WHERE d.village_id=$1::uuid
ORDER BY d.name`, villageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DusunItem
	for rows.Next() {
		var item DusunItem
		if err := rows.Scan(&item.ID, &item.Name, &item.HeadName, &item.Residents, &item.Households); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

type HouseholdItem struct {
	ID          string `json:"id"`
	NoKK        string `json:"no_kk"`
	Address     string `json:"address"`
	RT          string `json:"rt"`
	RW          string `json:"rw"`
	PostalCode  string `json:"postal_code"`
	DusunID     string `json:"dusun_id"`
	DusunName   string `json:"dusun_name"`
	HeadName    string `json:"head_name"`
	MemberCount int    `json:"member_count"`
	HeadCount   int    `json:"head_count"`
	HasAnomaly  bool   `json:"has_anomaly"`
}

func (s *Store) ListHouseholds(ctx context.Context, villageID, dusunID, search string, limit, offset int) ([]HouseholdItem, int, error) {
	if limit <= 0 || limit > 200 {
		limit = 25
	}
	if offset < 0 {
		offset = 0
	}
	search = strings.TrimSpace(search)

	var total int
	err := s.Pool.QueryRow(ctx, `
SELECT COUNT(*)
FROM households h
WHERE h.village_id=$1::uuid
  AND ($2 = '' OR h.dusun_id = NULLIF($2,'')::uuid)
  AND (
        $3 = ''
     OR h.no_kk ILIKE '%'||$3||'%'
     OR h.address ILIKE '%'||$3||'%'
     OR EXISTS (SELECT 1 FROM residents r WHERE r.household_id=h.id AND r.full_name ILIKE '%'||$3||'%')
  )`, villageID, dusunID, search).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	q := `
SELECT h.id::text, h.no_kk, h.address, COALESCE(h.rt,''), COALESCE(h.rw,''), COALESCE(h.postal_code,''),
       COALESCE(h.dusun_id::text,''), COALESCE(d.name,''),
       COALESCE((SELECT r.full_name FROM residents r WHERE r.household_id=h.id AND r.shdk='KEPALA KELUARGA' AND r.status='AKTIF' LIMIT 1),''),
       (SELECT COUNT(*) FROM residents r WHERE r.household_id=h.id AND r.status='AKTIF'),
       (SELECT COUNT(*) FROM residents r WHERE r.household_id=h.id AND r.shdk='KEPALA KELUARGA' AND r.status='AKTIF')
FROM households h
LEFT JOIN dusuns d ON d.id=h.dusun_id
WHERE h.village_id=$1::uuid
  AND ($2 = '' OR h.dusun_id = NULLIF($2,'')::uuid)
  AND (
        $3 = ''
     OR h.no_kk ILIKE '%'||$3||'%'
     OR h.address ILIKE '%'||$3||'%'
     OR EXISTS (SELECT 1 FROM residents r WHERE r.household_id=h.id AND r.full_name ILIKE '%'||$3||'%')
  )
ORDER BY h.no_kk
LIMIT $4 OFFSET $5`
	rows, err := s.Pool.Query(ctx, q, villageID, dusunID, search, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []HouseholdItem
	for rows.Next() {
		var h HouseholdItem
		if err := rows.Scan(&h.ID, &h.NoKK, &h.Address, &h.RT, &h.RW, &h.PostalCode,
			&h.DusunID, &h.DusunName, &h.HeadName, &h.MemberCount, &h.HeadCount); err != nil {
			return nil, 0, err
		}
		h.HasAnomaly = h.MemberCount > 0 && h.HeadCount != 1
		out = append(out, h)
	}
	return out, total, rows.Err()
}

type ResidentItem struct {
	ID            string            `json:"id"`
	NIK           string            `json:"nik"`
	NoKK          string            `json:"no_kk"`
	FullName      string            `json:"full_name"`
	Gender        string            `json:"gender"`
	BirthPlace    string            `json:"birth_place"`
	BirthDate     string            `json:"birth_date"`
	BloodType     string            `json:"blood_type"`
	Religion      string            `json:"religion"`
	MaritalStatus string            `json:"marital_status"`
	SHDK          string            `json:"shdk"`
	Education     string            `json:"education"`
	Occupation    string            `json:"occupation"`
	FatherName    string            `json:"father_name"`
	MotherName    string            `json:"mother_name"`
	DusunID       string            `json:"dusun_id"`
	DusunName     string            `json:"dusun_name"`
	Address       string            `json:"address"`
	Status        string            `json:"status"`
	RFIDUID       string            `json:"rfid_uid,omitempty"`
	CivilDocs     map[string]string `json:"civil_docs,omitempty"`
}

type PopulationEventItem struct {
	ID        string         `json:"id"`
	EventType string         `json:"event_type"`
	EventDate string         `json:"event_date"`
	Summary   string         `json:"summary"`
	ActorName string         `json:"actor_name"`
	Metadata  map[string]any `json:"metadata,omitempty"`
	CreatedAt string         `json:"created_at"`
}

type ResidentDetail struct {
	ResidentItem
	Events []PopulationEventItem `json:"events"`
}

func (s *Store) ListResidents(ctx context.Context, villageID, dusunID, status, shdk, search string, limit, offset int) ([]ResidentItem, int, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	search = strings.TrimSpace(search)
	shdk = strings.ToUpper(strings.TrimSpace(shdk))
	unmappedOnly := strings.EqualFold(dusunID, "UNMAPPED")
	dusunUUID := dusunID
	if unmappedOnly {
		dusunUUID = ""
	}

	var total int
	err := s.Pool.QueryRow(ctx, `
SELECT COUNT(*)
FROM residents r
LEFT JOIN households h ON h.id=r.household_id
WHERE r.village_id=$1::uuid
  AND (
        ($5 = TRUE AND r.dusun_id IS NULL)
     OR ($5 = FALSE AND ($2 = '' OR r.dusun_id = NULLIF($2,'')::uuid))
  )
  AND ($3 = '' OR r.status = $3)
  AND ($6 = '' OR r.shdk = $6)
  AND ($4 = '' OR r.nik ILIKE $4||'%' OR h.no_kk ILIKE $4||'%' OR r.full_name ILIKE '%'||$4||'%' OR COALESCE(r.rfid_uid,'') ILIKE $4||'%')`,
		villageID, dusunUUID, status, search, unmappedOnly, shdk).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	rows, err := s.Pool.Query(ctx, `
SELECT r.id::text, r.nik, COALESCE(h.no_kk,''), r.full_name, r.gender,
       r.birth_place, to_char(r.birth_date,'YYYY-MM-DD'), COALESCE(r.blood_type,'-'),
       r.religion, r.marital_status, r.shdk, COALESCE(r.education,''), COALESCE(r.occupation,''),
       COALESCE(r.father_name,''), COALESCE(r.mother_name,''),
       COALESCE(r.dusun_id::text,''), COALESCE(d.name,''), COALESCE(h.address,''), r.status,
       COALESCE(r.rfid_uid,'')
FROM residents r
LEFT JOIN households h ON h.id=r.household_id
LEFT JOIN dusuns d ON d.id=r.dusun_id
WHERE r.village_id=$1::uuid
  AND (
        ($7 = TRUE AND r.dusun_id IS NULL)
     OR ($7 = FALSE AND ($2 = '' OR r.dusun_id = NULLIF($2,'')::uuid))
  )
  AND ($3 = '' OR r.status = $3)
  AND ($8 = '' OR r.shdk = $8)
  AND ($4 = '' OR r.nik ILIKE $4||'%' OR h.no_kk ILIKE $4||'%' OR r.full_name ILIKE '%'||$4||'%' OR COALESCE(r.rfid_uid,'') ILIKE $4||'%')
ORDER BY r.full_name
LIMIT $5 OFFSET $6`,
		villageID, dusunUUID, status, search, limit, offset, unmappedOnly, shdk)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []ResidentItem
	for rows.Next() {
		var r ResidentItem
		if err := rows.Scan(&r.ID, &r.NIK, &r.NoKK, &r.FullName, &r.Gender,
			&r.BirthPlace, &r.BirthDate, &r.BloodType, &r.Religion, &r.MaritalStatus,
			&r.SHDK, &r.Education, &r.Occupation, &r.FatherName, &r.MotherName,
			&r.DusunID, &r.DusunName, &r.Address, &r.Status, &r.RFIDUID); err != nil {
			return nil, 0, err
		}
		out = append(out, r)
	}
	return out, total, rows.Err()
}

func (s *Store) GetResidentDetail(ctx context.Context, villageID, dusunScopeID, residentID string) (*ResidentDetail, error) {
	var det ResidentDetail
	var rawDocs []byte
	err := s.Pool.QueryRow(ctx, `
SELECT r.id::text, r.nik, COALESCE(h.no_kk,''), r.full_name, r.gender,
       r.birth_place, to_char(r.birth_date,'YYYY-MM-DD'), COALESCE(r.blood_type,'-'),
       r.religion, r.marital_status, r.shdk, COALESCE(r.education,''), COALESCE(r.occupation,''),
       COALESCE(r.father_name,''), COALESCE(r.mother_name,''),
       COALESCE(r.dusun_id::text,''), COALESCE(d.name,''), COALESCE(h.address,''), r.status,
       COALESCE(r.rfid_uid,''), r.civil_docs
FROM residents r
LEFT JOIN households h ON h.id=r.household_id
LEFT JOIN dusuns d ON d.id=r.dusun_id
WHERE r.id=$1::uuid AND r.village_id=$2::uuid
  AND ($3 = '' OR r.dusun_id = NULLIF($3,'')::uuid)`,
		residentID, villageID, dusunScopeID).Scan(
		&det.ID, &det.NIK, &det.NoKK, &det.FullName, &det.Gender,
		&det.BirthPlace, &det.BirthDate, &det.BloodType, &det.Religion, &det.MaritalStatus,
		&det.SHDK, &det.Education, &det.Occupation, &det.FatherName, &det.MotherName,
		&det.DusunID, &det.DusunName, &det.Address, &det.Status, &det.RFIDUID, &rawDocs)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(rawDocs, &det.CivilDocs)

	evRows, err := s.Pool.Query(ctx, `
SELECT e.id::text, e.event_type, to_char(e.event_date,'YYYY-MM-DD'), e.summary,
       COALESCE(u.full_name,'Sistem SIDECI'), e.event_metadata, to_char(e.created_at,'YYYY-MM-DD HH24:MI')
FROM population_events e
LEFT JOIN users u ON u.id=e.recorded_by
WHERE e.village_id=$1::uuid AND e.resident_id=$2::uuid
ORDER BY e.event_date DESC, e.created_at DESC`, villageID, residentID)
	if err != nil {
		return nil, err
	}
	defer evRows.Close()
	for evRows.Next() {
		var ev PopulationEventItem
		var metaBytes []byte
		if err := evRows.Scan(&ev.ID, &ev.EventType, &ev.EventDate, &ev.Summary, &ev.ActorName, &metaBytes, &ev.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(metaBytes, &ev.Metadata)
		det.Events = append(det.Events, ev)
	}
	return &det, evRows.Err()
}

type PopulationOperationalStats struct {
	ActiveResidents      int         `json:"active_residents"`
	MaleCount            int         `json:"male_count"`
	FemaleCount          int         `json:"female_count"`
	TotalHouseholds      int         `json:"total_households"`
	WajibKTPCount        int         `json:"wajib_ktp_count"`
	BalitaCount          int         `json:"balita_count"`
	LansiaCount          int         `json:"lansia_count"`
	DeceasedCount        int         `json:"deceased_count"`
	MovedOutCount        int         `json:"moved_out_count"`
	InactiveCount        int         `json:"inactive_count"`
	UnmappedDusunCount   int         `json:"unmapped_dusun_count"`
	PendingSubmissions   int         `json:"pending_submissions"`
	ApprovedSubmissions  int         `json:"approved_submissions"`
	RevisionSubmissions  int         `json:"revision_submissions"`
	EventsThisMonth      int         `json:"events_this_month"`
	TotalLifecycleEvents int         `json:"total_lifecycle_events"`
	Dusuns               []DusunItem `json:"dusuns"`
}

// GetPopulationStats returns real-time operational stats for Operator Desa, Kepala Dusun, & Perbekel.
func (s *Store) GetPopulationStats(ctx context.Context, villageID, dusunScopeID string) (*PopulationOperationalStats, error) {
	st := &PopulationOperationalStats{}
	err := s.Pool.QueryRow(ctx, `
SELECT COUNT(*) FILTER (WHERE status='AKTIF'),
       COUNT(*) FILTER (WHERE status='AKTIF' AND gender='L'),
       COUNT(*) FILTER (WHERE status='AKTIF' AND gender='P'),
       COUNT(DISTINCT household_id) FILTER (WHERE status='AKTIF'),
       COUNT(*) FILTER (WHERE status='AKTIF' AND (AGE(CURRENT_DATE, birth_date) >= INTERVAL '17 years' OR marital_status <> 'BELUM KAWIN')),
       COUNT(*) FILTER (WHERE status='AKTIF' AND AGE(CURRENT_DATE, birth_date) < INTERVAL '5 years'),
       COUNT(*) FILTER (WHERE status='AKTIF' AND AGE(CURRENT_DATE, birth_date) >= INTERVAL '60 years'),
       COUNT(*) FILTER (WHERE status='MENINGGAL'),
       COUNT(*) FILTER (WHERE status='PINDAH_KELUAR'),
       COUNT(*) FILTER (WHERE status='TIDAK_AKTIF'),
       COUNT(*) FILTER (WHERE status='AKTIF' AND dusun_id IS NULL)
FROM residents
WHERE village_id=$1::uuid
  AND ($2 = '' OR dusun_id = NULLIF($2,'')::uuid)`, villageID, dusunScopeID).Scan(
		&st.ActiveResidents, &st.MaleCount, &st.FemaleCount, &st.TotalHouseholds,
		&st.WajibKTPCount, &st.BalitaCount, &st.LansiaCount,
		&st.DeceasedCount, &st.MovedOutCount, &st.InactiveCount, &st.UnmappedDusunCount)
	if err != nil {
		return nil, err
	}

	_ = s.Pool.QueryRow(ctx, `
SELECT COUNT(*) FILTER (WHERE status='PENDING'),
       COUNT(*) FILTER (WHERE status='APPROVED'),
       COUNT(*) FILTER (WHERE status IN ('REVISION_REQUESTED','REJECTED'))
FROM population_submissions
WHERE village_id=$1::uuid
  AND ($2 = '' OR dusun_id = NULLIF($2,'')::uuid)`, villageID, dusunScopeID).Scan(
		&st.PendingSubmissions, &st.ApprovedSubmissions, &st.RevisionSubmissions)

	_ = s.Pool.QueryRow(ctx, `
SELECT COUNT(*) FILTER (WHERE e.event_type <> 'INITIAL_IMPORT' AND date_trunc('month', e.event_date) = date_trunc('month', CURRENT_DATE)),
       COUNT(*) FILTER (WHERE e.event_type <> 'INITIAL_IMPORT')
FROM population_events e
JOIN residents r ON r.id=e.resident_id
WHERE e.village_id=$1::uuid
  AND ($2 = '' OR r.dusun_id = NULLIF($2,'')::uuid)`, villageID, dusunScopeID).Scan(&st.EventsThisMonth, &st.TotalLifecycleEvents)

	dusuns, err := s.ListDusuns(ctx, villageID)
	if err != nil {
		return nil, err
	}
	st.Dusuns = dusuns
	return st, nil
}

type UpsertResidentInput struct {
	NIK           string            `json:"nik"`
	NoKK          string            `json:"no_kk"`
	FullName      string            `json:"full_name"`
	Gender        string            `json:"gender"`
	BirthPlace    string            `json:"birth_place"`
	BirthDate     string            `json:"birth_date"`
	BloodType     string            `json:"blood_type"`
	Religion      string            `json:"religion"`
	MaritalStatus string            `json:"marital_status"`
	SHDK          string            `json:"shdk"`
	Education     string            `json:"education"`
	Occupation    string            `json:"occupation"`
	FatherName    string            `json:"father_name"`
	MotherName    string            `json:"mother_name"`
	DusunID       string            `json:"dusun_id"`
	Address       string            `json:"address"`
	PostalCode    string            `json:"postal_code"`
	Status        string            `json:"status"`
	CivilDocs     map[string]string `json:"civil_docs"`
	EventType     string            `json:"event_type"`
	EventDate     string            `json:"event_date"`
	EventSummary  string            `json:"event_summary"`
}

// UpsertResidentDirect is used by operator_kependudukan at the village office desk.
// It returns (residentID, duplicateHeadWarning, error) and appends an entry to population_events.
func (s *Store) UpsertResidentDirect(ctx context.Context, villageID, actorUserID string, in UpsertResidentInput) (string, bool, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", false, err
	}
	defer tx.Rollback(ctx)

	var hhID string
	err = tx.QueryRow(ctx, `
INSERT INTO households (village_id, dusun_id, no_kk, address, postal_code)
VALUES ($1::uuid, NULLIF($2,'')::uuid, $3, $4, NULLIF($5,''))
ON CONFLICT (village_id, no_kk) DO UPDATE
SET dusun_id = COALESCE(EXCLUDED.dusun_id, households.dusun_id),
    address  = CASE WHEN EXCLUDED.address <> '' AND EXCLUDED.address <> '-' THEN EXCLUDED.address ELSE households.address END,
    updated_at = NOW()
RETURNING id::text`,
		villageID, in.DusunID, in.NoKK, defaultStr(in.Address, "-"), in.PostalCode).Scan(&hhID)
	if err != nil {
		return "", false, err
	}

	docsJSON, _ := json.Marshal(in.CivilDocs)
	if len(docsJSON) == 0 || string(docsJSON) == "null" {
		docsJSON = []byte("{}")
	}
	status := strings.ToUpper(strings.TrimSpace(in.Status))
	if status == "" {
		status = "AKTIF"
	}

	var resID string
	err = tx.QueryRow(ctx, `
INSERT INTO residents (
    village_id, household_id, dusun_id, nik, full_name, gender, birth_place, birth_date,
    blood_type, religion, marital_status, shdk, education, occupation, father_name, mother_name,
    civil_docs, status
) VALUES (
    $1::uuid, $2::uuid, NULLIF($3,'')::uuid, $4, $5, $6, $7, $8::date,
    $9, $10, $11, $12, $13, $14, NULLIF($15,''), NULLIF($16,''), $17::jsonb, $18
)
ON CONFLICT (village_id, nik) DO UPDATE SET
    household_id = EXCLUDED.household_id,
    dusun_id = COALESCE(EXCLUDED.dusun_id, residents.dusun_id),
    full_name = EXCLUDED.full_name,
    gender = EXCLUDED.gender,
    birth_place = EXCLUDED.birth_place,
    birth_date = EXCLUDED.birth_date,
    blood_type = EXCLUDED.blood_type,
    religion = EXCLUDED.religion,
    marital_status = EXCLUDED.marital_status,
    shdk = EXCLUDED.shdk,
    education = EXCLUDED.education,
    occupation = EXCLUDED.occupation,
    father_name = EXCLUDED.father_name,
    mother_name = EXCLUDED.mother_name,
    civil_docs = EXCLUDED.civil_docs,
    status = EXCLUDED.status,
    updated_at = NOW()
RETURNING id::text`,
		villageID, hhID, in.DusunID, in.NIK, in.FullName, in.Gender, defaultStr(in.BirthPlace, "-"), in.BirthDate,
		defaultStr(in.BloodType, "-"), defaultStr(in.Religion, "Hindu"), defaultStr(in.MaritalStatus, "BELUM KAWIN"),
		defaultStr(strings.ToUpper(in.SHDK), "FAMILI LAIN"),
		in.Education, in.Occupation, in.FatherName, in.MotherName, string(docsJSON), status).Scan(&resID)
	if err != nil {
		return "", false, err
	}

	var headCount int
	_ = tx.QueryRow(ctx, `
SELECT COUNT(*) FROM residents
WHERE household_id=$1::uuid AND shdk='KEPALA KELUARGA' AND status='AKTIF'`, hhID).Scan(&headCount)

	evType := strings.ToUpper(strings.TrimSpace(in.EventType))
	if evType == "" {
		evType = "NEW_RESIDENT"
	}
	evDate := strings.TrimSpace(in.EventDate)
	if evDate == "" {
		evDate = time.Now().Format("2006-01-02")
	}
	evSummary := strings.TrimSpace(in.EventSummary)
	if evSummary == "" {
		evSummary = fmt.Sprintf("Pencatatan penduduk (%s) oleh Operator Desa", status)
	}

	_, err = tx.Exec(ctx, `
INSERT INTO population_events (village_id, resident_id, event_type, event_date, summary, recorded_by)
VALUES ($1::uuid, $2::uuid, $3, $4::date, $5, NULLIF($6,'')::uuid)`,
		villageID, resID, evType, evDate, evSummary, actorUserID)
	if err != nil {
		return "", false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", false, err
	}
	return resID, headCount > 1, nil
}

// UpdateResidentByID updates an existing resident by ID (scoped strictly to villageID) and logs DATA_UPDATED.
func (s *Store) UpdateResidentByID(ctx context.Context, villageID, actorUserID, residentID string, in UpsertResidentInput) (bool, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	var exists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM residents WHERE id=$1::uuid AND village_id=$2::uuid)`,
		residentID, villageID).Scan(&exists); err != nil {
		return false, err
	}
	if !exists {
		return false, ErrNotFound
	}

	var hhID string
	err = tx.QueryRow(ctx, `
INSERT INTO households (village_id, dusun_id, no_kk, address, postal_code)
VALUES ($1::uuid, NULLIF($2,'')::uuid, $3, $4, NULLIF($5,''))
ON CONFLICT (village_id, no_kk) DO UPDATE
SET dusun_id = COALESCE(EXCLUDED.dusun_id, households.dusun_id),
    address  = CASE WHEN EXCLUDED.address <> '' AND EXCLUDED.address <> '-' THEN EXCLUDED.address ELSE households.address END,
    updated_at = NOW()
RETURNING id::text`,
		villageID, in.DusunID, in.NoKK, defaultStr(in.Address, "-"), in.PostalCode).Scan(&hhID)
	if err != nil {
		return false, err
	}

	status := strings.ToUpper(strings.TrimSpace(in.Status))
	if status == "" {
		status = "AKTIF"
	}

	_, err = tx.Exec(ctx, `
UPDATE residents SET
    household_id   = $1::uuid,
    dusun_id       = NULLIF($2,'')::uuid,
    nik            = $3,
    full_name      = $4,
    gender         = $5,
    birth_place    = $6,
    birth_date     = $7::date,
    blood_type     = $8,
    religion       = $9,
    marital_status = $10,
    shdk           = $11,
    education      = $12,
    occupation     = $13,
    father_name    = NULLIF($14,''),
    mother_name    = NULLIF($15,''),
    status         = $16,
    updated_at     = NOW()
WHERE id=$17::uuid AND village_id=$18::uuid`,
		hhID, in.DusunID, in.NIK, in.FullName, in.Gender, defaultStr(in.BirthPlace, "-"), in.BirthDate,
		defaultStr(in.BloodType, "-"), defaultStr(in.Religion, "Hindu"), defaultStr(in.MaritalStatus, "BELUM KAWIN"),
		defaultStr(strings.ToUpper(in.SHDK), "FAMILI LAIN"),
		in.Education, in.Occupation, in.FatherName, in.MotherName, status, residentID, villageID)
	if err != nil {
		if isUniqueViolation(err) {
			return false, ErrConflict
		}
		return false, err
	}

	var headCount int
	_ = tx.QueryRow(ctx, `
SELECT COUNT(*) FROM residents
WHERE household_id=$1::uuid AND shdk='KEPALA KELUARGA' AND status='AKTIF'`, hhID).Scan(&headCount)

	summary := strings.TrimSpace(in.EventSummary)
	if summary == "" {
		summary = fmt.Sprintf("Perubahan biodata penduduk (Status: %s) oleh Operator Desa", status)
	}
	_, err = tx.Exec(ctx, `
INSERT INTO population_events (village_id, resident_id, event_type, event_date, summary, recorded_by)
VALUES ($1::uuid, $2::uuid, 'UPDATE_BIODATA', CURRENT_DATE, $3, NULLIF($4,'')::uuid)`,
		villageID, residentID, summary, actorUserID)
	if err != nil {
		return false, err
	}

	return headCount > 1, tx.Commit(ctx)
}

// DeleteResidentByID removes an erroneous/duplicate resident entry scoped strictly to villageID.
func (s *Store) DeleteResidentByID(ctx context.Context, villageID, residentID string) error {
	tag, err := s.Pool.Exec(ctx,
		`DELETE FROM residents WHERE id=$1::uuid AND village_id=$2::uuid`,
		residentID, villageID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type RecordEventInput struct {
	EventType     string         `json:"event_type"` // DEATH, MOVE_OUT, MOVE_IN, CHANGE_DUSUN, MARRIAGE, DIVORCE, BIRTH, OTHER_NOTE
	EventDate     string         `json:"event_date"`
	Summary       string         `json:"summary"`
	DusunID       string         `json:"dusun_id"`
	NoKK          string         `json:"no_kk"`
	Address       string         `json:"address"`
	MaritalStatus string         `json:"marital_status"`
	SHDK          string         `json:"shdk"`
	Metadata      map[string]any `json:"metadata"`
}

// RecordResidentEvent allows Operator Desa to directly record a demographic mutation/history event
// and atomically synchronize the resident's status, dusun/KK, or marital status.
func (s *Store) RecordResidentEvent(ctx context.Context, villageID, actorUserID, residentID string, in RecordEventInput) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var curStatus, curDusunID, curHHID string
	err = tx.QueryRow(ctx, `
SELECT status, COALESCE(dusun_id::text,''), COALESCE(household_id::text,'')
FROM residents
WHERE id=$1::uuid AND village_id=$2::uuid
FOR UPDATE`, residentID, villageID).Scan(&curStatus, &curDusunID, &curHHID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	evType := strings.ToUpper(strings.TrimSpace(in.EventType))
	evDate := strings.TrimSpace(in.EventDate)
	if evDate == "" {
		evDate = time.Now().Format("2006-01-02")
	}

	targetDusunID := strings.TrimSpace(in.DusunID)
	if targetDusunID == "" {
		targetDusunID = curDusunID
	}
	targetHHID := curHHID

	if len(strings.TrimSpace(in.NoKK)) == 16 {
		err = tx.QueryRow(ctx, `
INSERT INTO households (village_id, dusun_id, no_kk, address)
VALUES ($1::uuid, NULLIF($2,'')::uuid, $3, $4)
ON CONFLICT (village_id, no_kk) DO UPDATE
SET dusun_id = COALESCE(EXCLUDED.dusun_id, households.dusun_id),
    address  = CASE WHEN EXCLUDED.address <> '' AND EXCLUDED.address <> '-' THEN EXCLUDED.address ELSE households.address END,
    updated_at = NOW()
RETURNING id::text`,
			villageID, targetDusunID, strings.TrimSpace(in.NoKK), defaultStr(in.Address, "-")).Scan(&targetHHID)
		if err != nil {
			return err
		}
	}

	switch evType {
	case "DEATH":
		if _, err := tx.Exec(ctx, `
UPDATE residents SET status='MENINGGAL', updated_at=NOW()
WHERE id=$1::uuid AND village_id=$2::uuid`, residentID, villageID); err != nil {
			return err
		}
	case "MOVE_OUT":
		if _, err := tx.Exec(ctx, `
UPDATE residents SET status='PINDAH_KELUAR', updated_at=NOW()
WHERE id=$1::uuid AND village_id=$2::uuid`, residentID, villageID); err != nil {
			return err
		}
	case "MOVE_IN", "CHANGE_DUSUN":
		if _, err := tx.Exec(ctx, `
UPDATE residents SET
    status       = 'AKTIF',
    dusun_id     = NULLIF($1,'')::uuid,
    household_id = NULLIF($2,'')::uuid,
    shdk         = COALESCE(NULLIF($3,''), shdk),
    updated_at   = NOW()
WHERE id=$4::uuid AND village_id=$5::uuid`,
			targetDusunID, targetHHID, strings.ToUpper(strings.TrimSpace(in.SHDK)), residentID, villageID); err != nil {
			return err
		}
	case "MARRIAGE":
		ms := defaultStr(strings.ToUpper(strings.TrimSpace(in.MaritalStatus)), "KAWIN")
		if _, err := tx.Exec(ctx, `
UPDATE residents SET
    marital_status = $1,
    household_id   = NULLIF($2,'')::uuid,
    shdk           = COALESCE(NULLIF($3,''), shdk),
    updated_at     = NOW()
WHERE id=$4::uuid AND village_id=$5::uuid`,
			ms, targetHHID, strings.ToUpper(strings.TrimSpace(in.SHDK)), residentID, villageID); err != nil {
			return err
		}
	case "DIVORCE":
		ms := defaultStr(strings.ToUpper(strings.TrimSpace(in.MaritalStatus)), "CERAI HIDUP")
		if _, err := tx.Exec(ctx, `
UPDATE residents SET
    marital_status = $1,
    household_id   = NULLIF($2,'')::uuid,
    shdk           = COALESCE(NULLIF($3,''), shdk),
    updated_at     = NOW()
WHERE id=$4::uuid AND village_id=$5::uuid`,
			ms, targetHHID, strings.ToUpper(strings.TrimSpace(in.SHDK)), residentID, villageID); err != nil {
			return err
		}
	default:
		// BIRTH / OTHER_NOTE: optional dusun/KK update without changing active status unless needed
		if targetDusunID != curDusunID || targetHHID != curHHID {
			if _, err := tx.Exec(ctx, `
UPDATE residents SET
    dusun_id     = NULLIF($1,'')::uuid,
    household_id = NULLIF($2,'')::uuid,
    updated_at   = NOW()
WHERE id=$3::uuid AND village_id=$4::uuid`,
				targetDusunID, targetHHID, residentID, villageID); err != nil {
				return err
			}
		}
	}

	metaBytes, _ := json.Marshal(in.Metadata)
	if len(metaBytes) == 0 || string(metaBytes) == "null" {
		metaBytes = []byte("{}")
	}

	_, err = tx.Exec(ctx, `
INSERT INTO population_events (village_id, resident_id, event_type, event_date, summary, event_metadata, recorded_by)
VALUES ($1::uuid, $2::uuid, $3, $4::date, $5, $6::jsonb, NULLIF($7,'')::uuid)`,
		villageID, residentID, evType, evDate, strings.TrimSpace(in.Summary), string(metaBytes), actorUserID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// ImportSIAKResidents commits normalized SIAK Excel rows into households & residents inside a transaction.
func (s *Store) ImportSIAKResidents(ctx context.Context, villageID, actorUserID string, rows []importer.NormalizedResident) (int, error) {
	// Load dusun name -> id map for this village
	dusuns, err := s.ListDusuns(ctx, villageID)
	if err != nil {
		return 0, err
	}
	dusunMap := make(map[string]string, len(dusuns))
	for _, d := range dusuns {
		dusunMap[strings.ToUpper(d.Name)] = d.ID
	}

	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	hhCache := make(map[string]string)
	imported := 0

	for _, r := range rows {
		dusunID := dusunMap[strings.ToUpper(r.DusunName)]
		hhID, ok := hhCache[r.NoKK]
		if !ok {
			err := tx.QueryRow(ctx, `
INSERT INTO households (village_id, dusun_id, no_kk, address, postal_code)
VALUES ($1::uuid, NULLIF($2,'')::uuid, $3, $4, NULLIF($5,''))
ON CONFLICT (village_id, no_kk) DO UPDATE SET
    dusun_id = COALESCE(EXCLUDED.dusun_id, households.dusun_id),
    updated_at = NOW()
RETURNING id::text`,
				villageID, dusunID, r.NoKK, defaultStr(r.Address, "-"), r.PostalCode).Scan(&hhID)
			if err != nil {
				return imported, fmt.Errorf("baris %d (KK): %w", r.RowNumber, err)
			}
			hhCache[r.NoKK] = hhID
		}

		docsJSON, _ := json.Marshal(r.CivilDocs)
		if len(docsJSON) == 0 {
			docsJSON = []byte("{}")
		}

		var resID string
		var insertedNew bool
		err := tx.QueryRow(ctx, `
INSERT INTO residents (
    village_id, household_id, dusun_id, nik, full_name, gender, birth_place, birth_date,
    blood_type, religion, marital_status, shdk, education, occupation, father_name, mother_name,
    civil_docs, status
) VALUES (
    $1::uuid, $2::uuid, NULLIF($3,'')::uuid, $4, $5, $6, $7, $8::date,
    $9, $10, $11, $12, $13, $14, NULLIF($15,''), NULLIF($16,''), $17::jsonb, 'AKTIF'
)
ON CONFLICT (village_id, nik) DO UPDATE SET
    household_id = EXCLUDED.household_id,
    dusun_id = COALESCE(EXCLUDED.dusun_id, residents.dusun_id),
    full_name = EXCLUDED.full_name,
    marital_status = EXCLUDED.marital_status,
    shdk = EXCLUDED.shdk,
    education = EXCLUDED.education,
    occupation = EXCLUDED.occupation,
    civil_docs = EXCLUDED.civil_docs,
    updated_at = NOW()
RETURNING id::text, (xmax = 0)`,
			villageID, hhID, dusunID, r.NIK, r.FullName, r.Gender, r.BirthPlace, r.BirthDate,
			r.BloodType, r.Religion, r.MaritalStatus, r.SHDK, r.Education, r.Occupation,
			r.FatherName, r.MotherName, string(docsJSON)).Scan(&resID, &insertedNew)
		if err != nil {
			return imported, fmt.Errorf("baris %d (penduduk): %w", r.RowNumber, err)
		}

		if insertedNew {
			_, _ = tx.Exec(ctx, `
INSERT INTO population_events (village_id, resident_id, event_type, event_date, summary, recorded_by)
VALUES ($1::uuid, $2::uuid, 'INITIAL_IMPORT', CURRENT_DATE, 'Impor data kependudukan SIAK desa', NULLIF($3,'')::uuid)`,
				villageID, resID, actorUserID)
		}
		imported++
	}

	return imported, tx.Commit(ctx)
}

// --- Maker-Checker Submissions (T-203 & T-204) ---

type SubmissionItem struct {
	ID              string         `json:"id"`
	DusunID         string         `json:"dusun_id"`
	DusunName       string         `json:"dusun_name"`
	ResidentID      string         `json:"resident_id,omitempty"`
	SubmissionType  string         `json:"submission_type"`
	PayloadBefore   map[string]any `json:"payload_before,omitempty"`
	PayloadAfter    map[string]any `json:"payload_after"`
	Status          string         `json:"status"`
	SubmittedByName string         `json:"submitted_by_name"`
	ReviewedByName  string         `json:"reviewed_by_name,omitempty"`
	ReviewNotes     string         `json:"review_notes,omitempty"`
	CreatedAt       string         `json:"created_at"`
	ReviewedAt      string         `json:"reviewed_at,omitempty"`
}

type CreateSubmissionInput struct {
	VillageID      string
	DusunID        string
	ResidentID     string
	SubmissionType string
	PayloadAfter   map[string]any
	SubmittedBy    string
}

func (s *Store) CreateSubmission(ctx context.Context, in CreateSubmissionInput) (string, error) {
	var beforeBytes []byte
	if in.ResidentID != "" {
		// Verify resident belongs to this village & dusun before snapshotting!
		var snap ResidentItem
		err := s.Pool.QueryRow(ctx, `
SELECT r.id::text, r.nik, COALESCE(h.no_kk,''), r.full_name, r.gender,
       r.birth_place, to_char(r.birth_date,'YYYY-MM-DD'), r.religion, r.marital_status,
       r.shdk, COALESCE(r.education,''), COALESCE(r.occupation,''), r.status, COALESCE(r.dusun_id::text,'')
FROM residents r
LEFT JOIN households h ON h.id=r.household_id
WHERE r.id=$1::uuid AND r.village_id=$2::uuid`, in.ResidentID, in.VillageID).Scan(
			&snap.ID, &snap.NIK, &snap.NoKK, &snap.FullName, &snap.Gender,
			&snap.BirthPlace, &snap.BirthDate, &snap.Religion, &snap.MaritalStatus,
			&snap.SHDK, &snap.Education, &snap.Occupation, &snap.Status, &snap.DusunID)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		if err != nil {
			return "", err
		}
		if snap.DusunID != "" && snap.DusunID != in.DusunID {
			return "", errors.New("warga berada di luar dusun wewenang Anda")
		}
		beforeBytes, _ = json.Marshal(snap)
	}

	afterBytes, err := json.Marshal(in.PayloadAfter)
	if err != nil {
		return "", err
	}

	var subID string
	err = s.Pool.QueryRow(ctx, `
INSERT INTO population_submissions (
    village_id, dusun_id, resident_id, submission_type, payload_before, payload_after, submitted_by
) VALUES (
    $1::uuid, $2::uuid, NULLIF($3,'')::uuid, $4, NULLIF($5,'')::jsonb, $6::jsonb, $7::uuid
) RETURNING id::text`,
		in.VillageID, in.DusunID, in.ResidentID, in.SubmissionType, string(beforeBytes), string(afterBytes), in.SubmittedBy).Scan(&subID)
	return subID, err
}

func (s *Store) ListSubmissions(ctx context.Context, villageID, dusunScopeID, status string) ([]SubmissionItem, error) {
	rows, err := s.Pool.Query(ctx, `
SELECT ps.id::text, ps.dusun_id::text, d.name, COALESCE(ps.resident_id::text,''), ps.submission_type,
       COALESCE(ps.payload_before,'{}'::jsonb), ps.payload_after, ps.status,
       u1.full_name, COALESCE(u2.full_name,''), COALESCE(ps.review_notes,''),
       to_char(ps.created_at,'YYYY-MM-DD HH24:MI'), COALESCE(to_char(ps.reviewed_at,'YYYY-MM-DD HH24:MI'),'')
FROM population_submissions ps
JOIN dusuns d ON d.id=ps.dusun_id
JOIN users u1 ON u1.id=ps.submitted_by
LEFT JOIN users u2 ON u2.id=ps.reviewed_by
WHERE ps.village_id=$1::uuid
  AND ($2 = '' OR ps.dusun_id = NULLIF($2,'')::uuid)
  AND ($3 = '' OR ps.status = $3)
ORDER BY ps.created_at DESC
LIMIT 100`, villageID, dusunScopeID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SubmissionItem
	for rows.Next() {
		var item SubmissionItem
		var bBefore, bAfter []byte
		if err := rows.Scan(&item.ID, &item.DusunID, &item.DusunName, &item.ResidentID, &item.SubmissionType,
			&bBefore, &bAfter, &item.Status, &item.SubmittedByName, &item.ReviewedByName, &item.ReviewNotes,
			&item.CreatedAt, &item.ReviewedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(bBefore, &item.PayloadBefore)
		_ = json.Unmarshal(bAfter, &item.PayloadAfter)
		out = append(out, item)
	}
	return out, rows.Err()
}

// ReviewSubmission atomically transitions a PENDING submission to APPROVED, REVISION_REQUESTED, or REJECTED.
// When APPROVED, it updates residents/households and appends an immutable population_events record.
func (s *Store) ReviewSubmission(ctx context.Context, villageID, submissionID, reviewerUserID, decision, notes string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var dusunID, residentID, subType, curStatus string
	var afterBytes []byte
	err = tx.QueryRow(ctx, `
SELECT dusun_id::text, COALESCE(resident_id::text,''), submission_type, status, payload_after
FROM population_submissions
WHERE id=$1::uuid AND village_id=$2::uuid
FOR UPDATE`, submissionID, villageID).Scan(&dusunID, &residentID, &subType, &curStatus, &afterBytes)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if curStatus != "PENDING" {
		return errors.New("usulan ini sudah pernah diproses sebelumnya")
	}

	if decision == "REVISION_REQUESTED" || decision == "REJECTED" {
		_, err = tx.Exec(ctx, `
UPDATE population_submissions
SET status=$1, reviewed_by=$2::uuid, review_notes=$3, reviewed_at=NOW()
WHERE id=$4::uuid`, decision, reviewerUserID, notes, submissionID)
		if err != nil {
			return err
		}
		return tx.Commit(ctx)
	}

	// decision == "APPROVED"
	var rawPayload map[string]any
	_ = json.Unmarshal(afterBytes, &rawPayload)
	payload := make(map[string]string, len(rawPayload))
	for k, v := range rawPayload {
		if v != nil {
			payload[k] = fmt.Sprint(v)
		}
	}

	if residentID == "" && len(strings.TrimSpace(payload["nik"])) == 16 {
		_ = tx.QueryRow(ctx, `
SELECT id::text FROM residents WHERE village_id=$1::uuid AND nik=$2`,
			villageID, strings.TrimSpace(payload["nik"])).Scan(&residentID)
	}

	eventDate := payload["event_date"]
	if eventDate == "" {
		eventDate = time.Now().Format("2006-01-02")
	}
	summary := payload["summary"]
	if summary == "" {
		summary = fmt.Sprintf("Usulan %s disetujui oleh Operator Desa", subType)
	}

	switch subType {
	case "DEATH":
		if residentID == "" {
			return errors.New("resident_id wajib untuk laporan kematian")
		}
		// Soft status transition per BR-F02-03: never hard-delete deceased residents!
		if _, err := tx.Exec(ctx, `
UPDATE residents SET status='MENINGGAL', updated_at=NOW()
WHERE id=$1::uuid AND village_id=$2::uuid`, residentID, villageID); err != nil {
			return err
		}

	case "MOVE_OUT":
		if residentID == "" {
			return errors.New("resident_id wajib untuk laporan pindah keluar")
		}
		if _, err := tx.Exec(ctx, `
UPDATE residents SET status='PINDAH_KELUAR', updated_at=NOW()
WHERE id=$1::uuid AND village_id=$2::uuid`, residentID, villageID); err != nil {
			return err
		}

	case "NEW_RESIDENT", "BIRTH", "MOVE_IN":
		nik := payload["nik"]
		noKK := payload["no_kk"]
		fullName := payload["full_name"]
		if len(nik) == 16 && len(noKK) == 16 && fullName != "" {
			var hhID string
			if err := tx.QueryRow(ctx, `
INSERT INTO households (village_id, dusun_id, no_kk, address)
VALUES ($1::uuid, $2::uuid, $3, $4)
ON CONFLICT (village_id, no_kk) DO UPDATE SET updated_at=NOW()
RETURNING id::text`, villageID, dusunID, noKK, defaultStr(payload["address"], "-")).Scan(&hhID); err != nil {
				return err
			}
			bDate := defaultStr(payload["birth_date"], eventDate)
			gender := defaultStr(payload["gender"], "L")
			shdk := defaultStr(payload["shdk"], "ANAK")
			if subType != "BIRTH" && payload["shdk"] == "" {
				shdk = "FAMILI LAIN"
			}
			if err := tx.QueryRow(ctx, `
INSERT INTO residents (
    village_id, household_id, dusun_id, nik, full_name, gender, birth_place, birth_date,
    religion, marital_status, shdk, education, occupation, status
) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, $13, 'AKTIF')
ON CONFLICT (village_id, nik) DO UPDATE SET full_name=EXCLUDED.full_name, status='AKTIF', updated_at=NOW()
RETURNING id::text`,
				villageID, hhID, dusunID, nik, fullName, gender,
				defaultStr(payload["birth_place"], "-"), bDate,
				defaultStr(payload["religion"], "Hindu"),
				defaultStr(payload["marital_status"], "BELUM KAWIN"),
				shdk, defaultStr(payload["education"], "TIDAK/BELUM SEKOLAH"),
				defaultStr(payload["occupation"], "BELUM/TIDAK BEKERJA")).Scan(&residentID); err != nil {
				return err
			}
		}

	case "UPDATE_BIODATA", "MARRIAGE", "DIVORCE":
		if residentID != "" {
			if _, err := tx.Exec(ctx, `
UPDATE residents SET
    marital_status = COALESCE(NULLIF($1,''), marital_status),
    education      = COALESCE(NULLIF($2,''), education),
    occupation     = COALESCE(NULLIF($3,''), occupation),
    shdk           = COALESCE(NULLIF($4,''), shdk),
    updated_at     = NOW()
WHERE id=$5::uuid AND village_id=$6::uuid`,
				payload["marital_status"], payload["education"], payload["occupation"],
				strings.ToUpper(payload["shdk"]), residentID, villageID); err != nil {
				return err
			}
		}
	}

	if _, err := tx.Exec(ctx, `
UPDATE population_submissions
SET status='APPROVED', resident_id=NULLIF($1,'')::uuid, reviewed_by=$2::uuid, review_notes=$3, reviewed_at=NOW()
WHERE id=$4::uuid`, residentID, reviewerUserID, notes, submissionID); err != nil {
		return err
	}

	if residentID != "" {
		if _, err := tx.Exec(ctx, `
INSERT INTO population_events (village_id, resident_id, submission_id, event_type, event_date, summary, event_metadata, recorded_by)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::date, $6, $7::jsonb, $8::uuid)`,
			villageID, residentID, submissionID, subType, eventDate, summary, string(afterBytes), reviewerUserID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func defaultStr(s, fallback string) string {
	if strings.TrimSpace(s) == "" {
		return fallback
	}
	return strings.TrimSpace(s)
}
