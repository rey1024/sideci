# F02 — Manajemen Kependudukan, Validasi Dusun-Desa & Historis

| Atribut | Nilai |
| :--- | :--- |
| **Feature ID** | `F02` |
| **Nama Fitur** | Kependudukan Berjenjang (*Maker-Checker*), Mutasi Historis & Smart Excel Import |
| **Status** | `IN_PROGRESS` (Skema DB & UI Simulasi Aktif) |
| **Prioritas** | `P0` |

## 1. Ikhtisar
Mengelola data Kartu Keluarga (KK) dan penduduk dengan pembagian tugas nyata: **Operator Kepala Dusun** melaporkan warga/peristiwa di dusunnya masing-masing, sedangkan **Operator Kependudukan Desa** memvalidasi usulan tersebut sehingga memperbarui data master dan merekam jejak historis abadi per penduduk.

## 2. User Stories
- **US-F02-01**: Sebagai **Kepala Dusun / Kelian Banjar Dinas**, saya ingin menginput warga baru serta melaporkan kelahiran, kematian, perkawinan, dan perpindahan warga di dusun saya.
- **US-F02-02**: Sebagai **Operator Kependudukan Desa**, saya ingin memeriksa usulan Kepala Dusun secara berdampingan (*before/after diff*), mengimpor Excel SIAK desa, serta menelusuri riwayat peristiwa tiap penduduk.

## 3. Aturan Bisnis
- **BR-F02-01**: Akun `kepala_dusun` wajib terikat pada satu `dusun_id` dan ditolak di tingkat API apabila mengakses atau mengusulkan perubahan untuk `dusun_id` lain.
- **BR-F02-02**: Perubahan yang diusulkan Kepala Dusun berstatus `PENDING` dan belum mengubah statistik populasi aktif hingga disetujui (`APPROVED`) oleh `operator_kependudukan`.
- **BR-F02-03**: Penduduk yang dilaporkan `MENINGGAL` atau `PINDAH_KELUAR` tidak dihapus secara fisik (*hard delete*), melainkan diubah statusnya dan dicatat pada `population_events` agar relasi keluarga/waris tetap terjaga.

## 4. Kriteria Penerimaan (Acceptance Criteria)
- **AC-F02-01**: Saat `operator_kependudukan` menyetujui laporan kelahiran/kematian/pindah dari Kepala Dusun, tabel `residents` diperbarui dan minimal 1 baris tercatat otomatis pada `population_events`.
- **AC-F02-02**: Saat mengimpor file berformat `Data_Kependudukan_Desa_Ringdikit.xlsx`, sistem memetakan kode SIAK (`AGAMA`, `SHDRT`, `AKTA_*`), menormalisasi format tanggal campuran, dan menampilkan pratinjau baris anomali (seperti dusun kosong atau KK dengan >1 Kepala Keluarga).
- **AC-F02-03**: Seluruh kolom NIK dan Nomor KK ditampilkan menggunakan font monospace `JetBrains Mono` dengan validasi tepat 16 digit angka.
