import Link from "next/link";
import {
  ArrowRight,
  Award,
  Globe,
  LayoutDashboard,
  Mail,
  MoreVertical,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { RINGDIKIT_OVERVIEW } from "@/lib/ringdikit-data";
import HeroCarousel from "@/components/HeroCarousel";
import PublicLetterSection from "@/components/PublicLetterSection";
import {
  MultiSegmentDonut,
  PastelBarChart,
  SmoothHoneyAreaChart,
  SmoothSingleRingDonut,
  SmoothVioletSparkline,
} from "@/components/SmoothCharts";

export const dynamic = "force-dynamic";

interface ApiVillageOverview {
  slug: string;
  name: string;
  district_name: string;
  regency_name: string;
  province_name: string;
  postal_code: string;
  leader_title: string;
  leader_name: string;
  hamlet_term: string;
  office_address: string;
  office_phone: string;
  office_email: string;
  welcome_quote: string;
  total_residents: number;
  total_households: number;
  male_count: number;
  female_count: number;
  dusuns?: { name: string; residents: number; percentage: number }[];
}

async function loadVillageOverview(tenantSlug: string) {
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
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      return tenantSlug === "ringdikit" ? RINGDIKIT_OVERVIEW : null;
    }
    const api = (await res.json()) as ApiVillageOverview;
    const slug = api.slug || tenantSlug;
    return {
      ...RINGDIKIT_OVERVIEW,
      slug,
      subdomain: `sideci.reisys.id/${slug}`,
      name: api.name || RINGDIKIT_OVERVIEW.name,
      district: api.district_name
        ? `Kecamatan ${api.district_name}`
        : RINGDIKIT_OVERVIEW.district,
      regency: api.regency_name || RINGDIKIT_OVERVIEW.regency,
      province: api.province_name
        ? `Provinsi ${api.province_name}`
        : RINGDIKIT_OVERVIEW.province,
      postalCode: api.postal_code || RINGDIKIT_OVERVIEW.postalCode,
      leaderTitle: api.leader_title
        ? `${api.leader_title} ${api.name.replace(/^Desa\s+/i, "")}`
        : RINGDIKIT_OVERVIEW.leaderTitle,
      leaderName: api.leader_name || RINGDIKIT_OVERVIEW.leaderName,
      hamletTerm: api.hamlet_term || RINGDIKIT_OVERVIEW.hamletTerm,
      officeAddress: api.office_address || RINGDIKIT_OVERVIEW.officeAddress,
      officePhone: api.office_phone || RINGDIKIT_OVERVIEW.officePhone,
      officeEmail: api.office_email || RINGDIKIT_OVERVIEW.officeEmail,
      welcomeQuote: api.welcome_quote || RINGDIKIT_OVERVIEW.welcomeQuote,
      stats:
        api.total_residents > 0
          ? {
              ...RINGDIKIT_OVERVIEW.stats,
              totalResidents: api.total_residents,
              totalHouseholds: api.total_households,
              maleCount: api.male_count,
              femaleCount: api.female_count,
            }
          : RINGDIKIT_OVERVIEW.stats,
    };
  } catch {
    return tenantSlug === "ringdikit"
      ? {
          ...RINGDIKIT_OVERVIEW,
          subdomain: "sideci.reisys.id/ringdikit",
        }
      : null;
  }
}

export default async function VillageTenantPortalPage({
  params,
}: {
  params: Promise<{ villageSlug: string }>;
}) {
  const { villageSlug } = await params;
  const normalizedSlug = villageSlug.toLowerCase();
  const v = await loadVillageOverview(normalizedSlug);

  if (!v) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="soft-card p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-pastel-violetSoft text-[#6741D9] font-bold flex items-center justify-center mx-auto">
            SD
          </div>
          <h1 className="text-lg font-bold text-ink">
            Desa Belum Terdaftar di SIDECI
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
            Alamat portal{" "}
            <span className="font-mono text-ink">
              sideci.reisys.id/{normalizedSlug}
            </span>{" "}
            belum diaktifkan pada platform Sistem Desa Cerdas Terintegrasi.
          </p>
          <Link
            href="/ringdikit"
            className="soft-btn-primary text-xs py-2.5 px-4 inline-flex"
          >
            Buka Portal Desa Ringdikit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      {/* Top Navigation Bar */}
      <header className="bg-white/95 border-b border-line sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 xl:gap-6">
          {/* Identitas Desa */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center font-bold text-sm border border-pastel-violet/20 shrink-0">
              RD
            </div>
            <div className="min-w-0 leading-tight">
              <div className="font-bold text-sm sm:text-base text-ink whitespace-nowrap">
                {v.name}
              </div>
              <div className="hidden sm:block text-[11px] text-ink-muted whitespace-nowrap">
                {v.district} • {v.regency}
              </div>
            </div>
          </div>

          {/* Menu Navigasi (satu baris, tanpa tulisan menumpuk) */}
          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 flex-1 justify-center min-w-0">
            <a
              href="#beranda"
              className="pill-tab-active whitespace-nowrap text-[13px] px-2.5 xl:px-3.5"
            >
              Beranda
            </a>
            <a
              href="#statistik-desa"
              className="pill-tab whitespace-nowrap text-[13px] px-2.5 xl:px-3.5"
            >
              Statistik
            </a>
            <a
              href="#sebaran-banjar"
              className="pill-tab whitespace-nowrap text-[13px] px-2.5 xl:px-3.5"
            >
              {v.hamletTerm}
            </a>
            <a
              href="#layanan-surat"
              className="pill-tab whitespace-nowrap text-[13px] px-2.5 xl:px-3.5"
            >
              Layanan Surat
            </a>
            <Link
              href={`/${v.slug}/privacy-policy`}
              className="pill-tab whitespace-nowrap text-[13px] px-2.5 xl:px-3.5"
            >
              Kebijakan Privasi
            </Link>
          </nav>

          {/* Alamat Portal + Tombol Login */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden 2xl:flex items-center gap-2 text-xs text-ink-muted border-r border-line pr-3 whitespace-nowrap">
              <Globe className="w-3.5 h-3.5 text-pastel-aqua" />
              <span className="font-mono">{v.subdomain}</span>
            </div>
            <Link
              href={`/${v.slug}/panel`}
              className="soft-btn-primary text-xs sm:text-sm py-2 px-3.5 whitespace-nowrap"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Portal Perangkat Desa</span>
              <span className="sm:hidden">Masuk</span>
            </Link>
          </div>
        </div>

        {/* Menu geser untuk layar kecil / tablet */}
        <nav className="lg:hidden border-t border-line bg-white overflow-x-auto">
          <div className="flex items-center gap-1 px-4 py-2 w-max min-w-full">
            <a href="#beranda" className="pill-tab-active whitespace-nowrap text-xs">
              Beranda
            </a>
            <a href="#statistik-desa" className="pill-tab whitespace-nowrap text-xs">
              Statistik
            </a>
            <a href="#sebaran-banjar" className="pill-tab whitespace-nowrap text-xs">
              {v.hamletTerm}
            </a>
            <a href="#layanan-surat" className="pill-tab whitespace-nowrap text-xs">
              Layanan Surat
            </a>
            <Link
              href={`/${v.slug}/privacy-policy`}
              className="pill-tab whitespace-nowrap text-xs"
            >
              Kebijakan Privasi
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* HERO CAROUSEL 100vh */}
        <HeroCarousel
          totalResidents={v.stats.totalResidents}
          totalHouseholds={v.stats.totalHouseholds}
          totalBanjars={v.banjars.length}
        />

        {/* DASHBOARD STATISTIK PUBLIK */}
        <section id="statistik-desa" className="pt-8 pb-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-ink">
                  Ringkasan Demografi
                </h2>
                <span className="text-xs sm:text-sm text-ink-muted">
                  Data Agregat Tervalidasi {v.name}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-line rounded-xl p-1 shadow-soft">
                <span className="pill-tab-active text-xs py-1 px-3">
                  Tahun Berjalan
                </span>
                <span className="pill-tab text-xs py-1 px-3">Per Banjar</span>
                <span className="pill-tab text-xs py-1 px-3">Pendidikan</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-3 soft-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold tabular-nums text-ink tracking-tight">
                          {v.stats.totalResidents.toLocaleString("id-ID")}
                        </span>
                        <span className="w-5 h-5 rounded-full bg-pastel-mintSoft text-pastel-mint inline-flex items-center justify-center text-xs font-bold">
                          ↑
                        </span>
                      </div>
                      <div className="text-xs font-medium text-ink-muted mt-1">
                        Total Penduduk Aktif
                      </div>
                    </div>
                    <MoreVertical className="w-4 h-4 text-ink-muted" />
                  </div>
                </div>

                <SmoothVioletSparkline badgeText="99,3% Terpetakan" />

                <div className="flex items-center justify-between text-xs text-ink-muted pt-2 border-t border-line">
                  <span>
                    Laki-laki: {v.stats.maleCount.toLocaleString("id-ID")}
                  </span>
                  <span>
                    Perempuan: {v.stats.femaleCount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              <div className="lg:col-span-6 soft-card p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-ink">
                      Komposisi Pendidikan Warga
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Distribusi jenjang pendidikan terakhir penduduk
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-[#F8FAFC] border border-line rounded-lg p-0.5 text-xs">
                    <span className="bg-pastel-violetSoft text-[#6741D9] font-semibold px-2.5 py-1 rounded-md">
                      Grafik
                    </span>
                    <span className="text-ink-muted px-2.5 py-1">Ringkas</span>
                  </div>
                </div>

                <PastelBarChart
                  items={v.educationStats}
                  badgeText="31,5% SD"
                />
              </div>

              <div className="lg:col-span-3 soft-card p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-ink">
                    Kartu Keluarga
                  </h3>
                  <MoreVertical className="w-4 h-4 text-ink-muted" />
                </div>

                <SmoothSingleRingDonut
                  centerValue={v.stats.totalHouseholds.toLocaleString("id-ID")}
                  centerLabel="Kepala Keluarga"
                  percentage={74}
                  badgeText="73,8% Wajib KTP"
                />
              </div>
            </div>

            <div
              id="sebaran-banjar"
              className="grid grid-cols-1 lg:grid-cols-12 gap-5"
            >
              <div className="lg:col-span-4 soft-card p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-ink">
                      Sebaran 5 {v.hamletTerm}
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Proporsi warga tiap wilayah banjar
                    </p>
                  </div>
                  <MoreVertical className="w-4 h-4 text-ink-muted" />
                </div>

                <div className="space-y-4">
                  {v.banjars.map((b) => (
                    <div key={b.id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-xs sm:text-sm">
                        <div className="truncate">
                          <span className="font-semibold text-ink">
                            {b.name.replace("Banjar Dinas ", "BD. ")}
                          </span>{" "}
                          <span className="text-xs text-ink-muted">
                            {b.residents.toLocaleString("id-ID")} jiwa •{" "}
                            {b.households} KK
                          </span>
                        </div>
                        <span className="font-bold tabular-nums text-ink text-xs">
                          {b.percentage}%
                        </span>
                      </div>
                      <div
                        className="w-full h-2 rounded-full overflow-hidden"
                        style={{ backgroundColor: b.trackHex }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(b.percentage * 2.4, 100)}%`,
                            backgroundColor: b.accentHex,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-3 soft-card p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm sm:text-base font-bold text-ink">
                    Status Perkawinan
                  </h3>
                  <MoreVertical className="w-4 h-4 text-ink-muted" />
                </div>

                <MultiSegmentDonut
                  segments={v.maritalSegments}
                  centerValue={v.stats.totalResidents.toLocaleString("id-ID")}
                  centerLabel="Jiwa"
                />
              </div>

              <div className="lg:col-span-5 soft-card p-6 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl sm:text-3xl font-bold tabular-nums text-ink tracking-tight">
                        {v.stats.avgLetterSlaMinutes} Menit
                      </span>
                      <span className="w-5 h-5 rounded-full bg-pastel-mintSoft text-pastel-mint inline-flex items-center justify-center text-xs font-bold">
                        ↑
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      Rata-rata penyelesaian layanan surat desa (
                      {v.stats.monthlyLettersIssued} surat bulan ini)
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#F8FAFC] border border-line rounded-lg p-0.5 text-xs">
                    <span className="bg-pastel-violetSoft text-[#6741D9] font-semibold px-2.5 py-1 rounded-md">
                      Tren
                    </span>
                    <span className="text-ink-muted px-2.5 py-1">Bulanan</span>
                  </div>
                </div>

                <SmoothHoneyAreaChart
                  badgeText="96,4% Tepat Waktu"
                  labels={["Jun", "Jul", "Agu", "Sep", "Okt", "Nov"]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* LAYANAN PENGAJUAN & LACAK SURAT TANPA LOGIN */}
        <PublicLetterSection villageSlug={v.slug} />
      </main>

      {/* Footer Bawah Halaman */}
      <footer className="bg-white border-t border-line py-10 mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="rounded-2xl bg-gradient-to-r from-pastel-violetSoft/70 via-[#F8FAFD] to-pastel-mintSoft/60 border border-line p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white border border-line text-[#6741D9] flex items-center justify-center shadow-soft shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm sm:text-base font-bold text-ink">
                  Sistem Desa Cerdas Terintegrasi (SIDECI)
                </div>
                <div className="text-xs sm:text-sm text-ink-secondary mt-0.5">
                  Produk Pengabdian Kepada Masyarakat —{" "}
                  <strong className="font-semibold text-[#6741D9]">
                    Universitas Pendidikan Ganesha
                  </strong>
                </div>
              </div>
            </div>

            <Link
              href={`/${v.slug}/panel`}
              className="soft-btn-primary text-xs sm:text-sm py-2.5 px-4 shrink-0"
            >
              Workspace Operator & Perbekel <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 text-xs text-ink-muted">
            <div>
              <strong className="text-ink font-semibold">
                Pemerintah {v.name}
              </strong>{" "}
              — {v.district}, {v.regency}, {v.province} ({v.postalCode})
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href={`/${v.slug}/privacy-policy`}
                className="inline-flex items-center gap-1.5 font-semibold text-[#6741D9] hover:underline"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Kebijakan Privasi & Ketentuan (UU PDP)
              </Link>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-pastel-violet" />{" "}
                {v.officePhone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-pastel-aqua" />{" "}
                {v.officeEmail}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
