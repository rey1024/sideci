package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rey1024/sideci/backend/internal/auth"
	"github.com/rey1024/sideci/backend/internal/domain"
	"github.com/rey1024/sideci/backend/internal/handler"
	"github.com/rey1024/sideci/backend/internal/middleware"
)

const testSecret = "unit-test-secret-minimum-32-characters!!"

func newTestMux(t *testing.T) (*http.ServeMux, *auth.Manager) {
	t.Helper()
	am, err := auth.NewManager(testSecret)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	handler.NewServer("test", nil, am, false).RegisterRoutes(mux)
	return mux, am
}

func serve(mux *http.ServeMux, am *auth.Manager, req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	middleware.Authenticate(am)(mux).ServeHTTP(rec, req)
	return rec
}

func TestMaskFullName_UUPDP(t *testing.T) {
	got := domain.MaskFullName("Komang Rodi Gunawan")
	want := "K***** R*** G******"
	if got != want {
		t.Fatalf("MaskFullName mismatch: got %q, want %q", got, want)
	}
}

func TestValidateNIK(t *testing.T) {
	if !domain.ValidateNIK("5108021212120012") {
		t.Fatal("expected valid 16-digit NIK to pass")
	}
	if domain.ValidateNIK("51080212") || domain.ValidateNIK("51080212121200AB") {
		t.Fatal("expected short or non-numeric NIK to fail")
	}
}

func TestResolveSlugFromHost(t *testing.T) {
	custom := map[string]string{"ringdikit.desa.id": "ringdikit"}
	cases := map[string]string{
		"ringdikit.desa.id":            "ringdikit",
		"ularan.sideci.reisys.id":      "ularan",
		"localhost:3000":               "ringdikit",
		"api-sideci.reisys.id":         "ringdikit",
		"sideci.reisys.id":             "ringdikit",
		"www.sideci.reisys.id":         "ringdikit",
		"sulanyah.sideci.reisys.id:80": "sulanyah",
	}
	for host, want := range cases {
		if got := middleware.ResolveSlugFromHost(host, "ringdikit", custom); got != want {
			t.Errorf("host %q: got %q, want %q", host, got, want)
		}
	}
}

func TestProtectedRoutesRequireAuth(t *testing.T) {
	mux, am := newTestMux(t)
	for _, path := range []string{"/api/v1/auth/me", "/api/v1/admin/villages"} {
		rec := serve(mux, am, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s tanpa login: got %d, want 401", path, rec.Code)
		}
	}
}

func TestRBAC_NonSuperadminForbiddenOnAdminRoutes(t *testing.T) {
	mux, am := newTestMux(t)
	token, _, err := am.Issue(auth.KindAccess, "u1", "v1", "", "operator1", "Operator", []string{"operator_kependudukan"})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/villages", nil)
	req.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: token})
	if rec := serve(mux, am, req); rec.Code != http.StatusForbidden {
		t.Fatalf("operator ke rute superadmin: got %d, want 403", rec.Code)
	}

	// Admin desa tidak boleh memakai rute superadmin, tetapi boleh ke rute desanya (lolos RBAC).
	adminToken, _, _ := am.Issue(auth.KindAccess, "u2", "v1", "", "admin1", "Admin", []string{"admin_desa"})
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users", bytes.NewReader([]byte(`{}`)))
	req2.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: adminToken})
	if rec := serve(mux, am, req2); rec.Code != http.StatusForbidden {
		t.Fatalf("admin_desa ke /admin/users: got %d, want 403", rec.Code)
	}
}

func TestMeReturnsClaims(t *testing.T) {
	mux, am := newTestMux(t)
	token, _, _ := am.Issue(auth.KindAccess, "u3", "v1", "d1", "kelodan", "Kelian Kelodan", []string{"kepala_dusun"})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: token})
	rec := serve(mux, am, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200", rec.Code)
	}
	var body struct {
		User struct {
			DusunID string   `json:"dusun_id"`
			Roles   []string `json:"roles"`
		} `json:"user"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.User.DusunID != "d1" || len(body.User.Roles) != 1 || body.User.Roles[0] != "kepala_dusun" {
		t.Fatalf("klaim tidak sesuai: %+v", body.User)
	}
}

func TestRefreshTokenCannotBeUsedAsAccess(t *testing.T) {
	mux, am := newTestMux(t)
	rt, _, _ := am.Issue(auth.KindRefresh, "u4", "v1", "", "x", "X", []string{"superadmin"})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/villages", nil)
	req.AddCookie(&http.Cookie{Name: middleware.AccessCookie, Value: rt})
	if rec := serve(mux, am, req); rec.Code != http.StatusUnauthorized {
		t.Fatalf("refresh token sebagai access: got %d, want 401", rec.Code)
	}
}

func TestPublicLetterSubmitReturnsMaskedName(t *testing.T) {
	mux, am := newTestMux(t)
	body, _ := json.Marshal(domain.PublicLetterSubmitRequest{
		TemplateCode: "SK_UMUM",
		NIK:          "5108021212120012",
		BirthDate:    "1995-08-17",
		ApplicantWA:  "081234567890",
		Purpose:      "Melengkapi administrasi melamar pekerjaan",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/public/letters", bytes.NewReader(body))
	rec := serve(mux, am, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d", rec.Code)
	}
	var resp domain.PublicLetterTicketResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if resp.MaskedName != "K***** R*** G******" {
		t.Fatalf("expected masked name, got %q", resp.MaskedName)
	}
}
