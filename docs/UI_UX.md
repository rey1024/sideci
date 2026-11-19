# UI/UX Design Specification — "Soft Pastel Modern Dashboard"

Dokumen ini merupakan sumber kebenaran tunggal (*Single Source of Truth*) untuk standar desain visual, palet warna pastel modern, tipografi, visualisasi data, dan komponen antarmuka **SIDECI**.

---

## 1. Filosofi Visual Utama (Smooth, Airy, Soft Pastel & Professional)

Antarmuka SIDECI mengadopsi standar produk SaaS & *GovTech* modern saat ini: **tenang di mata, bersih, halus (*smooth*), berbasis kartu putih di atas kanvas porselen lembut, serta diperkaya aksen warna pastel yang elegan pada grafik dan lencana status**.

### Prinsip Wajib
1. **Permukaan Putih Bersih di Atas Kanvas Lembut**:
   - Latar belakang halaman menggunakan abu-kebiruan sangat lembut (`#F4F6FB`).
   - Seluruh kartu menggunakan putih bersih (`#FFFFFF`), sudut membulat halus (`rounded-2xl` / `16px`–`20px`), garis tepi sangat tipis (`1px solid #EAEFF7`), dan bayangan lembut (`0 4px 24px -4px rgba(24, 39, 75, 0.04)`).
2. **Aksen Warna Pastel Halus (*Smooth Pastel Accents*)**:
   - Warna tidak pernah ditumpahkan memenuhi seluruh latar kartu dengan outline hitam tebal (hindari gaya komik/*neo-brutalism* atau ilustrasi kartun kekanak-kanakan).
   - Warna hadir secara proporsional pada *pill tab* aktif, *donut ring*, *area chart* lembut, *progress bar* ramping, dan *badge* indikator.
3. **Visualisasi Data Halus & Informatif**:
   - Gunakan *smooth curved area sparkline*, *pastel bar chart* (batang pastel lembut dengan 1 sorotan aksen utama), *multi-segment donut chart*, dan *slim rounded progress bar* (`6px`–`8px`) disertai *floating metric pill* putih yang rapi.

---

## 2. Sistem Palet Warna ("Soft Pastel Civic Palette")

| Token | Nama | Hex Utama (Accent) | Hex Pastel Lembut (Tint/Track) | Penggunaan |
| :--- | :--- | :--- | :--- | :--- |
| `canvas` | **Porcelain Mist** | `#F4F6FB` | `#F8FAFC` | Latar belakang utama halaman & kotak input |
| `surface` | **Pure White** | `#FFFFFF` | — | Seluruh permukaan kartu, header, dan *floating pill* |
| `border` | **Soft Hairline** | `#EAEFF7` | `#DCE3F0` (Hover) | Garis pembatas tipis dan bersih |
| `ink` | **Deep Slate Navy** | `#1E2438` | `#5E6AD2` (Link) | Judul, angka metrik utama (`tabular-nums`), teks utama |
| `muted` | **Cool Slate** | `#8A94A6` | `#5A6578` (Label) | Subjudul kartu, sumbu grafik, keterangan sekunder |
| `lavender` | **Soft Violet** | `#7950F2` | `#F2EFFE` | Tab aktif (`Pill`), *area chart* utama, Banjar Kajanan |
| `aqua` | **Mint Aqua** | `#22B8CF` | `#E3FAFC` | *Donut ring* KK, pelacakan tiket, Banjar Kelodan |
| `mint` | **Emerald Mint** | `#12B886` | `#E6FCF5` | Indikator naik/positif (`+`), validasi disetujui, QR sah |
| `coral` | **Warm Coral** | `#FF6B5B` | `#FFE5E2` | Sorotan batang puncak pada *bar chart*, Banjar Rawa |
| `honey` | **Soft Amber** | `#F59F00` | `#FFF8DB` | *Area chart* layanan, status menunggu verifikasi, Banjar Kuwum |
| `pistachio` | **Soft Lime** | `#82C91E` | `#EEFCE3` | Segmen komposisi demografi, Banjar Sari Mekar |

---

## 3. Tipografi Halus & Standar Keterbacaan

1. **Font Utama (`--font-sans`)**: **`Inter`** dipadukan dengan **`Plus Jakarta Sans`** (`400`, `500`, `600`, `700`).
   - Angka statistik besar (`5,393`, `1,698`, `18 Menit`) menggunakan `font-bold tracking-tight tabular-nums text-[#1E2438]` sehingga tampak modern, sejajar rapi, dan tidak kaku.
2. **Font Kode Identitas (`--font-mono`)**: **`JetBrains Mono`** (`500`) dengan ukuran proporsional khusus untuk input/tampilan 16 digit NIK, Nomor KK, dan Kode Tiket agar tetap mudah diverifikasi operator tanpa merusak kelembutan visual.
3. **Hierarki Berat Huruf**:
   - Hindari penggunaan `UPPERCASE` berlebihan dan `font-extrabold` di setiap elemen. Gunakan *Sentence Case* yang ramah (`Dashboard Eksekutif`, `Sebaran Penduduk`, `Tingkat Pendidikan`) dengan `font-semibold` (`600`) untuk judul kartu (`15px`–`16px`).

---

## 4. Pola Komponen Standar

- **Segmented Pill Switcher**: Tombol tab aktif menggunakan latar `#F2EFFE` dan teks `#6741D9` (`rounded-lg px-3.5 py-1.5 text-sm font-semibold`), sedangkan tab non-aktif berwarna `#697386`.
- **Floating Trend Badge**: Kotak kecil putih `bg-white border border-[#E6EAF2] shadow-sm rounded-lg px-2.5 py-1 text-xs font-semibold` dengan ikon panah hijau lembut `#12B886`.
- **Hero Carousel Layar Penuh (`min-h-[calc(100vh-4rem)]`)**:
  - Layar pembuka tampil penuh satu layar (*full-viewport hero carousel*) berisi *hook* ucapan selamat datang di **Layanan Digital (SIDECI) Desa Ringdikit**, berpindah halus antar 3 sorotan utama (*Selamat Datang*, *Persuratan Cepat*, *Satu Data 5 Banjar Dinas*).
  - Menampilkan foto resmi **Pimpinan Pemerintah Desa** (`public/images/perbekel-ringdikit.jpg` — *I Made Sumadi, Perbekel Ringdikit*) dalam bingkai potret proporsional yang bersih.
  - Bagian bawah layar pembuka maupun footer menampilkan atribusi resmi: **"Sistem Desa Cerdas Terintegrasi (SIDECI) — Produk Pengabdian Kepada Masyarakat - Universitas Pendidikan Ganesha"**.
