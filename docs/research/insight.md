# Research & Domain Insights — Studi Kasus Desa Ringdikit

Dokumen ini merangkum temuan faktual dari eksplorasi materi sistem terdahulu (`docs/referensi/`) sebagai landasan perancangan SIDECI v2.0.

> **Catatan Perlindungan Data (UU PDP)**: File mentah `db_sideci.sql` dan `Data_Kependudukan_Desa_Ringdikit.xlsx` berisi NIK/KK asli warga sehingga telah dikecualikan melalui `.gitignore`. Dokumen ini hanya mencatat metrik agregat dan pola skema.

---

## 1. Profil Wilayah Studi Kasus (Desa Ringdikit)

- **Wilayah Administratif**: Desa Ringdikit, Kecamatan Seririt, Kabupaten Buleleng, Provinsi Bali (`Kode Pos 81153`).
- **Sebutan Lokal**: Kepala Desa disebut **Perbekel** (*I Made Sumadi*), dan sub-wilayah disebut **Banjar Dinas** yang dipimpin oleh **Kelian Banjar Dinas**.
- **Alamat Sekretariat**: Jalan Raya Seririt – Pupuan, Desa Ringdikit (`desaringdikit@gmail.com`).
- **Daftar 5 Banjar Dinas & Populasi Awal (Total: 5.393 Jiwa / 1.698 KK)**:
  1. **Banjar Dinas Kajanan**: 1.778 jiwa (32,97%)
  2. **Banjar Dinas Kelodan**: 1.717 jiwa (31,84%)
  3. **Banjar Dinas Sari Mekar**: 751 jiwa (13,93%)
  4. **Banjar Dinas Kuwum**: 585 jiwa (10,85%)
  5. **Banjar Dinas Rawa**: 479 jiwa (8,88%)
  6. *Belum Terpetakan (`NULL` di data mentah)*: **83 jiwa (1,54%)**

---

## 2. Temuan Kualitas Data Ekspor SIAK (`Data_Kependudukan_Desa_Ringdikit.xlsx`)

1. **Komposisi Demografi Dasar**:
   - Jenis Kelamin: Perempuan **2.737 jiwa** (50,75%) | Laki-laki **2.656 jiwa** (49,25%).
   - Status Kawin: Kawin (`2.751`), Belum Kawin (`2.329`), Cerai Mati (`246`), Cerai Hidup (`67`).
   - Pendidikan Terakhir: Tamat SD (`1.700`), Tidak/Belum Sekolah (`1.643`), SLTA (`812`), SLTP (`664`), Tidak Tamat SD (`424`), Diploma/Sarjana/Pascasarjana (`150`).
2. **Inkonsistensi Kode & Tipe Data yang Wajib Dinormalisasi Importer**:
   - Kolom `AGAMA` berisi kode numerik SIAK (`'4'` = Hindu sebanyak 5.369 jiwa, `'1'` = Islam 19 jiwa, `'2'` = Kristen 5 jiwa), sedangkan input manual di aplikasi lama menulis teks `'Hindu'`.
   - Kolom `SHDRT` memakai kode numerik (`1` = Kepala Keluarga, `3` = Istri, `4` = Anak, `5` = Menantu, `6` = Cucu, `7` = Orangtua, `9` = Famili Lain, `11` = Lainnya).
   - Kolom tanggal tidak seragam: `TGL_LHR` berformat `MM/DD/YYYY HH:mm:ss`, sedangkan `TGL_KWN` dan `TGL_CRAI` berformat `DD-MON-YY` (`19-NOV-09`).
   - Terdapat **1.698 Nomor KK unik**, namun terdapat **1.699 baris berstatus `KEPALA KELUARGA`** — menandakan adanya minimal 1 KK dengan Kepala Keluarga ganda yang perlu dideteksi otomatis oleh validator.
   - Sebanyak **83 baris kehilangan relasi `id_dusun`** karena variasi ketikan teks alamat seperti `BNJAR DINAS MEKAR SARI` (seharusnya `Sari Mekar`) atau `BANJAR DINAS RINGDIKIT`.
   - Sebanyak **3.479 warga** tercatat berkode `AKTA_LHR = '1'` (belum tercatat nomor akta lahir di SIAK) — menjadi metrik eksekutif yang sangat bernilai bagi Perbekel untuk program layanan jemput bola administrasi kependudukan.

---

## 3. Temuan Struktur 5 Template Surat Desa (`docs/referensi/format-surat/`)

Bedah dokumen `.docx` membuktikan bahwa tabel `surat` lama (yang hanya mengikat 1 `nik`) tidak memadai:

1. **Surat Keterangan Umum**: 1 NIK pemohon + dasar surat pengantar Kelian Banjar Dinas + uraian keterangan + keperluan.
2. **Surat Keterangan Kelahiran**: Data anak (nama, anak ke-, tempat/tgl lahir, alamat) + nama & alamat penolong kelahiran + **2 NIK Orang Tua (NIK Ibu & NIK Ayah)**.
3. **Surat Keterangan Kematian**: Identitas pelapor & status hubungan + **NIK Almarhum/ah** + hari/tanggal/tempat/sebab kematian + keperluan. Wajib diintegrasikan agar status penduduk Almarhum/ah dapat dimutakhirkan menjadi `MENINGGAL`.
4. **Surat Keterangan Beda Nama**: 1 NIK pemohon + **daftar berulang (*repeatable*) beberapa dokumen** (`Jenis Dokumen`, `Nomor`, `Nama Tercantum`). *(Ditemukan salah ketik judul `"SURAT KETERANGAN KEMATIAN"` di dalam file referensi `4. SURAT KETERANGAN BEDA NAMA.docx` yang diperbaiki pada engine baru).*
5. **Surat Keterangan Waris**: Data pewaris yang telah wafat + **daftar multi-NIK ahli waris** (*auto-fill* nama, TTL, NIK, pekerjaan per ahli waris) + keperluan.

---

## 4. Pelajaran Keamanan dari `db_sideci.sql` Lama

- Tabel `log` di sistem lama merekam payload JSON mentah dari form tambah pengguna, termasuk string hash password di dalam teks log.
- File PDF surat warga disimpan di direktori web publik statis (`/public_html/sideci/berkas/...`) yang rawan diakses tanpa otorisasi apabila nama berkas diketahui.
- Kedua celah ini dieliminasi pada SIDECI v2 melalui *sanitized structured audit log* dan *private object storage* dengan *presigned URL* + verifikasi `NIK + Tanggal Lahir`.
