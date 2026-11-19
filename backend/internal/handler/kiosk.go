package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/rey1024/sideci/backend/internal/store"
)

func (s *Server) handleKioskLookup(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	rfid := strings.TrimSpace(r.URL.Query().Get("rfid"))
	nik := strings.TrimSpace(r.URL.Query().Get("nik"))
	if rfid == "" && nik == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Masukkan ID Kartu RFID KTP-el atau 16 digit NIK"})
		return
	}

	res, err := s.Store.LookupResidentByRFIDOrNIK(r.Context(), c.VillageID, rfid, nik)
	if errors.Is(err, store.ErrNotFound) || res == nil {
		if rfid != "" {
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error": "ID Kartu RFID KTP-el (" + strings.ToUpper(rfid) + ") belum dipetakan ke NIK warga. Silakan gunakan pencarian NIK atau petakan kartu di menu Pengaturan RFID.",
			})
		} else {
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error": "Warga dengan NIK " + nik + " tidak ditemukan di database penduduk Desa Ringdikit.",
			})
		}
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mencari identitas warga: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"resident": res,
	})
}

func (s *Server) handleListRFIDMappings(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	search := strings.TrimSpace(r.URL.Query().Get("q"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 100
	}

	items, totalMapped, err := s.Store.ListRFIDMappings(r.Context(), c.VillageID, search, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memuat daftar pemetaan RFID: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items":        items,
		"total_mapped": totalMapped,
	})
}

func (s *Server) handleBindRFIDMapping(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	var req struct {
		ResidentID string `json:"resident_id"`
		RFIDUID    string `json:"rfid_uid"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32*1024)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan JSON tidak valid"})
		return
	}

	res, err := s.Store.BindResidentRFID(r.Context(), c.VillageID, c.Subject, req.ResidentID, req.RFIDUID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "RFID_MAPPING_UPDATED", "resident", res.ID, clientIP(r))
	msg := "Pemetaan ID Kartu RFID KTP-el ke NIK warga berhasil disimpan."
	if strings.TrimSpace(req.RFIDUID) == "" {
		msg = "Pemetaan ID Kartu RFID berhasil dilepas dari warga tersebut."
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"resident": res,
		"message":  msg,
	})
}

func (s *Server) handleListGuestbook(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	search := strings.TrimSpace(r.URL.Query().Get("q"))
	method := strings.TrimSpace(r.URL.Query().Get("method"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 100
	}

	items, stats, err := s.Store.ListGuestbookEntries(r.Context(), c.VillageID, search, method, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memuat buku tamu desa: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"stats": stats,
	})
}

func (s *Server) handleCreateGuestbook(w http.ResponseWriter, r *http.Request) {
	c, ok := requireTenantClaims(w, r)
	if !ok {
		return
	}
	if s.Store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum terhubung"})
		return
	}

	var in store.CreateGuestbookInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan JSON tidak valid"})
		return
	}

	entry, err := s.Store.CreateGuestbookEntry(r.Context(), c.VillageID, c.Subject, in)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Gagal menyimpan buku tamu: " + err.Error()})
		return
	}

	s.Store.Audit(r.Context(), c.VillageID, c.Subject, "GUESTBOOK_CHECKIN_"+entry.IdentificationMethod, "guestbook_entry", entry.ID, clientIP(r))
	writeJSON(w, http.StatusCreated, map[string]any{
		"entry":   entry,
		"message": "Data kunjungan Buku Tamu Desa berhasil tercatat.",
	})
}
