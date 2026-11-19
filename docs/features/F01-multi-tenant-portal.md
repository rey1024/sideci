# F01 — Multi-Desa Tenant & Portal Publik Desa

| Atribut | Nilai |
| :--- | :--- |
| **Feature ID** | `F01` |
| **Nama Fitur** | Manajemen Multi-Desa (*Multi-Tenant*) & Landing Page Publik Modern |
| **Status** | `IN_PROGRESS` (UI Baseline Aktif) |
| **Prioritas** | `P0` |

## 1. Ikhtisar
Menyediakan portal publik spesifik per desa yang pada lingkungan produksi diakses melalui pola path **`https://sideci.reisys.id/<slug-desa>`** (contoh pilot: **`https://sideci.reisys.id/ringdikit`**) maupun custom domain resmi desa (`ringdikit.desa.id`), menampilkan potret besar pimpinan desa, profil dasar sekretariat, dan infografis demografi agregat yang berwarna, flat, dan jelas terbaca.

## 2. User Stories
- **US-F01-01**: Sebagai **Superadmin**, saya ingin mendaftarkan desa baru beserta subdomain, custom domain, dan istilah lokal (*Perbekel* / *Kepala Desa*, *Banjar Dinas* / *Dusun*) tanpa mengubah kode program.
- **US-F01-02**: Sebagai **Warga / Publik**, saya ingin melihat profil resmi desa, foto Kepala Desa/Perbekel, dan statistik penduduk desa yang menarik secara visual dari HP maupun laptop.

## 3. Aturan Bisnis
- **BR-F01-01**: Seluruh angka statistik publik merupakan agregasi penduduk berstatus `AKTIF` dan dilarang keras mengekspos NIK, Nomor KK, maupun nama warga.
- **BR-F01-02**: Terminologi jabatan kepala desa dan sub-wilayah mengikuti konfigurasi `villages` masing-masing desa.

## 4. Kriteria Penerimaan (Acceptance Criteria)
- **AC-F01-01**: Saat pengunjung membuka domain desa (contoh studi kasus Desa Ringdikit), halaman menampilkan Hero potret Perbekel *I Made Sumadi*, data 5.393 penduduk aktif, 1.698 KK, dan rincian 5 Banjar Dinas (*Kajanan, Kelodan, Sari Mekar, Kuwum, Rawa*).
- **AC-F01-02**: Saat domain tidak terdaftar pada tabel `villages`, sistem menampilkan halaman informasi "Desa Belum Terdaftar di SIDECI" yang bersih tanpa membocorkan struktur internal.
- **AC-F01-03**: Tampilan memenuhi standar [../UI_UX.md](../UI_UX.md) (**Soft Pastel Modern**: kanvas `#F4F6FB`, kartu putih `rounded-2xl` berbayangan lembut, palet pastel halus, dan grafik SVG bersih).

## 5. Edge Cases
- Desa baru belum memiliki data penduduk: komponen grafik menampilkan status kosong (*empty state*) dengan angka `0` tanpa error pembagian nol (`NaN%`).
