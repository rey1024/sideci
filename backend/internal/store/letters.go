package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/rey1024/sideci/backend/internal/docgen"
	"github.com/rey1024/sideci/backend/internal/domain"
)

type LetterRecord struct {
	ID                  string         `json:"id"`
	VillageID           string         `json:"village_id"`
	TemplateID          string         `json:"template_id"`
	TemplateCode        string         `json:"template_code"`
	TemplateTitle       string         `json:"template_title"`
	ClassificationCode  string         `json:"classification_code"`
	TicketCode          string         `json:"ticket_code"`
	LetterNumber        string         `json:"letter_number"`
	ApplicantResidentID string         `json:"applicant_resident_id,omitempty"`
	ApplicantNIK        string         `json:"applicant_nik"`
	ApplicantName       string         `json:"applicant_name"`
	ApplicantDusun      string         `json:"applicant_dusun"`
	ApplicantWA         string         `json:"applicant_wa,omitempty"`
	Source              string         `json:"source"`
	Purpose             string         `json:"purpose"`
	DynamicPayload      map[string]any `json:"dynamic_payload"`
	Status              string         `json:"status"`
	VerifyQRToken       string         `json:"verify_qr_token"`
	SignedPDFKey        string         `json:"signed_pdf_key,omitempty"`
	HasSignedFile       bool           `json:"has_signed_file"`
	SignatureType       string         `json:"signature_type,omitempty"`
	SignedFileName      string         `json:"signed_file_name,omitempty"`
	SignedUploadedAt    string         `json:"signed_uploaded_at,omitempty"`
	SignedNotes         string         `json:"signed_notes,omitempty"`
	LeaderName          string         `json:"leader_name"`
	LeaderTitle         string         `json:"leader_title"`
	IssuedAt            string         `json:"issued_at,omitempty"`
	CreatedAt           string         `json:"created_at"`
}

type LetterStats struct {
	Total             int `json:"total"`
	AwaitingSignature int `json:"awaiting_signature"`
	CompletedSigned   int `json:"completed_signed"`
	PublicQueue       int `json:"public_queue"`
}

type CreateLetterInput struct {
	TemplateCode   string         `json:"template_code"`
	LetterNumber   string         `json:"letter_number"`
	ApplicantNIK   string         `json:"applicant_nik"`
	ApplicantWA    string         `json:"applicant_wa"`
	Source         string         `json:"source"` // WALK_IN | PUBLIC_FORM
	Purpose        string         `json:"purpose"`
	DynamicPayload map[string]any `json:"dynamic_payload"`
}

func randomHexToken(bytesLen int) string {
	b := make([]byte, bytesLen)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func romanMonth(m time.Month) string {
	romans := []string{"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"}
	if int(m) >= 1 && int(m) <= 12 {
		return romans[int(m)]
	}
	return "I"
}

func indonesianDateStr(t time.Time) string {
	months := []string{
		"", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
		"Juli", "Agustus", "September", "Oktober", "November", "Desember",
	}
	m := int(t.Month())
	mName := "Januari"
	if m >= 1 && m <= 12 {
		mName = months[m]
	}
	return fmt.Sprintf("%02d %s %d", t.Day(), mName, t.Year())
}

func strFromMap(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprintf("%v", v))
}

func (s *Store) ListLetters(ctx context.Context, villageID, statusFilter, search string, limit int) ([]LetterRecord, LetterStats, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var stats LetterStats
	_ = s.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'VERIFIED', 'AWAITING_SIGNATURE')),
			COUNT(*) FILTER (WHERE status = 'COMPLETED' OR COALESCE(signed_pdf_key, '') <> ''),
			COUNT(*) FILTER (WHERE source = 'PUBLIC_FORM' AND status = 'SUBMITTED')
		FROM letter_requests
		WHERE village_id = $1
	`, villageID).Scan(&stats.Total, &stats.AwaitingSignature, &stats.CompletedSigned, &stats.PublicQueue)

	rows, err := s.Pool.Query(ctx, `
		SELECT
			lr.id::text,
			lr.village_id::text,
			lr.template_id::text,
			lt.code,
			lt.title,
			lt.classification_code,
			lr.ticket_code,
			COALESCE(lr.letter_number, ''),
			COALESCE(lr.applicant_resident_id::text, ''),
			COALESCE(r.nik, COALESCE(lr.dynamic_payload->>'applicant_nik', '')),
			COALESCE(r.full_name, COALESCE(lr.dynamic_payload->>'applicant_name', '')),
			COALESCE(d.name, COALESCE(lr.dynamic_payload->>'applicant_dusun', '')),
			COALESCE(lr.applicant_wa, ''),
			lr.source,
			lr.purpose,
			lr.dynamic_payload,
			lr.status,
			lr.verify_qr_token,
			COALESCE(lr.signed_pdf_key, ''),
			v.leader_name,
			v.leader_title,
			COALESCE(TO_CHAR(lr.issued_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), ''),
			TO_CHAR(lr.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM letter_requests lr
		JOIN letter_templates lt ON lt.id = lr.template_id
		JOIN villages v ON v.id = lr.village_id
		LEFT JOIN residents r ON r.id = lr.applicant_resident_id
		LEFT JOIN dusuns d ON d.id = r.dusun_id
		WHERE lr.village_id = $1
		  AND ($2 = '' OR lr.status = $2)
		  AND (
		      $3 = ''
		      OR lr.ticket_code ILIKE '%' || $3 || '%'
		      OR COALESCE(lr.letter_number, '') ILIKE '%' || $3 || '%'
		      OR COALESCE(r.full_name, lr.dynamic_payload->>'applicant_name', '') ILIKE '%' || $3 || '%'
		      OR COALESCE(r.nik, lr.dynamic_payload->>'applicant_nik', '') ILIKE '%' || $3 || '%'
		      OR lt.title ILIKE '%' || $3 || '%'
		  )
		ORDER BY lr.created_at DESC
		LIMIT $4
	`, villageID, strings.TrimSpace(statusFilter), strings.TrimSpace(search), limit)
	if err != nil {
		return nil, stats, err
	}
	defer rows.Close()

	list := make([]LetterRecord, 0)
	for rows.Next() {
		var rec LetterRecord
		var rawPayload []byte
		if err := rows.Scan(
			&rec.ID,
			&rec.VillageID,
			&rec.TemplateID,
			&rec.TemplateCode,
			&rec.TemplateTitle,
			&rec.ClassificationCode,
			&rec.TicketCode,
			&rec.LetterNumber,
			&rec.ApplicantResidentID,
			&rec.ApplicantNIK,
			&rec.ApplicantName,
			&rec.ApplicantDusun,
			&rec.ApplicantWA,
			&rec.Source,
			&rec.Purpose,
			&rawPayload,
			&rec.Status,
			&rec.VerifyQRToken,
			&rec.SignedPDFKey,
			&rec.LeaderName,
			&rec.LeaderTitle,
			&rec.IssuedAt,
			&rec.CreatedAt,
		); err != nil {
			return nil, stats, err
		}
		rec.DynamicPayload = map[string]any{}
		_ = json.Unmarshal(rawPayload, &rec.DynamicPayload)
		rec.HasSignedFile = strings.TrimSpace(rec.SignedPDFKey) != ""
		rec.SignatureType = strFromMap(rec.DynamicPayload, "signature_type")
		rec.SignedFileName = strFromMap(rec.DynamicPayload, "signed_file_name")
		rec.SignedUploadedAt = strFromMap(rec.DynamicPayload, "signed_uploaded_at")
		rec.SignedNotes = strFromMap(rec.DynamicPayload, "signed_notes")
		list = append(list, rec)
	}
	return list, stats, nil
}

func (s *Store) GetLetterByID(ctx context.Context, villageID, letterID string) (*LetterRecord, error) {
	var rec LetterRecord
	var rawPayload []byte
	err := s.Pool.QueryRow(ctx, `
		SELECT
			lr.id::text,
			lr.village_id::text,
			lr.template_id::text,
			lt.code,
			lt.title,
			lt.classification_code,
			lr.ticket_code,
			COALESCE(lr.letter_number, ''),
			COALESCE(lr.applicant_resident_id::text, ''),
			COALESCE(r.nik, COALESCE(lr.dynamic_payload->>'applicant_nik', '')),
			COALESCE(r.full_name, COALESCE(lr.dynamic_payload->>'applicant_name', '')),
			COALESCE(d.name, COALESCE(lr.dynamic_payload->>'applicant_dusun', '')),
			COALESCE(lr.applicant_wa, ''),
			lr.source,
			lr.purpose,
			lr.dynamic_payload,
			lr.status,
			lr.verify_qr_token,
			COALESCE(lr.signed_pdf_key, ''),
			v.leader_name,
			v.leader_title,
			COALESCE(TO_CHAR(lr.issued_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), ''),
			TO_CHAR(lr.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM letter_requests lr
		JOIN letter_templates lt ON lt.id = lr.template_id
		JOIN villages v ON v.id = lr.village_id
		LEFT JOIN residents r ON r.id = lr.applicant_resident_id
		LEFT JOIN dusuns d ON d.id = r.dusun_id
		WHERE lr.village_id = $1 AND lr.id = $2::uuid
	`, villageID, letterID).Scan(
		&rec.ID,
		&rec.VillageID,
		&rec.TemplateID,
		&rec.TemplateCode,
		&rec.TemplateTitle,
		&rec.ClassificationCode,
		&rec.TicketCode,
		&rec.LetterNumber,
		&rec.ApplicantResidentID,
		&rec.ApplicantNIK,
		&rec.ApplicantName,
		&rec.ApplicantDusun,
		&rec.ApplicantWA,
		&rec.Source,
		&rec.Purpose,
		&rawPayload,
		&rec.Status,
		&rec.VerifyQRToken,
		&rec.SignedPDFKey,
		&rec.LeaderName,
		&rec.LeaderTitle,
		&rec.IssuedAt,
		&rec.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	rec.DynamicPayload = map[string]any{}
	_ = json.Unmarshal(rawPayload, &rec.DynamicPayload)
	rec.HasSignedFile = strings.TrimSpace(rec.SignedPDFKey) != ""
	rec.SignatureType = strFromMap(rec.DynamicPayload, "signature_type")
	rec.SignedFileName = strFromMap(rec.DynamicPayload, "signed_file_name")
	rec.SignedUploadedAt = strFromMap(rec.DynamicPayload, "signed_uploaded_at")
	rec.SignedNotes = strFromMap(rec.DynamicPayload, "signed_notes")
	return &rec, nil
}

func (s *Store) GetLetterByQRToken(ctx context.Context, qrToken string) (*LetterRecord, string, error) {
	var rec LetterRecord
	var rawPayload []byte
	var villageFull string
	err := s.Pool.QueryRow(ctx, `
		SELECT
			lr.id::text,
			lr.village_id::text,
			lt.code,
			lt.title,
			lr.ticket_code,
			COALESCE(lr.letter_number, ''),
			COALESCE(r.full_name, COALESCE(lr.dynamic_payload->>'applicant_name', 'Warga Desa')),
			lr.status,
			lr.verify_qr_token,
			COALESCE(lr.signed_pdf_key, ''),
			lr.dynamic_payload,
			v.leader_name,
			v.leader_title,
			v.name || ', Kec. ' || v.district || ', Kab. ' || v.regency,
			COALESCE(TO_CHAR(lr.issued_at, 'YYYY-MM-DD'), TO_CHAR(lr.created_at, 'YYYY-MM-DD'))
		FROM letter_requests lr
		JOIN letter_templates lt ON lt.id = lr.template_id
		JOIN villages v ON v.id = lr.village_id
		LEFT JOIN residents r ON r.id = lr.applicant_resident_id
		WHERE lr.verify_qr_token = $1
	`, strings.TrimSpace(qrToken)).Scan(
		&rec.ID,
		&rec.VillageID,
		&rec.TemplateCode,
		&rec.TemplateTitle,
		&rec.TicketCode,
		&rec.LetterNumber,
		&rec.ApplicantName,
		&rec.Status,
		&rec.VerifyQRToken,
		&rec.SignedPDFKey,
		&rawPayload,
		&rec.LeaderName,
		&rec.LeaderTitle,
		&villageFull,
		&rec.IssuedAt,
	)
	if err != nil {
		return nil, "", err
	}
	rec.DynamicPayload = map[string]any{}
	_ = json.Unmarshal(rawPayload, &rec.DynamicPayload)
	rec.HasSignedFile = strings.TrimSpace(rec.SignedPDFKey) != ""
	rec.SignatureType = strFromMap(rec.DynamicPayload, "signature_type")
	return &rec, villageFull, nil
}

func (s *Store) collectInvolvedResidentIDsTx(ctx context.Context, tx pgx.Tx, villageID, primaryResidentID string, payload map[string]any) []string {
	seenIDs := map[string]bool{}
	ordered := make([]string, 0, 6)
	addID := func(id string) {
		id = strings.TrimSpace(id)
		if id != "" && !seenIDs[id] {
			seenIDs[id] = true
			ordered = append(ordered, id)
		}
	}
	addID(primaryResidentID)

	nikCandidates := []string{
		strFromMap(payload, "applicant_nik"),
		strFromMap(payload, "mother_nik"),
		strFromMap(payload, "father_nik"),
		strFromMap(payload, "deceased_nik"),
		strFromMap(payload, "reporter_nik"),
		strFromMap(payload, "pewaris_nik"),
	}
	if rawHeirs, ok := payload["heirs"]; ok && rawHeirs != nil {
		if b, err := json.Marshal(rawHeirs); err == nil {
			var heirs []docgen.HeirRow
			if err := json.Unmarshal(b, &heirs); err == nil {
				for _, h := range heirs {
					if domain.ValidateNIK(strings.TrimSpace(h.NIK)) {
						nikCandidates = append(nikCandidates, strings.TrimSpace(h.NIK))
					}
				}
			}
		}
	}

	seenNIKs := map[string]bool{}
	for _, nik := range nikCandidates {
		nik = strings.TrimSpace(nik)
		if !domain.ValidateNIK(nik) || seenNIKs[nik] {
			continue
		}
		seenNIKs[nik] = true
		var rID string
		if err := tx.QueryRow(ctx, `
			SELECT id::text FROM residents WHERE village_id = $1 AND nik = $2 LIMIT 1
		`, villageID, nik).Scan(&rID); err == nil {
			addID(rID)
		}
	}
	return ordered
}

// CreateOrIssueLetter menyimpan surat baru, melengkapi biodata warga dari tabel residents,
// dan otomatis mencatat event LETTER_ISSUED pada population_events warga terkait.
func (s *Store) CreateOrIssueLetter(ctx context.Context, villageID, actorUserID string, in CreateLetterInput) (*LetterRecord, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	templateCode := strings.ToUpper(strings.TrimSpace(in.TemplateCode))
	if templateCode == "" {
		templateCode = "SK_UMUM"
	}

	var templateID, templateTitle, classCode string
	err = tx.QueryRow(ctx, `
		SELECT id::text, title, classification_code
		FROM letter_templates
		WHERE village_id = $1 AND code = $2
		LIMIT 1
	`, villageID, templateCode).Scan(&templateID, &templateTitle, &classCode)
	if err != nil {
		return nil, fmt.Errorf("template surat %s tidak ditemukan di desa ini", templateCode)
	}

	if in.DynamicPayload == nil {
		in.DynamicPayload = map[string]any{}
	}

	applicantNIK := strings.TrimSpace(in.ApplicantNIK)
	if applicantNIK == "" {
		applicantNIK = strFromMap(in.DynamicPayload, "applicant_nik")
	}

	var applicantResidentID string
	if domain.ValidateNIK(applicantNIK) {
		var rID, rName, rBirthPlace, rBirthDate, rGender, rReligion, rMarital, rOccupation, rCitizenship, rDusun, rKK string
		err := tx.QueryRow(ctx, `
			SELECT
				r.id::text,
				r.full_name,
				r.birth_place,
				TO_CHAR(r.birth_date, 'DD-MM-YYYY'),
				r.gender,
				r.religion,
				r.marital_status,
				COALESCE(r.occupation, 'BELUM/TIDAK BEKERJA'),
				COALESCE(r.citizenship, 'WNI'),
				d.name,
				COALESCE(h.no_kk, '')
			FROM residents r
			JOIN dusuns d ON d.id = r.dusun_id
			LEFT JOIN households h ON h.id = r.household_id
			WHERE r.village_id = $1 AND r.nik = $2
			LIMIT 1
		`, villageID, applicantNIK).Scan(
			&rID, &rName, &rBirthPlace, &rBirthDate, &rGender,
			&rReligion, &rMarital, &rOccupation, &rCitizenship, &rDusun, &rKK,
		)
		if err == nil {
			applicantResidentID = rID
			in.DynamicPayload["applicant_nik"] = applicantNIK
			if strFromMap(in.DynamicPayload, "applicant_name") == "" {
				in.DynamicPayload["applicant_name"] = rName
			}
			if strFromMap(in.DynamicPayload, "applicant_birth_place") == "" {
				in.DynamicPayload["applicant_birth_place"] = rBirthPlace
			}
			if strFromMap(in.DynamicPayload, "applicant_birth_date") == "" {
				in.DynamicPayload["applicant_birth_date"] = rBirthDate
			}
			if strFromMap(in.DynamicPayload, "applicant_gender") == "" {
				in.DynamicPayload["applicant_gender"] = rGender
			}
			if strFromMap(in.DynamicPayload, "applicant_religion") == "" {
				in.DynamicPayload["applicant_religion"] = rReligion
			}
			if strFromMap(in.DynamicPayload, "applicant_marital") == "" {
				in.DynamicPayload["applicant_marital"] = rMarital
			}
			if strFromMap(in.DynamicPayload, "applicant_occupation") == "" {
				in.DynamicPayload["applicant_occupation"] = rOccupation
			}
			if strFromMap(in.DynamicPayload, "applicant_citizenship") == "" {
				in.DynamicPayload["applicant_citizenship"] = rCitizenship
			}
			if strFromMap(in.DynamicPayload, "applicant_dusun") == "" {
				in.DynamicPayload["applicant_dusun"] = rDusun
			}
			if strFromMap(in.DynamicPayload, "applicant_no_kk") == "" && rKK != "" {
				in.DynamicPayload["applicant_no_kk"] = rKK
			}
		}
	}

	now := time.Now()
	var seq int
	_ = tx.QueryRow(ctx, `SELECT COUNT(*) + 1 FROM letter_requests WHERE village_id = $1`, villageID).Scan(&seq)

	letterNumber := strings.TrimSpace(in.LetterNumber)
	if letterNumber == "" {
		letterNumber = fmt.Sprintf("%s / %04d / %s / %d", classCode, seq, romanMonth(now.Month()), now.Year())
	}
	ticketCode := fmt.Sprintf("SRT-RDK-%s-%04d-%s", now.Format("060102"), seq, strings.ToUpper(randomHexToken(2)))
	qrToken := "qr-rdk-" + randomHexToken(12)

	source := strings.ToUpper(strings.TrimSpace(in.Source))
	if source != "PUBLIC_FORM" {
		source = "WALK_IN"
	}
	status := "AWAITING_SIGNATURE"
	if source == "PUBLIC_FORM" {
		status = "SUBMITTED"
	}
	purpose := strings.TrimSpace(in.Purpose)
	if purpose == "" {
		purpose = "Keperluan Administrasi Kependudukan"
	}
	in.DynamicPayload["issued_date_str"] = indonesianDateStr(now)

	payloadBytes, _ := json.Marshal(in.DynamicPayload)

	var letterID string
	err = tx.QueryRow(ctx, `
		INSERT INTO letter_requests (
			village_id, template_id, ticket_code, letter_number,
			applicant_resident_id, applicant_wa, source, purpose,
			dynamic_payload, status, verify_qr_token, processed_by, issued_at
		) VALUES (
			$1, $2::uuid, $3, $4,
			NULLIF($5, '')::uuid, NULLIF($6, ''), $7, $8,
			$9::jsonb, $10, $11, NULLIF($12, '')::uuid, NOW()
		)
		RETURNING id::text
	`, villageID, templateID, ticketCode, letterNumber,
		applicantResidentID, strings.TrimSpace(in.ApplicantWA), source, purpose,
		string(payloadBytes), status, qrToken, actorUserID).Scan(&letterID)
	if err != nil {
		return nil, err
	}

	involvedResidentIDs := s.collectInvolvedResidentIDsTx(ctx, tx, villageID, applicantResidentID, in.DynamicPayload)

	metaBytes, _ := json.Marshal(map[string]any{
		"letter_id":       letterID,
		"ticket_code":     ticketCode,
		"letter_number":   letterNumber,
		"template_code":   templateCode,
		"template_title":  templateTitle,
		"purpose":         purpose,
		"verify_qr_token": qrToken,
		"status":          status,
	})

	eventSummary := fmt.Sprintf("Pembuatan %s (No: %s) — Keperluan: %s", templateTitle, letterNumber, purpose)
	for _, resID := range involvedResidentIDs {
		_, _ = tx.Exec(ctx, `
			INSERT INTO population_events (
				village_id, resident_id, event_type, event_date, summary, event_metadata, recorded_by
			) VALUES (
				$1, $2::uuid, 'LETTER_ISSUED', CURRENT_DATE, $3, $4::jsonb, NULLIF($5, '')::uuid
			)
		`, villageID, resID, eventSummary, string(metaBytes), actorUserID)
	}

	// Khusus SK_KEMATIAN: apabila ada deceased_nik di database warga dan statusnya masih AKTIF, ubah ke MENINGGAL
	if templateCode == "SK_KEMATIAN" {
		deceasedNIK := strFromMap(in.DynamicPayload, "deceased_nik")
		if deceasedNIK == "" {
			deceasedNIK = applicantNIK
		}
		if domain.ValidateNIK(deceasedNIK) {
			var decID, decName, decStatus string
			if err := tx.QueryRow(ctx, `
				SELECT id::text, full_name, status FROM residents WHERE village_id = $1 AND nik = $2 LIMIT 1
			`, villageID, deceasedNIK).Scan(&decID, &decName, &decStatus); err == nil && decStatus == "AKTIF" {
				_, _ = tx.Exec(ctx, `UPDATE residents SET status = 'MENINGGAL', updated_at = NOW() WHERE id = $1::uuid`, decID)
				deathSummary := fmt.Sprintf("Tercatat meninggal dunia melalui penerbitan %s No. %s", templateTitle, letterNumber)
				_, _ = tx.Exec(ctx, `
					INSERT INTO population_events (
						village_id, resident_id, event_type, event_date, summary, event_metadata, recorded_by
					) VALUES (
						$1, $2::uuid, 'DEATH', CURRENT_DATE, $3, $4::jsonb, NULLIF($5, '')::uuid
					)
				`, villageID, decID, deathSummary, string(metaBytes), actorUserID)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetLetterByID(ctx, villageID, letterID)
}

// AttachSignedLetterFile menyimpan path berkas surat yang sudah ditandatangani (TTD Basah / TTE BSrE),
// mengubah status surat menjadi COMPLETED, dan otomatis mencatat event LETTER_SIGNED_UPLOADED
// pada population_events warga terkait agar terdokumentasi di riwayat historis warga.
func (s *Store) AttachSignedLetterFile(ctx context.Context, villageID, actorUserID, letterID, storedFileKey, originalFileName, signatureType, notes string) (*LetterRecord, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var templateCode, templateTitle, ticketCode, letterNumber, applicantResidentID, purpose, qrToken string
	var rawPayload []byte
	err = tx.QueryRow(ctx, `
		SELECT
			lt.code,
			lt.title,
			lr.ticket_code,
			COALESCE(lr.letter_number, ''),
			COALESCE(lr.applicant_resident_id::text, ''),
			lr.purpose,
			lr.verify_qr_token,
			lr.dynamic_payload
		FROM letter_requests lr
		JOIN letter_templates lt ON lt.id = lr.template_id
		WHERE lr.village_id = $1 AND lr.id = $2::uuid
		FOR UPDATE
	`, villageID, letterID).Scan(
		&templateCode,
		&templateTitle,
		&ticketCode,
		&letterNumber,
		&applicantResidentID,
		&purpose,
		&qrToken,
		&rawPayload,
	)
	if err != nil {
		return nil, fmt.Errorf("data surat tidak ditemukan")
	}

	payload := map[string]any{}
	_ = json.Unmarshal(rawPayload, &payload)

	sigType := strings.ToUpper(strings.TrimSpace(signatureType))
	if sigType != "TTE_BSRE" {
		sigType = "TTD_BASAH"
	}
	sigLabel := "TTD Basah & Stempel Desa"
	if sigType == "TTE_BSRE" {
		sigLabel = "Tanda Tangan Elektronik (TTE BSrE)"
	}

	uploadedAt := time.Now().UTC().Format(time.RFC3339)
	payload["signature_type"] = sigType
	payload["signature_label"] = sigLabel
	payload["signed_file_name"] = originalFileName
	payload["signed_uploaded_at"] = uploadedAt
	if strings.TrimSpace(notes) != "" {
		payload["signed_notes"] = strings.TrimSpace(notes)
	}
	updatedPayloadBytes, _ := json.Marshal(payload)

	_, err = tx.Exec(ctx, `
		UPDATE letter_requests
		SET
			status = 'COMPLETED',
			signed_pdf_key = $3,
			dynamic_payload = $4::jsonb,
			processed_by = COALESCE(NULLIF($5, '')::uuid, processed_by),
			issued_at = COALESCE(issued_at, NOW()),
			updated_at = NOW()
		WHERE village_id = $1 AND id = $2::uuid
	`, villageID, letterID, storedFileKey, string(updatedPayloadBytes), actorUserID)
	if err != nil {
		return nil, err
	}

	involvedResidentIDs := s.collectInvolvedResidentIDsTx(ctx, tx, villageID, applicantResidentID, payload)
	metaBytes, _ := json.Marshal(map[string]any{
		"letter_id":          letterID,
		"ticket_code":        ticketCode,
		"letter_number":      letterNumber,
		"template_code":      templateCode,
		"template_title":     templateTitle,
		"purpose":            purpose,
		"verify_qr_token":    qrToken,
		"signature_type":     sigType,
		"signature_label":    sigLabel,
		"signed_file_name":   originalFileName,
		"signed_uploaded_at": uploadedAt,
		"signed_notes":       strings.TrimSpace(notes),
		"has_signed_file":    true,
	})

	eventSummary := fmt.Sprintf("Arsip Surat Sah (%s) terunggah & terdokumentasi untuk %s No. %s (Berkas: %s)", sigLabel, templateTitle, letterNumber, originalFileName)
	if strings.TrimSpace(notes) != "" {
		eventSummary += " — Catatan: " + strings.TrimSpace(notes)
	}

	for _, resID := range involvedResidentIDs {
		_, _ = tx.Exec(ctx, `
			INSERT INTO population_events (
				village_id, resident_id, event_type, event_date, summary, event_metadata, recorded_by
			) VALUES (
				$1, $2::uuid, 'LETTER_SIGNED_UPLOADED', CURRENT_DATE, $3, $4::jsonb, NULLIF($5, '')::uuid
			)
		`, villageID, resID, eventSummary, string(metaBytes), actorUserID)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetLetterByID(ctx, villageID, letterID)
}

func (rec *LetterRecord) ToLetterDocData() docgen.LetterDocData {
	p := rec.DynamicPayload
	if p == nil {
		p = map[string]any{}
	}

	docTitle := strings.ToUpper(strings.TrimSpace(rec.TemplateTitle))
	switch rec.TemplateCode {
	case "SK_UMUM":
		docTitle = "SURAT KETERANGAN"
	case "SK_KELAHIRAN":
		docTitle = "SURAT KETERANGAN KELAHIRAN"
	case "SK_KEMATIAN":
		docTitle = "SURAT KETERANGAN KEMATIAN"
	case "SK_BEDA_NAMA":
		docTitle = "SURAT KETERANGAN BEDA NAMA"
	case "SK_WARIS":
		docTitle = "SURAT KETERANGAN WARIS"
	}

	issuedDateStr := strFromMap(p, "issued_date_str")
	if issuedDateStr == "" {
		issuedDateStr = indonesianDateStr(time.Now())
	}

	applicantName := rec.ApplicantName
	if strFromMap(p, "applicant_name") != "" {
		applicantName = strFromMap(p, "applicant_name")
	}
	applicantNIK := rec.ApplicantNIK
	if strFromMap(p, "applicant_nik") != "" {
		applicantNIK = strFromMap(p, "applicant_nik")
	}
	applicantDusun := rec.ApplicantDusun
	if strFromMap(p, "applicant_dusun") != "" {
		applicantDusun = strFromMap(p, "applicant_dusun")
	}

	applicantTTL := strFromMap(p, "applicant_ttl")
	if applicantTTL == "" {
		bp := strFromMap(p, "applicant_birth_place")
		bd := strFromMap(p, "applicant_birth_date")
		if bp != "" && bd != "" {
			applicantTTL = bp + ", " + bd
		} else if bp != "" {
			applicantTTL = bp
		} else {
			applicantTTL = bd
		}
	}
	applicantAddr := strFromMap(p, "applicant_address")
	if applicantAddr == "" && applicantDusun != "" {
		applicantAddr = "BD. " + applicantDusun + " Desa Ringdikit"
	}

	// Untuk SK_KEMATIAN, apabila deceased_* diisi di payload, gunakan sebagai Applicant* pada body surat kematian
	if rec.TemplateCode == "SK_KEMATIAN" {
		if v := strFromMap(p, "deceased_name"); v != "" {
			applicantName = v
		}
		if v := strFromMap(p, "deceased_nik"); v != "" {
			applicantNIK = v
		}
		if v := strFromMap(p, "deceased_ttl"); v != "" {
			applicantTTL = v
		}
		if v := strFromMap(p, "deceased_address"); v != "" {
			applicantAddr = v
		}
	}

	extraStmt := strFromMap(p, "statement_text")
	if extraStmt == "" {
		extraStmt = strFromMap(p, "extra_statement")
	}

	refDoc := strFromMap(p, "reference_doc_name")
	if refDoc == "" {
		refDoc = strFromMap(p, "anchor_document")
	}

	pewarisName := strFromMap(p, "pewaris_name")
	if pewarisName == "" {
		pewarisName = strFromMap(p, "deceased_name")
	}
	pewarisDate := strFromMap(p, "pewaris_death_date")
	if pewarisDate == "" {
		pewarisDate = strFromMap(p, "deceased_date")
	}
	pewarisPlace := strFromMap(p, "pewaris_death_place")
	if pewarisPlace == "" {
		pewarisPlace = strFromMap(p, "deceased_place")
	}

	data := docgen.LetterDocData{
		TemplateCode:        rec.TemplateCode,
		DocumentTitle:       docTitle,
		LetterNumber:        rec.LetterNumber,
		IssuedDateStr:       issuedDateStr,
		VerifyQRToken:       rec.VerifyQRToken,
		LeaderName:          rec.LeaderName,
		LeaderTitle:         rec.LeaderTitle,
		Purpose:             rec.Purpose,
		ApplicantName:       applicantName,
		ApplicantNIK:        applicantNIK,
		ApplicantNoKK:       strFromMap(p, "applicant_no_kk"),
		ApplicantTTL:        applicantTTL,
		ApplicantGender:     strFromMap(p, "applicant_gender"),
		ApplicantReligion:   strFromMap(p, "applicant_religion"),
		ApplicantMarital:    strFromMap(p, "applicant_marital"),
		ApplicantOccupation: strFromMap(p, "applicant_occupation"),
		ApplicantAddress:    applicantAddr,
		ExtraStatement:      extraStmt,

		// SK_KELAHIRAN
		ChildName:       strFromMap(p, "child_name"),
		ChildOrder:      strFromMap(p, "child_order"),
		ChildBirthPlace: strFromMap(p, "child_birth_place"),
		ChildBirthDate:  strFromMap(p, "child_birth_date"),
		ChildAddress:    strFromMap(p, "child_address"),
		BirthHelperName: strFromMap(p, "birth_helper_name"),
		BirthHelperAddr: strFromMap(p, "birth_helper_addr"),
		MotherNIK:       strFromMap(p, "mother_nik"),
		MotherName:      strFromMap(p, "mother_name"),
		MotherTTL:       strFromMap(p, "mother_ttl"),
		MotherAddress:   strFromMap(p, "mother_address"),
		FatherNIK:       strFromMap(p, "father_nik"),
		FatherName:      strFromMap(p, "father_name"),
		FatherTTL:       strFromMap(p, "father_ttl"),
		FatherAddress:   strFromMap(p, "father_address"),

		// SK_KEMATIAN
		ReporterName:     strFromMap(p, "reporter_name"),
		ReporterAddress:  strFromMap(p, "reporter_address"),
		ReporterRelation: strFromMap(p, "reporter_relation"),
		DeathDayDate:     strFromMap(p, "death_day_date"),
		DeathPlace:       strFromMap(p, "death_place"),
		DeathCause:       strFromMap(p, "death_cause"),

		// SK_BEDA_NAMA
		ReferenceDocName: refDoc,

		// SK_WARIS
		DeceasedName:  pewarisName,
		DeceasedDate:  pewarisDate,
		DeceasedPlace: pewarisPlace,
	}

	if rawDiffs, ok := p["diff_docs"]; ok && rawDiffs != nil {
		if b, err := json.Marshal(rawDiffs); err == nil {
			_ = json.Unmarshal(b, &data.DiffDocs)
		}
	}
	if rawHeirs, ok := p["heirs"]; ok && rawHeirs != nil {
		if b, err := json.Marshal(rawHeirs); err == nil {
			_ = json.Unmarshal(b, &data.Heirs)
		}
	}
	return data
}
