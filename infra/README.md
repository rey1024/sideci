# Panduan Infrastruktur & Operasional Deployment SIDECI

Seluruh nilai topologi server, port kontainer, dan domain didefinisikan secara terpusat di [config.yaml](config.yaml). Dokumen ini menjelaskan tata cara operasional tanpa menduplikasi nilai rahasia.

---

## 1. Pemisahan Konfigurasi Publik vs Rahasia

- **[config.yaml](config.yaml)** *(Version-Controlled)*: Berisi nama kontainer, alokasi port VPS yang telah diverifikasi bebas bentrok (`6210`/`6211` untuk produksi dan `6212`/`6213` untuk staging), nama database, serta domain.
- **`infra/credentials.env`** *(Gitignored)*: Dibuat secara lokal dengan menyalin [credentials.env.example](credentials.env.example). Dilarang keras meng-*commit* atau mencetak isi berkas ini.

---

## 2. Arsitektur Routing URL Desa (`Path-Based` & Custom Domain) di Nginx

Agar setiap desa baru yang ditambahkan Superadmin langsung memiliki Landing Page aktif di produksi tanpa perlu membuat wildcard DNS atau sertifikat SSL per subdomain:

1. **DNS Cloudflare**:
   - `A` record `sideci.reisys.id` ➔ IP VPS (melayani semua desa melalui pola **`https://sideci.reisys.id/<slug-desa>`**, contoh pilot: **`https://sideci.reisys.id/ringdikit`**).
   - `A` record `api-sideci.reisys.id` ➔ IP VPS.
   - *(Opsional)* Untuk desa yang memiliki domain resmi sendiri (contoh: `ringdikit.desa.id`), admin domain desa dapat mengarahkan `CNAME` / `A` record ke gateway SIDECI.
2. **Nginx Reverse Proxy**:
   - Blok server `sideci.reisys.id` meneruskan seluruh path (`/<slug-desa>`) beserta `Host` header asli (`proxy_set_header Host $host;`) ke kontainer `sideci-frontend-prod` (`127.0.0.1:6210`) sehingga Next.js dan Backend Golang dapat mengenali `slug` atau `custom_domain` desa secara otomatis.

---

## 3. Alur Perintah `deploy.ps1`

Jalankan dari direktori root proyek menggunakan PowerShell:

```powershell
# 1. Validasi konfigurasi, keamanan Git, migrasi SQL, dan typecheck
.\infra\deploy.ps1 validate

# 2. Lihat rencana port, kontainer, dan domain tanpa menyentuh server
.\infra\deploy.ps1 plan

# 3. Sinkronisasi variabel & secret yang disetujui ke GitHub
.\infra\deploy.ps1 secrets

# 4. Deploy dan uji di lingkungan Staging terlebih dahulu
.\infra\deploy.ps1 deploy-staging

# 5. Deploy ke Produksi (meminta konfirmasi eksplisit 'DEPLOY-PROD')
.\infra\deploy.ps1 deploy-production

# 6. Periksa kesehatan layanan pasca-rilis
.\infra\deploy.ps1 status
```

---

## 4. Kesiapan Backup & Rollback

- Sebelum menjalankan migrasi skema di produksi, lakukan `pg_dump` pada database `sideci_prod` di kontainer PostgreSQL bersama.
- Setiap berkas `.up.sql` di `backend/migrations/` wajib didampingi berkas `.down.sql` yang teruji (diperiksa otomatis oleh `.\infra\deploy.ps1 validate`).
