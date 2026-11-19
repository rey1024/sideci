package importer

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"
)

// NormalizedResident represents one cleaned, validated SIAK row ready for PostgreSQL.
type NormalizedResident struct {
	RowNumber     int               `json:"row_number"`
	NIK           string            `json:"nik"`
	NoKK          string            `json:"no_kk"`
	FullName      string            `json:"full_name"`
	Gender        string            `json:"gender"`
	BirthPlace    string            `json:"birth_place"`
	BirthDate     string            `json:"birth_date"` // YYYY-MM-DD
	BloodType     string            `json:"blood_type"`
	Religion      string            `json:"religion"`
	MaritalStatus string            `json:"marital_status"`
	SHDK          string            `json:"shdk"`
	Education     string            `json:"education"`
	Occupation    string            `json:"occupation"`
	FatherName    string            `json:"father_name"`
	MotherName    string            `json:"mother_name"`
	Address       string            `json:"address"`
	PostalCode    string            `json:"postal_code"`
	DusunName     string            `json:"dusun_name"`
	DusunHealed   bool              `json:"dusun_healed"`
	CivilDocs     map[string]string `json:"civil_docs"`
}

type RowAnomaly struct {
	RowNumber int    `json:"row_number"`
	Code      string `json:"code"`
	Detail    string `json:"detail"`
}

type ParseReport struct {
	TotalRows            int                  `json:"total_rows"`
	ValidRows            int                  `json:"valid_rows"`
	UniqueHouseholds     int                  `json:"unique_households"`
	AutoHealedDusunCount int                  `json:"auto_healed_dusun_count"`
	UnmappedDusunCount   int                  `json:"unmapped_dusun_count"`
	DuplicateKKHeadCount int                  `json:"duplicate_kk_head_count"`
	InvalidRowCount      int                  `json:"invalid_row_count"`
	DusunDistribution    map[string]int       `json:"dusun_distribution"`
	Anomalies            []RowAnomaly         `json:"anomalies"`
	Residents            []NormalizedResident `json:"-"`
}

var religionCodeMap = map[string]string{
	"1": "Islam",
	"2": "Kristen",
	"3": "Katolik",
	"4": "Hindu",
	"5": "Buddha",
	"6": "Konghucu",
	"7": "Kepercayaan",
}

var shdrtCodeMap = map[string]string{
	"1":  "KEPALA KELUARGA",
	"2":  "SUAMI",
	"3":  "ISTRI",
	"4":  "ANAK",
	"5":  "MENANTU",
	"6":  "CUCU",
	"7":  "ORANGTUA",
	"8":  "MERTUA",
	"9":  "FAMILI LAIN",
	"10": "PEMBANTU",
	"11": "LAINNYA",
}

// ParseSIAKXLSX parses an .xlsx file compatible with Data_Kependudukan_Desa_Ringdikit.xlsx.
// knownDusuns lists canonical dusun/banjar names for the target village (e.g. ["Kajanan", "Kelodan", ...]).
func ParseSIAKXLSX(xlsxBytes []byte, knownDusuns []string) (*ParseReport, error) {
	zr, err := zip.NewReader(bytes.NewReader(xlsxBytes), int64(len(xlsxBytes)))
	if err != nil {
		return nil, fmt.Errorf("file bukan arsip .xlsx yang valid: %w", err)
	}

	sharedStrings, err := readSharedStrings(zr)
	if err != nil {
		return nil, err
	}
	rawRows, err := readFirstSheetRows(zr, sharedStrings)
	if err != nil {
		return nil, err
	}
	if len(rawRows) < 2 {
		return nil, fmt.Errorf("sheet penduduk kosong atau tidak memiliki baris data")
	}

	headers := make(map[string]string)
	for col, val := range rawRows[0] {
		headers[col] = strings.ToUpper(strings.TrimSpace(val))
	}

	dusunLookup := buildDusunMatcher(knownDusuns)

	report := &ParseReport{
		TotalRows:         len(rawRows) - 1,
		DusunDistribution: make(map[string]int),
	}

	kkSet := make(map[string]struct{})
	kkHeadCount := make(map[string]int)

	for i := 1; i < len(rawRows); i++ {
		rowNum := i + 1
		cells := rawRows[i]
		byName := make(map[string]string, len(cells))
		for col, val := range cells {
			if h, ok := headers[col]; ok && h != "" {
				byName[h] = strings.TrimSpace(val)
			}
		}

		nik := digitsOnly(byName["NIK"])
		noKK := digitsOnly(byName["NO_KK"])
		name := strings.TrimSpace(byName["NAMA"])
		if nik == "" && name == "" {
			report.TotalRows--
			continue
		}
		if len(nik) != 16 {
			report.InvalidRowCount++
			appendAnomaly(report, rowNum, "INVALID_NIK", "NIK tidak terdiri dari 16 digit angka")
			continue
		}
		if len(noKK) != 16 {
			report.InvalidRowCount++
			appendAnomaly(report, rowNum, "INVALID_NO_KK", "Nomor KK tidak terdiri dari 16 digit angka")
			continue
		}

		gender := strings.ToUpper(byName["JK"])
		if gender == "1" || strings.HasPrefix(gender, "L") {
			gender = "L"
		} else if gender == "0" || strings.HasPrefix(gender, "P") {
			gender = "P"
		} else {
			gender = "L"
		}

		birthDate, ok := parseSIAKDate(byName["TGL_LHR"])
		if !ok {
			birthDate = "1970-01-01"
			appendAnomaly(report, rowNum, "FALLBACK_BIRTH_DATE", "Format TGL_LHR tidak dikenali, disetel ke 1970-01-01")
		}

		religion := normalizeReligion(byName["AGAMA"])
		shdk := normalizeSHDK(byName["SHDK"], byName["SHDRT"])
		marital := normalizeMarital(byName["STATUS"])
		cleanAddr, postal := parseSemiAddress(byName["ALAMAT"])

		dusunName, healed := matchDusun(byName["NAMA_DUSUN"], byName["ALAMAT"], dusunLookup)
		if healed {
			report.AutoHealedDusunCount++
		}
		if dusunName == "" {
			report.UnmappedDusunCount++
			appendAnomaly(report, rowNum, "UNMAPPED_DUSUN", "Dusun kosong / tidak cocok pada kolom NAMA_DUSUN maupun ALAMAT")
		} else {
			report.DusunDistribution[dusunName]++
		}

		kkSet[noKK] = struct{}{}
		if shdk == "KEPALA KELUARGA" {
			kkHeadCount[noKK]++
		}

		civilDocs := map[string]string{}
		for _, kv := range [][2]string{
			{"akta_lahir_status", normalizeDocFlag(byName["AKTA_LHR"])},
			{"no_akta_lahir", byName["NO_AKTA_LHR"]},
			{"akta_kawin_status", normalizeDocFlag(byName["AKTA_KWN"])},
			{"no_akta_kawin", byName["NO_AKTA_KWN"]},
			{"tgl_kawin", normalizeOptionalDate(byName["TGL_KWN"])},
			{"akta_cerai_status", normalizeDocFlag(byName["AKTA_CRAI"])},
			{"no_akta_cerai", byName["NO_AKTA_CRAI"]},
			{"tgl_cerai", normalizeOptionalDate(byName["TGL_CRAI"])},
			{"no_paspor", byName["NO_PASPOR"]},
		} {
			if kv[1] != "" {
				civilDocs[kv[0]] = kv[1]
			}
		}

		blood := byName["GDR"]
		if blood == "" {
			blood = "-"
		}

		res := NormalizedResident{
			RowNumber:     rowNum,
			NIK:           nik,
			NoKK:          noKK,
			FullName:      name,
			Gender:        gender,
			BirthPlace:    defaultIfEmpty(byName["TMPT_LHR"], "-"),
			BirthDate:     birthDate,
			BloodType:     blood,
			Religion:      religion,
			MaritalStatus: marital,
			SHDK:          shdk,
			Education:     defaultIfEmpty(byName["PDDK_AKHIR"], "TIDAK/BELUM SEKOLAH"),
			Occupation:    defaultIfEmpty(byName["PEKERJAAN"], "BELUM/TIDAK BEKERJA"),
			FatherName:    cleanDash(byName["NAMA_AYAH"]),
			MotherName:    cleanDash(byName["NAMA_IBU"]),
			Address:       defaultIfEmpty(cleanAddr, "-"),
			PostalCode:    postal,
			DusunName:     dusunName,
			DusunHealed:   healed,
			CivilDocs:     civilDocs,
		}
		report.Residents = append(report.Residents, res)
		report.ValidRows++
	}

	report.UniqueHouseholds = len(kkSet)
	for _, count := range kkHeadCount {
		if count > 1 {
			report.DuplicateKKHeadCount++
		}
	}
	if report.DuplicateKKHeadCount > 0 {
		appendAnomaly(report, 0, "DUPLICATE_KK_HEAD",
			fmt.Sprintf("Ditemukan %d Nomor KK yang memiliki lebih dari satu Kepala Keluarga", report.DuplicateKKHeadCount))
	}

	return report, nil
}

func appendAnomaly(r *ParseReport, row int, code, detail string) {
	if len(r.Anomalies) < 50 {
		r.Anomalies = append(r.Anomalies, RowAnomaly{RowNumber: row, Code: code, Detail: detail})
	}
}

func digitsOnly(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			b.WriteByte(s[i])
		}
	}
	return b.String()
}

func normalizeReligion(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if mapped, ok := religionCodeMap[trimmed]; ok {
		return mapped
	}
	if trimmed == "" {
		return "Lainnya"
	}
	return strings.Title(strings.ToLower(trimmed))
}

func normalizeSHDK(shdk, shdrt string) string {
	s := strings.ToUpper(strings.TrimSpace(shdk))
	if s != "" {
		return s
	}
	if mapped, ok := shdrtCodeMap[strings.TrimSpace(shdrt)]; ok {
		return mapped
	}
	return "FAMILI LAIN"
}

func normalizeMarital(raw string) string {
	u := strings.ToUpper(strings.TrimSpace(raw))
	switch u {
	case "KAWIN", "BELUM KAWIN", "CERAI MATI", "CERAI HIDUP":
		return u
	case "":
		return "BELUM KAWIN"
	default:
		return u
	}
}

func normalizeDocFlag(raw string) string {
	switch strings.TrimSpace(raw) {
	case "2":
		return "ADA"
	case "1":
		return "TIDAK_ADA"
	default:
		return ""
	}
}

func normalizeOptionalDate(raw string) string {
	if d, ok := parseSIAKDate(raw); ok {
		return d
	}
	return ""
}

func parseSIAKDate(raw string) (string, bool) {
	s := strings.TrimSpace(raw)
	if s == "" || s == "-" {
		return "", false
	}
	layouts := []string{
		"2006-01-02",
		"01/02/2006 15:04:05",
		"1/2/2006 15:04:05",
		"01/02/2006",
		"1/2/2006",
		"02-01-2006",
		"02-Jan-06",
		"2-Jan-06",
		"02-Jan-2006",
	}
	// Go's "Jan" expects Title-case month ("Nov", "May") while SIAK exports "19-NOV-09".
	normalizedCase := s
	if parts := strings.Split(s, "-"); len(parts) == 3 && len(parts[1]) == 3 {
		normalizedCase = parts[0] + "-" + strings.ToUpper(parts[1][:1]) + strings.ToLower(parts[1][1:]) + "-" + parts[2]
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, normalizedCase); err == nil {
			// Fix two-digit years > current year (e.g. '63' parsed as 2063 instead of 1963)
			if t.Year() > time.Now().Year()+1 {
				t = t.AddDate(-100, 0, 0)
			}
			return t.Format("2006-01-02"), true
		}
	}
	// Excel numeric serial date fallback (days since 1899-12-30)
	if serial, err := strconv.ParseFloat(s, 64); err == nil && serial > 1000 && serial < 80000 {
		base := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
		days := int(math.Floor(serial))
		return base.AddDate(0, 0, days).Format("2006-01-02"), true
	}
	return "", false
}

func parseSemiAddress(raw string) (addr, postal string) {
	if raw == "" {
		return "", ""
	}
	parts := strings.Split(raw, ";")
	var clean []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		upper := strings.ToUpper(p)
		if strings.HasPrefix(upper, "KODEPOS") {
			val := strings.TrimSpace(strings.TrimPrefix(upper, "KODEPOS"))
			val = strings.TrimSpace(strings.TrimPrefix(val, ":"))
			if val != "" && val != "0" {
				postal = val
			}
			continue
		}
		if strings.HasSuffix(upper, ":") || strings.HasSuffix(upper, ":0") {
			continue
		}
		if p != "" {
			clean = append(clean, p)
		}
	}
	return strings.Join(clean, ", "), postal
}

func buildDusunMatcher(known []string) map[string]string {
	m := make(map[string]string)
	for _, d := range known {
		canon := strings.TrimSpace(d)
		if canon == "" {
			continue
		}
		upper := strings.ToUpper(canon)
		m[upper] = canon
		// Auto-register reversed two-word alias (e.g. "Sari Mekar" <-> "MEKAR SARI")
		words := strings.Fields(upper)
		if len(words) == 2 {
			m[words[1]+" "+words[0]] = canon
		}
	}
	return m
}

func matchDusun(rawDusun, rawAddr string, lookup map[string]string) (string, bool) {
	u := strings.ToUpper(strings.TrimSpace(rawDusun))
	if u != "" && u != "NULL" && u != "-" {
		if canon, ok := lookup[u]; ok {
			return canon, false
		}
	}
	// Auto-heal from semi-structured ALAMAT (e.g. "BNJAR DINAS MEKAR SARI;...")
	addrUpper := strings.ToUpper(rawAddr)
	for alias, canon := range lookup {
		if strings.Contains(addrUpper, alias) {
			return canon, true
		}
	}
	return "", false
}

func defaultIfEmpty(s, fallback string) string {
	if strings.TrimSpace(s) == "" {
		return fallback
	}
	return strings.TrimSpace(s)
}

func cleanDash(s string) string {
	t := strings.TrimSpace(s)
	if t == "-" {
		return ""
	}
	return t
}

// --- Minimal OpenXML (.xlsx) Reader ---

type xmlSST struct {
	Items []struct {
		Text string `xml:"t"`
		Runs []struct {
			Text string `xml:"t"`
		} `xml:"r"`
	} `xml:"si"`
}

func readSharedStrings(zr *zip.Reader) ([]string, error) {
	var f *zip.File
	for _, zf := range zr.File {
		if zf.Name == "xl/sharedStrings.xml" {
			f = zf
			break
		}
	}
	if f == nil {
		return nil, nil
	}
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	data, err := io.ReadAll(rc)
	if err != nil {
		return nil, err
	}
	var sst xmlSST
	if err := xml.Unmarshal(data, &sst); err != nil {
		return nil, fmt.Errorf("parse sharedStrings.xml: %w", err)
	}
	out := make([]string, len(sst.Items))
	for i, si := range sst.Items {
		if len(si.Runs) > 0 {
			var b strings.Builder
			for _, r := range si.Runs {
				b.WriteString(r.Text)
			}
			out[i] = b.String()
		} else {
			out[i] = si.Text
		}
	}
	return out, nil
}

type xmlWorksheet struct {
	Rows []struct {
		Cells []struct {
			Ref  string `xml:"r,attr"`
			Type string `xml:"t,attr"`
			Val  string `xml:"v"`
			IS   struct {
				Text string `xml:"t"`
			} `xml:"is"`
		} `xml:"c"`
	} `xml:"sheetData>row"`
}

func readFirstSheetRows(zr *zip.Reader, shared []string) ([]map[string]string, error) {
	var f *zip.File
	for _, zf := range zr.File {
		if zf.Name == "xl/worksheets/sheet1.xml" {
			f = zf
			break
		}
	}
	if f == nil {
		return nil, fmt.Errorf("xl/worksheets/sheet1.xml tidak ditemukan di dalam file .xlsx")
	}
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	data, err := io.ReadAll(rc)
	if err != nil {
		return nil, err
	}
	var ws xmlWorksheet
	if err := xml.Unmarshal(data, &ws); err != nil {
		return nil, fmt.Errorf("parse sheet1.xml: %w", err)
	}
	rows := make([]map[string]string, 0, len(ws.Rows))
	for _, r := range ws.Rows {
		m := make(map[string]string, len(r.Cells))
		for _, c := range r.Cells {
			col := extractColLetters(c.Ref)
			switch c.Type {
			case "s":
				if idx, err := strconv.Atoi(strings.TrimSpace(c.Val)); err == nil && idx >= 0 && idx < len(shared) {
					m[col] = shared[idx]
				}
			case "inlineStr":
				m[col] = c.IS.Text
			default:
				m[col] = c.Val
			}
		}
		rows = append(rows, m)
	}
	return rows, nil
}

func extractColLetters(cellRef string) string {
	var i int
	for i < len(cellRef) && ((cellRef[i] >= 'A' && cellRef[i] <= 'Z') || (cellRef[i] >= 'a' && cellRef[i] <= 'z')) {
		i++
	}
	return strings.ToUpper(cellRef[:i])
}
