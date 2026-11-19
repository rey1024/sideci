package docgen

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"encoding/xml"
	"fmt"
	"strings"
)

//go:embed logo-buleleng.jpg
var bulelengLogoJPG []byte

type DiffDocRow struct {
	DocType     string `json:"doc_type"`
	DocNumber   string `json:"doc_number"`
	WrittenName string `json:"written_name"`
}

type HeirRow struct {
	FullName   string `json:"full_name"`
	TTL        string `json:"ttl"`
	NIK        string `json:"nik"`
	Occupation string `json:"occupation"`
}

type LetterDocData struct {
	TemplateCode  string
	DocumentTitle string // SURAT KETERANGAN, SURAT KETERANGAN KELAHIRAN, dst.
	LetterNumber  string
	IssuedDateStr string // contoh: 19 November 2026
	VerifyQRToken string
	LeaderName    string // I Made Sumadi
	LeaderTitle   string // Perbekel Ringdikit
	Purpose       string

	// Pemohon utama (SK_UMUM / SK_BEDA_NAMA)
	ApplicantName       string
	ApplicantNIK        string
	ApplicantNoKK       string
	ApplicantTTL        string
	ApplicantGender     string
	ApplicantReligion   string
	ApplicantMarital    string
	ApplicantOccupation string
	ApplicantAddress    string
	ExtraStatement      string

	// SK_KELAHIRAN
	ChildName        string
	ChildOrder       string
	ChildBirthPlace  string
	ChildBirthDate   string
	ChildAddress     string
	BirthHelperName  string
	BirthHelperAddr  string
	MotherNIK        string
	MotherName       string
	MotherTTL        string
	MotherAddress    string
	FatherNIK        string
	FatherName       string
	FatherTTL        string
	FatherAddress    string

	// SK_KEMATIAN
	ReporterName     string
	ReporterAddress  string
	ReporterRelation string
	DeathDayDate     string
	DeathPlace       string
	DeathCause       string

	// SK_BEDA_NAMA
	DiffDocs         []DiffDocRow
	ReferenceDocName string

	// SK_WARIS
	DeceasedName  string
	DeceasedDate  string
	DeceasedPlace string
	Heirs         []HeirRow
}

type bodyElement struct {
	Kind    string // "p", "h", "kv", "gap"
	Text    string
	Label   string
	Value   string
	Bold    bool
	Center  bool
	Right   bool
}

func buildElements(d LetterDocData) []bodyElement {
	if d.LeaderName == "" {
		d.LeaderName = "I Made Sumadi"
	}
	if d.LeaderTitle == "" {
		d.LeaderTitle = "Perbekel Ringdikit"
	}
	if d.IssuedDateStr == "" {
		d.IssuedDateStr = "19 November 2026"
	}

	var els []bodyElement

	els = append(els,
		bodyElement{Kind: "p", Text: "Yang bertanda tangan di bawah ini :"},
		bodyElement{Kind: "kv", Label: "Nama", Value: d.LeaderName, Bold: true},
		bodyElement{Kind: "kv", Label: "Jabatan", Value: d.LeaderTitle},
		bodyElement{Kind: "gap"},
	)

	switch strings.ToUpper(d.TemplateCode) {
	case "SK_KELAHIRAN":
		els = append(els,
			bodyElement{Kind: "p", Text: "Dengan ini menerangkan bahwa :"},
			bodyElement{Kind: "kv", Label: "Nama lengkap anak", Value: nonEmpty(d.ChildName, d.ApplicantName), Bold: true},
			bodyElement{Kind: "kv", Label: "Anak ke", Value: nonEmpty(d.ChildOrder, "1")},
			bodyElement{Kind: "kv", Label: "Dilahirkan di", Value: nonEmpty(d.ChildBirthPlace+", "+d.ChildBirthDate, d.ApplicantTTL)},
			bodyElement{Kind: "kv", Label: "Alamat Anak", Value: nonEmpty(d.ChildAddress, d.ApplicantAddress)},
			bodyElement{Kind: "kv", Label: "Penolong Kelahiran", Value: nonEmpty(d.BirthHelperName, "Bidan / Tenaga Kesehatan")},
			bodyElement{Kind: "kv", Label: "Alamat Penolong", Value: nonEmpty(d.BirthHelperAddr, "Kecamatan Seririt")},
			bodyElement{Kind: "gap"},
			bodyElement{Kind: "p", Text: "Adalah anak kandung dari suami istri tersebut di bawah ini :"},
			bodyElement{Kind: "h", Text: "IBU", Bold: true},
			bodyElement{Kind: "kv", Label: "NIK", Value: nonEmpty(d.MotherNIK, "-")},
			bodyElement{Kind: "kv", Label: "Nama", Value: nonEmpty(d.MotherName, "-"), Bold: true},
			bodyElement{Kind: "kv", Label: "Tempat / tanggal lahir", Value: nonEmpty(d.MotherTTL, "-")},
			bodyElement{Kind: "kv", Label: "Alamat", Value: nonEmpty(d.MotherAddress, nonEmpty(d.ChildAddress, "Desa Ringdikit"))},
			bodyElement{Kind: "h", Text: "AYAH", Bold: true},
			bodyElement{Kind: "kv", Label: "NIK", Value: nonEmpty(d.FatherNIK, "-")},
			bodyElement{Kind: "kv", Label: "Nama", Value: nonEmpty(d.FatherName, "-"), Bold: true},
			bodyElement{Kind: "kv", Label: "Tempat / tanggal lahir", Value: nonEmpty(d.FatherTTL, "-")},
			bodyElement{Kind: "kv", Label: "Alamat", Value: nonEmpty(d.FatherAddress, nonEmpty(d.ChildAddress, "Desa Ringdikit"))},
		)

	case "SK_KEMATIAN":
		repLine := fmt.Sprintf(
			"Berdasarkan laporan dari : Nama %s, Alamat : %s, Status Pelapor : %s, dengan ini menerangkan bahwa :",
			nonEmpty(d.ReporterName, "-"),
			nonEmpty(d.ReporterAddress, "Desa Ringdikit"),
			nonEmpty(d.ReporterRelation, "Keluarga"),
		)
		els = append(els,
			bodyElement{Kind: "p", Text: repLine},
			bodyElement{Kind: "kv", Label: "Nama", Value: nonEmpty(d.ApplicantName, "-"), Bold: true},
			bodyElement{Kind: "kv", Label: "NIK", Value: nonEmpty(d.ApplicantNIK, "-")},
			bodyElement{Kind: "kv", Label: "Nomor Kartu Keluarga", Value: nonEmpty(d.ApplicantNoKK, "-")},
			bodyElement{Kind: "kv", Label: "Tempat, tanggal lahir", Value: nonEmpty(d.ApplicantTTL, "-")},
			bodyElement{Kind: "kv", Label: "Jenis Kelamin", Value: nonEmpty(d.ApplicantGender, "-")},
			bodyElement{Kind: "kv", Label: "Kewarganegaraan", Value: "WNI"},
			bodyElement{Kind: "kv", Label: "Agama", Value: nonEmpty(d.ApplicantReligion, "Hindu")},
			bodyElement{Kind: "kv", Label: "Status Perkawinan", Value: nonEmpty(d.ApplicantMarital, "-")},
			bodyElement{Kind: "kv", Label: "Pekerjaan", Value: nonEmpty(d.ApplicantOccupation, "-")},
			bodyElement{Kind: "kv", Label: "Alamat", Value: nonEmpty(d.ApplicantAddress, "Desa Ringdikit")},
			bodyElement{Kind: "gap"},
			bodyElement{Kind: "p", Text: "Telah meninggal dunia, pada :"},
			bodyElement{Kind: "kv", Label: "Hari / tanggal", Value: nonEmpty(d.DeathDayDate, d.IssuedDateStr)},
			bodyElement{Kind: "kv", Label: "Tempat Kematian", Value: nonEmpty(d.DeathPlace, "Desa Ringdikit")},
			bodyElement{Kind: "kv", Label: "Kecamatan", Value: "Seririt"},
			bodyElement{Kind: "kv", Label: "Kabupaten", Value: "Buleleng"},
			bodyElement{Kind: "kv", Label: "Provinsi", Value: "Bali"},
			bodyElement{Kind: "kv", Label: "Sebab kematian", Value: nonEmpty(d.DeathCause, "Sakit")},
		)

	case "SK_BEDA_NAMA":
		els = append(els, bodyElement{Kind: "p", Text: "Dengan ini menerangkan bahwa :"})
		docs := d.DiffDocs
		if len(docs) == 0 {
			docs = []DiffDocRow{
				{DocType: "KTP Elektronik", DocNumber: d.ApplicantNIK, WrittenName: d.ApplicantName},
				{DocType: "Kartu Keluarga (KK)", DocNumber: d.ApplicantNoKK, WrittenName: d.ApplicantName},
			}
		}
		for _, item := range docs {
			els = append(els,
				bodyElement{Kind: "p", Text: fmt.Sprintf("Berdasarkan dokumen %s No. %s :", nonEmpty(item.DocType, "-"), nonEmpty(item.DocNumber, "-"))},
				bodyElement{Kind: "kv", Label: "Nama", Value: nonEmpty(item.WrittenName, d.ApplicantName), Bold: true},
			)
		}
		refDoc := nonEmpty(d.ReferenceDocName, "KTP Elektronik / Kartu Keluarga")
		els = append(els,
			bodyElement{Kind: "gap"},
			bodyElement{Kind: "p", Text: fmt.Sprintf("Nama-nama tersebut di atas adalah benar milik satu orang yang sama, dan nama yang berlaku mengacu pada yang tercantum dalam %s.", refDoc)},
		)

	case "SK_WARIS":
		els = append(els, bodyElement{Kind: "p", Text: "Dengan ini menerangkan bahwa :"})
		heirs := d.Heirs
		if len(heirs) == 0 {
			heirs = []HeirRow{
				{FullName: d.ApplicantName, TTL: d.ApplicantTTL, NIK: d.ApplicantNIK, Occupation: d.ApplicantOccupation},
			}
		}
		for idx, h := range heirs {
			els = append(els,
				bodyElement{Kind: "kv", Label: fmt.Sprintf("%d. Nama", idx+1), Value: nonEmpty(h.FullName, "-"), Bold: true},
				bodyElement{Kind: "kv", Label: "    Tempat/tanggal lahir", Value: nonEmpty(h.TTL, "-")},
				bodyElement{Kind: "kv", Label: "    NIK", Value: nonEmpty(h.NIK, "-")},
				bodyElement{Kind: "kv", Label: "    Pekerjaan", Value: nonEmpty(h.Occupation, "-")},
			)
		}
		els = append(els,
			bodyElement{Kind: "gap"},
			bodyElement{
				Kind: "p",
				Text: fmt.Sprintf(
					"Sepengetahuan kami, bahwa nama-nama tersebut di atas adalah benar ahli waris dari %s yang telah meninggal dunia pada tanggal %s di %s.",
					nonEmpty(d.DeceasedName, "-"),
					nonEmpty(d.DeceasedDate, "-"),
					nonEmpty(d.DeceasedPlace, "Desa Ringdikit Kecamatan Seririt Kabupaten Buleleng"),
				),
			},
		)

	default: // SK_UMUM
		els = append(els,
			bodyElement{Kind: "p", Text: "Dengan ini menerangkan bahwa :"},
			bodyElement{Kind: "kv", Label: "Nama", Value: nonEmpty(d.ApplicantName, "-"), Bold: true},
			bodyElement{Kind: "kv", Label: "NIK", Value: nonEmpty(d.ApplicantNIK, "-")},
			bodyElement{Kind: "kv", Label: "Tempat, tanggal lahir", Value: nonEmpty(d.ApplicantTTL, "-")},
			bodyElement{Kind: "kv", Label: "Jenis Kelamin", Value: nonEmpty(d.ApplicantGender, "-")},
			bodyElement{Kind: "kv", Label: "Agama", Value: nonEmpty(d.ApplicantReligion, "Hindu")},
			bodyElement{Kind: "kv", Label: "Status Perkawinan", Value: nonEmpty(d.ApplicantMarital, "-")},
			bodyElement{Kind: "kv", Label: "Pekerjaan", Value: nonEmpty(d.ApplicantOccupation, "-")},
			bodyElement{Kind: "kv", Label: "Alamat", Value: nonEmpty(d.ApplicantAddress, "Desa Ringdikit")},
			bodyElement{Kind: "gap"},
			bodyElement{Kind: "h", Text: "Keterangan:", Bold: true},
			bodyElement{Kind: "p", Text: "Orang tersebut di atas benar-benar penduduk Desa Ringdikit Kecamatan Seririt Kabupaten Buleleng."},
			bodyElement{Kind: "p", Text: nonEmpty(d.ExtraStatement, "Sepanjang sepengetahuan kami orang tersebut di atas berkelakuan baik dan terdaftar aktif dalam administrasi kependudukan Desa Ringdikit.")},
		)
	}

	els = append(els,
		bodyElement{Kind: "gap"},
		bodyElement{Kind: "p", Text: "Surat Keterangan ini digunakan untuk :"},
		bodyElement{Kind: "p", Text: nonEmpty(d.Purpose, "Melengkapi persyaratan administrasi"), Bold: true},
		bodyElement{Kind: "gap"},
		bodyElement{Kind: "p", Text: "Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya."},
	)

	return els
}

// BuildLetterDOCX menghasilkan berkas Microsoft Word (.docx) resmi sesuai format surat Desa Ringdikit.
func BuildLetterDOCX(d LetterDocData) ([]byte, error) {
	title := strings.ToUpper(nonEmpty(d.DocumentTitle, "SURAT KETERANGAN"))
	number := nonEmpty(d.LetterNumber, "147/0001/XI/2026")
	els := buildElements(d)

	var docBody strings.Builder

	// 1. KOP SURAT RESMI (Tabel 2 Kolom: Logo Kabupaten Buleleng + Teks Kop)
	docBody.WriteString(`<w:tbl>
<w:tblPr>
  <w:tblW w:w="9600" w:type="dxa"/>
  <w:tblBorders>
    <w:bottom w:val="double" w:sz="18" w:space="4" w:color="000000"/>
  </w:tblBorders>
</w:tblPr>
<w:tr>
  <w:tc>
    <w:tcPr><w:tcW w:w="1400" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="685800" cy="641350"/>
            <wp:docPr id="1" name="Logo Kabupaten Buleleng"/>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr><pic:cNvPr id="1" name="logo.jpg"/><pic:cNvPicPr/></pic:nvPicPr>
                  <pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                  <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="685800" cy="641350"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  </w:tc>
  <w:tc>
    <w:tcPr><w:tcW w:w="8200" w:type="dxa"/></w:tcPr>
    ` + wParaCenter("PEMERINTAH KABUPATEN BULELENG", 28, true, false) + `
    ` + wParaCenter("KECAMATAN SERIRIT", 28, true, false) + `
    ` + wParaCenter("PERBEKEL RINGDIKIT", 32, true, false) + `
    ` + wParaCenter("Jalan Seririt – Pupuan Desa Ringdikit 81153", 20, false, false) + `
    ` + wParaCenter("Telp.+62 878 5875 5564 e-mail : desaringdikit@gmail.com", 20, false, false) + `
  </w:tc>
</w:tr>
</w:tbl>`)

	// 2. JUDUL SURAT & NOMOR SURAT
	docBody.WriteString(wParaCenter("", 20, false, false))
	docBody.WriteString(wParaCenter(title, 26, true, true))
	docBody.WriteString(wParaCenter("Nomor : "+number, 24, false, false))
	docBody.WriteString(wParaCenter("", 16, false, false))

	// 3. ISI SURAT
	for _, el := range els {
		switch el.Kind {
		case "gap":
			docBody.WriteString(wParaLeft("", 12, false))
		case "h":
			docBody.WriteString(wParaLeft(el.Text, 24, true))
		case "p":
			docBody.WriteString(wParaLeft(el.Text, 24, el.Bold))
		case "kv":
			docBody.WriteString(wKVRow(el.Label, el.Value, el.Bold))
		}
	}

	// 4. BLOK TANDA TANGAN PERBEKEL & INFO VERIFIKASI QR
	docBody.WriteString(wParaLeft("", 20, false))
	docBody.WriteString(fmt.Sprintf(`<w:tbl>
<w:tblPr><w:tblW w:w="9600" w:type="dxa"/></w:tblPr>
<w:tr>
  <w:tc>
    <w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>
    %s
    %s
  </w:tc>
  <w:tc>
    <w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>
    %s
    %s
    %s
    %s
    %s
  </w:tc>
</w:tr>
</w:tbl>`,
		wParaLeft("Verifikasi Elektronik SIDECI:", 18, true),
		wParaLeft("https://sideci.reisys.id/ringdikit/verify/"+nonEmpty(d.VerifyQRToken, "rdk-verified"), 18, false),
		wParaCenter("Ringdikit, "+d.IssuedDateStr, 24, false, false),
		wParaCenter(d.LeaderTitle, 24, false, false),
		wParaCenter("", 24, false, false),
		wParaCenter("", 24, false, false),
		wParaCenter(d.LeaderName, 24, true, true),
	))

	documentXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    ` + docBody.String() + `
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	files := map[string][]byte{
		"[Content_Types].xml": []byte(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
		"_rels/.rels": []byte(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
		"word/_rels/document.xml.rels": []byte(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.jpg"/>
</Relationships>`),
		"word/document.xml":   []byte(documentXML),
		"word/media/logo.jpg": bulelengLogoJPG,
	}

	for name, content := range files {
		f, err := zw.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := f.Write(content); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// BuildLetterPDF menghasilkan dokumen PDF A4 resmi lengkap dengan logo Kabupaten Buleleng & format surat Desa Ringdikit.
func BuildLetterPDF(d LetterDocData) ([]byte, error) {
	title := strings.ToUpper(nonEmpty(d.DocumentTitle, "SURAT KETERANGAN"))
	number := nonEmpty(d.LetterNumber, "147/0001/XI/2026")
	els := buildElements(d)

	var s strings.Builder

	// 1. Gambar Logo Kabupaten Buleleng di kiri atas Kop Surat (x=55, y=732, w=54, h=50)
	s.WriteString("q 54 0 0 50 55 732 cm /ImLogo Do Q\n")

	// 2. Teks Kop Surat Resmi (Rata Tengah)
	s.WriteString(pdfTextCentered("/F2", 13, 770, "PEMERINTAH KABUPATEN BULELENG"))
	s.WriteString(pdfTextCentered("/F2", 13, 754, "KECAMATAN SERIRIT"))
	s.WriteString(pdfTextCentered("/F2", 15, 737, "PERBEKEL RINGDIKIT"))
	s.WriteString(pdfTextCentered("/F1", 9.5, 723, "Jalan Seririt - Pupuan Desa Ringdikit 81153"))
	s.WriteString(pdfTextCentered("/F1", 9.5, 711, "Telp.+62 878 5875 5564 e-mail : desaringdikit@gmail.com"))

	// Garis ganda Kop Surat
	s.WriteString("2 w 50 701 m 545 701 l S\n")
	s.WriteString("0.7 w 50 698 m 545 698 l S\n")

	// 3. Judul Surat & Nomor Surat
	s.WriteString(pdfTextCentered("/F2", 12.5, 675, title))
	titleW := float64(len(title)) * 6.8
	x1 := (595.0 - titleW) / 2.0
	s.WriteString(fmt.Sprintf("0.9 w %.1f 672 m %.1f 672 l S\n", x1, x1+titleW))
	s.WriteString(pdfTextCentered("/F1", 11, 659, "Nomor : "+number))

	// 4. Isi Surat
	y := 634.0
	for _, el := range els {
		if y < 140 {
			break
		}
		switch el.Kind {
		case "gap":
			y -= 8
		case "h":
			s.WriteString(pdfTextAt("/F2", 11, 60, y, el.Text))
			y -= 16
		case "p":
			font := "/F1"
			if el.Bold {
				font = "/F2"
			}
			lines := wrapText(el.Text, 78)
			for _, ln := range lines {
				s.WriteString(pdfTextAt(font, 10.8, 60, y, ln))
				y -= 15
			}
		case "kv":
			valFont := "/F1"
			if el.Bold {
				valFont = "/F2"
			}
			s.WriteString(pdfTextAt("/F1", 10.8, 72, y, el.Label))
			s.WriteString(pdfTextAt("/F1", 10.8, 225, y, ":"))
			valLines := wrapText(el.Value, 52)
			for i, vln := range valLines {
				s.WriteString(pdfTextAt(valFont, 10.8, 236, y, vln))
				if i < len(valLines)-1 {
					y -= 14
				}
			}
			y -= 15.5
		}
	}

	// 5. Blok Tanda Tangan Perbekel & Kotak Verifikasi QR
	sigY := y - 16
	if sigY < 130 {
		sigY = 130
	}
	s.WriteString(pdfTextAt("/F2", 9, 60, sigY-10, "Kode Verifikasi Keaslian (SIDECI QR):"))
	s.WriteString(pdfTextAt("/F1", 8.5, 60, sigY-23, "https://sideci.reisys.id/ringdikit/verify/"+nonEmpty(d.VerifyQRToken, "rdk-verified")))

	s.WriteString(pdfTextAt("/F1", 10.8, 375, sigY, "Ringdikit, "+d.IssuedDateStr))
	s.WriteString(pdfTextAt("/F1", 10.8, 388, sigY-15, d.LeaderTitle))
	s.WriteString(pdfTextAt("/F2", 11, 385, sigY-68, d.LeaderName))

	streamBytes := []byte(s.String())

	// Rakit objek PDF 1.4
	var pdf bytes.Buffer
	pdf.WriteString("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
	offsets := make([]int, 8)

	writeObj := func(id int, body []byte) {
		offsets[id] = pdf.Len()
		pdf.WriteString(fmt.Sprintf("%d 0 obj\n", id))
		pdf.Write(body)
		pdf.WriteString("\nendobj\n")
	}

	writeObj(1, []byte(`<< /Type /Catalog /Pages 2 0 R >>`))
	writeObj(2, []byte(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`))
	writeObj(3, []byte(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /ImLogo 6 0 R >> >> /Contents 7 0 R >>`))
	writeObj(4, []byte(`<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>`))
	writeObj(5, []byte(`<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>`))

	var imgObj bytes.Buffer
	imgObj.WriteString(fmt.Sprintf("<< /Type /XObject /Subtype /Image /Width 232 /Height 217 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n", len(bulelengLogoJPG)))
	imgObj.Write(bulelengLogoJPG)
	imgObj.WriteString("\nendstream")
	writeObj(6, imgObj.Bytes())

	var contentObj bytes.Buffer
	contentObj.WriteString(fmt.Sprintf("<< /Length %d >>\nstream\n", len(streamBytes)))
	contentObj.Write(streamBytes)
	contentObj.WriteString("endstream")
	writeObj(7, contentObj.Bytes())

	xrefPos := pdf.Len()
	pdf.WriteString("xref\n0 8\n0000000000 65535 f \n")
	for i := 1; i <= 7; i++ {
		pdf.WriteString(fmt.Sprintf("%010d 00000 n \n", offsets[i]))
	}
	pdf.WriteString(fmt.Sprintf("trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", xrefPos))

	return pdf.Bytes(), nil
}

func xmlEsc(s string) string {
	var b bytes.Buffer
	_ = xml.EscapeText(&b, []byte(s))
	return b.String()
}

func wParaCenter(text string, szHalfPt int, bold, underline bool) string {
	bTag := ""
	if bold {
		bTag = "<w:b/>"
	}
	uTag := ""
	if underline {
		uTag = `<w:u w:val="single"/>`
	}
	return fmt.Sprintf(`<w:p>
  <w:pPr><w:spacing w:after="40" w:line="260" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>
  <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>%s%s<w:sz w:val="%d"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r>
</w:p>`, bTag, uTag, szHalfPt, xmlEsc(text))
}

func wParaLeft(text string, szHalfPt int, bold bool) string {
	bTag := ""
	if bold {
		bTag = "<w:b/>"
	}
	return fmt.Sprintf(`<w:p>
  <w:pPr><w:spacing w:after="60" w:line="276" w:lineRule="auto"/></w:pPr>
  <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>%s<w:sz w:val="%d"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r>
</w:p>`, bTag, szHalfPt, xmlEsc(text))
}

func wKVRow(label, value string, boldVal bool) string {
	bTag := ""
	if boldVal {
		bTag = "<w:b/>"
	}
	return fmt.Sprintf(`<w:tbl>
<w:tblPr><w:tblW w:w="9400" w:type="dxa"/></w:tblPr>
<w:tr>
  <w:tc><w:tcPr><w:tcW w:w="2700" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="30"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p></w:tc>
  <w:tc><w:tcPr><w:tcW w:w="240" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="30"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t>:</w:t></w:r></w:p></w:tc>
  <w:tc><w:tcPr><w:tcW w:w="6460" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="30"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>%s<w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p></w:tc>
</w:tr>
</w:tbl>`, xmlEsc(label), bTag, xmlEsc(value))
}

func pdfEsc(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `(`, `\(`, `)`, `\)`, "–", "-", "—", "-", "“", `"`, "”", `"`)
	out := r.Replace(s)
	// Jaga karakter tetap dalam rentang WinAnsi / ASCII cetak
	var clean strings.Builder
	for _, ch := range out {
		if ch >= 32 && ch <= 255 {
			clean.WriteRune(ch)
		} else {
			clean.WriteByte(' ')
		}
	}
	return clean.String()
}

func pdfTextAt(font string, size, x, y float64, text string) string {
	return fmt.Sprintf("BT %s %.1f Tf %.1f %.1f Td (%s) Tj ET\n", font, size, x, y, pdfEsc(text))
}

func pdfTextCentered(font string, size, y float64, text string) string {
	approxW := float64(len(text)) * (size * 0.5)
	x := (595.0 - approxW) / 2.0
	if x < 50 {
		x = 50
	}
	return pdfTextAt(font, size, x, y, text)
}

func wrapText(s string, maxChars int) []string {
	words := strings.Fields(s)
	if len(words) == 0 {
		return []string{""}
	}
	var lines []string
	cur := words[0]
	for _, w := range words[1:] {
		if len(cur)+1+len(w) <= maxChars {
			cur += " " + w
		} else {
			lines = append(lines, cur)
			cur = w
		}
	}
	lines = append(lines, cur)
	return lines
}

func nonEmpty(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return strings.TrimSpace(v)
}
