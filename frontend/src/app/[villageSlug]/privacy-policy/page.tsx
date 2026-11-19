import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Database,
  EyeOff,
  FileCheck2,
  Lock,
  Mail,
  Phone,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { RINGDIKIT_OVERVIEW } from "@/lib/ringdikit-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kebijakan Privasi & Perlindungan Data Pribadi (UU PDP) — SIDECI",
  description:
    "Kebijakan Privasi dan Ketentuan Perlindungan Data Pribadi Warga pada Sistem Desa Cerdas Terintegrasi (SIDECI) sesuai UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi.",
};

interface ApiVillageOverview {
  slug: string;
  name: string;
  district_name: string;
  regency_name: string;
  province_name: string;
  postal_code: string;
  leader_title: string;
  leader_name: string;
  office_address: string;
  office_phone: string;
  office_email: string;
}

async function loadVillageIdentity(tenantSlug: string) {
  const base =
    process.env.INTERNAL_API_BASE_URL ||
    (process.env.INTERNAL_API_ORIGIN
      ? `${process.env.INTERNAL_API_ORIGIN}/api/v1`
      : "http://127.0.0.1:8080/api/v1");
  try {
    const res = await fetch(`${base}/public/village`, {
      headers: { "X-Tenant-Slug": tenantSlug },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("fallback");
    const api = (await res.json()) as ApiVillageOverview;
    return {
      slug: api.slug || tenantSlug,
      name: api.name || RINGDIKIT_OVERVIEW.name,
      district: api.district_name
        ? `Kecamatan ${api.district_name}`
        : RINGDIKIT_OVERVIEW.district,
      regency: api.regency_name || RINGDIKIT_OVERVIEW.regency,
      province: api.province_name
        ? `Provinsi ${api.province_name}`
        : RINGDIKIT_OVERVIEW.province,
      postalCode: api.postal_code || RINGDIKIT_OVERVIEW.postalCode,
      officeAddress: api.office_address || RINGDIKIT_OVERVIEW.officeAddress,
      officePhone: api.office_phone || RINGDIKIT_OVERVIEW.officePhone,
      officeEmail: api.office_email || RINGDIKIT_OVERVIEW.officeEmail,
    };
  } catch {
    return {
      slug: tenantSlug,
      name: RINGDIKIT_OVERVIEW.name,
      district: RINGDIKIT_OVERVIEW.district,
      regency: RINGDIKIT_OVERVIEW.regency,
      province: RINGDIKIT_OVERVIEW.province,
      postalCode: RINGDIKIT_OVERVIEW.postalCode,
      officeAddress: RINGDIKIT_OVERVIEW.officeAddress,
      officePhone: RINGDIKIT_OVERVIEW.officePhone,
      officeEmail: RINGDIKIT_OVERVIEW.officeEmail,
    };
  }
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ villageSlug: string }>;
}) {
  const { villageSlug } = await params;
  const v = await loadVillageIdentity(villageSlug.toLowerCase());

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {/* Header Navigasi */}
      <header className="bg-white/95 border-b border-line sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href={`/${v.slug}`}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-ink-secondary hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Portal {v.name}
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-lg bg-pastel-mintSoft px-3 py-1 text-xs font-semibold text-[#099268]">
            <ShieldCheck className="w-4 h-4" />
            Patuh UU PDP No. 27 Tahun 2022
          </span>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 space-y-6">
        {/* Hero Ringkasan Kebijakan */}
        <section className="soft-card p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-pastel-violetSoft px-3 py-1 text-xs font-semibold text-[#6741D9]">
              Dokumen Resmi Privasi & Ketentuan Layanan
            </span>
            <span className="text-xs text-ink-muted">
              Berlaku Efektif: 19 November 2026 • Versi 1.0
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              Kebijakan Privasi & Perlindungan Data Pribadi (Privacy Policy)
            </h1>
            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
              Kebijakan Privasi ini menjelaskan bagaimana{" "}
              <strong className="text-ink">Pemerintah {v.name}</strong> ({v.district},{" "}
              {v.regency}, {v.province}) melalui platform{" "}
              <strong className="text-ink">
                Sistem Desa Cerdas Terintegrasi (SIDECI)
              </strong>{" "}
              mengumpulkan, memproses, menyimpan, melindungi, dan menghormati
              hak atas Data Pribadi warga sesuai peraturan perundang-undangan di
              Republik Indonesia.
            </p>
          </div>

          {/* 4 Komitmen Inti untuk Warga */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
            <div className="rounded-2xl bg-[#F8FAFD] border border-line p-4 space-y-1.5">
              <EyeOff className="w-5 h-5 text-[#6741D9]" />
              <div className="text-xs font-bold text-ink">
                Tanpa Eksposur NIK Publik
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                Halaman publik hanya menampilkan grafik statistik agregat dan
                menyamarkan nama pemohon surat.
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FAFD] border border-line p-4 space-y-1.5">
              <Lock className="w-5 h-5 text-[#099268]" />
              <div className="text-xs font-bold text-ink">
                Isolasi Ketat Antar-Desa
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                Data warga {v.name} terisolasi penuh (`village_id`) dan dikunci
                sesuai wilayah Banjar Dinas/Dusun.
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FAFD] border border-line p-4 space-y-1.5">
              <Scale className="w-5 h-5 text-[#0B7285]" />
              <div className="text-xs font-bold text-ink">
                Nol Komersialisasi Data
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                Data kependudukan murni untuk pelayanan publik desa dan dilarang
                keras diperjualbelikan atau dipakai iklan.
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FAFD] border border-line p-4 space-y-1.5">
              <FileCheck2 className="w-5 h-5 text-[#B45309]" />
              <div className="text-xs font-bold text-ink">
                Jejak Audit Terverifikasi
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                Setiap perubahan data penduduk dan penerbitan surat tercatat di
                log audit resmi pemerintah desa.
              </p>
            </div>
          </div>
        </section>

        {/* Isi Detail Pasal demi Pasal */}
        <div className="soft-card p-6 sm:p-8 space-y-8 text-xs sm:text-sm text-ink-secondary leading-relaxed">
          {/* Pasal 1 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#6741D9]" />
              1. Dasar Hukum Kepatuhan
            </h2>
            <p>
              Pengelolaan dan pemrosesan Data Pribadi pada sistem SIDECI tunduk
              dan patuh pada ketentuan peraturan perundang-undangan Republik
              Indonesia, meliputi:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-ink">
                  Undang-Undang Nomor 27 Tahun 2022 tentang Perlindungan Data
                  Pribadi (UU PDP)
                </strong>
                , khususnya Pasal 20 ayat (2) huruf d dan e mengenai pemrosesan
                Data Pribadi untuk pemenuhan kewajiban hukum Pengendali Data
                Pribadi serta pelaksanaan tugas dalam rangka kepentingan umum
                dan pelayanan publik.
              </li>
              <li>
                <strong className="text-ink">
                  Undang-Undang Nomor 24 Tahun 2013 tentang Perubahan atas
                  Undang-Undang Nomor 23 Tahun 2006 tentang Administrasi
                  Kependudukan
                </strong>{" "}
                terkait perlindungan kerahasiaan elemen data kependudukan warga.
              </li>
              <li>
                <strong className="text-ink">
                  Undang-Undang Nomor 6 Tahun 2014 tentang Desa
                </strong>{" "}
                (beserta perubahannya) terkait penyelenggaraan Sistem Informasi
                Desa dan keterbukaan informasi publik non-pribadi.
              </li>
              <li>
                <strong className="text-ink">
                  Peraturan Pemerintah Nomor 71 Tahun 2019 tentang
                  Penyelenggaraan Sistem dan Transaksi Elektronik (PP PSTE)
                </strong>
                .
              </li>
            </ul>
          </section>

          {/* Pasal 2 */}
          <section className="space-y-2.5 border-t border-line pt-6">
            <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#6741D9]" />
              2. Pengendali dan Pemroses Data Pribadi
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-ink">
                  Pengendali Data Pribadi (Data Controller)
                </strong>
                : <strong className="text-ink">Pemerintah {v.name}</strong> yang
                menentukan tujuan dan melakukan kendali sah atas administrasi
                kependudukan serta pelayanan persuratan warga di wilayah{" "}
                {v.name}.
              </li>
              <li>
                <strong className="text-ink">
                  Penyelenggara Teknis Sistem
                </strong>
                : Tim Pengabdian Kepada Masyarakat{" "}
                <strong className="text-ink">
                  Universitas Pendidikan Ganesha (Undiksha)
                </strong>{" "}
                yang menyediakan infrastruktur keamanan perangkat lunak SIDECI
                sesuai instruksi resmi Pemerintah Desa.
              </li>
            </ul>
          </section>

          {/* Pasal 3 */}
          <section className="space-y-2.5 border-t border-line pt-6">
            <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
              <Database className="w-4 h-4 text-[#6741D9]" />
              3. Jenis Data Pribadi yang Diproses
            </h2>
            <p>
              Sesuai kebutuhan sah pelayanan administrasi desa, sistem memproses
              kategori data berikut secara terbatas dan proporsional:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="rounded-xl bg-[#F9FAFD] border border-line p-4 space-y-1.5">
                <div className="font-bold text-ink text-xs sm:text-sm">
                  A. Data Administrasi Kependudukan (Internal Desa)
                </div>
                <p className="text-xs">
                  Nomor Induk Kependudukan (NIK), Nomor Kartu Keluarga (KK),
                  Nama Lengkap, Jenis Kelamin, Tempat & Tanggal Lahir, Golongan
                  Darah, Agama, Status Perkawinan, Hubungan Dalam Keluarga
                  (SHDK), Pendidikan, Pekerjaan, Nama Orang Tua, Alamat Banjar
                  Dinas/Dusun, serta riwayat mutasi (kelahiran, kematian,
                  perpindahan).
                </p>
              </div>
              <div className="rounded-xl bg-[#F9FAFD] border border-line p-4 space-y-1.5">
                <div className="font-bold text-ink text-xs sm:text-sm">
                  B. Data Permohonan Layanan & Teknis Keamanan
                </div>
                <p className="text-xs">
                  Nomor telepon/WhatsApp aktif pemohon surat untuk pemberitahuan
                  status tiket, keperluan pengajuan surat, dokumen pengantar
                  yang diunggah warga, serta alamat IP & waktu akses pada log
                  keamanan untuk mencegah penyalahgunaan atau serangan siber.
                </p>
              </div>
            </div>
          </section>

          {/* Pasal 4 */}
          <section className="space-y-2.5 border-t border-line pt-6">
            <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#099268]" />
              4. Tujuan Pemrosesan Data
            </h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                Memverifikasi identitas warga saat mengajukan permohonan surat
                keterangan desa secara daring maupun langsung di loket kantor
                desa.
              </li>
              <li>
                Menyelenggarakan alur pemutakhiran data penduduk secara
                berjenjang dan tervalidasi dari Kepala Dusun / Kelian Banjar
                Dinas ke Operator Kependudukan Desa.
              </li>
              <li>
                Menyediakan fitur verifikasi keaslian dokumen surat desa melalui
                QR Code resmi (`/verify/[token]`) guna mencegah pemalsuan
                dokumen negara/desa.
              </li>
              <li>
                Menyajikan informasi keterbukaan publik dan perencanaan
                pembangunan desa dalam bentuk{" "}
                <strong className="text-ink">
                  statistik demografi agregat yang sepenuhnya anonim
                </strong>{" "}
                (tanpa menampilkan NIK, Nomor KK, atau daftar nama warga).
              </li>
            </ol>
          </section>

          {/* Pasal 5 */}
          <section className="space-y-2.5 border-t border-line pt-6">
            <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#099268]" />
              5. Standar Keamanan Teknis & Masking Data Publik
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-ink">
                  Penyamaran Identitas Publik (Data Masking)
                </strong>
                : Pada fitur pengajuan surat tanpa login, pelacakan tiket, dan
                halaman verifikasi QR publik, sistem mewajibkan kecocokan
                kombinasi <code>NIK + Tanggal Lahir</code>, menerapkan
                pembatasan laju permintaan (<em>rate limiting</em>), serta
                menyamarkan nama warga (contoh: <code>K***** R*** G******</code>
                ).
              </li>
              <li>
                <strong className="text-ink">
                  Kontrol Akses Berbasis Peran (Multi-Role RBAC)
                </strong>
                : Kepala Desa hanya mengakses dasbor agregat eksekutif; Kepala
                Dusun terkunci secara teknis hanya pada data warga dusun
                wewenangnya; dan perubahan buku induk penduduk hanya sah setelah
                divalidasi Operator Kependudukan Desa.
              </li>
              <li>
                <strong className="text-ink">
                  Keamanan Sesi, Kriptografi & Cookie
                </strong>
                : Seluruh komunikasi dilindungi enkripsi HTTPS/TLS, kata sandi
                perangkat desa disimpan menggunakan algoritma hash{" "}
                <code>bcrypt</code>, dan sesi login menggunakan{" "}
                <code>HttpOnly, Secure, SameSite=Lax</code> cookie. Sistem{" "}
                <strong className="text-ink">tidak menggunakan</strong> cookie
                pelacakan iklan pihak ketiga.
              </li>
            </ul>
          </section>

          {/* Pasal 6 */}
          <section className="space-y-2.5 border-t border-line pt-6">
            <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#6741D9]" />
              6. Hak Warga sebagai Subjek Data Pribadi (UU PDP)
            </h2>
            <p>
              Sesuai Bab IV UU No. 27 Tahun 2022 tentang Perlindungan Data
              Pribadi, setiap warga berhak untuk:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Memperoleh informasi yang jelas mengenai tujuan penggunaan data
                kependudukannya pada layanan digital desa.
              </li>
              <li>
                Melengkapi, memperbarui, dan/atau memperbaiki kesalahan atau
                ketidakakuratan biodata kependudukan melalui Kelian Banjar
                Dinas/Kepala Dusun setempat maupun Loket Pelayanan Kantor{" "}
                {v.name} dengan menunjukkan dokumen kependudukan sah
                (KTP-el/KK/Akta).
              </li>
              <li>
                Mengajukan pengaduan atau keberatan apabila menemukan indikasi
                ketidaksesuaian pemrosesan data pribadi pada layanan SIDECI.
              </li>
            </ul>
          </section>

          {/* Pasal 7 */}
          <section className="space-y-2.5 border-t border-line pt-6">
            <h2 className="text-base sm:text-lg font-bold text-ink">
              7. Penyimpanan, Retensi, & Pembagian kepada Pihak Ketiga
            </h2>
            <p>
              Data Pribadi disimpan pada pusat data berlokasi di wilayah hukum /
              pengelolaan aman Pemerintah Desa selama diperlukan bagi
              penyelenggaraan administrasi kependudukan dan kearsipan desa
              sesuai ketentuan jadwal retensi arsip pemerintahan. Pemerintah{" "}
              {v.name} <strong className="text-ink">tidak pernah</strong>{" "}
              menjual, menyewakan, atau menyerahkan Data Pribadi warga kepada
              pihak komersial mana pun, kecuali diwajibkan oleh perintah hukum
              atau instansi pemerintah berwenang (seperti Dinas Dukcapil) sesuai
              undang-undang.
            </p>
          </section>

          {/* Pasal 8 — Kontak Resmi */}
          <section className="space-y-3 border-t border-line pt-6">
            <h2 className="text-base sm:text-lg font-bold text-ink">
              8. Layanan Pengaduan & Kontak Perlindungan Data Desa
            </h2>
            <p>
              Untuk pertanyaan, permohonan pemutakhiran biodata, atau pengaduan
              terkait perlindungan Data Pribadi pada portal SIDECI, warga dapat
              menghubungi saluran resmi berikut:
            </p>
            <div className="rounded-2xl bg-pastel-violetSoft/45 border border-pastel-violet/25 p-5 space-y-2 text-xs sm:text-sm">
              <div className="font-bold text-ink text-sm sm:text-base">
                Sekretariat Pemerintah {v.name} (Pengelola Layanan SIDECI)
              </div>
              <div className="text-ink-secondary">
                {v.officeAddress} — {v.district}, {v.regency}, {v.province} (
                {v.postalCode})
              </div>
              <div className="flex flex-wrap gap-5 pt-1 font-medium text-ink">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-[#6741D9]" />
                  {v.officePhone}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[#0B7285]" />
                  {v.officeEmail}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
