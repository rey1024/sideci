package importer_test

import (
	"archive/zip"
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/rey1024/sideci/backend/internal/importer"
)

func buildSyntheticXLSX(t *testing.T, rows [][]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	w, err := zw.Create("xl/worksheets/sheet1.xml")
	if err != nil {
		t.Fatal(err)
	}
	var xmlBuf bytes.Buffer
	xmlBuf.WriteString(`<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>`)
	for rIdx, row := range rows {
		xmlBuf.WriteString(fmt.Sprintf(`<row r="%d">`, rIdx+1))
		for cIdx, val := range row {
			col := colName(cIdx)
			xmlBuf.WriteString(fmt.Sprintf(`<c r="%s%d" t="inlineStr"><is><t>%s</t></is></c>`, col, rIdx+1, val))
		}
		xmlBuf.WriteString(`</row>`)
	}
	xmlBuf.WriteString(`</sheetData></worksheet>`)
	if _, err := w.Write(xmlBuf.Bytes()); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func colName(n int) string {
	var s string
	for n >= 0 {
		s = string(rune('A'+(n%26))) + s
		n = n/26 - 1
	}
	return s
}

func TestParseSIAKXLSX_NormalizesCodesDatesAndFuzzyDusun(t *testing.T) {
	headers := []string{
		"NIK", "NO_KK", "NAMA", "JK", "TMPT_LHR", "TGL_LHR",
		"AGAMA", "STATUS", "SHDK", "SHDRT", "PDDK_AKHIR", "PEKERJAAN",
		"AKTA_LHR", "TGL_KWN", "ALAMAT", "NAMA_DUSUN",
	}
	rows := [][]string{
		headers,
		// Baris 1: Kode SIAK AGAMA=4 (Hindu), tanggal US MM/DD/YYYY, TGL_KWN DD-MON-YY, dusun normal
		{
			"5108020101850001", "5108021005120001", "PUTU CONTOH SATU", "L", "RINGDIKIT", "08/07/1989 00:00:00",
			"4", "KAWIN", "KEPALA KELUARGA", "1", "SLTA/SEDERAJAT", "WIRASWASTA",
			"2", "19-NOV-09", "BANJAR DINAS KAJANAN;RT :;KODEPOS :81153;TELP :", "Kajanan",
		},
		// Baris 2: Dusun kosong, tetapi alamat tertulis typo "BNJAR DINAS MEKAR SARI" -> auto-heal ke "Sari Mekar", + duplikat Kepala Keluarga di KK yang sama
		{
			"5108024202880002", "5108021005120001", "KADEK CONTOH DUA", "P", "SERIRIT", "12/25/1990 00:00:00",
			"1", "KAWIN", "", "1", "TAMAT SD/SEDERAJAT", "PEDAGANG",
			"1", "", "BNJAR DINAS MEKAR SARI;RT :;RW :;KODEPOS :81153", "",
		},
		// Baris 3: NIK tidak 16 digit -> terdeteksi sebagai anomali
		{
			"12345", "5108021005120001", "BARIS TIDAK VALID", "L", "BALI", "01/01/2000",
			"4", "BELUM KAWIN", "ANAK", "4", "", "", "1", "", "BANJAR DINAS RAWA", "Rawa",
		},
	}

	xlsx := buildSyntheticXLSX(t, rows)
	rep, err := importer.ParseSIAKXLSX(xlsx, []string{"Kajanan", "Kelodan", "Kuwum", "Rawa", "Sari Mekar"})
	if err != nil {
		t.Fatalf("ParseSIAKXLSX gagal: %v", err)
	}

	if rep.ValidRows != 2 || rep.InvalidRowCount != 1 {
		t.Fatalf("ekspektasi 2 valid & 1 invalid, dapat valid=%d invalid=%d", rep.ValidRows, rep.InvalidRowCount)
	}
	if rep.AutoHealedDusunCount != 1 {
		t.Fatalf("ekspektasi 1 dusun auto-healed, dapat %d", rep.AutoHealedDusunCount)
	}
	if rep.DuplicateKKHeadCount != 1 {
		t.Fatalf("ekspektasi 1 duplikat Kepala Keluarga, dapat %d", rep.DuplicateKKHeadCount)
	}

	r0 := rep.Residents[0]
	if r0.Religion != "Hindu" || r0.BirthDate != "1989-08-07" || r0.PostalCode != "81153" {
		t.Fatalf("normalisasi baris 1 tidak sesuai: %+v", r0)
	}
	if r0.CivilDocs["tgl_kawin"] != "2009-11-19" || r0.CivilDocs["akta_lahir_status"] != "ADA" {
		t.Fatalf("normalisasi dokumen sipil tidak sesuai: %+v", r0.CivilDocs)
	}

	r1 := rep.Residents[1]
	if r1.DusunName != "Sari Mekar" || !r1.DusunHealed || r1.Religion != "Islam" || r1.SHDK != "KEPALA KELUARGA" {
		t.Fatalf("auto-heal dusun / SHDRT baris 2 gagal: %+v", r1)
	}
}

// TestParseRealRingdikitDatasetIfPresent memverifikasi kompatibilitas 100% terhadap file Excel referensi lokal
// tanpa mencetak NIK atau nama warga apa pun ke log test (patuh UU PDP).
func TestParseRealRingdikitDatasetIfPresent(t *testing.T) {
	relPath := filepath.Join("..", "..", "..", "docs", "referensi", "data penduduk", "Data_Kependudukan_Desa_Ringdikit.xlsx")
	raw, err := os.ReadFile(relPath)
	if err != nil {
		t.Skip("File referensi lokal tidak tersedia di lingkungan CI (normal karena gitignored)")
	}
	rep, err := importer.ParseSIAKXLSX(raw, []string{"Kajanan", "Kelodan", "Kuwum", "Rawa", "Sari Mekar"})
	if err != nil {
		t.Fatalf("gagal mem-parse dataset Desa Ringdikit: %v", err)
	}
	if rep.TotalRows != 5393 {
		t.Fatalf("ekspektasi 5393 baris pada dataset Ringdikit, dapat %d", rep.TotalRows)
	}
	if rep.ValidRows < 5380 {
		t.Fatalf("terlalu sedikit baris valid: %d dari %d", rep.ValidRows, rep.TotalRows)
	}
	t.Logf("Verifikasi Agregat Ringdikit (0 PII): total=%d, valid=%d, kk=%d, auto_healed_dusun=%d, sisa_unmapped=%d, dup_kk_head=%d",
		rep.TotalRows, rep.ValidRows, rep.UniqueHouseholds, rep.AutoHealedDusunCount, rep.UnmappedDusunCount, rep.DuplicateKKHeadCount)
}
