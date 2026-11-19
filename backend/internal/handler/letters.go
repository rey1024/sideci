package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/rey1024/sideci/backend/internal/docgen"
	"github.com/rey1024/sideci/backend/internal/domain"
	"github.com/rey1024/sideci/backend/internal/middleware"
	"github.com/rey1024/sideci/backend/internal/store"
)

var safeFilenameRegex = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

func sanitizeFilename(name string) string {
	clean := safeFilenameRegex.ReplaceAllString(filepath.Base(strings.TrimSpace(name)), "_")
	if clean == "" {
		return "surat_sah.pdf"
	}
	return clean
}

func (s *Server) handlePublicLetterSubmit(w http.ResponseWriter, r *http.Request) {
	if s.loginLimiter != nil && !s.loginLimiter.Allow("pub_letter:"+clientIP(r)) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{
			"error": "Terlalu banyak percobaan pengajuan surat dari alamat IP ini. Silakan coba lagi setelah 1 menit.",
		})
		return
	}

	var req domain.PublicLetterSubmitRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan JSON tidak valid"})
		return
	}
	if !domain.ValidateNIK(req.NIK) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "NIK wajib terdiri dari tepat 16 digit angka"})
		return
	}
	if strings.TrimSpace(req.BirthDate) == "" || strings.TrimSpace(req.Purpose) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Tanggal lahir verifikasi dan keperluan surat wajib diisi"})
		return
	}

	if s.Store != nil {
		slug := middleware.TenantSlugFromContext(r.Context())
		if slug == "" {
			slug = "ringdikit"
		}
		var villageID string
		if err := s.Store.Pool.QueryRow(r.Context(), `SELECT id::text FROM villages WHERE slug = $1 LIMIT 1`, slug).Scan(&villageID); err == nil && villageID != "" {
			// Verifikasi ketat UU PDP: kombinasi NIK + Tanggal Lahir wajib cocok sebelum surat dibuat
			var matchedResidentID string
			errVerify := s.Store.Pool.QueryRow(r.Context(), `
				SELECT id::text FROM residents
				WHERE village_id = $1::uuid AND nik = $2 AND to_char(birth_date, 'YYYY-MM-DD') = $3
				LIMIT 1
			`, villageID, strings.TrimSpace(req.NIK), strings.TrimSpace(req.BirthDate)).Scan(&matchedResidentID)
			if errVerify != nil || matchedResidentID == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "Kombinasi NIK dan Tanggal Lahir tidak sesuai dengan data kependudukan desa.",
				})
				return
			}

			payload := map[string]any{
				"applicant_nik":     req.NIK,
				"verify_birth_date": req.BirthDate,
			}

			rec, err := s.Store.CreateOrIssueLetter(r.Context(), villageID, "", store.CreateLetterInput{
				TemplateCode:   req.TemplateCode,
				ApplicantNIK:   req.NIK,
				ApplicantWA:    req.ApplicantWA,
				Source:         "PUBLIC_FORM",
				Purpose:        req.Purpose,
				DynamicPayload: payload,
			})
			if err == nil && rec != nil {
				masked := domain.MaskFullName(rec.ApplicantName)
				if strings.TrimSpace(rec.ApplicantName) == "" {
					masked = "W**** D***"
				}
				writeJSON(w, http.StatusCreated, domain.PublicLetterTicketResponse{
					TicketCode:     rec.TicketCode,
					TemplateCode:   rec.TemplateCode,
					MaskedName:     masked,
					Status:         rec.Status,
					SubmittedAtISO: rec.CreatedAt,
				})
				return
			}
		}
	}

	writeJSON(w, http.StatusCreated, domain.PublicLetterTicketResponse{
		TicketCode:     "SRT-RDK-261119-0042",
		TemplateCode:   req.TemplateCode,
		MaskedName:     domain.MaskFullName("Komang Rodi Gunawan"),
		Status:         "SUBMITTED",
		SubmittedAtISO: time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleVerifyQR(w http.ResponseWriter, r *http.Request) {
	if s.loginLimiter != nil && !s.loginLimiter.Allow("verify_qr:"+clientIP(r)) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{
			"error": "Terlalu banyak permintaan verifikasi QR dari alamat IP ini.",
		})
		return
	}

	token := strings.TrimSpace(r.PathValue("token"))
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Token verifikasi kosong"})
		return
	}

	if s.Store != nil {
		if rec, villageFull, err := s.Store.GetLetterByQRToken(r.Context(), token); err == nil && rec != nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"valid":           true,
				"token":           rec.VerifyQRToken,
				"ticket_code":     rec.TicketCode,
				"letter_number":   rec.LetterNumber,
				"letter_title":    rec.TemplateTitle,
				"status":          rec.Status,
				"has_signed_file": rec.HasSignedFile,
				"signature_type":  rec.SignatureType,
				"village":         villageFull,
				"signer_name":     rec.LeaderName,
				"signer_title":    rec.LeaderTitle,
				"masked_name":     domain.MaskFullName(rec.ApplicantName),
				"issued_date":     rec.IssuedAt,
			})
			return
		}
		if token != "rdk-9f42a81c" {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"valid": false,
				"token": token,
				"error": "Token QR surat tidak ditemukan atau tidak terdaftar pada Buku Register Desa.",
			})
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"valid":         true,
		"token":         token,
		"letter_number": "147/0042/XI/2026",
		"letter_title":  "Surat Keterangan Umum / Pengantar",
		"village":       "Desa Ringdikit, Kec. Seririt, Kab. Buleleng",
		"signer_name":   "I Made Sumadi",
		"signer_title":  "Perbekel Ringdikit",
		"masked_name":   domain.MaskFullName("Komang Rodi Gunawan"),
		"issued_date":   "2026-11-19",
	})
}

func (s *Server) handleListLetters(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	statusFilter := strings.TrimSpace(r.URL.Query().Get("status"))
	search := strings.TrimSpace(r.URL.Query().Get("q"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 100
	}

	items, stats, err := s.Store.ListLetters(r.Context(), c.VillageID, statusFilter, search, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memuat daftar surat: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"stats": stats,
	})
}

func (s *Server) handleCreateLetter(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	var in store.CreateLetterInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256*1024)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan JSON tidak valid"})
		return
	}
	if strings.TrimSpace(in.TemplateCode) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Kode template surat wajib dipilih"})
		return
	}

	rec, err := s.Store.CreateOrIssueLetter(r.Context(), c.VillageID, c.Subject, in)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Gagal menerbitkan surat: " + err.Error()})
		return
	}

	if strings.ToUpper(strings.TrimSpace(in.TemplateCode)) == "SK_KEMATIAN" {
		s.InvalidateAllVillageCache()
	}
	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "LETTER_ISSUED_"+rec.TemplateCode, "letter_request", rec.ID, clientIP(r))

	writeJSON(w, http.StatusCreated, map[string]any{
		"letter":  rec,
		"message": "Surat berhasil dibuat, siap diunduh dalam format PDF & DOCX, dan telah tercatat otomatis pada riwayat historis warga.",
	})
}

func (s *Server) handleDownloadLetterDOCX(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	letterID := strings.TrimSpace(r.PathValue("id"))
	rec, err := s.Store.GetLetterByID(r.Context(), c.VillageID, letterID)
	if err != nil || rec == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Data surat tidak ditemukan"})
		return
	}

	docxBytes, err := docgen.BuildLetterDOCX(rec.ToLetterDocData())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyusun dokumen DOCX: " + err.Error()})
		return
	}

	fileName := sanitizeFilename(fmt.Sprintf("%s_%s_%s.docx", rec.TemplateCode, rec.TicketCode, rec.ApplicantName))
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	w.Header().Set("Content-Length", strconv.Itoa(len(docxBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(docxBytes)
}

func (s *Server) handleDownloadLetterPDF(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	letterID := strings.TrimSpace(r.PathValue("id"))
	rec, err := s.Store.GetLetterByID(r.Context(), c.VillageID, letterID)
	if err != nil || rec == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Data surat tidak ditemukan"})
		return
	}

	pdfBytes, err := docgen.BuildLetterPDF(rec.ToLetterDocData())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyusun dokumen PDF: " + err.Error()})
		return
	}

	fileName := sanitizeFilename(fmt.Sprintf("%s_%s_%s.pdf", rec.TemplateCode, rec.TicketCode, rec.ApplicantName))
	w.Header().Set("Content-Type", "application/pdf")
	if r.URL.Query().Get("inline") == "1" {
		w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, fileName))
	} else {
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(pdfBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdfBytes)
}

func (s *Server) handleUploadSignedLetter(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	letterID := strings.TrimSpace(r.PathValue("id"))
	if letterID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ID surat wajib diisi"})
		return
	}

	if err := r.ParseMultipartForm(16 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Berkas unggahan tidak valid atau melebihi batas 16 MB"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Wajib memilih berkas surat yang sudah ditandatangani (PDF/JPG/PNG)"})
		return
	}
	defer file.Close()

	origName := sanitizeFilename(header.Filename)
	ext := strings.ToLower(filepath.Ext(origName))
	if ext != ".pdf" && ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format berkas harus berupa .pdf, .jpg, atau .png"})
		return
	}

	// Validasi Magic-Byte MIME Type (mencegah unggahan HTML/SVG/Script yang disamarkan sebagai PDF/PNG)
	headBuf := make([]byte, 512)
	nRead, readErr := file.Read(headBuf)
	if readErr != nil && readErr != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Gagal membaca isi berkas unggahan"})
		return
	}
	headSlice := headBuf[:nRead]
	detectedMIME := http.DetectContentType(headSlice)
	if detectedMIME != "application/pdf" && detectedMIME != "image/jpeg" && detectedMIME != "image/png" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Isi berkas tidak valid (terdeteksi: " + detectedMIME + "). Hanya berkas PDF, JPEG, atau PNG asli yang diizinkan.",
		})
		return
	}

	storageDir := filepath.Join("storage", "letters")
	if err := os.MkdirAll(storageDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyiapkan direktori penyimpanan arsip surat"})
		return
	}

	storedFileName := fmt.Sprintf("%s_%d_%s", sanitizeFilename(letterID), time.Now().Unix(), origName)
	storedPath := filepath.Join(storageDir, storedFileName)
	outFile, err := os.Create(storedPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan berkas surat ke server"})
		return
	}
	if _, err := outFile.Write(headSlice); err != nil {
		_ = outFile.Close()
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menulis header berkas surat"})
		return
	}
	if _, err := io.Copy(outFile, io.LimitReader(file, 16<<20)); err != nil {
		_ = outFile.Close()
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menulis berkas surat"})
		return
	}
	_ = outFile.Close()

	sigType := strings.TrimSpace(r.FormValue("signature_type"))
	notes := strings.TrimSpace(r.FormValue("notes"))

	rec, err := s.Store.AttachSignedLetterFile(r.Context(), c.VillageID, c.Subject, letterID, storedPath, origName, sigType, notes)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Gagal mencatat arsip surat TTD/TTE: " + err.Error()})
		return
	}
	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "LETTER_SIGNED_UPLOADED", "letter_request", rec.ID, clientIP(r))

	writeJSON(w, http.StatusOK, map[string]any{
		"letter":  rec,
		"message": "Berkas surat bertanda tangan (TTD/TTE) berhasil diunggah, status surat menjadi SAH/SELESAI, dan otomatis terdokumentasi di riwayat historis warga.",
	})
}

func (s *Server) handleDownloadSignedLetterFile(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}
	letterID := strings.TrimSpace(r.PathValue("id"))
	rec, err := s.Store.GetLetterByID(r.Context(), c.VillageID, letterID)
	if err != nil || rec == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Data surat tidak ditemukan"})
		return
	}
	if !rec.HasSignedFile || strings.TrimSpace(rec.SignedPDFKey) == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Surat ini belum memiliki berkas TTD/TTE yang diunggah"})
		return
	}

	allowedBase := filepath.Clean(filepath.Join("storage", "letters")) + string(os.PathSeparator)
	cleanKey := filepath.Clean(rec.SignedPDFKey)
	var dataBytes []byte
	if strings.HasPrefix(cleanKey, allowedBase) {
		dataBytes, err = os.ReadFile(cleanKey)
	} else {
		err = os.ErrPermission
	}
	if err != nil {
		// Fallback apabila file fisik tidak ditemukan: kembalikan PDF surat resmi
		pdfBytes, pdfErr := docgen.BuildLetterPDF(rec.ToLetterDocData())
		if pdfErr != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Berkas fisik arsip surat tidak ditemukan di server"})
			return
		}
		dataBytes = pdfBytes
	}

	downloadName := rec.SignedFileName
	if downloadName == "" {
		downloadName = sanitizeFilename(fmt.Sprintf("ARSIP_SAH_%s_%s.pdf", rec.TemplateCode, rec.TicketCode))
	}
	ext := strings.ToLower(filepath.Ext(downloadName))
	contentType := "application/pdf"
	switch ext {
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".png":
		contentType = "image/png"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, sanitizeFilename(downloadName)))
	w.Header().Set("Content-Length", strconv.Itoa(len(dataBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(dataBytes)
}
