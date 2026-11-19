package docgen

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"
)

func TestBuildLetterDOCXAndPDFAllTemplates(t *testing.T) {
	templates := []struct {
		code  string
		title string
	}{
		{"SK_UMUM", "SURAT KETERANGAN"},
		{"SK_KELAHIRAN", "SURAT KETERANGAN KELAHIRAN"},
		{"SK_KEMATIAN", "SURAT KETERANGAN KEMATIAN"},
		{"SK_BEDA_NAMA", "SURAT KETERANGAN BEDA NAMA"},
		{"SK_WARIS", "SURAT KETERANGAN WARIS"},
	}

	for _, tc := range templates {
		data := LetterDocData{
			TemplateCode:        tc.code,
			DocumentTitle:       tc.title,
			LetterNumber:        "470 / 0042 / XI / 2026",
			IssuedDateStr:       "19 November 2026",
			VerifyQRToken:       "qr-test-token-12345",
			LeaderName:          "I Made Sumadi",
			LeaderTitle:         "Perbekel Ringdikit",
			Purpose:             "Persyaratan Administrasi Bank",
			ApplicantName:       "Komang Rodi Gunawan",
			ApplicantNIK:        "5108040101900001",
			ApplicantTTL:        "Ringdikit, 01-01-1990",
			ApplicantGender:     "LAKI-LAKI",
			ApplicantReligion:   "HINDU",
			ApplicantMarital:    "KAWIN",
			ApplicantOccupation: "WIRASWASTA",
			ApplicantAddress:    "BD. Kelodan Desa Ringdikit",
			ExtraStatement:      "Sepengetahuan kami memang benar orang tersebut di atas adalah penduduk Desa Ringdikit Kecamatan Seririt Kabupaten Buleleng.",
		}

		docxBytes, err := BuildLetterDOCX(data)
		if err != nil {
			t.Fatalf("BuildLetterDOCX(%s) error: %v", tc.code, err)
		}
		if len(docxBytes) < 15000 {
			t.Fatalf("BuildLetterDOCX(%s) too small (%d bytes), expected embedded logo", tc.code, len(docxBytes))
		}
		zr, err := zip.NewReader(bytes.NewReader(docxBytes), int64(len(docxBytes)))
		if err != nil {
			t.Fatalf("BuildLetterDOCX(%s) invalid zip: %v", tc.code, err)
		}
		hasDocXML := false
		hasLogo := false
		for _, f := range zr.File {
			if f.Name == "word/document.xml" {
				hasDocXML = true
			}
			if f.Name == "word/media/logo.jpg" {
				hasLogo = true
			}
		}
		if !hasDocXML || !hasLogo {
			t.Fatalf("BuildLetterDOCX(%s) missing word/document.xml (%v) or word/media/logo.jpg (%v)", tc.code, hasDocXML, hasLogo)
		}

		pdfBytes, err := BuildLetterPDF(data)
		if err != nil {
			t.Fatalf("BuildLetterPDF(%s) error: %v", tc.code, err)
		}
		if !strings.HasPrefix(string(pdfBytes[:8]), "%PDF-1.4") {
			t.Fatalf("BuildLetterPDF(%s) invalid PDF header", tc.code)
		}
		if len(pdfBytes) < 15000 {
			t.Fatalf("BuildLetterPDF(%s) too small (%d bytes), expected embedded logo", tc.code, len(pdfBytes))
		}
	}
}
