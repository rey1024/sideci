## Ringkasan Perubahan
<!-- Jelaskan secara singkat apa yang diubah dan mengapa -->

## Referensi Tugas / Fitur
- Task ID (`docs/TASKS.md`): `T-...`
- Feature ID (`docs/features/`): `F...`

## Daftar Periksa Kualitas & Keamanan (Wajib)
- [ ] Perubahan mengikuti arsitektur di `docs/ARCHITECTURE.md` dan desain **Civic Pop Flat** di `docs/UI_UX.md` (tanpa gradasi AI/glassmorphism).
- [ ] Seluruh query database operasional menyertakan isolasi `village_id` (dan `dusun_id` untuk `kepala_dusun`).
- [ ] Tidak ada kredensial, kunci privat, token, atau data PII warga mentah yang ikut ter-*commit*.
- [ ] Pemeriksaan statis, tipe data, dan build otomatis telah dijalankan dan lulus.
- [ ] Dokumentasi terkait (`docs/TASKS.md`, `docs/features/`, atau skema migrasi) telah diperbarui.

## Bukti Verifikasi
<!-- Tempelkan perintah test/build yang benar-benar dijalankan beserta hasilnya -->
