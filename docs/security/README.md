# Security Posture & Pre-Production Audit Guide

Dokumen ini mengatur kebijakan keamanan, perlindungan data pribadi warga sesuai **UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP)**, pengelolaan rahasia, dan gerbang audit sebelum rilis produksi.

---

## 1. Catatan Audit Awal Repositori (Secret & PII Hygiene)

Pada saat inisialisasi standar repositori (19 November 2026), dilakukan pemeriksaan terhadap seluruh berkas kerja:

1. **Temuan Berkas Referensi Sensitif Lokal (Belum Pernah Masuk Git History)**:
   - Folder `docs/infra/` yang disalin sebagai referensi arsitektur dari proyek sebelumnya memuat berkas kredensial lokal (`credentials.env`, `play-service-account.json`, dan `android-keystore/`).
   - Folder `docs/referensi/` memuat dump database lama (`db_sideci.sql`) dan spreadsheet warga (`Data_Kependudukan_Desa_Ringdikit.xlsx`) yang mengandung data pribadi riil warga.
2. **Tindakan Mitigasi yang Telah Diterapkan**:
   - Diverifikasi melalui `git status` bahwa seluruh berkas tersebut berstatus *untracked* (belum pernah di-*commit*).
   - Aturan blokir ketat langsung ditambahkan ke [../../.gitignore](../../.gitignore) untuk `docs/infra/`, `infra/credentials.env`, `infra/secrets/`, `*.jks`, `*service-account*.json`, `docs/referensi/db_sideci.sql`, dan `docs/referensi/data penduduk/`.
   - **Rekomendasi Tindak Lanjut**: Setelah konfigurasi [../../infra/config.yaml](../../infra/config.yaml) yang baru selesai ditinjau, hapus folder referensi `docs/infra/` dari komputer lokal agar tidak tersimpan duplikat kredensial proyek lain.

---

## 2. Kontrol Keamanan Utama SIDECI

1. **Isolasi Multi-Tenant (`village_id`)**:
   - Setiap query database wajib menyertakan filter `village_id` dari konteks terverifikasi. Dilarang menerima `village_id` mentah dari body JSON klien untuk operasi baca/tulis lintas desa tanpa hak `superadmin`.
2. **Perlindungan Data Pribadi Warga (PII)**:
   - Endpoint publik hanya menyajikan angka agregat desa/dusun.
   - Pengajuan dan pelacakan surat tanpa login memverifikasi kombinasi `NIK + Tanggal Lahir`, membatasi laju permintaan (*rate limit*), dan menyamarkan nama warga pada respons publik.
   - Audit log aplikasi dilarang keras mencatat `password`, `password_hash`, token sesi, atau kunci rahasia (memperbaiki celah tabel `log` pada sistem lama).
3. **Keamanan Penyimpanan Dokumen**:
   - Berkas KTP/KK pengantar dan PDF surat bertanda tangan disimpan pada bucket privat dan diakses melalui *presigned URL* berbatas waktu singkat.

---

## 3. Gerbang Audit Keamanan Pra-Produksi (Cloudflare Security Audit Gate)

Sebelum menjalankan deployment produksi (`.\infra\deploy.ps1 deploy-production`), lakukan peninjauan keamanan menyeluruh (mengacu pada https://github.com/cloudflare/security-audit-skill apabila terpasang di lingkungan kerja):

- [x] Verifikasi tidak ada kredensial/kunci privat di riwayat Git (`git status --ignored`, pemeriksaan variabel).
- [x] Uji coba lintas-tenant (*IDOR / Cross-Village Access Test*): pastikan token Operator Desa A ditolak (`403/404`) saat mengakses warga atau surat Desa B.
- [x] Uji coba batasan Kepala Dusun: pastikan `kepala_dusun` Banjar Kelodan ditolak saat mencoba mengubah warga Banjar Kajanan.
- [x] Uji coba anti-enumerasi NIK pada endpoint publik pengajuan surat.
- [x] Pemeriksaan kompilasi & tipe (`go vet ./...`, `go test ./...` untuk Golang dan `tsc --noEmit` + `next build` untuk Next.js).
- [x] Persetujuan eksplisit pemilik rilis (*Release Owner Approval*) — laporan hasil audit tercatat di [AUDIT-2026-11-19-prod.md](AUDIT-2026-11-19-prod.md) dan audit mendalam pasca-rilis Studio Persuratan & Kiosk RFID tercatat di [AUDIT-2026-11-19-cloudflare-skill.md](AUDIT-2026-11-19-cloudflare-skill.md).
