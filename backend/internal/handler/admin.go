package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/rey1024/sideci/backend/internal/auth"
	"github.com/rey1024/sideci/backend/internal/middleware"
	"github.com/rey1024/sideci/backend/internal/store"
)

var (
	slugRe     = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$`)
	usernameRe = regexp.MustCompile(`^[a-z0-9._-]{3,40}$`)
)

// Role yang boleh dibuat admin desa untuk desanya sendiri (tanpa superadmin).
var villageRoles = map[string]bool{
	"admin_desa":            true,
	"operator_kependudukan": true,
	"operator_persuratan":   true,
	"kepala_dusun":          true,
	"kepala_desa":           true,
}

func (s *Server) handleAdminListVillages(w http.ResponseWriter, r *http.Request) {
	list, err := s.Store.ListVillages(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"villages": list})
}

type createVillageRequest struct {
	Slug             string   `json:"slug"`
	CustomDomain     string   `json:"custom_domain"`
	Name             string   `json:"name"`
	DistrictName     string   `json:"district_name"`
	RegencyName      string   `json:"regency_name"`
	ProvinceName     string   `json:"province_name"`
	LeaderTitle      string   `json:"leader_title"`
	LeaderName       string   `json:"leader_name"`
	HamletTerm       string   `json:"hamlet_term"`
	HamletLeaderTerm string   `json:"hamlet_leader_term"`
	Dusuns           []string `json:"dusuns"`
}

func (s *Server) handleAdminCreateVillage(w http.ResponseWriter, r *http.Request) {
	var req createVillageRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32*1024)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan tidak valid"})
		return
	}
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	req.CustomDomain = strings.ToLower(strings.TrimSpace(req.CustomDomain))
	if !slugRe.MatchString(req.Slug) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Slug hanya boleh huruf kecil, angka, dan tanda hubung (3-40 karakter)"})
		return
	}
	for _, f := range []string{req.Name, req.DistrictName, req.RegencyName, req.ProvinceName, req.LeaderName} {
		if strings.TrimSpace(f) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Nama desa, kecamatan, kabupaten, provinsi, dan nama kepala desa wajib diisi"})
			return
		}
	}
	if req.LeaderTitle == "" {
		req.LeaderTitle = "Kepala Desa"
	}
	if req.HamletTerm == "" {
		req.HamletTerm = "Dusun"
	}
	if req.HamletLeaderTerm == "" {
		req.HamletLeaderTerm = "Kepala Dusun"
	}

	var dusuns []string
	for _, d := range req.Dusuns {
		if d = strings.TrimSpace(d); d != "" {
			dusuns = append(dusuns, d)
		}
	}

	id, err := s.Store.CreateVillage(r.Context(), store.NewVillage{
		Slug: req.Slug, CustomDomain: req.CustomDomain, Name: strings.TrimSpace(req.Name),
		DistrictName: strings.TrimSpace(req.DistrictName), RegencyName: strings.TrimSpace(req.RegencyName),
		ProvinceName: strings.TrimSpace(req.ProvinceName), LeaderTitle: req.LeaderTitle,
		LeaderName: strings.TrimSpace(req.LeaderName), HamletTerm: req.HamletTerm,
		HamletLeaderTerm: req.HamletLeaderTerm, Dusuns: dusuns,
	})
	if errors.Is(err, store.ErrConflict) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "Slug atau domain desa sudah terdaftar"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	c := middleware.ClaimsFromContext(r.Context())
	s.Store.Audit(r.Context(), id, c.Subject, "VILLAGE_CREATED", "village", id, clientIP(r))
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "slug": req.Slug})
}

type createUserRequest struct {
	VillageID string   `json:"village_id"`
	DusunID   string   `json:"dusun_id"`
	Username  string   `json:"username"`
	FullName  string   `json:"full_name"`
	Password  string   `json:"password"`
	Roles     []string `json:"roles"`
}

// Superadmin: boleh membuat akun untuk desa mana pun (atau superadmin lain tanpa desa).
func (s *Server) handleAdminCreateUser(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeCreateUser(w, r)
	if !ok {
		return
	}
	allowed := map[string]bool{"superadmin": true}
	for k := range villageRoles {
		allowed[k] = true
	}
	s.createUser(w, r, req, allowed, req.VillageID)
}

// Admin desa: hanya untuk desanya sendiri, tidak boleh membuat superadmin.
func (s *Server) handleVillageCreateUser(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeCreateUser(w, r)
	if !ok {
		return
	}
	c := middleware.ClaimsFromContext(r.Context())
	if c.VillageID == "" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akun tidak terikat pada desa"})
		return
	}
	// Abaikan village_id dari klien: selalu pakai desa milik sesi.
	s.createUser(w, r, req, villageRoles, c.VillageID)
}

func decodeCreateUser(w http.ResponseWriter, r *http.Request) (createUserRequest, bool) {
	var req createUserRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Format permintaan tidak valid"})
		return req, false
	}
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	req.FullName = strings.TrimSpace(req.FullName)
	req.Password = strings.TrimSpace(req.Password)
	return req, true
}

func (s *Server) createUser(w http.ResponseWriter, r *http.Request, req createUserRequest, allowed map[string]bool, villageID string) {
	if !usernameRe.MatchString(req.Username) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Username 3-40 karakter: huruf kecil, angka, titik, garis"})
		return
	}
	if req.FullName == "" || len(req.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Nama lengkap wajib diisi dan kata sandi minimal 8 karakter"})
		return
	}
	if len(req.Roles) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Minimal satu role wajib dipilih"})
		return
	}
	isSuper := false
	isDusun := false
	for _, role := range req.Roles {
		if !allowed[role] {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Role tidak diizinkan: " + role})
			return
		}
		if role == "superadmin" {
			isSuper = true
		}
		if role == "kepala_dusun" {
			isDusun = true
		}
	}
	if isSuper && len(req.Roles) > 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Superadmin tidak boleh digabung dengan role desa"})
		return
	}
	if !isSuper && villageID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "village_id wajib untuk akun desa"})
		return
	}
	if isSuper {
		villageID = ""
	}

	dusunID := ""
	if isDusun {
		if req.DusunID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Kepala dusun wajib terikat pada satu dusun"})
			return
		}
		ok, err := s.Store.DusunBelongsToVillage(r.Context(), req.DusunID, villageID)
		if err != nil || !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Dusun tidak ditemukan pada desa ini"})
			return
		}
		dusunID = req.DusunID
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	id, err := s.Store.CreateUser(r.Context(), villageID, dusunID, req.Username, req.FullName, hash, req.Roles)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "Username sudah dipakai"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan server"})
		return
	}
	c := middleware.ClaimsFromContext(r.Context())
	s.Store.Audit(r.Context(), villageID, c.Subject, "USER_CREATED", "user", id, clientIP(r))
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "username": req.Username, "roles": req.Roles})
}
