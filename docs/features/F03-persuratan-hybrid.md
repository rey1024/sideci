# F03 — Layanan Persuratan Multi-NIK & Pengesahan Hybrid

| Atribut | Nilai |
| :--- | :--- |
| **Feature ID** | `F03` |
| **Nama Fitur** | Persuratan Otomatis Berbasis Template, Pengajuan Tanpa Login & QR Hybrid |
| **Status** | `IN_PROGRESS` (UI Pengajuan, Studio Surat & Verifikasi QR Aktif) |
| **Prioritas** | `P0` |

## 1. Ikhtisar
Mempercepat pelayanan administrasi surat desa baik melalui pengajuan mandiri warga tanpa login maupun pembuatan langsung oleh Operator Persuratan di loket cukup dengan mengetikkan NIK, dilengkapi QR Code verifikasi keaslian dan dukungan arsip tanda tangan basah maupun TTE BSrE.

## 2. User Stories
- **US-F03-01**: Sebagai **Warga**, saya ingin mengajukan permohonan surat cukup dengan memasukkan NIK, Tanggal Lahir, dan Nomor WhatsApp, lalu memantau progresnya dengan Kode Lacak Tiket.
- **US-F03-02**: Sebagai **Operator Persuratan**, saya ingin membuat 5 jenis surat utama (Umum, Kelahiran, Kematian, Beda Nama, Ahli Waris) dengan *auto-fill* NIK cepat serta mengunggah PDF yang telah ditandatangani Perbekel/Kepala Desa.

## 3. Aturan Bisnis
- **BR-F03-01**: Form publik wajib mencocokkan pasangan `(NIK, Tanggal Lahir)` dan hanya menampilkan nama warga yang disamarkan (`K***** R*** G******`) untuk mematuhi UU PDP.
- **BR-F03-02**: Template surat mendukung struktur multi-entitas: 2 NIK orang tua pada *Surat Kelahiran*, pelapor + almarhum pada *Surat Kematian*, deret dokumen dinamis pada *Surat Beda Nama*, dan multi-NIK ahli waris pada *Surat Waris*.
- **BR-F03-03**: Setiap surat yang diterbitkan wajib memiliki `verify_qr_token` unik yang dapat diperiksa publik melalui `/verify/{token}`.

## 4. Kriteria Penerimaan (Acceptance Criteria)
- **AC-F03-01**: Operator mengetik NIK warga pada Studio Surat dan dalam 1 langkah seluruh variabel dasar (Nama, TTL, JK, Agama, Pekerjaan, No KK, Alamat Banjar) terisi otomatis ke pratinjau surat.
- **AC-F03-02**: Pengajuan publik yang valid menghasilkan Kode Lacak Tiket berformat konsisten dan dapat dilacak tahapan statusnya hingga selesai.
- **AC-F03-03**: Pemindaian tautan `/verify/{token}` menampilkan status keabsahan surat, nomor surat, tanggal terbit, perihal, dan nama pejabat penandatangan resmi desa.
