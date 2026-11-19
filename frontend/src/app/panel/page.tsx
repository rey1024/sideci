"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ApiDusunItem,
  ApiPopulationStats,
  ApiResidentItem,
  ApiSubmissionItem,
  fetchDusuns,
  fetchMe,
  fetchPopulationStats,
  fetchResidents,
  fetchSubmissions,
  logout,
  reviewSubmission,
  SessionUser,
  viewsForRoles,
} from "@/lib/api";
import {
  Activity,
  ArrowLeft,
  Bell,
  Check,
  ClipboardCheck,
  FileCheck2,
  FilePlus2,
  Home,
  Nfc,
  QrCode,
  RotateCcw,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import { LETTER_TEMPLATES, RINGDIKIT_OVERVIEW } from "@/lib/ringdikit-data";
import {
  MultiSegmentDonut,
  PastelBarChart,
  SmoothHoneyAreaChart,
  SmoothVioletSparkline,
} from "@/components/SmoothCharts";
import SuperadminView from "@/components/SuperadminView";
import OperatorPopulationManager from "@/components/OperatorPopulationManager";
import KepalaDusunWorkspace from "@/components/KepalaDusunWorkspace";
import LetterStudioManager, {
  PersuratanSubTab,
} from "@/components/LetterStudioManager";
import KioskWorkspaceManager from "@/components/KioskWorkspaceManager";

type ActiveRole =
  | "operator_desa"
  | "kepala_dusun"
  | "kepala_desa"
  | "superadmin";

const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  BIRTH: "KELAHIRAN",
  DEATH: "KEMATIAN",
  MOVE_IN: "PINDAH MASUK",
  MOVE_OUT: "PINDAH KELUAR",
  MARRIAGE: "PERKAWINAN",
  DIVORCE: "PERCERAIAN",
  NEW_RESIDENT: "PENDUDUK BARU",
  UPDATE_BIODATA: "PERUBAHAN KK / BIODATA",
};

function Workspace({
  user,
  allowedViews,
  villageSlug,
}: {
  user: SessionUser;
  allowedViews: ActiveRole[];
  villageSlug: string;
}) {
  const [role, setRole] = useState<ActiveRole>(allowedViews[0]);
  const [operatorTab, setOperatorTab] = useState<
    "penduduk" | "validasi" | "persuratan" | "kiosk"
  >("penduduk");
  const [persuratanSubTab, setPersuratanSubTab] =
    useState<PersuratanSubTab>("studio");

  const [popStats, setPopStats] = useState<ApiPopulationStats | null>(null);
  const [dusuns, setDusuns] = useState<ApiDusunItem[]>([]);
  const [submissions, setSubmissions] = useState<ApiSubmissionItem[]>([]);

  const reloadOverviewAndSubmissions = useCallback(async () => {
    const [statsResp, dusunsResp, subResp] = await Promise.all([
      fetchPopulationStats(),
      fetchDusuns(),
      fetchSubmissions(),
    ]);

    if (statsResp.ok) {
      setPopStats(statsResp.data);
    }
    if (dusunsResp.ok && dusunsResp.data.dusuns) {
      setDusuns(dusunsResp.data.dusuns);
    }
    if (subResp.ok) {
      setSubmissions(subResp.data.submissions || []);
    }
  }, []);

  useEffect(() => {
    if (role !== "superadmin") {
      reloadOverviewAndSubmissions();
    }
  }, [role, reloadOverviewAndSubmissions]);

  async function updateSubmissionStatus(
    id: string,
    decision: "APPROVED" | "REVISION_REQUESTED"
  ) {
    const notes =
      decision === "REVISION_REQUESTED"
        ? "Mohon lengkapi rincian / dokumen pengantar Banjar Dinas"
        : "Telah diverifikasi dan disetujui oleh Operator Kependudukan Desa";
    const res = await reviewSubmission(id, decision, notes);
    if (res.ok) {
      await reloadOverviewAndSubmissions();
    }
  }

  const pendingCount =
    popStats?.pending_submissions ??
    submissions.filter((s) => s.status === "PENDING").length;

  const roleMeta: Record<ActiveRole, { initials: string }> = {
    kepala_desa: { initials: "MS" },
    operator_desa: { initials: "OD" },
    kepala_dusun: { initials: "KD" },
    superadmin: { initials: "SA" },
  };

  const activeResidentsTotal =
    popStats?.active_residents ?? RINGDIKIT_OVERVIEW.stats.totalResidents;
  const householdsTotal =
    popStats?.total_households ?? RINGDIKIT_OVERVIEW.stats.totalHouseholds;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {/* Top Header — Soft Pastel Modern */}
      <header className="bg-white border-b border-line sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-x-auto py-1">
            <Link
              href={`/${villageSlug}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:text-ink shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Portal Desa
            </Link>

            <div className="flex items-center gap-1">
              {[
                { key: "kepala_desa", label: "Eksekutif Perbekel" },
                { key: "operator_desa", label: "Operator Desa" },
                { key: "kepala_dusun", label: "Kepala Dusun" },
                { key: "superadmin", label: "Superadmin" },
              ]
                .filter((item) => allowedViews.includes(item.key as ActiveRole))
                .map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setRole(item.key as ActiveRole)}
                    className={
                      role === item.key
                        ? "pill-tab-active whitespace-nowrap"
                        : "pill-tab whitespace-nowrap"
                    }
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            <span className="text-xs text-ink-muted">
              Halo,{" "}
              <strong className="text-ink font-semibold">
                {user.full_name}
              </strong>
            </span>
            <span className="w-8 h-8 rounded-lg bg-pastel-violetSoft text-[#6741D9] font-bold text-xs flex items-center justify-center">
              {roleMeta[role].initials}
            </span>
            <span className="relative w-8 h-8 rounded-lg border border-line flex items-center justify-center text-ink-secondary">
              <Bell className="w-4 h-4" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pastel-coral text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-7 flex-1 space-y-6">
        {/* =====================================================================
            VIEW 1: EKSEKUTIF KEPALA DESA / PERBEKEL
           ===================================================================== */}
        {role === "kepala_desa" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <h1 className="text-xl font-bold text-ink">
                  Dashboard Eksekutif
                </h1>
                <span className="text-xs sm:text-sm text-ink-muted">
                  Pemerintah Desa Ringdikit • Mode Pantau Pimpinan
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-white border border-line rounded-xl p-1 flex items-center gap-1 text-xs shadow-soft">
                  <span className="pill-tab-active py-1 px-3 text-xs">
                    Tahunan
                  </span>
                  <span className="pill-tab py-1 px-3 text-xs">Bulanan</span>
                  <span className="pill-tab py-1 px-3 text-xs">Mingguan</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-3 soft-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold tabular-nums text-ink">
                      {activeResidentsTotal.toLocaleString("id-ID")}
                    </span>
                    <span className="w-5 h-5 rounded-full bg-pastel-mintSoft text-pastel-mint inline-flex items-center justify-center text-xs font-bold">
                      ↑
                    </span>
                  </div>
                  <div className="text-xs text-ink-muted mt-1">
                    Penduduk Aktif ({householdsTotal.toLocaleString("id-ID")} KK)
                  </div>
                </div>
                <SmoothVioletSparkline badgeText="Database Aktif" />
              </div>

              <div className="lg:col-span-6 soft-card p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-ink">
                      Sebaran Tingkat Pendidikan
                    </h2>
                    <p className="text-xs text-ink-muted">
                      Indikator perencanaan SDM & pendidikan desa
                    </p>
                  </div>
                  <span className="rounded-lg bg-pastel-violetSoft text-[#6741D9] text-xs font-semibold px-2.5 py-1">
                    Data SIAK Ringdikit
                  </span>
                </div>
                <PastelBarChart
                  items={RINGDIKIT_OVERVIEW.educationStats}
                  badgeText="1.700 Tamat SD"
                />
              </div>

              <div className="lg:col-span-3 soft-card p-6 flex flex-col justify-between">
                <h2 className="text-sm sm:text-base font-bold text-ink mb-2">
                  Komposisi Perkawinan
                </h2>
                <MultiSegmentDonut
                  segments={RINGDIKIT_OVERVIEW.maritalSegments}
                  centerValue={(
                    popStats?.wajib_ktp_count ?? 3980
                  ).toLocaleString("id-ID")}
                  centerLabel="Wajib KTP"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 soft-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-bold text-ink">
                    Proporsi & Keaktifan 5 Banjar Dinas
                  </h2>
                  <span className="text-xs font-semibold text-[#099268] bg-pastel-mintSoft px-2.5 py-1 rounded-lg">
                    5 Banjar Aktif
                  </span>
                </div>
                <div className="space-y-4">
                  {(popStats?.dusuns && popStats.dusuns.length > 0
                    ? popStats.dusuns.map((d, idx) => {
                        const palette = [
                          { accent: "#7C5CFC", track: "#EFEAFE" },
                          { accent: "#12B886", track: "#E6FCF5" },
                          { accent: "#F59F00", track: "#FFF3BF" },
                          { accent: "#15AABF", track: "#E3FAFC" },
                          { accent: "#FA5252", track: "#FFE3E3" },
                        ][idx % 5];
                        const pct =
                          activeResidentsTotal > 0
                            ? Number(
                                (
                                  (d.residents * 100) /
                                  activeResidentsTotal
                                ).toFixed(1)
                              )
                            : 0;
                        return {
                          id: d.id,
                          name: `Banjar Dinas ${d.name}`,
                          households: d.households,
                          residents: d.residents,
                          percentage: pct,
                          accentHex: palette.accent,
                          trackHex: palette.track,
                        };
                      })
                    : RINGDIKIT_OVERVIEW.banjars
                  ).map((b) => (
                    <div key={b.id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between text-xs sm:text-sm">
                        <div>
                          <span className="font-semibold text-ink">
                            {b.name}
                          </span>{" "}
                          <span className="text-xs text-ink-muted">
                            ({b.residents.toLocaleString("id-ID")} jiwa •{" "}
                            {b.households.toLocaleString("id-ID")} KK)
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
                          className="h-full rounded-full"
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

              <div className="lg:col-span-7 soft-card p-6 flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl sm:text-3xl font-bold tabular-nums text-ink">
                        68 Surat
                      </span>
                      <span className="w-5 h-5 rounded-full bg-pastel-mintSoft text-pastel-mint inline-flex items-center justify-center text-xs font-bold">
                        ↑
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      Layanan surat bulan berjalan • Rata-rata SLA 18 menit •{" "}
                      {pendingCount} usulan dusun menunggu validasi
                    </div>
                  </div>
                  <span className="rounded-lg bg-pastel-honeySoft text-[#B45309] text-xs font-semibold px-2.5 py-1">
                    3.479 Belum No. Akta
                  </span>
                </div>
                <SmoothHoneyAreaChart
                  badgeText="SLA 96,4%"
                  labels={["Jun", "Jul", "Agu", "Sep", "Okt", "Nov"]}
                />
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            VIEW 2: OPERATOR DESA (STATISTIK ATAS + TABEL CRUD + MUTASI + SURAT)
           ===================================================================== */}
        {role === "operator_desa" && (
          <div className="space-y-5">
            {/* 1. RINGKASAN STATISTIK KEPENDUDUKAN REAL-TIME DI BAGIAN ATAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="soft-card p-5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-ink-muted">
                    Penduduk Aktif Terdaftar
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-ink mt-1">
                    {(popStats?.active_residents ?? 0).toLocaleString("id-ID")}
                  </div>
                  <div className="text-xs text-ink-secondary mt-1.5 tabular-nums">
                    L:{" "}
                    <strong className="text-ink">
                      {(popStats?.male_count ?? 0).toLocaleString("id-ID")}
                    </strong>{" "}
                    • P:{" "}
                    <strong className="text-ink">
                      {(popStats?.female_count ?? 0).toLocaleString("id-ID")}
                    </strong>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="soft-card p-5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-ink-muted">
                    Total Kartu Keluarga (KK)
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-ink mt-1">
                    {(popStats?.total_households ?? 0).toLocaleString("id-ID")}
                  </div>
                  <div className="text-xs text-[#099268] font-medium mt-1.5 tabular-nums">
                    Wajib KTP:{" "}
                    {(popStats?.wajib_ktp_count ?? 0).toLocaleString("id-ID")} •{" "}
                    {popStats?.dusuns?.length || 5} Banjar
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-pastel-mintSoft text-[#099268] flex items-center justify-center shrink-0">
                  <Home className="w-5 h-5" />
                </div>
              </div>

              <div className="soft-card p-5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-ink-muted">
                    Mutasi & Non-Aktif
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-ink mt-1">
                    {(
                      (popStats?.deceased_count ?? 0) +
                      (popStats?.moved_out_count ?? 0)
                    ).toLocaleString("id-ID")}
                  </div>
                  <div className="text-xs text-ink-secondary mt-1.5 tabular-nums">
                    Wafat:{" "}
                    <strong className="text-[#C92A2A]">
                      {popStats?.deceased_count ?? 0}
                    </strong>{" "}
                    • Pindah:{" "}
                    <strong className="text-[#B45309]">
                      {popStats?.moved_out_count ?? 0}
                    </strong>{" "}
                    • Bln ini:{" "}
                    <strong className="text-ink">
                      {popStats?.events_this_month ?? 0}
                    </strong>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-pastel-aquaSoft text-[#0B7285] flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
              </div>

              <div className="soft-card p-5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-ink-muted">
                    Antrean Validasi Dusun
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-ink mt-1">
                    {pendingCount}
                  </div>
                  <div className="text-xs text-ink-secondary mt-1.5">
                    {pendingCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setOperatorTab("validasi")}
                        className="text-[#B45309] font-semibold hover:underline"
                      >
                        Perlu ditinjau Operator ➔
                      </button>
                    ) : (
                      <span className="text-[#099268] font-medium">
                        Semua usulan dusun tervalidasi
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-pastel-honeySoft text-[#B45309] flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 2. HEADER & NAVIGASI TAB MEJA KERJA OPERATOR DESA */}
            <div className="soft-card p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="rounded-lg bg-pastel-mintSoft px-2.5 py-0.5 text-xs font-semibold text-[#099268]">
                    Role: Kependudukan & Mutasi
                  </span>
                  <span className="rounded-lg bg-pastel-violetSoft px-2.5 py-0.5 text-xs font-semibold text-[#6741D9]">
                    Role: Persuratan Desa
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-ink">
                  Meja Kerja Operator Desa Ringdikit
                </h1>
              </div>

              <div className="flex flex-wrap gap-1.5 bg-[#F8FAFC] border border-line p-1.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setOperatorTab("penduduk")}
                  className={
                    operatorTab === "penduduk"
                      ? "pill-tab-active inline-flex items-center gap-1.5"
                      : "pill-tab inline-flex items-center gap-1.5"
                  }
                >
                  <Users className="w-4 h-4" />
                  Data Penduduk & Mutasi
                </button>
                <button
                  type="button"
                  onClick={() => setOperatorTab("validasi")}
                  className={
                    operatorTab === "validasi"
                      ? "pill-tab-active inline-flex items-center gap-1.5"
                      : "pill-tab inline-flex items-center gap-1.5"
                  }
                >
                  <UserCheck className="w-4 h-4" />
                  Validasi Dusun ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPersuratanSubTab("studio");
                    setOperatorTab("persuratan");
                  }}
                  className={
                    operatorTab === "persuratan" &&
                    persuratanSubTab === "studio"
                      ? "pill-tab-active inline-flex items-center gap-1.5"
                      : "pill-tab inline-flex items-center gap-1.5"
                  }
                >
                  <FilePlus2 className="w-4 h-4" />
                  Studio Buat Surat (PDF & DOCX)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPersuratanSubTab("register");
                    setOperatorTab("persuratan");
                  }}
                  className={
                    operatorTab === "persuratan" &&
                    persuratanSubTab !== "studio"
                      ? "pill-tab-active inline-flex items-center gap-1.5"
                      : "pill-tab inline-flex items-center gap-1.5"
                  }
                >
                  <FileCheck2 className="w-4 h-4" />
                  Buku Register & Arsip TTD/TTE
                </button>
                <button
                  type="button"
                  onClick={() => setOperatorTab("kiosk")}
                  className={
                    operatorTab === "kiosk"
                      ? "pill-tab-active inline-flex items-center gap-1.5"
                      : "pill-tab inline-flex items-center gap-1.5"
                  }
                >
                  <Nfc className="w-4 h-4" />
                  Anjungan Kiosk & RFID
                </button>
              </div>
            </div>

            {/* TAB 1: TABEL CRUD PENDUDUK + TAMBAH HISTORIS MUTASI */}
            {operatorTab === "penduduk" && (
              <OperatorPopulationManager
                stats={popStats}
                dusuns={dusuns}
                onDataChanged={reloadOverviewAndSubmissions}
              />
            )}

            {/* TAB 2: ANTREAN VALIDASI LAPORAN DARI KEPALA DUSUN */}
            {operatorTab === "validasi" && (
              <div className="space-y-4">
                {submissions.length === 0 ? (
                  <div className="soft-card p-10 text-center space-y-2">
                    <div className="w-11 h-11 rounded-2xl bg-pastel-mintSoft text-[#099268] flex items-center justify-center mx-auto">
                      <Check className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-ink">
                      Belum Ada Usulan Mutasi dari Kepala Dusun
                    </h3>
                    <p className="text-xs text-ink-muted max-w-md mx-auto">
                      Ketika Kelian Banjar Dinas mengirimkan laporan kelahiran,
                      kematian, atau perpindahan warga, usulan tersebut akan
                      tampil di sini untuk Anda validasi.
                    </p>
                  </div>
                ) : (
                  submissions.map((sub) => {
                    const resName = String(
                      sub.payload_after?.full_name ||
                        sub.payload_before?.full_name ||
                        "Warga Desa Ringdikit"
                    );
                    const resNik = String(
                      sub.payload_after?.nik || sub.payload_before?.nik || "-"
                    );
                    const summaryAfter = String(
                      sub.payload_after?.summary ||
                        JSON.stringify(sub.payload_after)
                    );
                    return (
                      <div key={sub.id} className="soft-card p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-pastel-violetSoft text-[#6741D9]">
                              {SUBMISSION_TYPE_LABELS[sub.submission_type] ||
                                sub.submission_type}
                            </span>
                            <span className="text-sm font-semibold text-ink">
                              Banjar Dinas {sub.dusun_name} •{" "}
                              {sub.submitted_by_name}
                            </span>
                          </div>
                          <span className="text-xs text-ink-muted">
                            {sub.created_at}
                          </span>
                        </div>

                        <div>
                          <div className="font-bold text-base text-ink">
                            {resName}
                          </div>
                          <div className="font-mono text-xs text-ink-muted mt-0.5">
                            NIK: {resNik}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                          <div className="rounded-xl bg-[#F9FAFD] border border-line p-3.5">
                            <div className="text-[11px] font-semibold text-ink-muted mb-1">
                              Data Sebelumnya
                            </div>
                            <div className="text-ink-secondary">
                              {sub.payload_before?.full_name
                                ? `${String(
                                    sub.payload_before.full_name
                                  )} • Status: ${String(
                                    sub.payload_before.status || "AKTIF"
                                  )}`
                                : "Pencatatan warga / kelahiran / pindah masuk baru"}
                            </div>
                          </div>
                          <div className="rounded-xl bg-pastel-mintSoft/55 border border-pastel-mint/25 p-3.5">
                            <div className="text-[11px] font-semibold text-[#099268] mb-1">
                              Usulan Pembaruan / Peristiwa Baru
                            </div>
                            <div className="font-medium text-ink">
                              {summaryAfter}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <span
                            className={`text-xs font-semibold px-3 py-1 rounded-lg ${
                              sub.status === "APPROVED"
                                ? "bg-pastel-mintSoft text-[#099268]"
                                : sub.status === "REVISION_REQUESTED" ||
                                  sub.status === "REJECTED"
                                ? "bg-pastel-coralSoft text-[#C92A2A]"
                                : "bg-pastel-honeySoft text-[#B45309]"
                            }`}
                          >
                            Status: {sub.status}
                          </span>

                          {sub.status === "PENDING" && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateSubmissionStatus(
                                    sub.id,
                                    "REVISION_REQUESTED"
                                  )
                                }
                                className="soft-btn-secondary text-xs py-2"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Minta
                                Revisi
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSubmissionStatus(sub.id, "APPROVED")
                                }
                                className="soft-btn-primary text-xs py-2"
                              >
                                <Check className="w-3.5 h-3.5" /> Setujui &
                                Catat Historis
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: STUDIO PERSURATAN DESA (5 FORMAT RESMI, PDF & DOCX, BUKU REGISTER, ARSIP TTD/TTE & HISTORIS WARGA) */}
            {operatorTab === "persuratan" && (
              <LetterStudioManager
                key={persuratanSubTab}
                initialSubTab={persuratanSubTab}
                onDataChanged={reloadOverviewAndSubmissions}
              />
            )}

            {/* TAB 4: ANJUNGAN KIOSK MANDIRI, PEMETAAN RFID KTP-EL <-> NIK, & BUKU TAMU DIGITAL */}
            {operatorTab === "kiosk" && (
              <KioskWorkspaceManager
                onDataChanged={reloadOverviewAndSubmissions}
              />
            )}
          </div>
        )}

        {/* =====================================================================
            VIEW 3: OPERATOR KEPALA DUSUN (STATISTIK DUSUN + TABEL WARGA/KK + AUTOCOMPLETE MUTASI)
           ===================================================================== */}
        {role === "kepala_dusun" && (
          <KepalaDusunWorkspace
            user={user}
            dusuns={dusuns}
            submissions={submissions}
            onSubmissionCreated={reloadOverviewAndSubmissions}
          />
        )}

        {/* =====================================================================
            VIEW 4: SUPERADMIN PLATFORM
           ===================================================================== */}
        {role === "superadmin" && <SuperadminView />}
      </main>
    </div>
  );
}

export default function InternalWorkspacePage() {
  const router = useRouter();
  const params = useParams<{ villageSlug?: string }>();
  const villageSlug = (params?.villageSlug || "ringdikit").toLowerCase();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetchMe().then((u) => {
      if (!u) {
        router.replace(`/${villageSlug}/login`);
        return;
      }
      setUser(u);
      setChecked(true);
    });
  }, [router, villageSlug]);

  if (!checked || !user) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-sm text-ink-muted">
        Memeriksa sesi login...
      </div>
    );
  }

  const allowedViews = viewsForRoles(user.roles) as ActiveRole[];
  if (allowedViews.length === 0) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="soft-card p-6 max-w-sm text-center space-y-3">
          <div className="font-bold text-ink">Akun belum memiliki hak akses</div>
          <p className="text-xs text-ink-muted">
            Hubungi Admin Desa untuk menetapkan role pada akun Anda.
          </p>
          <button
            type="button"
            className="soft-btn-secondary text-xs"
            onClick={async () => {
              await logout();
              router.replace(`/${villageSlug}/login`);
            }}
          >
            Keluar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Workspace
        user={user}
        allowedViews={allowedViews}
        villageSlug={villageSlug}
      />
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.replace(`/${villageSlug}/login`);
        }}
        className="fixed bottom-4 right-4 z-40 soft-btn-secondary text-xs shadow-pill"
      >
        Keluar
      </button>
    </>
  );
}
