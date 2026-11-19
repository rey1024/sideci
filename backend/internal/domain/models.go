package domain

import "strings"

type DusunStat struct {
	Name       string  `json:"name"`
	Residents  int     `json:"residents"`
	Percentage float64 `json:"percentage"`
}

type CategoryStat struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

type PublicVillageOverview struct {
	Slug              string         `json:"slug"`
	Name              string         `json:"name"`
	DistrictName      string         `json:"district_name"`
	RegencyName       string         `json:"regency_name"`
	ProvinceName      string         `json:"province_name"`
	PostalCode        string         `json:"postal_code"`
	LeaderTitle       string         `json:"leader_title"`
	LeaderName        string         `json:"leader_name"`
	HamletTerm        string         `json:"hamlet_term"`
	HamletLeaderTerm  string         `json:"hamlet_leader_term"`
	OfficeAddress     string         `json:"office_address"`
	OfficePhone       string         `json:"office_phone"`
	OfficeEmail       string         `json:"office_email"`
	WelcomeQuote      string         `json:"welcome_quote"`
	TotalResidents    int            `json:"total_residents"`
	TotalHouseholds   int            `json:"total_households"`
	MaleCount         int            `json:"male_count"`
	FemaleCount       int            `json:"female_count"`
	Dusuns            []DusunStat    `json:"dusuns"`
	EducationSummary  []CategoryStat `json:"education_summary"`
	MaritalSummary    []CategoryStat `json:"marital_summary"`
}

type PublicLetterSubmitRequest struct {
	TemplateCode string `json:"template_code"`
	NIK          string `json:"nik"`
	BirthDate    string `json:"birth_date"`
	ApplicantWA  string `json:"applicant_wa"`
	Purpose      string `json:"purpose"`
}

type PublicLetterTicketResponse struct {
	TicketCode     string `json:"ticket_code"`
	TemplateCode   string `json:"template_code"`
	MaskedName     string `json:"masked_name"`
	Status         string `json:"status"`
	VerifyQRToken  string `json:"verify_qr_token,omitempty"`
	SubmittedAtISO string `json:"submitted_at"`
}

// ValidateNIK ensures a strict 16-digit numeric NIK without leaking resident info.
func ValidateNIK(nik string) bool {
	if len(nik) != 16 {
		return false
	}
	for i := 0; i < len(nik); i++ {
		if nik[i] < '0' || nik[i] > '9' {
			return false
		}
	}
	return true
}

// MaskFullName masks citizen names on unauthenticated public responses (UU PDP compliance).
func MaskFullName(fullName string) string {
	words := strings.Fields(strings.TrimSpace(fullName))
	if len(words) == 0 {
		return "***"
	}
	masked := make([]string, 0, len(words))
	for _, w := range words {
		runes := []rune(w)
		if len(runes) <= 1 {
			masked = append(masked, "*")
			continue
		}
		masked = append(masked, string(runes[0])+strings.Repeat("*", len(runes)-1))
	}
	return strings.Join(masked, " ")
}
