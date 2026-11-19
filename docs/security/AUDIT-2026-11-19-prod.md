# Pre-Production Security Audit Report — SIDECI v1.0 (Pilot Desa Ringdikit)

- **Tanggal Audit**: 19 November 2026
- **Lingkup**: Backend Golang (`backend/`), Frontend Next.js (`frontend/`), Skema PostgreSQL (`backend/migrations/`), & Topologi Deployment VPS (`infra/`).
- **Status Gerbang Rilis**: **LULUS (0 Critical / 0 High Terbuka)**

---

## Ringkasan Pemeriksaan Keamanan

| Area | Pemeriksaan | Hasil | Bukti / Kontrol Teknis |
| :--- | :--- | :--- | :--- |
| **1. Secret & PII Git Hygiene** | Tidak ada kredensial, private key, atau dump NIK warga yang terlacak Git | **PASS** | `.\infra\deploy.ps1 validate` memblokir `credentials.env`, `*service-account*.json`, `*.jks`, `db_sideci.sql`, & `Data_Kependudukan*.xlsx`. Database produksi memakai akun terisolasi `sideci_user` dengan sandi acak CSPRNG di `.env` (`chmod 600`). |
| **2. Isolasi Multi-Tenant (`village_id`)** | Anti-IDOR lintas desa & penguncian wilayah `kepala_dusun` | **PASS** | Seluruh query `store/residents.go` mewajibkan `WHERE village_id = $1::uuid`. Pengguna `kepala_dusun` dikunci ketat ke `c.DusunID` (`TestKepalaDusunRBACAndScopeIsolation` memverifikasi `403` lintas dusun dan `0` kebocoran baris dusun lain). |
| **3. Autentikasi & Cookie Sesi** | Proteksi token sesi, *timing attack*, & *brute-force* | **PASS** | JWT HS256 terpisah `kind=access` vs `kind=refresh` di cookie `HttpOnly; SameSite=Lax; Secure` (same-origin `/api/v1` proxy), `bcrypt` cost 12 + `DummyHash` anti-enumerasi username, serta IP `RateLimiter` pada `/api/v1/auth/login`. |
| **4. Perlindungan Data Pribadi (UU PDP)** | Endpoint publik bebas kebocoran NIK/KK mentah | **PASS** | `GET /api/v1/public/village` hanya mengembalikan statistik agregat; `POST /api/v1/public/letters` menyamarkan nama pemohon (`MaskFullName` -> `K***** R*** G******`). |
| **5. Higiene Port & Jaringan VPS** | Pencegahan bentrok port & pembatasan permukaan jaringan | **PASS** | Terdeteksi port `6210` dipakai `reisys-backend-prod`; alokasi dipindah ke **`6215`** (`sideci-frontend-prod`) dan **`127.0.0.1:6216`** (`sideci-backend-prod` hanya loopback internal + Docker network `acagrity-prod_default`). |
