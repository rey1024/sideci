# Dokumentasi Proyek SIDECI

Selamat datang di pusat dokumentasi **SIDECI (Sistem Desa Cerdas Terintegrasi)**. Seluruh dokumen disusun mengikuti prinsip *Single Source of Truth* (`MASTER INSTRUCTION v2.0`) agar tidak terjadi duplikasi antara spesifikasi produk, desain antarmuka, arsitektur teknis, dan konfigurasi infrastruktur.

## Urutan Baca yang Direkomendasikan

1. **[research/insight.md](research/insight.md)** — Bukti temuan lapangan dari audit database lama (`db_sideci.sql`), dataset riil 5.393 penduduk Desa Ringdikit, dan 5 template surat `.docx`.
2. **[PRD.md](PRD.md)** — Visi produk, matriks pengguna & multi-role RBAC, cakupan MVP Fase 1, dan peta jalan pengembangan (termasuk Mobile Flutter).
3. **[UI_UX.md](UI_UX.md)** — Sistem Desain **Civic Pop Flat**: estetika modern flat tanpa klise template AI, palet warna fungsional kontras tinggi, tipografi mudah dibaca (`Plus Jakarta Sans` + `JetBrains Mono`), dan alur layar.
4. **[ARCHITECTURE.md](ARCHITECTURE.md)** — Arsitektur multi-tenant subdomain & custom domain, desain Backend Golang + PostgreSQL (`golang-migrate`) + Frontend Next.js, mekanisme keamanan, dan kontrak API.
5. **[features/](features/)** — Spesifikasi detail per modul lengkap dengan *Acceptance Criteria* ber-ID stabil:
   - [features/FEATURE_TEMPLATE.md](features/FEATURE_TEMPLATE.md)
   - [features/F01-multi-tenant-portal.md](features/F01-multi-tenant-portal.md)
   - [features/F02-kependudukan-mutasi.md](features/F02-kependudukan-mutasi.md)
   - [features/F03-persuratan-hybrid.md](features/F03-persuratan-hybrid.md)
   - [features/F04-dashboard-eksekutif.md](features/F04-dashboard-eksekutif.md)
6. **[security/README.md](security/README.md)** — Standar perlindungan data pribadi warga (UU PDP), *Secret Hygiene*, dan *Pre-Production Security Gate*.
7. **[TASKS.md](TASKS.md)** — Backlog implementasi bertahap dan status verifikasi.
8. **[../infra/README.md](../infra/README.md)** & **[../infra/config.yaml](../infra/config.yaml)** — Konfigurasi infrastruktur non-rahasia dan prosedur deployment VPS.
