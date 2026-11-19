package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type GuestbookEntry struct {
	ID                   string `json:"id"`
	VillageID            string `json:"village_id"`
	ResidentID           string `json:"resident_id,omitempty"`
	IdentificationMethod string `json:"identification_method"` // RFID | NIK | MANUAL
	RFIDUID              string `json:"rfid_uid,omitempty"`
	NIK                  string `json:"nik,omitempty"`
	FullName             string `json:"full_name"`
	DusunName            string `json:"dusun_name,omitempty"`
	Address              string `json:"address,omitempty"`
	Phone                string `json:"phone,omitempty"`
	Institution          string `json:"institution,omitempty"`
	PurposeCategory      string `json:"purpose_category"`
	PurposeDetail        string `json:"purpose_detail"`
	TargetOfficial       string `json:"target_official"`
	ServiceRating        int    `json:"service_rating,omitempty"`
	FeedbackImpression   string `json:"feedback_impression,omitempty"`
	CheckinAt            string `json:"checkin_at"`
}

type GuestbookStats struct {
	Total       int     `json:"total"`
	Today       int     `json:"today"`
	RFIDCount   int     `json:"rfid_count"`
	NIKCount    int     `json:"nik_count"`
	ManualCount int     `json:"manual_count"`
	RatedCount  int     `json:"rated_count"`
	AvgRating   float64 `json:"avg_rating"`
}

func (s *Store) ensureGuestbookFeedbackColumns(ctx context.Context) {
	_, _ = s.Pool.Exec(ctx, `
		ALTER TABLE guestbook_entries
			ADD COLUMN IF NOT EXISTS service_rating SMALLINT CHECK (service_rating BETWEEN 1 AND 5),
			ADD COLUMN IF NOT EXISTS feedback_impression TEXT,
			ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ
	`)
}

type CreateGuestbookInput struct {
	IdentificationMethod string `json:"identification_method"` // RFID | NIK | MANUAL
	RFIDUID              string `json:"rfid_uid"`
	NIK                  string `json:"nik"`
	ResidentID           string `json:"resident_id"`
	FullName             string `json:"full_name"`
	DusunName            string `json:"dusun_name"`
	Address              string `json:"address"`
	Phone                string `json:"phone"`
	Institution          string `json:"institution"`
	PurposeCategory      string `json:"purpose_category"`
	PurposeDetail        string `json:"purpose_detail"`
	TargetOfficial       string `json:"target_official"`
}

func (s *Store) ensureDemoRFIDMappings(ctx context.Context, villageID string) {
	// Pastikan data KTP Ketua Pelaksana / Demo Utama (I KETUT RESIKA ARTHANA — NIK: 5108020112840001)
	// selalu terdaftar di database Desa Ringdikit (Banjar Dinas Kelodan) agar saat fisik KTP-el
	// dipindai lewat Kamera Kiosk maupun RFID selalu ditemukan 100% akurat.
	var kelodanID string
	_ = s.Pool.QueryRow(ctx, `
		SELECT id::text FROM dusuns
		WHERE village_id = $1::uuid AND LOWER(name) = 'kelodan'
		LIMIT 1
	`, villageID).Scan(&kelodanID)

	if kelodanID != "" {
		var hhID string
		_ = s.Pool.QueryRow(ctx, `
			INSERT INTO households (village_id, dusun_id, no_kk, address, rt, rw, postal_code)
			VALUES ($1::uuid, $2::uuid, '5108020112840000', 'BANJAR DINAS KELODAN, DESA RINGDIKIT', '000', '000', '81153')
			ON CONFLICT (village_id, no_kk) DO UPDATE
			SET dusun_id = EXCLUDED.dusun_id,
			    updated_at = NOW()
			RETURNING id::text
		`, villageID, kelodanID).Scan(&hhID)

		if hhID != "" {
			_, _ = s.Pool.Exec(ctx, `
				INSERT INTO residents (
					village_id, household_id, dusun_id, nik, full_name, gender,
					birth_place, birth_date, blood_type, religion, marital_status,
					shdk, education, occupation, status, rfid_uid
				) VALUES (
					$1::uuid, $2::uuid, $3::uuid,
					'5108020112840001', 'I KETUT RESIKA ARTHANA', 'L',
					'RINGDIKIT', '1984-12-01'::date, '-', 'HINDU', 'KAWIN',
					'KEPALA KELUARGA', 'S3', 'DOSEN', 'AKTIF', '04A28F00'
				)
				ON CONFLICT (village_id, nik) DO UPDATE SET
					full_name = EXCLUDED.full_name,
					dusun_id = EXCLUDED.dusun_id,
					birth_place = EXCLUDED.birth_place,
					birth_date = EXCLUDED.birth_date,
					religion = EXCLUDED.religion,
					marital_status = EXCLUDED.marital_status,
					occupation = EXCLUDED.occupation,
					status = 'AKTIF',
					rfid_uid = COALESCE(NULLIF(residents.rfid_uid, ''), '04A28F00')
			`, villageID, hhID, kelodanID)
		}
	}

	var count int
	_ = s.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM residents
		WHERE village_id = $1::uuid AND COALESCE(rfid_uid, '') <> ''
	`, villageID).Scan(&count)
	if count > 1 {
		return
	}
	_, _ = s.Pool.Exec(ctx, `
		WITH sample_residents AS (
			SELECT id, ROW_NUMBER() OVER (ORDER BY full_name ASC) AS rn
			FROM residents
			WHERE village_id = $1::uuid AND status = 'AKTIF' AND COALESCE(rfid_uid, '') = ''
			LIMIT 6
		)
		UPDATE residents r
		SET rfid_uid = '04A28F0' || sr.rn::text,
		    updated_at = NOW()
		FROM sample_residents sr
		WHERE r.id = sr.id
	`, villageID)
}

func (s *Store) LookupResidentByRFIDOrNIK(ctx context.Context, villageID, rfidUID, nik string) (*ResidentItem, error) {
	s.ensureDemoRFIDMappings(ctx, villageID)

	rfidUID = strings.ToUpper(strings.TrimSpace(rfidUID))
	nik = strings.TrimSpace(nik)
	if rfidUID == "" && nik == "" {
		return nil, ErrNotFound
	}

	var r ResidentItem
	err := s.Pool.QueryRow(ctx, `
		SELECT r.id::text, r.nik, COALESCE(h.no_kk,''), r.full_name, r.gender,
		       r.birth_place, to_char(r.birth_date,'YYYY-MM-DD'), COALESCE(r.blood_type,'-'),
		       r.religion, r.marital_status, r.shdk, COALESCE(r.education,''), COALESCE(r.occupation,''),
		       COALESCE(r.father_name,''), COALESCE(r.mother_name,''),
		       COALESCE(r.dusun_id::text,''), COALESCE(d.name,''), COALESCE(h.address,''), r.status,
		       COALESCE(r.rfid_uid,'')
		FROM residents r
		LEFT JOIN households h ON h.id = r.household_id
		LEFT JOIN dusuns d ON d.id = r.dusun_id
		WHERE r.village_id = $1::uuid
		  AND (
		      ($2 <> '' AND UPPER(COALESCE(r.rfid_uid, '')) = $2)
		      OR ($3 <> '' AND r.nik = $3)
		  )
		LIMIT 1
	`, villageID, rfidUID, nik).Scan(
		&r.ID, &r.NIK, &r.NoKK, &r.FullName, &r.Gender,
		&r.BirthPlace, &r.BirthDate, &r.BloodType, &r.Religion, &r.MaritalStatus,
		&r.SHDK, &r.Education, &r.Occupation, &r.FatherName, &r.MotherName,
		&r.DusunID, &r.DusunName, &r.Address, &r.Status, &r.RFIDUID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *Store) ListRFIDMappings(ctx context.Context, villageID, search string, limit int) ([]ResidentItem, int, error) {
	s.ensureDemoRFIDMappings(ctx, villageID)
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	search = strings.TrimSpace(search)

	var totalMapped int
	_ = s.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM residents
		WHERE village_id = $1::uuid AND COALESCE(rfid_uid, '') <> ''
	`, villageID).Scan(&totalMapped)

	rows, err := s.Pool.Query(ctx, `
		SELECT r.id::text, r.nik, COALESCE(h.no_kk,''), r.full_name, r.gender,
		       r.birth_place, to_char(r.birth_date,'YYYY-MM-DD'), COALESCE(r.blood_type,'-'),
		       r.religion, r.marital_status, r.shdk, COALESCE(r.education,''), COALESCE(r.occupation,''),
		       COALESCE(r.father_name,''), COALESCE(r.mother_name,''),
		       COALESCE(r.dusun_id::text,''), COALESCE(d.name,''), COALESCE(h.address,''), r.status,
		       COALESCE(r.rfid_uid,'')
		FROM residents r
		LEFT JOIN households h ON h.id = r.household_id
		LEFT JOIN dusuns d ON d.id = r.dusun_id
		WHERE r.village_id = $1::uuid
		  AND COALESCE(r.rfid_uid, '') <> ''
		  AND (
		      $2 = ''
		      OR r.rfid_uid ILIKE '%' || $2 || '%'
		      OR r.nik ILIKE '%' || $2 || '%'
		      OR r.full_name ILIKE '%' || $2 || '%'
		      OR COALESCE(d.name, '') ILIKE '%' || $2 || '%'
		  )
		ORDER BY r.updated_at DESC, r.full_name ASC
		LIMIT $3
	`, villageID, search, limit)
	if err != nil {
		return nil, totalMapped, err
	}
	defer rows.Close()

	list := make([]ResidentItem, 0)
	for rows.Next() {
		var r ResidentItem
		if err := rows.Scan(
			&r.ID, &r.NIK, &r.NoKK, &r.FullName, &r.Gender,
			&r.BirthPlace, &r.BirthDate, &r.BloodType, &r.Religion, &r.MaritalStatus,
			&r.SHDK, &r.Education, &r.Occupation, &r.FatherName, &r.MotherName,
			&r.DusunID, &r.DusunName, &r.Address, &r.Status, &r.RFIDUID,
		); err != nil {
			return nil, totalMapped, err
		}
		list = append(list, r)
	}
	return list, totalMapped, rows.Err()
}

func (s *Store) BindResidentRFID(ctx context.Context, villageID, actorUserID, residentID, rfidUID string) (*ResidentItem, error) {
	cleanRFID := strings.ToUpper(strings.TrimSpace(rfidUID))
	residentID = strings.TrimSpace(residentID)
	if residentID == "" {
		return nil, fmt.Errorf("warga wajib dipilih terlebih dahulu")
	}

	if cleanRFID != "" {
		var existingName, existingNIK string
		err := s.Pool.QueryRow(ctx, `
			SELECT full_name, nik
			FROM residents
			WHERE village_id = $1::uuid
			  AND UPPER(COALESCE(rfid_uid, '')) = $2
			  AND id <> $3::uuid
			LIMIT 1
		`, villageID, cleanRFID, residentID).Scan(&existingName, &existingNIK)
		if err == nil {
			return nil, fmt.Errorf("ID Kartu RFID %s sudah terhubung pada warga %s (NIK: %s)", cleanRFID, existingName, existingNIK)
		}
	}

	cmd, err := s.Pool.Exec(ctx, `
		UPDATE residents
		SET rfid_uid = NULLIF($3, ''),
		    updated_at = NOW()
		WHERE village_id = $1::uuid AND id = $2::uuid
	`, villageID, residentID, cleanRFID)
	if err != nil {
		return nil, err
	}
	if cmd.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	summary := fmt.Sprintf("Pemetaan ID Kartu RFID KTP-el dilepas dari data warga")
	if cleanRFID != "" {
		summary = fmt.Sprintf("Kartu RFID KTP-el berhasil dipetakan ke NIK warga (UID RFID: %s)", cleanRFID)
	}
	metaBytes, _ := json.Marshal(map[string]any{
		"rfid_uid": cleanRFID,
	})
	_, _ = s.Pool.Exec(ctx, `
		INSERT INTO population_events (
			village_id, resident_id, event_type, event_date, summary, event_metadata, recorded_by
		) VALUES (
			$1::uuid, $2::uuid, 'RFID_PAIRED', CURRENT_DATE, $3, $4::jsonb, NULLIF($5, '')::uuid
		)
	`, villageID, residentID, summary, string(metaBytes), actorUserID)

	det, err := s.GetResidentDetail(ctx, villageID, "", residentID)
	if err != nil {
		return nil, err
	}
	return &det.ResidentItem, nil
}

func (s *Store) ListGuestbookEntries(ctx context.Context, villageID, search, methodFilter string, limit int) ([]GuestbookEntry, GuestbookStats, error) {
	s.ensureGuestbookFeedbackColumns(ctx)
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var stats GuestbookStats
	_ = s.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE checkin_at::date = CURRENT_DATE),
			COUNT(*) FILTER (WHERE identification_method = 'RFID'),
			COUNT(*) FILTER (WHERE identification_method = 'NIK'),
			COUNT(*) FILTER (WHERE identification_method = 'MANUAL'),
			COUNT(*) FILTER (WHERE service_rating IS NOT NULL AND service_rating > 0),
			COALESCE(ROUND(AVG(service_rating)::numeric, 1), 0)::float8
		FROM guestbook_entries
		WHERE village_id = $1::uuid
	`, villageID).Scan(&stats.Total, &stats.Today, &stats.RFIDCount, &stats.NIKCount, &stats.ManualCount, &stats.RatedCount, &stats.AvgRating)

	rows, err := s.Pool.Query(ctx, `
		SELECT
			id::text,
			village_id::text,
			COALESCE(resident_id::text, ''),
			identification_method,
			COALESCE(rfid_uid, ''),
			COALESCE(nik, ''),
			full_name,
			COALESCE(dusun_name, ''),
			COALESCE(address, ''),
			COALESCE(phone, ''),
			COALESCE(institution, ''),
			purpose_category,
			purpose_detail,
			target_official,
			COALESCE(service_rating, 0),
			COALESCE(feedback_impression, ''),
			TO_CHAR(checkin_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM guestbook_entries
		WHERE village_id = $1::uuid
		  AND ($2 = '' OR identification_method = UPPER($2))
		  AND (
		      $3 = ''
		      OR full_name ILIKE '%' || $3 || '%'
		      OR COALESCE(nik, '') ILIKE '%' || $3 || '%'
		      OR COALESCE(rfid_uid, '') ILIKE '%' || $3 || '%'
		      OR COALESCE(dusun_name, '') ILIKE '%' || $3 || '%'
		      OR purpose_detail ILIKE '%' || $3 || '%'
		      OR target_official ILIKE '%' || $3 || '%'
		      OR COALESCE(feedback_impression, '') ILIKE '%' || $3 || '%'
		  )
		ORDER BY checkin_at DESC
		LIMIT $4
	`, villageID, strings.TrimSpace(methodFilter), strings.TrimSpace(search), limit)
	if err != nil {
		return nil, stats, err
	}
	defer rows.Close()

	list := make([]GuestbookEntry, 0)
	for rows.Next() {
		var g GuestbookEntry
		if err := rows.Scan(
			&g.ID,
			&g.VillageID,
			&g.ResidentID,
			&g.IdentificationMethod,
			&g.RFIDUID,
			&g.NIK,
			&g.FullName,
			&g.DusunName,
			&g.Address,
			&g.Phone,
			&g.Institution,
			&g.PurposeCategory,
			&g.PurposeDetail,
			&g.TargetOfficial,
			&g.ServiceRating,
			&g.FeedbackImpression,
			&g.CheckinAt,
		); err != nil {
			return nil, stats, err
		}
		list = append(list, g)
	}
	return list, stats, rows.Err()
}

func (s *Store) SubmitGuestbookFeedback(ctx context.Context, villageID, entryID string, rating int, impression string) (*GuestbookEntry, error) {
	s.ensureGuestbookFeedbackColumns(ctx)
	entryID = strings.TrimSpace(entryID)
	if entryID == "" {
		return nil, fmt.Errorf("id kunjungan buku tamu wajib diisi")
	}
	if rating < 1 || rating > 5 {
		return nil, fmt.Errorf("rating layanan wajib bernilai antara 1 sampai 5 bintang")
	}
	impression = strings.TrimSpace(impression)

	var g GuestbookEntry
	err := s.Pool.QueryRow(ctx, `
		UPDATE guestbook_entries
		SET service_rating = $3,
		    feedback_impression = NULLIF($4, ''),
		    rated_at = NOW()
		WHERE village_id = $1::uuid AND id = $2::uuid
		RETURNING
			id::text,
			village_id::text,
			COALESCE(resident_id::text, ''),
			identification_method,
			COALESCE(rfid_uid, ''),
			COALESCE(nik, ''),
			full_name,
			COALESCE(dusun_name, ''),
			COALESCE(address, ''),
			COALESCE(phone, ''),
			COALESCE(institution, ''),
			purpose_category,
			purpose_detail,
			target_official,
			COALESCE(service_rating, 0),
			COALESCE(feedback_impression, ''),
			TO_CHAR(checkin_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
	`, villageID, entryID, rating, impression).Scan(
		&g.ID,
		&g.VillageID,
		&g.ResidentID,
		&g.IdentificationMethod,
		&g.RFIDUID,
		&g.NIK,
		&g.FullName,
		&g.DusunName,
		&g.Address,
		&g.Phone,
		&g.Institution,
		&g.PurposeCategory,
		&g.PurposeDetail,
		&g.TargetOfficial,
		&g.ServiceRating,
		&g.FeedbackImpression,
		&g.CheckinAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *Store) CreateGuestbookEntry(ctx context.Context, villageID, actorUserID string, in CreateGuestbookInput) (*GuestbookEntry, error) {
	method := strings.ToUpper(strings.TrimSpace(in.IdentificationMethod))
	if method != "RFID" && method != "NIK" {
		method = "MANUAL"
	}

	rfidUID := strings.ToUpper(strings.TrimSpace(in.RFIDUID))
	nik := strings.TrimSpace(in.NIK)
	resID := strings.TrimSpace(in.ResidentID)
	fullName := strings.TrimSpace(in.FullName)
	dusunName := strings.TrimSpace(in.DusunName)
	address := strings.TrimSpace(in.Address)

	// Apabila menggunakan RFID atau NIK, tarik data dari tabel residents jika ada
	if method == "RFID" || method == "NIK" || resID != "" {
		if matched, err := s.LookupResidentByRFIDOrNIK(ctx, villageID, rfidUID, nik); err == nil && matched != nil {
			resID = matched.ID
			nik = matched.NIK
			if rfidUID == "" {
				rfidUID = matched.RFIDUID
			}
			if fullName == "" {
				fullName = matched.FullName
			}
			if dusunName == "" {
				dusunName = matched.DusunName
			}
			if address == "" {
				if matched.DusunName != "" {
					address = "BD. " + matched.DusunName + " Desa Ringdikit"
				} else {
					address = matched.Address
				}
			}
		}
	}

	if fullName == "" {
		return nil, fmt.Errorf("nama lengkap pengunjung wajib diisi")
	}

	purposeCategory := strings.TrimSpace(in.PurposeCategory)
	if purposeCategory == "" {
		purposeCategory = "Pelayanan Administrasi"
	}
	purposeDetail := strings.TrimSpace(in.PurposeDetail)
	if purposeDetail == "" {
		purposeDetail = purposeCategory
	}
	targetOfficial := strings.TrimSpace(in.TargetOfficial)
	if targetOfficial == "" {
		targetOfficial = "Perangkat Desa / Loket Pelayanan"
	}

	var entry GuestbookEntry
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO guestbook_entries (
			village_id, resident_id, identification_method, rfid_uid, nik,
			full_name, dusun_name, address, phone, institution,
			purpose_category, purpose_detail, target_official, checkin_at
		) VALUES (
			$1::uuid, NULLIF($2, '')::uuid, $3, NULLIF($4, ''), NULLIF($5, ''),
			$6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''),
			$11, $12, $13, NOW()
		)
		RETURNING
			id::text,
			village_id::text,
			COALESCE(resident_id::text, ''),
			identification_method,
			COALESCE(rfid_uid, ''),
			COALESCE(nik, ''),
			full_name,
			COALESCE(dusun_name, ''),
			COALESCE(address, ''),
			COALESCE(phone, ''),
			COALESCE(institution, ''),
			purpose_category,
			purpose_detail,
			target_official,
			TO_CHAR(checkin_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
	`,
		villageID, resID, method, rfidUID, nik,
		fullName, dusunName, address, strings.TrimSpace(in.Phone), strings.TrimSpace(in.Institution),
		purposeCategory, purposeDetail, targetOfficial,
	).Scan(
		&entry.ID,
		&entry.VillageID,
		&entry.ResidentID,
		&entry.IdentificationMethod,
		&entry.RFIDUID,
		&entry.NIK,
		&entry.FullName,
		&entry.DusunName,
		&entry.Address,
		&entry.Phone,
		&entry.Institution,
		&entry.PurposeCategory,
		&entry.PurposeDetail,
		&entry.TargetOfficial,
		&entry.CheckinAt,
	)
	if err != nil {
		return nil, err
	}

	// Apabila pengunjung adalah warga desa yang terdaftar, catat juga kunjungannya ke Timeline Historis Warga!
	if entry.ResidentID != "" {
		metaBytes, _ := json.Marshal(map[string]any{
			"guestbook_id":          entry.ID,
			"identification_method": entry.IdentificationMethod,
			"rfid_uid":              entry.RFIDUID,
			"target_official":       entry.TargetOfficial,
			"purpose_category":      entry.PurposeCategory,
		})
		evSummary := fmt.Sprintf("Kunjungan Buku Tamu Kantor Desa (via %s) — Bertemu: %s — Keperluan: %s", entry.IdentificationMethod, entry.TargetOfficial, entry.PurposeDetail)
		_, _ = s.Pool.Exec(ctx, `
			INSERT INTO population_events (
				village_id, resident_id, event_type, event_date, summary, event_metadata, recorded_by
			) VALUES (
				$1::uuid, $2::uuid, 'GUESTBOOK_CHECKIN', CURRENT_DATE, $3, $4::jsonb, NULLIF($5, '')::uuid
			)
		`, villageID, entry.ResidentID, evSummary, string(metaBytes), actorUserID)
	}

	return &entry, nil
}
