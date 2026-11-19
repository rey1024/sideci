# Graph Report - sideci  (2026-11-19)

## Corpus Check
- 92 files · ~103,459 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 7, .example 3, .css 1)

## Summary
- 785 nodes · 1836 edges · 55 communities (48 shown, 7 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 91 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ec1b73f8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- api/main.go
- testing.T
- Server
- package.json
- siak_xlsx.go
- KioskWorkspaceManager.tsx
- OperatorPopulationManager.tsx
- KepalaDusunWorkspace.tsx
- docgen.go
- context.Context
- SIDECI — Sistem Desa Cerdas Terintegrasi
- compilerOptions
- next
- lucide-react
- defaultStr
- .CreateOrIssueLetter
- LetterStudioManager.tsx
- deploy.ps1
- docs/README.md
- app/panel/page.tsx
- ringdikit-data.ts
- api.ts
- ResidentItem
- [villageSlug]/page.tsx
- Detail Storyboard & Naskah Narasi Per Adegan
- ResidentAutocomplete
- SuperadminView.tsx
- [...path]/route.ts
- AGENTS.md — SIDECI AI Software Engineering Guidelines
- System Architecture — SIDECI
- Feature Specification Template
- 3. Evaluasi Matriks Keamanan (Cloudflare Security Audit Checklist)
- F01 — Multi-Desa Tenant & Portal Publik Desa
- F02 — Manajemen Kependudukan, Validasi Dusun-Desa & Historis
- F03 — Layanan Persuratan Multi-NIK & Pengesahan Hybrid
- F04 — Dashboard Eksekutif Kepala Desa / Perbekel
- SIDECI — Development Backlog & Task Tracker
- UI/UX Design Specification — "Soft Pastel Modern Dashboard"
- Paket Caption Sosial Media & Dokumentasi — SIDECI Desa Ringdikit — Produk Pengabdian Kepada Masyarakat Undiksha
- SIDECI — Sistem Desa Cerdas Terintegrasi
- SIDECI Backend API (Golang + PostgreSQL + `golang-migrate`)
- Research & Domain Insights — Studi Kasus Desa Ringdikit
- pull_request_template.md
- Panduan Infrastruktur & Operasional Deployment SIDECI
- VillageStats
- Security Posture & Pre-Production Audit Guide
- next.config.mjs
- postcss.config.mjs
- github.com/rey1024/sideci/backend
- 000001_init_sideci_schema.up.sql
- lucide-react

## God Nodes (most connected - your core abstractions)
1. `Server` - 49 edges
2. `writeJSON()` - 40 edges
3. `requireTenantClaims()` - 31 edges
4. `request()` - 26 edges
5. `OperatorPopulationManager()` - 22 edges
6. `ParseSIAKXLSX()` - 21 edges
7. `clientIP()` - 18 edges
8. `lucide-react` - 17 edges
9. `next` - 16 edges
10. `Workspace()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `D. Kepatuhan UU PDP No. 27 Tahun 2022 & Perlindungan PII Warga` --references--> `MaskFullName()`  [INFERRED]
  docs/security/AUDIT-2026-11-19-cloudflare-skill.md → backend/internal/domain/models.go
- `Ringkasan Pemeriksaan Keamanan` --references--> `MaskFullName()`  [INFERRED]
  docs/security/AUDIT-2026-11-19-prod.md → backend/internal/domain/models.go
- `Ringkasan Pemeriksaan Keamanan` --references--> `TestKepalaDusunRBACAndScopeIsolation()`  [INFERRED]
  docs/security/AUDIT-2026-11-19-prod.md → backend/internal/handler/residents_test.go
- `Ringkasan Pemeriksaan Keamanan` --references--> `RateLimiter`  [INFERRED]
  docs/security/AUDIT-2026-11-19-prod.md → backend/internal/middleware/ratelimit.go
- `main()` --calls--> `ParseSIAKXLSX()`  [EXTRACTED]
  backend/cmd/seed-prod/main.go → backend/internal/importer/siak_xlsx.go

## Import Cycles
- None detected.

## Communities (55 total, 7 thin omitted)

### Community 0 - "api/main.go"
Cohesion: 0.12
Nodes (10): PublicVillageOverview, CategoryStat, DusunStat, PublicLetterSubmitRequest, PublicLetterTicketResponse, createSubmissionReq, createVillageRequest, loginRequest (+2 more)

### Community 1 - "testing.T"
Cohesion: 0.05
Nodes (50): bootstrapSuperadmin(), main(), main(), CheckPassword(), Manager, HashPassword(), NewManager(), TestIssueAndParseRoundTrip() (+42 more)

### Community 2 - "Server"
Cohesion: 0.13
Nodes (18): Claims, ValidateNIK(), decodeCreateUser(), toSessionUser(), sanitizeFilename(), effectiveDusunFilter(), isStrictDusunOnly(), requireTenantClaims() (+10 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (32): dependencies, lucide-react, next, react, react-dom, devDependencies, autoprefixer, postcss (+24 more)

### Community 4 - "siak_xlsx.go"
Cohesion: 0.15
Nodes (22): appendAnomaly(), buildDusunMatcher(), cleanDash(), defaultIfEmpty(), digitsOnly(), extractColLetters(), NormalizedResident, matchDusun() (+14 more)

### Community 5 - "KioskWorkspaceManager.tsx"
Cohesion: 0.14
Nodes (22): formatBirthDateDDMMYYYY(), formatDateTimeID(), GuestbookIdMethod, KIOSK_LETTER_OPTIONS, KioskAdminTab, KioskServiceMode, KioskTemplateOption, KioskWorkspaceManager() (+14 more)

### Community 6 - "OperatorPopulationManager.tsx"
Cohesion: 0.13
Nodes (22): openResidentDetail(), EDUCATION_OPTIONS, EMPTY_FORM, EVENT_TYPE_LABELS, MARITAL_OPTIONS, OperatorPopulationManager(), handleConfirmDelete(), handleSaveEvent() (+14 more)

### Community 7 - "KepalaDusunWorkspace.tsx"
Cohesion: 0.13
Nodes (19): DirectorySubMode, EDUCATION_OPTIONS, KadusMenuTab, KepalaDusunWorkspace(), handleSubmitReport(), KepalaDusunWorkspaceProps, SHDK_OPTIONS, statusBadgeClass() (+11 more)

### Community 8 - "docgen.go"
Cohesion: 0.22
Nodes (17): buildElements(), BuildLetterDOCX(), BuildLetterPDF(), LetterDocData, nonEmpty(), pdfEsc(), pdfTextAt(), pdfTextCentered() (+9 more)

### Community 9 - "context.Context"
Cohesion: 0.12
Nodes (6): AuthUser, CreateSubmissionInput, HouseholdItem, SubmissionItem, VillageProfile, VillageSummary

### Community 10 - "SIDECI — Sistem Desa Cerdas Terintegrasi"
Cohesion: 0.11
Nodes (19): 1. Ringkasan Eksekutif & Visi Produk, 2. Evaluasi Sistem Referensi Lama & Masalah yang Diselesaikan, 3. Pengguna Sistem & Matriks Hak Akses (RBAC), 4. Arsitektur Multi-Desa (Multi-Tenancy & Routing URL), 5.1. Modul Landing Page & Profil Dasar Desa (Publik), 5.2. Modul Kependudukan, Alur Validasi Dusun-Desa & Historis, 5.3. Modul Persuratan Cerdas & Pengesahan Hybrid, 5.4. Modul Dashboard Eksekutif Kepala Desa / Perbekel (+11 more)

### Community 11 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 12 - "next"
Cohesion: 0.10
Nodes (8): dynamic, metadata, RootLayout(), DemoAccessGate(), config, CUSTOM_DOMAIN_MAP, RESERVED_SEGMENTS, next

### Community 13 - "lucide-react"
Cohesion: 0.20
Nodes (9): ApiVillageOverview, dynamic, loadVillageIdentity(), metadata, PrivacyPolicyPage(), Slide, SLIDES, RINGDIKIT_OVERVIEW (+1 more)

### Community 14 - "defaultStr"
Cohesion: 0.14
Nodes (7): isUniqueViolation(), defaultStr(), DusunItem, NewVillage, PopulationOperationalStats, RecordEventInput, UpsertResidentInput

### Community 15 - ".CreateOrIssueLetter"
Cohesion: 0.20
Nodes (7): indonesianDateStr(), randomHexToken(), romanMonth(), strFromMap(), CreateLetterInput, LetterRecord, LetterStats

### Community 16 - "LetterStudioManager.tsx"
Cohesion: 0.17
Nodes (15): DiffDocRow, formatBirthDateDDMMYYYY(), formatDateID(), HeirRow, LetterStudioManager(), LetterStudioManagerProps, OFFICIAL_TEMPLATES, PersuratanSubTab (+7 more)

### Community 17 - "deploy.ps1"
Cohesion: 0.42
Nodes (14): Invoke-DeployProduction(), Invoke-DeployStaging(), Invoke-Plan(), Invoke-Rollback(), Invoke-Secrets(), Invoke-Setup(), Invoke-Status(), Invoke-Validate() (+6 more)

### Community 18 - "docs/README.md"
Cohesion: 0.29
Nodes (3): Product Requirements Document (PRD), Dokumentasi Proyek SIDECI, Urutan Baca yang Direkomendasikan

### Community 19 - "app/panel/page.tsx"
Cohesion: 0.26
Nodes (11): ActiveRole, InternalWorkspacePage(), SUBMISSION_TYPE_LABELS, Workspace(), updateSubmissionStatus(), fetchDusuns(), fetchMe(), fetchSubmissions() (+3 more)

### Community 20 - "ringdikit-data.ts"
Cohesion: 0.20
Nodes (11): CreatedTicket, PublicLetterSection(), handleSubmit(), BanjarStat, DEMO_RESIDENTS, DemoResident, INITIAL_SUBMISSIONS, KadusSubmission (+3 more)

### Community 21 - "api.ts"
Cohesion: 0.17
Nodes (15): TenantLoginPage(), handleSubmit(), SmartImportBox(), runImport(), activeVillageSlugFromPath(), API_BASE, ApiPopulationEvent, CreateUserPayload (+7 more)

### Community 22 - "ResidentItem"
Cohesion: 0.15
Nodes (6): CreateGuestbookInput, GuestbookEntry, GuestbookStats, PopulationEventItem, ResidentDetail, ResidentItem

### Community 23 - "[villageSlug]/page.tsx"
Cohesion: 0.36
Nodes (11): ApiVillageOverview, dynamic, loadVillageOverview(), VillageTenantPortalPage(), HeroCarousel(), MultiSegmentDonut(), PastelBarChart(), SmoothHoneyAreaChart() (+3 more)

### Community 24 - "Detail Storyboard & Naskah Narasi Per Adegan"
Cohesion: 0.18
Nodes (10): ADEGAN 1 — Hook Pembuka & Portal Publik SIDECI Desa Ringdikit, ADEGAN 2 — Dashboard Eksekutif Perbekel & Analitik Satu Data, ADEGAN 3 — Manajemen 5.392 Penduduk, Mutasi & Timeline Historis, ADEGAN 4 — Studio Persuratan Resmi Format PDF & Word (.DOCX), ADEGAN 5 — Buku Register Digital & Dokumentasi Arsip Sah TTD / TTE, ADEGAN 6 — Anjungan Kiosk Mandiri, Pemetaan RFID KTP-el & Buku Tamu Digital, ADEGAN 7 — Sinergi 5 Banjar Dinas & Kredit Pengabdian Kepada Masyarakat Undiksha, Detail Storyboard & Naskah Narasi Per Adegan (+2 more)

### Community 25 - "ResidentAutocomplete"
Cohesion: 0.27
Nodes (9): calcAgeYears(), HighlightMatch(), ResidentAutocomplete(), chooseItem(), handleKeyDown(), ResidentAutocompleteProps, ApiResidentDetail, ApiResidentItem (+1 more)

### Community 26 - "SuperadminView.tsx"
Cohesion: 0.27
Nodes (9): AVAILABLE_VILLAGE_ROLES, SuperadminView(), handleCreateUser(), handleCreateVillage(), AdminVillageSummary, createAdminUser(), createAdminVillage(), fetchAdminVillages() (+1 more)

### Community 27 - "[...path]/route.ts"
Cohesion: 0.25
Nodes (8): backendOrigin(), DELETE, dynamic, GET, PATCH, POST, proxyToBackend(), PUT

### Community 28 - "AGENTS.md — SIDECI AI Software Engineering Guidelines"
Cohesion: 0.25
Nodes (8): 1. Purpose and Role, 2. Project Context and Documentation Navigation, 3. Single Sources of Truth, 4. Codebase Discovery and Graphify, 5. Mandatory Development Workflow, 6. Security, Privacy (UU PDP), and Infrastructure Rules, 7. Required Task Reporting Format, AGENTS.md — SIDECI AI Software Engineering Guidelines

### Community 29 - "System Architecture — SIDECI"
Cohesion: 0.25
Nodes (8): 1. Gambaran Arsitektur Tingkat Tinggi, 2. Tumpukan Teknologi & Keputusan Arsitektur (ADR), 3. Desain Multi-Tenancy & Isolasi Data Desa, 4. Desain Autentikasi, Multi-Role RBAC & Keamanan Publik, 5.1. Backend (`backend/`), 5.2. Frontend (`frontend/`), 5. Struktur Modul Kode, System Architecture — SIDECI

### Community 30 - "Feature Specification Template"
Cohesion: 0.25
Nodes (7): 1. Ikhtisar (Overview), 2. User Stories, 3. Kebutuhan Fungsional & Aturan Bisnis, 4. Kriteria Penerimaan (Acceptance Criteria), 5. Edge Cases & Penanganan Kesalahan, 6. Ketergantungan & Pengujian Terkait, Feature Specification Template

### Community 31 - "3. Evaluasi Matriks Keamanan (Cloudflare Security Audit Checklist)"
Cohesion: 0.25
Nodes (7): 1. Ringkasan Eksekutif, 3. Evaluasi Matriks Keamanan (Cloudflare Security Audit Checklist), A. Kontrol Akses, Multi-Tenancy, & Anti-IDOR, B. Autentikasi, Manajemen Sesi & Kriptografi, C. Pencegahan Injeksi (SQLi, XSS, OpenXML/DOCX Injection), E. Keamanan Infrastruktur, Kontainer & Rahasia Repositori, Laporan Audit Keamanan Aplikasi SIDECI (Cloudflare Security Audit Skill Methodology)

### Community 32 - "F01 — Multi-Desa Tenant & Portal Publik Desa"
Cohesion: 0.33
Nodes (6): 1. Ikhtisar, 2. User Stories, 3. Aturan Bisnis, 4. Kriteria Penerimaan (Acceptance Criteria), 5. Edge Cases, F01 — Multi-Desa Tenant & Portal Publik Desa

### Community 33 - "F02 — Manajemen Kependudukan, Validasi Dusun-Desa & Historis"
Cohesion: 0.33
Nodes (5): 1. Ikhtisar, 2. User Stories, 3. Aturan Bisnis, 4. Kriteria Penerimaan (Acceptance Criteria), F02 — Manajemen Kependudukan, Validasi Dusun-Desa & Historis

### Community 34 - "F03 — Layanan Persuratan Multi-NIK & Pengesahan Hybrid"
Cohesion: 0.33
Nodes (5): 1. Ikhtisar, 2. User Stories, 3. Aturan Bisnis, 4. Kriteria Penerimaan (Acceptance Criteria), F03 — Layanan Persuratan Multi-NIK & Pengesahan Hybrid

### Community 35 - "F04 — Dashboard Eksekutif Kepala Desa / Perbekel"
Cohesion: 0.33
Nodes (5): 1. Ikhtisar, 2. User Stories, 3. Aturan Bisnis, 4. Kriteria Penerimaan (Acceptance Criteria), F04 — Dashboard Eksekutif Kepala Desa / Perbekel

### Community 36 - "SIDECI — Development Backlog & Task Tracker"
Cohesion: 0.33
Nodes (6): Milestone 0 — Standarisasi Repositori, Arsitektur & Pondasi UI/Infra, Milestone 1 — Backend Core, Autentikasi Multi-Role & Multi-Tenancy (`F01`), Milestone 2 — Kependudukan, Alur Validasi Dusun-Desa & Smart Excel Import (`F02`), Milestone 3 — Persuratan Multi-NIK & Pengesahan Hybrid QR/TTE (`F03`), Milestone 4 — Dashboard Eksekutif Kepala Desa & Kesiapan Rilis (`F04`), SIDECI — Development Backlog & Task Tracker

### Community 37 - "UI/UX Design Specification — "Soft Pastel Modern Dashboard""
Cohesion: 0.33
Nodes (6): 1. Filosofi Visual Utama (Smooth, Airy, Soft Pastel & Professional), 2. Sistem Palet Warna ("Soft Pastel Civic Palette"), 3. Tipografi Halus & Standar Keterbacaan, 4. Pola Komponen Standar, Prinsip Wajib, UI/UX Design Specification — "Soft Pastel Modern Dashboard"

### Community 38 - "Paket Caption Sosial Media & Dokumentasi — SIDECI Desa Ringdikit — Produk Pengabdian Kepada Masyarakat Undiksha"
Cohesion: 0.33
Nodes (5): Instagram Reels, Paket Caption Sosial Media & Dokumentasi — SIDECI Desa Ringdikit — Produk Pengabdian Kepada Masyarakat Undiksha, TikTok, YouTube Shorts, YouTube Video Full

### Community 39 - "SIDECI — Sistem Desa Cerdas Terintegrasi"
Cohesion: 0.33
Nodes (6): 1. Frontend Web (`Next.js`), 2. Database & Backend API (`Golang + PostgreSQL`), Navigasi Dokumentasi Utama, Panduan Cepat Menjalankan Secara Lokal, SIDECI — Sistem Desa Cerdas Terintegrasi, Struktur Repositori

### Community 40 - "SIDECI Backend API (Golang + PostgreSQL + `golang-migrate`)"
Cohesion: 0.40
Nodes (4): Menjalankan Migrasi Database (`golang-migrate`), Menjalankan Pengujian, Menjalankan Secara Lokal, SIDECI Backend API (Golang + PostgreSQL + `golang-migrate`)

### Community 41 - "Research & Domain Insights — Studi Kasus Desa Ringdikit"
Cohesion: 0.40
Nodes (5): 1. Profil Wilayah Studi Kasus (Desa Ringdikit), 2. Temuan Kualitas Data Ekspor SIAK (`Data_Kependudukan_Desa_Ringdikit.xlsx`), 3. Temuan Struktur 5 Template Surat Desa (`docs/referensi/format-surat/`), 4. Pelajaran Keamanan dari `db_sideci.sql` Lama, Research & Domain Insights — Studi Kasus Desa Ringdikit

### Community 44 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Bukti Verifikasi, Daftar Periksa Kualitas & Keamanan (Wajib), Referensi Tugas / Fitur, Ringkasan Perubahan

### Community 45 - "Panduan Infrastruktur & Operasional Deployment SIDECI"
Cohesion: 0.40
Nodes (5): 1. Pemisahan Konfigurasi Publik vs Rahasia, 2. Arsitektur Routing URL Desa (`Path-Based` & Custom Domain) di Nginx, 3. Alur Perintah `deploy.ps1`, 4. Kesiapan Backup & Rollback, Panduan Infrastruktur & Operasional Deployment SIDECI

### Community 46 - "VillageStats"
Cohesion: 0.50
Nodes (3): Count, DusunCount, VillageStats

### Community 47 - "Security Posture & Pre-Production Audit Guide"
Cohesion: 0.50
Nodes (4): 1. Catatan Audit Awal Repositori (Secret & PII Hygiene), 2. Kontrol Keamanan Utama SIDECI, 3. Gerbang Audit Keamanan Pra-Produksi (Cloudflare Security Audit Gate), Security Posture & Pre-Production Audit Guide

### Community 51 - "000001_init_sideci_schema.up.sql"
Cohesion: 0.17
Nodes (26): audit_logs, dusuns, households, idx_audit_village_created, idx_dusuns_village, idx_events_resident, idx_households_village_dusun, idx_letters_village_status (+18 more)

### Community 52 - "lucide-react"
Cohesion: 0.29
Nodes (3): VerifyPageProps, TenantVerifyPageProps, lucide-react

## Knowledge Gaps
- **8 isolated node(s):** `github.com/rey1024/sideci/backend`, `react-dom`, `@types/node`, `@types/react`, `@types/react-dom` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 269 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SIDECI — Development Backlog & Task Tracker` connect `SIDECI — Development Backlog & Task Tracker` to `docs/README.md`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `writeJSON()` (e.g. with `decodeCreateUser()` and `requireTenantClaims()`) actually correct?**
  _`writeJSON()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `github.com/rey1024/sideci/backend`, `react-dom`, `@types/node` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api/main.go` be split into smaller, more focused modules?**
  _Cohesion score 0.11951710261569416 - nodes in this community are weakly interconnected._
- **Why does `Milestone 3 — Persuratan Multi-NIK & Pengesahan Hybrid QR/TTE (`F03`)` connect `SIDECI — Development Backlog & Task Tracker` to `.CreateOrIssueLetter`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `testing.T` be split into smaller, more focused modules?**
  _Cohesion score 0.05357142857142857 - nodes in this community are weakly interconnected._
- **Why does `Laporan Audit Keamanan Aplikasi SIDECI (Cloudflare Security Audit Skill Methodology)` connect `3. Evaluasi Matriks Keamanan (Cloudflare Security Audit Checklist)` to `Server`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._