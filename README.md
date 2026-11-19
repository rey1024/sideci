# SIDECI — Sistem Desa Cerdas Terintegrasi

Platform tata kelola pemerintahan dan pelayanan publik desa berarsitektur **Multi-Desa (*Multi-Tenant*)** dengan antarmuka **Simple Modern Flat**, alur validasi kependudukan berjenjang (**Kepala Dusun ➔ Operator Desa**), persuratan otomatis berbasis **Multi-NIK & QR Code Hybrid**, serta **Dashboard Eksekutif Kepala Desa / Perbekel**.

- **Studi Kasus Perdana (Pilot)**: Desa Ringdikit, Kecamatan Seririt, Kabupaten Buleleng, Bali (`81153`)

---

## Struktur Repositori

Repositori ini mengikuti standar pengembangan terstruktur (`MASTER INSTRUCTION v2.0`):

```text
sideci/
├── AGENTS.md                  # Panduan & aturan kerja wajib AI Software Engineer
├── README.md                  # Ikhtisar proyek & panduan menjalankan lokal
├── docker-compose.yml         # Orkestrasi lokal PostgreSQL 16 + Backend + Frontend
├── .env.example               # Contoh variabel environment tingkat root (Docker Compose)
├── docs/                      # Dokumentasi produk, riset, arsitektur, UI/UX, fitur & keamanan
│   ├── README.md
│   ├── PRD.md
│   ├── UI_UX.md
│   ├── ARCHITECTURE.md
│   ├── TASKS.md
│   ├── research/insight.md
│   ├── features/
│   └── security/README.md
├── infra/                     # Konfigurasi & otomasi deployment VPS (non-rahasia)
│   ├── README.md
│   ├── config.yaml
│   ├── credentials.env.example
│   └── deploy.ps1
├── backend/                   # REST API Golang + PostgreSQL + migrasi SQL (golang-migrate)
└── frontend/                  # Web App Next.js (App Router, TypeScript, Civic Pop Flat UI)
```

---

## Panduan Cepat Menjalankan Secara Lokal

### 1. Frontend Web (`Next.js`)

```powershell
cd frontend
npm install
npm run dev
```

Buka `http://localhost:3000` untuk melihat:
- **Portal Publik Desa Ringdikit** (`/`) — Profil Perbekel, statistik riil 5.393 penduduk & 5 Banjar Dinas, form pengajuan surat tanpa login, dan pelacakan tiket surat.
- **Workspace Internal Multi-Role** (`/panel`) — Simulasi interaktif untuk **Operator Desa (Kependudukan & Persuratan)**, **Operator Kepala Dusun (Banjar Dinas Kelodan)**, **Kepala Desa / Perbekel (Eksekutif)**, dan **Superadmin Platform**.

### 2. Database & Backend API (`Golang + PostgreSQL`)

Menggunakan Docker Compose (direkomendasikan):

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Atau menjalankan Backend Golang secara langsung (membutuhkan Go 1.23+ dan PostgreSQL lokal):

```powershell
cd backend
Copy-Item .env.example .env
go run ./cmd/api
```

---

## Navigasi Dokumentasi Utama

Mulai dari [docs/README.md](docs/README.md):
1. [docs/PRD.md](docs/PRD.md) — Visi produk, matriks role, kebutuhan MVP, dan roadmap Flutter.
2. [docs/UI_UX.md](docs/UI_UX.md) — Sistem desain **Civic Pop Flat** (anti-template AI, flat, kontras tinggi, warna fungsional).
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Arsitektur multi-tenant subdomain/custom domain, skema database, dan kontrak API.
4. [docs/TASKS.md](docs/TASKS.md) — Daftar tugas pengembangan dan status verifikasi.
5. [infra/README.md](infra/README.md) — Standar deployment VPS & pengelolaan kredensial aman.
