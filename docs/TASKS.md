# SIDECI — Development Backlog & Task Tracker

Status yang diizinkan: `TODO` | `IN_PROGRESS` | `BLOCKED` | `DONE`  
*(Aturan: Tugas hanya boleh ditandai `DONE` setelah implementasi dan verifikasi nyata berhasil dijalankan).*

---

## Milestone 0 — Standarisasi Repositori, Arsitektur & Pondasi UI/Infra

| ID | Tugas | Prioritas | Status | Catatan Verifikasi |
| :--- | :--- | :--- | :--- | :--- |
| `T-001` | Analisa & validasi ide awal, audit DB/Excel/DOCX referensi Desa Ringdikit | P0 | `DONE` | Diverifikasi pada `docs/research/insight.md` & `docs/PRD.md` |
| `T-002` | Terapkan standar proyek `0 standard-dev` (`AGENTS.md`, `docs/*`, `.github/*`, `.gitignore`) | P0 | `DONE` | Struktur lengkap dibuat; proteksi `.gitignore` untuk kredensial & PII aktif |
| `T-003` | Adaptasi `infra/config.yaml` & `infra/deploy.ps1` untuk SIDECI + cek port bebas VPS | P0 | `DONE` | Port `6210` (FE) & `6211` (BE) terverifikasi `FREE` via `reynote_check_ports` |
| `T-004` | Inisialisasi `backend/` Golang + skema migrasi awal `golang-migrate` + seed Desa Ringdikit | P0 | `DONE` | Diverifikasi lulus `go vet ./...`, `go test ./...`, dan `go build` (Go 1.27.4) |
| `T-005` | Inisialisasi `frontend/` Next.js + implementasi desain **Soft Pastel Modern** (Portal Publik Ringdikit, Dashboard Grafik Pastel, Workspace Multi-Role, Verifikasi QR) | P0 | `DONE` | Diverifikasi lulus `npm run typecheck` dan `npm run build` (Next.js 15.5.29 standalone) |

---

## Milestone 1 — Backend Core, Autentikasi Multi-Role & Multi-Tenancy (`F01`)

| ID | Tugas | Prioritas | Status | Catatan Verifikasi |
| :--- | :--- | :--- | :--- | :--- |
| `T-101` | Koneksi pool `pgx/v5` & runner migrasi `golang-migrate` pada `backend/` | P0 | `DONE` | Terimplementasi di `internal/store/` (`pgxpool` + `golang-migrate/v4`); lulus `go vet` & `go build` |
| `T-102` | Implementasi autentikasi JWT (`HttpOnly` cookie + Refresh Token) & Multi-Role RBAC middleware | P0 | `DONE` | Lulus 13 unit test (`internal/auth`, `internal/handler`, `internal/middleware`) + halaman `/login` & guard `/panel` lulus `next build` |
| `T-103` | Endpoint Superadmin: CRUD Desa (`villages`), manajemen subdomain/custom domain, & kelola akun awal desa | P1 | `DONE` | Endpoint `/api/v1/admin/*` & `/api/v1/village/users` + UI `SuperadminView.tsx` terverifikasi `go test` & `next build` |
| `T-104` | Endpoint publik profil desa & agregasi statistik demografi ter-*cache* tanpa eksposur PII | P0 | `DONE` | `GET /api/v1/public/village` (TTL cache 5 menit, 0 PII) terhubung ke SSR `frontend/src/app/page.tsx` |

---

## Milestone 2 — Kependudukan, Alur Validasi Dusun-Desa & Smart Excel Import (`F02`)

| ID | Tugas | Prioritas | Status | Catatan Verifikasi |
| :--- | :--- | :--- | :--- | :--- |
| `T-201` | CRUD Kartu Keluarga (`households`) & Penduduk (`residents`) dengan validasi Kepala Keluarga tunggal + statistik atas Operator Desa | P0 | `DONE` | Endpoint `GET /api/v1/population/stats`, `GET/POST /api/v1/residents`, `PUT/DELETE /api/v1/residents/{id}` + tabel paginasi `OperatorPopulationManager.tsx` (5.392 warga riil Ringdikit) lulus `go test` & `tsc` |
| `T-202` | Smart Excel Importer (`Data_Kependudukan_Desa_Ringdikit.xlsx`): konversi kode SIAK, normalisasi tanggal, & laporan 83 baris anomali dusun | P0 | `DONE` | Diuji & diimpor ke PostgreSQL (`sideci_dev`): 5.392 penduduk valid (`L: 2.656`, `P: 2.736`), 1.698 KK, 45 baris banjar *auto-healed*, 38 belum terpetakan |
| `T-203` | API & Workspace UX Kepala Dusun (`KepalaDusunWorkspace.tsx` + `ResidentAutocomplete.tsx` terkunci `dusun_id`: statistik dusun, tabel warga & KK, sugesti nama instan, pelaporan mutasi) + review *diff* Operator Desa | P0 | `DONE` | Isolasi RBAC `kepala_dusun` (`0` kebocoran dusun lain), statistik Banjar Kelodan (`1.750 jiwa`, `561 KK`), autocomplete 1-huruf + navigasi keyboard lulus `go test` & `tsc` |
| `T-204` | Pencatatan `population_events` (kelahiran, kematian, perkawinan, perceraian, pindah masuk/keluar/banjar) & Timeline Historis per NIK | P1 | `DONE` | Endpoint langsung Operator `POST /api/v1/residents/{id}/events` + modal mutasi & detail Timeline Historis terverifikasi end-to-end ke PostgreSQL |

---

## Milestone 3 — Persuratan Multi-NIK & Pengesahan Hybrid QR/TTE (`F03`)

| ID | Tugas | Prioritas | Status | Catatan Verifikasi |
| :--- | :--- | :--- | :--- | :--- |
| `T-301` | Engine 5 template surat Desa Ringdikit (Umum, Kelahiran 2-NIK, Kematian + sinkron status wafat, Beda Nama multi-dokumen, Waris multi-NIK) sesuai `docs/referensi/format-surat/*.docx` | P0 | `DONE` | Terimplementasi di `backend/internal/docgen/docgen.go`, `backend/internal/store/letters.go`, & `frontend/src/components/LetterStudioManager.tsx` lengkap dengan Kop Resmi Kab. Buleleng (`logo-buleleng.jpg`) |
| `T-302` | Endpoint pengajuan surat publik tanpa login (`NIK + Tanggal Lahir` + rate limit + kode tiket) & antrean permohonan publik di Studio Persuratan | P0 | `DONE` | `POST /api/v1/public/letters` terhubung ke `CreateOrIssueLetter` (`source = PUBLIC_FORM`) dan tab **Antrean Permohonan Publik** di `LetterStudioManager.tsx` |
| `T-303` | Generator **PDF & DOCX** kop resmi desa + unggah berkas TTD Basah / TTE BSrE (`POST /api/v1/letters/{id}/upload-signed`) + pencatatan otomatis ke Timeline Historis Warga (`LETTER_ISSUED` & `LETTER_SIGNED_UPLOADED`) | P0 | `DONE` | Diverifikasi di local & production VPS (`https://sideci.reisys.id/ringdikit`): unduh `.pdf` (24 KB) & `.docx` (23 KB), unggah TTD/TTE, dan riwayat historis warga (`population_events`) tercatat otomatis |
| `T-304` | Fitur **Anjungan Kiosk Mandiri**, Pengaturan Pemetaan ID RFID KTP-el ↔ NIK Penduduk (`residents.rfid_uid`), Layanan Persuratan Kiosk, & **Buku Tamu Digital** (Scan RFID, Cari NIK, atau Isi Manual) | P0 | `DONE` | Terimplementasi di `000003_add_kiosk_rfid_and_guestbook.up.sql`, `internal/store/kiosk.go`, `internal/handler/kiosk.go`, & `KioskWorkspaceManager.tsx`; aktif & terverifikasi di `https://sideci.reisys.id/ringdikit/panel` |

---

## Milestone 4 — Dashboard Eksekutif Kepala Desa & Kesiapan Rilis (`F04`)

| ID | Tugas | Prioritas | Status | Ketergantungan |
| :--- | :--- | :--- | :--- | :--- |
| `T-401` | API analitik eksekutif Kepala Desa/Perbekel (tren mutasi bulanan, SLA surat, cakupan akta sipil, keaktifan dusun) | P1 | `TODO` | `T-204`, `T-301` |
| `T-402` | Penyesuaian routing multi-desa pra-produksi berbasis path (`https://sideci.reisys.id/<slug>`, contoh `https://sideci.reisys.id/ringdikit`) di Next.js & Backend `TenantMiddleware` | P0 | `DONE` | Rute `/[villageSlug]`, `/[villageSlug]/login`, `/[villageSlug]/panel`, `/[villageSlug]/verify/[token]` + same-origin proxy `/api/v1/[...path]` lulus `next build` & aktif di VPS (`:6215`) |
| `T-403` | Pengujian integrasi lintas-tenant (anti-IDOR), audit keamanan pra-produksi, dan deployment produksi VPS (`119.252.174.189`) | P0 | `DONE` | Audit tercatat di `docs/security/AUDIT-2026-11-19-prod.md`; `sideci-frontend-prod` (`:6215`) + `sideci-backend-prod` (`127.0.0.1:6216`) + `sideci_prod` (5.392 warga Ringdikit) aktif & `healthy` |
