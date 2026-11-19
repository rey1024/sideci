# F04 — Dashboard Eksekutif Kepala Desa / Perbekel

| Atribut | Nilai |
| :--- | :--- |
| **Feature ID** | `F04` |
| **Nama Fitur** | Ringkasan Statistik & Analitik Eksekutif Pimpinan Desa |
| **Status** | `IN_PROGRESS` (UI Eksekutif Aktif) |
| **Prioritas** | `P1` |

## 1. Ikhtisar
Menyajikan layar pantau khusus bagi Kepala Desa / Perbekel yang bersih, bebas dari menu teknis operator, responsif di layar ponsel, dan merangkum indikator strategis kependudukan serta kinerja layanan surat desa.

## 2. User Stories
- **US-F04-01**: Sebagai **Kepala Desa / Perbekel**, saya ingin memantau jumlah penduduk aktif, pertumbuhan bulanan (lahir/datang vs meninggal/pindah), cakupan kepemilikan akta, dan kecepatan layanan surat desa kapan saja.

## 3. Aturan Bisnis
- **BR-F04-01**: Role `kepala_desa` bersifat *read-only* terhadap data master penduduk (tidak dapat mengubah biodata warga secara langsung demi menjaga akuntabilitas operator dan jejak audit).

## 4. Kriteria Penerimaan (Acceptance Criteria)
- **AC-F04-01**: Dashboard menampilkan kartu KPI utama, perbandingan populasi & KK antar-Dusun/Banjar Dinas, indikator wajib KTP & kelengkapan Akta Lahir, serta rekap keaktifan laporan tiap Kepala Dusun.
- **AC-F04-02**: Seluruh grafik dan angka tetap jelas terbaca pada lebar layar mobile (`360px`–`430px`).
