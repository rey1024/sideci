# Laporan Audit Keamanan Aplikasi SIDECI (Cloudflare Security Audit Skill Methodology)

- **Tanggal Audit**: 19 November 2026
- **Kerangka Metodologi**: [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) & Standar Kepatuhan **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**
- **Cakupan Sistem**:
  - **Backend**: Golang (`backend/cmd/api`, `internal/auth`, `internal/middleware`, `internal/store`, `internal/handler`, `internal/docgen`, `internal/importer`)
  - **Frontend**: Next.js 15 App Router (`frontend/src/app`, `frontend/src/components`, `frontend/src/middleware.ts`)
  - **Infrastruktur**: Docker Compose Production (`infra/docker-compose.prod.yml`), PostgreSQL 16, Cloudflare Tunnel (`https://sideci.reisys.id/ringdikit`)
- **Status Akhir Gerbang Keamanan**: **LULUS (PASS — 0 Unresolved Critical/High Findings)**

---

## 1. Ringkasan Eksekutif

Audit keamanan menyeluruh dilakukan terhadap seluruh modul aplikasi **SIDECI (Sistem Desa Cerdas Terintegrasi)** Desa Ringdikit, termasuk modul-modul terbaru yang baru saja dibangun:
1. **Manajemen Kependudukan & Smart SIAK Excel Importer** (`5.392` warga & `1.698` KK)
2. **Workspace Berjenjang Kelian 5 Banjar Dinas** (*Maker-Checker* Dusun ke Desa)
3. **Studio Persuratan 5 Format Resmi (`.PDF` & `.DOCX`) & Unggah Arsip Sah TTD Basah / TTE BSrE**
4. **Anjungan Kiosk Mandiri, Pemetaan UID RFID KTP-el ↔ NIK Penduduk, & Buku Tamu Digital**

Selama audit ini ditemukan **4 temuan keamanan** (2 *High*, 1 *Medium*, 1 *Low*) pada modul persuratan dan *gate* demo, dan **seluruhnya telah langsung diperbaiki (remediated) serta diverifikasi di dalam kode sumber**.

---

## 2. Daftar Temuan & Mitigasi yang Telah Diterapkan (Findings & Remediation)

| ID | Tingkat Risiko | Modul / File Terdampak | Deskripsi Kerentanan | Tindakan Perbaikan (Remediation) | Status |
| :- | :---: | :--- | :--- | :--- | :---: |
| **`SEC-01`** | **HIGH** | `frontend/src/components/DemoAccessGate.tsx`, `frontend/src/app/panel/page.tsx`, `backend/internal/handler/village.go` | Parameter sementara `?demo_shot=...` yang digunakan saat pengambilan screenshot video memungkinkan *bypass* layar kunci demo (`SideciHarmoni`) apabila ikut ter-*deploy*, serta batas `loginLimiter` sempat dinaikkan ke 60 req/menit. | Menghapus seluruh logika *bypass* `?demo_shot` dari `DemoAccessGate.tsx`, `panel/page.tsx`, dan `LetterStudioManager.tsx`, serta mengembalikan `loginLimiter` ke **8 permintaan/menit per IP** di `village.go`. | **FIXED** |
| **`SEC-02`** | **HIGH** | `backend/internal/handler/letters.go` (`handlePublicLetterSubmit`) | Endpoint publik `POST /api/v1/public/letters` sebelumnya belum menerapkan *rate limiter* per IP dan belum memverifikasi kecocokan `birth_date` terhadap `nik` di tabel `residents` sebelum menerbitkan tiket dan menampilkan nama warga tersamar (*masked name*), sehingga berpotensi dimanfaatkan untuk enumerasi NIK. | Menambahkan *rate limiter* (`pub_letter:<ip>`) serta query verifikasi ketat `WHERE village_id = $1::uuid AND nik = $2 AND to_char(birth_date, 'YYYY-MM-DD') = $3` sebelum surat publik dibuat. Jika tidak cocok, server mengembalikan pesan generik `400 Bad Request`. | **FIXED** |
| **`SEC-03`** | **MEDIUM** | `backend/internal/handler/letters.go` (`handleUploadSignedLetter`, `handleDownloadSignedLetterFile`) | Unggahan berkas surat bertanda tangan (TTD/TTE) sebelumnya hanya memeriksa ekstensi nama file (`.pdf`, `.jpg`, `.png`) tanpa memeriksa *magic bytes* isi file, sehingga berisiko disusupi file HTML/SVG/Script yang diganti ekstensinya. | Menambahkan inspeksi 512-byte pertama menggunakan `http.DetectContentType` (wajib `application/pdf`, `image/jpeg`, atau `image/png`), pembatas ukuran `io.LimitReader(file, 16<<20)`, validasi prefix direktori `storage/letters/` (anti-*Path Traversal*), serta header `X-Content-Type-Options: nosniff` dan `Content-Security-Policy: default-src 'none'; sandbox`. | **FIXED** |
| **`SEC-04`** | **LOW** | `backend/internal/handler/letters.go` (`handleVerifyQR`) | Endpoint `GET /api/v1/public/verify/{token}` sebelumnya memiliki *fallback* demo yang mengembalikan `"valid": true` untuk token sembarang yang tidak ditemukan di database. | Menambahkan *rate limiter* (`verify_qr:<ip>`) dan membatasi *fallback* demo hanya pada token showcase resmi `rdk-9f42a81c`. Seluruh token lain yang tidak terdaftar di `letter_requests` kini mengembalikan `HTTP 404` dengan `"valid": false`. | **FIXED** |

---

## 3. Evaluasi Matriks Keamanan (Cloudflare Security Audit Checklist)

### A. Kontrol Akses, Multi-Tenancy, & Anti-IDOR
- **Isolasi Tenant (`village_id`)**:
  - Setiap handler terautentikasi memanggil `requireTenantClaims(w, r)` yang mengekstrak `c.VillageID` langsung dari JWT bertanda tangan HMAC-SHA256 (`backend/internal/handler/residents.go`).
  - Seluruh query SQL pada `residents.go`, `letters.go`, dan `kiosk.go` mengunci `WHERE village_id = $1::uuid` dari klaim JWT, bukan dari parameter URL atau body JSON klien.
- **Isolasi Wilayah Banjar Dinas (`dusun_id`)**:
  - Fungsi `isStrictDusunOnly(c)` dan `effectiveDusunFilter(c, queryDusunID)` memaksa akun `kepala_dusun` hanya dapat membaca dan mengajukan laporan mutasi pada `c.DusunID` miliknya sendiri.
- **Pemisahan Hak Akses (RBAC)**:
  - `superOnly`: hanya `superadmin`
  - `popOperator`: hanya `admin_desa`, `operator_kependudukan`
  - `letterOperator`: hanya `admin_desa`, `operator_persuratan`, `operator_kependudukan`
  - `subCreator`: `admin_desa`, `operator_kependudukan`, `kepala_dusun`

### B. Autentikasi, Manajemen Sesi & Kriptografi
- **Hashing Kata Sandi**: Menggunakan `bcrypt` (`golang.org/x/crypto/bcrypt`, `DefaultCost`).
- **Penyimpanan Token**: Access Token dan Refresh Token disimpan di dalam cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, dan `Secure=true` pada lingkungan produksi (`COOKIE_SECURE: "true"`).
- **Normalisasi Input Login**: `strings.TrimSpace` diterapkan pada `username` dan `password` untuk mencegah kegagalan autentikasi akibat spasi tak sengaja, dikombinasikan dengan *rate limiter* `8 req/menit` per IP untuk mencegah *brute-force*.

### C. Pencegahan Injeksi (SQLi, XSS, OpenXML/DOCX Injection)
- **Parameterized SQL (`pgx/v5`)**: 100% query database menggunakan *positional parameters* (`$1, $2, ...`). Tidak ada penggabungan string input pengguna ke dalam perintah SQL.
- **OpenXML (`.DOCX`) & PDF Generator (`backend/internal/docgen/docgen.go`)**:
  - Seluruh teks dinamis pada generator `.docx` melewati fungsi `xmlEscape()` (`encoding/xml.EscapeText`) sebelum disisipkan ke `<w:t>`, mencegah *XML Injection* maupun *XXE*.
  - Seluruh teks dinamis pada generator `.pdf` melewati `pdfEscape()` yang mensterilkan karakter kontrol dan tanda kurung PostScript `( ) \`.

### D. Kepatuhan UU PDP No. 27 Tahun 2022 & Perlindungan PII Warga
- **Zero Public PII Exposure**:
  - Endpoint `GET /api/v1/public/village` hanya mengembalikan angka agregat demografi (jumlah warga, jumlah KK, sebaran pendidikan, agama, perkawinan, dan proporsi 5 Banjar Dinas) tanpa menyertakan satu pun NIK, Nomor KK, atau nama warga.
- **Masking Nama pada Layanan Publik**:
  - Respons tiket pengajuan surat publik dan halaman verifikasi QR (`/verify/[token]`) selalu menyamarkan nama warga menggunakan `domain.MaskFullName()` (contoh: `A**** R*****`).
- **Sanitasi Audit Log**:
  - Tabel `audit_logs` hanya mencatat `village_id`, `user_id`, `action`, `entity_type`, `entity_id`, dan `ip_address` tanpa pernah mencatat password, hash password, atau token sesi.

### E. Keamanan Infrastruktur, Kontainer & Rahasia Repositori
- **Non-Root Containers**:
  - `backend/Dockerfile` berjalan sebagai `USER appuser` (Alpine Linux non-root).
  - `frontend/Dockerfile` berjalan sebagai `USER nextjs` (UID 1001 non-root).
- **Isolasi Jaringan & Port VPS**:
  - Port backend (`6216`) diikat ketat hanya ke loopback `127.0.0.1:6216:8080` sehingga tidak terekspos langsung ke internet publik; trafik publik masuk melalui Cloudflare Tunnel (`sideci.reisys.id`) ke container frontend.
- **Kerahasiaan Kredensial (`.gitignore`)**:
  - File `infra/credentials.env`, `clients_dontread/`, `docs/referensi/db_sideci.sql`, dan `docs/referensi/data penduduk/` diblokir di `.gitignore` dan tidak pernah masuk ke dalam riwayat Git.
