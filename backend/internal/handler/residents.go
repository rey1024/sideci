package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/rey1024/sideci/backend/internal/auth"
	"github.com/rey1024/sideci/backend/internal/domain"
	"github.com/rey1024/sideci/backend/internal/importer"
	"github.com/rey1024/sideci/backend/internal/middleware"
	"github.com/rey1024/sideci/backend/internal/store"
)

var allowedSubmissionTypes = map[string]bool{
	"NEW_RESIDENT":   true,
	"UPDATE_BIODATA": true,
	"BIRTH":          true,
	"DEATH":          true,
	"MARRIAGE":       true,
	"DIVORCE":        true,
	"MOVE_IN":        true,
	"MOVE_OUT":       true,
}

func requireTenantClaims(w http.ResponseWriter, r *http.Request) (*auth.Claims, bool) {
	c := middleware.ClaimsFromContext(r.Context())
	if c == nil || c.VillageID == "" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akun harus terikat pada satu desa"})
		return nil, false
	}
	// Jika pengguna adalah kepala_dusun murni (tanpa role tingkat desa), wajib punya dusun_id
	if isStrictDusunOnly(c) && c.DusunID == "" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akun Kepala Dusun belum terikat pada dusun"})
		return nil, false
	}
	return c, true
}

func isStrictDusunOnly(c *auth.Claims) bool {
	return c.HasRole("kepala_dusun") &&
		!c.HasAnyRole("admin_desa", "operator_kependudukan", "operator_persuratan", "kepala_desa")
}

func effectiveDusunFilter(c *auth.Claims, queryDusunID string) string {
	if isStrictDusunOnly(c) {
		return c.DusunID
	}
	return strings.TrimSpace(queryDusunID)
}

func (s *Server) handleListDusuns(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	list, err := s.Store.ListDusuns(r.Context(), c.VillageID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"dusuns": list})
}

func (s *Server) handleListHouseholds(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	dusunID := effectiveDusunFilter(c, r.URL.Query().Get("dusun_id"))
	search := r.URL.Query().Get("q")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	list, total, err := s.Store.ListHouseholds(r.Context(), c.VillageID, dusunID, search, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"households": list,
		"total":      total,
	})
}

func (s *Server) handleListResidents(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	dusunID := effectiveDusunFilter(c, r.URL.Query().Get("dusun_id"))
	status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))
	shdk := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("shdk")))
	search := r.URL.Query().Get("q")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	list, total, err := s.Store.ListResidents(r.Context(), c.VillageID, dusunID, status, shdk, search, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"residents": list,
		"total":     total,
	})
}

func (s *Server) handleGetResidentDetail(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	dusunScope := effectiveDusunFilter(c, "")

	det, err := s.Store.GetResidentDetail(r.Context(), c.VillageID, dusunScope, id)
	if errors.Is(err, store.ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Data penduduk tidak ditemukan"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	writeJSON(w, http.StatusOK, det)
}

var allowedDirectEventTypes = map[string]bool{
	"DEATH":        true,
	"MOVE_OUT":     true,
	"MOVE_IN":      true,
	"CHANGE_DUSUN": true,
	"MARRIAGE":     true,
	"DIVORCE":      true,
	"BIRTH":        true,
	"OTHER_NOTE":   true,
}

func (s *Server) handlePopulationStats(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	dusunScope := effectiveDusunFilter(c, r.URL.Query().Get("dusun_id"))
	stats, err := s.Store.GetPopulationStats(r.Context(), c.VillageID, dusunScope)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleUpsertResident(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	var in store.UpsertResidentInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan tidak valid"})
		return
	}
	in.Gender = strings.ToUpper(strings.TrimSpace(in.Gender))
	if in.Gender != "L" && in.Gender != "P" {
		in.Gender = "L"
	}
	if !domain.ValidateNIK(in.NIK) || !domain.ValidateNIK(in.NoKK) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "NIK dan Nomor KK wajib terdiri dari 16 digit angka"})
		return
	}
	if strings.TrimSpace(in.FullName) == "" || strings.TrimSpace(in.BirthDate) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Nama lengkap dan tanggal lahir wajib diisi"})
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	id, dupHeadWarn, err := s.Store.UpsertResidentDirect(r.Context(), c.VillageID, c.Subject, in)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan data penduduk"})
		return
	}
	s.InvalidateAllVillageCache()
	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "RESIDENT_UPSERT", "resident", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]any{
		"id":                     id,
		"duplicate_head_warning": dupHeadWarn,
	})
}

func (s *Server) handleUpdateResident(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	var in store.UpsertResidentInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan tidak valid"})
		return
	}
	in.Gender = strings.ToUpper(strings.TrimSpace(in.Gender))
	if in.Gender != "L" && in.Gender != "P" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Jenis kelamin wajib L atau P"})
		return
	}
	if !domain.ValidateNIK(in.NIK) || !domain.ValidateNIK(in.NoKK) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "NIK dan Nomor KK wajib terdiri dari 16 digit angka"})
		return
	}
	if strings.TrimSpace(in.FullName) == "" || strings.TrimSpace(in.BirthDate) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Nama lengkap dan tanggal lahir wajib diisi"})
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	dupHeadWarn, err := s.Store.UpdateResidentByID(r.Context(), c.VillageID, c.Subject, id, in)
	if errors.Is(err, store.ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Data penduduk tidak ditemukan"})
		return
	}
	if errors.Is(err, store.ErrConflict) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "NIK tersebut sudah digunakan oleh penduduk lain di desa ini"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Gagal memperbarui data penduduk"})
		return
	}
	s.InvalidateAllVillageCache()
	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "RESIDENT_UPDATED", "resident", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]any{
		"id":                     id,
		"duplicate_head_warning": dupHeadWarn,
	})
}

func (s *Server) handleDeleteResident(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	if err := s.Store.DeleteResidentByID(r.Context(), c.VillageID, id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Data penduduk tidak ditemukan"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus data penduduk"})
		return
	}
	s.InvalidateAllVillageCache()
	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "RESIDENT_DELETED", "resident", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"deleted_id": id})
}

func (s *Server) handleRecordResidentEvent(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	var in store.RecordEventInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32*1024)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan tidak valid"})
		return
	}
	in.EventType = strings.ToUpper(strings.TrimSpace(in.EventType))
	if !allowedDirectEventTypes[in.EventType] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Jenis peristiwa kependudukan tidak valid"})
		return
	}
	if strings.TrimSpace(in.Summary) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Ringkasan / keterangan peristiwa wajib diisi"})
		return
	}
	if in.NoKK != "" && !domain.ValidateNIK(in.NoKK) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Nomor KK tujuan wajib 16 digit angka"})
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	if err := s.Store.RecordResidentEvent(r.Context(), c.VillageID, c.Subject, id, in); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Data penduduk tidak ditemukan"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Gagal mencatat peristiwa kependudukan"})
		return
	}
	s.InvalidateAllVillageCache()
	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "RESIDENT_EVENT_"+in.EventType, "resident", id, clientIP(r))
	writeJSON(w, http.StatusCreated, map[string]string{"resident_id": id, "event_type": in.EventType})
}

// POST /api/v1/residents/import-xlsx?dry_run=true|false
func (s *Server) handleImportSIAKXLSX(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	dryRun := r.URL.Query().Get("dry_run") != "false"

	r.Body = http.MaxBytesReader(w, r.Body, 20*1024*1024) // maks 20 MB
	if err := r.ParseMultipartForm(20 * 1024 * 1024); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Unggah file multipart .xlsx maksimal 20 MB"})
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Field 'file' (.xlsx) wajib disertakan"})
		return
	}
	defer file.Close()

	rawBytes, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Gagal membaca berkas unggahan"})
		return
	}

	knownDusuns := []string{"Kajanan", "Kelodan", "Kuwum", "Rawa", "Sari Mekar"}
	if s.Store != nil {
		if dbDusuns, err := s.Store.ListDusuns(r.Context(), c.VillageID); err == nil && len(dbDusuns) > 0 {
			knownDusuns = make([]string, 0, len(dbDusuns))
			for _, d := range dbDusuns {
				knownDusuns = append(knownDusuns, d.Name)
			}
		}
	}

	report, err := importer.ParseSIAKXLSX(rawBytes, knownDusuns)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	if dryRun {
		writeJSON(w, http.StatusOK, map[string]any{
			"dry_run": true,
			"report":  report,
		})
		return
	}

	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung untuk menyimpan impor"})
		return
	}

	importedCount, err := s.Store.ImportSIAKResidents(r.Context(), c.VillageID, c.Subject, report.Residents)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengimpor ke database: " + err.Error()})
		return
	}
	s.InvalidateAllVillageCache()
	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "RESIDENT_IMPORT_XLSX", "village", c.VillageID, clientIP(r))

	writeJSON(w, http.StatusOK, map[string]any{
		"dry_run":        false,
		"imported_count": importedCount,
		"report":         report,
	})
}

type createSubmissionReq struct {
	DusunID        string         `json:"dusun_id"`
	ResidentID     string         `json:"resident_id"`
	SubmissionType string         `json:"submission_type"`
	PayloadAfter   map[string]any `json:"payload_after"`
}

func (s *Server) handleCreateSubmission(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	var req createSubmissionReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan tidak valid"})
		return
	}
	req.SubmissionType = strings.ToUpper(strings.TrimSpace(req.SubmissionType))
	if !allowedSubmissionTypes[req.SubmissionType] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Jenis laporan kependudukan tidak valid"})
		return
	}
	if len(req.PayloadAfter) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Detail perubahan / laporan wajib diisi"})
		return
	}

	// Enforce BR-F02-01: kepala_dusun can ONLY submit for their own assigned dusun_id!
	targetDusunID := strings.TrimSpace(req.DusunID)
	if isStrictDusunOnly(c) {
		if targetDusunID != "" && targetDusunID != c.DusunID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Kepala Dusun tidak diizinkan mengirim laporan untuk dusun lain"})
			return
		}
		targetDusunID = c.DusunID
	}
	if targetDusunID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "dusun_id wajib disertakan"})
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	id, err := s.Store.CreateSubmission(r.Context(), store.CreateSubmissionInput{
		VillageID:      c.VillageID,
		DusunID:        targetDusunID,
		ResidentID:     strings.TrimSpace(req.ResidentID),
		SubmissionType: req.SubmissionType,
		PayloadAfter:   req.PayloadAfter,
		SubmittedBy:    c.Subject,
	})
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "SUBMISSION_CREATED", "population_submission", id, clientIP(r))
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "PENDING"})
}

func (s *Server) handleListSubmissions(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	dusunScope := effectiveDusunFilter(c, r.URL.Query().Get("dusun_id"))
	status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))

	list, err := s.Store.ListSubmissions(r.Context(), c.VillageID, dusunScope, status)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"submissions": list})
}

type reviewSubmissionReq struct {
	Decision string `json:"decision"` // APPROVED, REVISION_REQUESTED, REJECTED
	Notes    string `json:"notes"`
}

func (s *Server) handleReviewSubmission(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	var req reviewSubmissionReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan tidak valid"})
		return
	}
	req.Decision = strings.ToUpper(strings.TrimSpace(req.Decision))
	if req.Decision != "APPROVED" && req.Decision != "REVISION_REQUESTED" && req.Decision != "REJECTED" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Keputusan harus APPROVED, REVISION_REQUESTED, atau REJECTED"})
		return
	}
	if (req.Decision == "REVISION_REQUESTED" || req.Decision == "REJECTED") && strings.TrimSpace(req.Notes) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Catatan alasan wajib diisi saat meminta revisi atau menolak usulan"})
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	if err := s.Store.ReviewSubmission(r.Context(), c.VillageID, id, c.Subject, req.Decision, strings.TrimSpace(req.Notes)); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usulan tidak ditemukan"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	s.InvalidateAllVillageCache()
	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "SUBMISSION_"+req.Decision, "population_submission", id, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": req.Decision})
}
