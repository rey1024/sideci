package handler_test

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rey1024/sideci/backend/internal/auth"
	"github.com/rey1024/sideci/backend/internal/middleware"
)

func TestKepalaDusunRBACAndScopeIsolation(t *testing.T) {
	mux, am := newTestMux(t)

	kadusToken, _, err := am.Issue(auth.KindAccess, "u-kadus", "v-ringdikit", "d-kelodan", "kelodan", "Kelian Kelodan", []string{"kepala_dusun"})
	if err != nil {
		t.Fatal(err)
	}

	// 1. Kepala Dusun DILARANG melakukan impor massal Excel SIAK (403)
	reqImport := httptest.NewRequest(http.MethodPost, "/api/v1/residents/import-xlsx?dry_run=true", nil)
	reqImport.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: kadusToken})
	if rec := serve(mux, am, reqImport); rec.Code != http.StatusForbidden {
		t.Fatalf("kepala_dusun ke import-xlsx: got %d, want 403", rec.Code)
	}

	// 2. Kepala Dusun DILARANG me-review/approve usulan sendiri (403)
	reqReview := httptest.NewRequest(http.MethodPost, "/api/v1/submissions/sub-1/review", bytes.NewReader([]byte(`{"decision":"APPROVED"}`)))
	reqReview.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: kadusToken})
	if rec := serve(mux, am, reqReview); rec.Code != http.StatusForbidden {
		t.Fatalf("kepala_dusun ke review submission: got %d, want 403", rec.Code)
	}

	// 3. Kepala Dusun DILARANG mengirim laporan atas nama dusun lain (d-kajanan != d-kelodan) -> 403
	crossDusunBody := `{"dusun_id":"d-kajanan","submission_type":"BIRTH","payload_after":{"full_name":"Bayi"}}`
	reqCross := httptest.NewRequest(http.MethodPost, "/api/v1/submissions", bytes.NewReader([]byte(crossDusunBody)))
	reqCross.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: kadusToken})
	if rec := serve(mux, am, reqCross); rec.Code != http.StatusForbidden {
		t.Fatalf("kepala_dusun lintas dusun: got %d, want 403", rec.Code)
	}

	// 4. Kepala Dusun DILARANG langsung mengubah/menghapus penduduk atau bypass mutasi tanpa validasi desa -> 403
	for _, tc := range []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodPut, "/api/v1/residents/res-1", `{"nik":"5108020101900001","no_kk":"5108020101900002","full_name":"Uji","gender":"L","birth_date":"1990-01-01"}`},
		{http.MethodDelete, "/api/v1/residents/res-1", ""},
		{http.MethodPost, "/api/v1/residents/res-1/events", `{"event_type":"DEATH","summary":"Wafat"}`},
	} {
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewReader([]byte(tc.body)))
		req.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: kadusToken})
		if rec := serve(mux, am, req); rec.Code != http.StatusForbidden {
			t.Fatalf("kepala_dusun %s %s: got %d, want 403", tc.method, tc.path, rec.Code)
		}
	}
}

func TestOperatorResidentCRUDAndEventValidation(t *testing.T) {
	mux, am := newTestMux(t)
	opToken, _, _ := am.Issue(auth.KindAccess, "u-op", "v-ringdikit", "", "op1", "Operator Kependudukan", []string{"operator_kependudukan"})

	// NIK kurang dari 16 digit ditolak 400 pada PUT /api/v1/residents/{id}
	reqBadPut := httptest.NewRequest(http.MethodPut, "/api/v1/residents/res-1", bytes.NewReader([]byte(`{"nik":"123","no_kk":"5108020101900002","full_name":"Uji","gender":"L","birth_date":"1990-01-01"}`)))
	reqBadPut.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: opToken})
	if rec := serve(mux, am, reqBadPut); rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT NIK pendek: got %d, want 400", rec.Code)
	}

	// Event type tidak dikenal ditolak 400 pada POST /api/v1/residents/{id}/events
	reqBadEv := httptest.NewRequest(http.MethodPost, "/api/v1/residents/res-1/events", bytes.NewReader([]byte(`{"event_type":"UNKNOWN","summary":"Tes"}`)))
	reqBadEv.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: opToken})
	if rec := serve(mux, am, reqBadEv); rec.Code != http.StatusBadRequest {
		t.Fatalf("POST event_type invalid: got %d, want 400", rec.Code)
	}
}

func TestOperatorDryRunImportXLSXEndpoint(t *testing.T) {
	mux, am := newTestMux(t)
	opToken, _, _ := am.Issue(auth.KindAccess, "u-op", "v-ringdikit", "", "op1", "Operator Kependudukan", []string{"operator_kependudukan"})

	// Buat mini .xlsx di memori
	var xlsxBuf bytes.Buffer
	zw := zip.NewWriter(&xlsxBuf)
	w, _ := zw.Create("xl/worksheets/sheet1.xml")
	_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>` +
		`<row r="1"><c r="A1" t="inlineStr"><is><t>NIK</t></is></c><c r="B1" t="inlineStr"><is><t>NO_KK</t></is></c><c r="C1" t="inlineStr"><is><t>NAMA</t></is></c><c r="D1" t="inlineStr"><is><t>JK</t></is></c><c r="E1" t="inlineStr"><is><t>TGL_LHR</t></is></c><c r="F1" t="inlineStr"><is><t>AGAMA</t></is></c><c r="G1" t="inlineStr"><is><t>SHDK</t></is></c><c r="H1" t="inlineStr"><is><t>ALAMAT</t></is></c></row>` +
		`<row r="2"><c r="A2" t="inlineStr"><is><t>5108020101900001</t></is></c><c r="B2" t="inlineStr"><is><t>5108021005150001</t></is></c><c r="C2" t="inlineStr"><is><t>CONTOH WARGA</t></is></c><c r="D2" t="inlineStr"><is><t>L</t></is></c><c r="E2" t="inlineStr"><is><t>08/17/1990 00:00:00</t></is></c><c r="F2" t="inlineStr"><is><t>4</t></is></c><c r="G2" t="inlineStr"><is><t>KEPALA KELUARGA</t></is></c><c r="H2" t="inlineStr"><is><t>BNJAR DINAS MEKAR SARI;KODEPOS :81153</t></is></c></row>` +
		`</sheetData></worksheet>`))
	_ = zw.Close()

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, _ := mw.CreateFormFile("file", "sample.xlsx")
	_, _ = part.Write(xlsxBuf.Bytes())
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/residents/import-xlsx?dry_run=true", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: opToken})

	rec := serve(mux, am, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("dry-run import gagal: status=%d body=%s", rec.Code, rec.Body.String())
	}

	var resp struct {
		DryRun bool `json:"dry_run"`
		Report struct {
			ValidRows            int `json:"valid_rows"`
			AutoHealedDusunCount int `json:"auto_healed_dusun_count"`
		} `json:"report"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if !resp.DryRun || resp.Report.ValidRows != 1 || resp.Report.AutoHealedDusunCount != 1 {
		t.Fatalf("laporan dry-run tidak sesuai: %+v", resp)
	}
}
