"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Baby,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  HeartHandshake,
  History,
  Home,
  LogIn,
  LogOut,
  PlusCircle,
  Search,
  Send,
  UserCog,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import {
  ApiDusunItem,
  ApiHouseholdItem,
  ApiPopulationStats,
  ApiResidentDetail,
  ApiResidentItem,
  ApiSubmissionItem,
  createSubmission,
  fetchHouseholds,
  fetchPopulationStats,
  fetchResidentDetail,
  fetchResidents,
  SessionUser,
} from "@/lib/api";
import ResidentAutocomplete from "@/components/ResidentAutocomplete";

interface KepalaDusunWorkspaceProps {
  user: SessionUser;
  dusuns: ApiDusunItem[];
  submissions: ApiSubmissionItem[];
  onSubmissionCreated: () => Promise<void> | void;
}

type KadusMenuTab = "penduduk" | "lapor" | "riwayat";
type DirectorySubMode = "warga" | "kk";

const SUBMISSION_CATEGORIES = [
  {
    code: "DEATH",
    label: "Kematian Warga",
    desc: "Lapor warga wafat",
    needsExisting: true,
    icon: UserMinus,
    tone: "bg-pastel-coralSoft text-[#C92A2A]",
  },
  {
    code: "MOVE_OUT",
    label: "Pindah Keluar",
    desc: "Warga pindah desa",
    needsExisting: true,
    icon: LogOut,
    tone: "bg-pastel-honeySoft text-[#B45309]",
  },
  {
    code: "BIRTH",
    label: "Kelahiran Bayi",
    desc: "Tambah anggota KK baru",
    needsExisting: false,
    icon: Baby,
    tone: "bg-pastel-mintSoft text-[#099268]",
  },
  {
    code: "MOVE_IN",
    label: "Pindah Masuk",
    desc: "Warga baru datang",
    needsExisting: false,
    icon: LogIn,
    tone: "bg-pastel-aquaSoft text-[#0B7285]",
  },
  {
    code: "MARRIAGE",
    label: "Perkawinan",
    desc: "Ubah status kawin / KK",
    needsExisting: true,
    icon: HeartHandshake,
    tone: "bg-pastel-violetSoft text-[#6741D9]",
  },
  {
    code: "DIVORCE",
    label: "Perceraian",
    desc: "Cerai hidup / cerai mati",
    needsExisting: true,
    icon: Activity,
    tone: "bg-[#F1F5F9] text-ink-secondary",
  },
  {
    code: "UPDATE_BIODATA",
    label: "Perubahan Biodata",
    desc: "Pendidikan, kerja, SHDK",
    needsExisting: true,
    icon: UserCog,
    tone: "bg-pastel-violetSoft text-[#6741D9]",
  },
] as const;

const SUBMISSION_LABELS: Record<string, string> = {
  DEATH: "KEMATIAN WARGA",
  MOVE_OUT: "PINDAH KELUAR",
  BIRTH: "KELAHIRAN BAYI",
  MOVE_IN: "WARGA PINDAH MASUK",
  MARRIAGE: "PERKAWINAN",
  DIVORCE: "PERCERAIAN",
  NEW_RESIDENT: "PENDUDUK BARU",
  UPDATE_BIODATA: "PERUBAHAN BIODATA / KK",
};

const SHDK_OPTIONS = [
  "KEPALA KELUARGA",
  "ISTRI",
  "SUAMI",
  "ANAK",
  "ORANG TUA",
  "MERTUA",
  "MENANTU",
  "CUCU",
  "FAMILI LAIN",
];

const EDUCATION_OPTIONS = [
  "TIDAK/BELUM SEKOLAH",
  "BELUM TAMAT SD/SEDERAJAT",
  "TAMAT SD/SEDERAJAT",
  "SLTP/SEDERAJAT",
  "SLTA/SEDERAJAT",
  "DIPLOMA I/II",
  "AKADEMI/DIPLOMA III/S. MUDA",
  "DIPLOMA IV/STRATA I",
  "STRATA II",
  "STRATA III",
];

function statusBadgeClass(status: string) {
  switch (status) {
    case "AKTIF":
      return "bg-pastel-mintSoft text-[#099268]";
    case "MENINGGAL":
      return "bg-pastel-coralSoft text-[#C92A2A]";
    case "PINDAH_KELUAR":
      return "bg-pastel-honeySoft text-[#B45309]";
    default:
      return "bg-[#F1F5F9] text-ink-secondary";
  }
}

export default function KepalaDusunWorkspace({
  user,
  dusuns,
  submissions,
  onSubmissionCreated,
}: KepalaDusunWorkspaceProps) {
  // Jika admin/operator sedang meninjau tampilan Kepala Dusun tanpa dusun_id terikat, izinkan pilih dusun pratinjau
  const [previewDusunId, setPreviewDusunId] = useState<string>(
    user.dusun_id || dusuns[0]?.id || ""
  );
  const effectiveDusunId = user.dusun_id || previewDusunId || dusuns[0]?.id || "";
  const activeDusunObj = dusuns.find((d) => d.id === effectiveDusunId);
  const dusunName = activeDusunObj?.name || "Kelodan";

  useEffect(() => {
    if (!previewDusunId && dusuns.length > 0) {
      setPreviewDusunId(user.dusun_id || dusuns[0].id);
    }
  }, [dusuns, previewDusunId, user.dusun_id]);

  const [menuTab, setMenuTab] = useState<KadusMenuTab>("penduduk");
  const [dirMode, setDirMode] = useState<DirectorySubMode>("warga");

  // Statistik spesifik wilayah Dusun
  const [dusunStats, setDusunStats] = useState<ApiPopulationStats | null>(null);

  // State Tabel Warga Dusun
  const [residents, setResidents] = useState<ApiResidentItem[]>([]);
  const [resTotal, setResTotal] = useState<number>(0);
  const [resLoading, setResLoading] = useState<boolean>(true);
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [shdkFilter, setShdkFilter] = useState<string>("");
  const [limit, setLimit] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  // State Tabel Kartu Keluarga (KK) Dusun
  const [households, setHouseholds] = useState<ApiHouseholdItem[]>([]);
  const [hhTotal, setHhTotal] = useState<number>(0);
  const [hhLoading, setHhLoading] = useState<boolean>(false);

  // Modal Detail & Historis Warga
  const [detailTarget, setDetailTarget] = useState<ApiResidentDetail | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // State Form Buat Laporan Peristiwa / Mutasi
  const [subType, setSubType] = useState<string>("DEATH");
  const [selectedResident, setSelectedResident] =
    useState<ApiResidentItem | null>(null);
  const [newFullName, setNewFullName] = useState<string>("");
  const [newGender, setNewGender] = useState<"L" | "P">("L");
  const [newBirthPlace, setNewBirthPlace] = useState<string>("RINGDIKIT");
  const [newBirthDate, setNewBirthDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [newNik, setNewNik] = useState<string>("");
  const [newNoKk, setNewNoKk] = useState<string>("");
  const [newAddress, setNewAddress] = useState<string>(
    `BANJAR DINAS ${dusunName.toUpperCase()}, DESA RINGDIKIT`
  );
  const [newShdk, setNewShdk] = useState<string>("ANAK");
  const [updEducation, setUpdEducation] = useState<string>("");
  const [updOccupation, setUpdOccupation] = useState<string>("");
  const [updMarital, setUpdMarital] = useState<string>("");
  const [updShdk, setUpdShdk] = useState<string>("");
  const [eventDate, setEventDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [fieldNote, setFieldNote] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  // Filter tab riwayat usulan
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("");

  // Debounce input pencarian tabel
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 220);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadDusunStats = useCallback(async () => {
    if (!effectiveDusunId) return;
    const res = await fetchPopulationStats(effectiveDusunId);
    if (res.ok) {
      setDusunStats(res.data);
    }
  }, [effectiveDusunId]);

  const loadDirectory = useCallback(async () => {
    if (!effectiveDusunId) return;
    const offset = (page - 1) * limit;
    if (dirMode === "warga") {
      setResLoading(true);
      const res = await fetchResidents(
        debouncedSearch,
        limit,
        offset,
        effectiveDusunId,
        statusFilter,
        shdkFilter
      );
      if (res.ok) {
        setResidents(res.data.residents || []);
        setResTotal(res.data.total ?? 0);
      }
      setResLoading(false);
    } else {
      setHhLoading(true);
      const res = await fetchHouseholds(
        debouncedSearch,
        limit,
        offset,
        effectiveDusunId
      );
      if (res.ok) {
        setHouseholds(res.data.households || []);
        setHhTotal(res.data.total ?? 0);
      }
      setHhLoading(false);
    }
  }, [
    effectiveDusunId,
    dirMode,
    debouncedSearch,
    limit,
    page,
    statusFilter,
    shdkFilter,
  ]);

  useEffect(() => {
    loadDusunStats();
  }, [loadDusunStats]);

  useEffect(() => {
    if (menuTab === "penduduk") {
      loadDirectory();
    }
  }, [menuTab, loadDirectory]);

  async function openResidentDetail(row: ApiResidentItem) {
    setDetailLoading(true);
    setDetailTarget({ ...row, events: [] });
    const det = await fetchResidentDetail(row.id);
    if (det.ok) {
      setDetailTarget(det.data);
    }
    setDetailLoading(false);
  }

  function startQuickMutationFromRow(
    row: ApiResidentItem,
    defaultCategory = "DEATH"
  ) {
    setSelectedResident(row);
    setSubType(defaultCategory);
    setUpdEducation(row.education || "");
    setUpdOccupation(row.occupation || "");
    setUpdMarital(row.marital_status || "");
    setUpdShdk(row.shdk || "");
    setFeedback(null);
    setDetailTarget(null);
    setMenuTab("lapor");
  }

  function startNewBirthOrMoveIn(category: "BIRTH" | "MOVE_IN") {
    setSelectedResident(null);
    setSubType(category);
    setNewShdk(category === "BIRTH" ? "ANAK" : "FAMILI LAIN");
    setNewAddress(`BANJAR DINAS ${dusunName.toUpperCase()}, DESA RINGDIKIT`);
    setFeedback(null);
    setMenuTab("lapor");
  }

  const currentCatMeta =
    SUBMISSION_CATEGORIES.find((c) => c.code === subType) ||
    SUBMISSION_CATEGORIES[0];

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (currentCatMeta.needsExisting && !selectedResident) {
      setFeedback({
        kind: "err",
        text: "Ketik nama atau NIK lalu pilih warga dari daftar sugesti terlebih dahulu.",
      });
      return;
    }
    if (!currentCatMeta.needsExisting && !newFullName.trim()) {
      setFeedback({
        kind: "err",
        text: "Nama lengkap bayi / warga pendatang wajib diisi.",
      });
      return;
    }
    if (!fieldNote.trim()) {
      setFeedback({
        kind: "err",
        text: "Catatan rincian lapangan / keterangan dokumen pengantar wajib diisi.",
      });
      return;
    }

    const payloadAfter: Record<string, unknown> = currentCatMeta.needsExisting
      ? {
          nik: selectedResident!.nik,
          no_kk: selectedResident!.no_kk,
          full_name: selectedResident!.full_name,
          event_date: eventDate,
          marital_status:
            subType === "MARRIAGE"
              ? "KAWIN"
              : subType === "DIVORCE"
              ? updMarital || "CERAI HIDUP"
              : subType === "UPDATE_BIODATA" && updMarital
              ? updMarital
              : undefined,
          education:
            subType === "UPDATE_BIODATA" && updEducation
              ? updEducation
              : undefined,
          occupation:
            subType === "UPDATE_BIODATA" && updOccupation
              ? updOccupation.toUpperCase()
              : undefined,
          shdk:
            subType === "UPDATE_BIODATA" && updShdk ? updShdk : undefined,
          summary: fieldNote.trim(),
        }
      : {
          nik: newNik.trim(),
          no_kk: newNoKk.trim(),
          full_name: newFullName.trim().toUpperCase(),
          gender: newGender,
          birth_place: newBirthPlace.trim().toUpperCase() || "RINGDIKIT",
          birth_date: subType === "BIRTH" ? eventDate : newBirthDate,
          shdk: newShdk,
          address: newAddress.trim(),
          event_date: eventDate,
          summary: fieldNote.trim(),
        };

    setSubmitting(true);
    try {
      const res = await createSubmission({
        dusun_id: effectiveDusunId,
        resident_id: currentCatMeta.needsExisting
          ? selectedResident!.id
          : undefined,
        submission_type: subType,
        payload_after: payloadAfter,
      });

      if (!res.ok) {
        setFeedback({
          kind: "err",
          text: res.data.error || "Gagal mengirim usulan ke Operator Desa.",
        });
        return;
      }

      setSelectedResident(null);
      setNewFullName("");
      setNewNik("");
      setNewNoKk("");
      setFieldNote("");
      setFeedback({
        kind: "ok",
        text: `Laporan ${currentCatMeta.label} berhasil dikirim ke antrean validasi Operator Kependudukan Desa.`,
      });
      await loadDusunStats();
      await onSubmissionCreated();
    } finally {
      setSubmitting(false);
    }
  }

  const activeCount = dusunStats?.active_residents ?? 0;
  const maleCount = dusunStats?.male_count ?? 0;
  const femaleCount = dusunStats?.female_count ?? 0;
  const malePct =
    activeCount > 0 ? Math.round((maleCount * 100) / activeCount) : 50;
  const kkCount = dusunStats?.total_households ?? 0;
  const avgPerKk = kkCount > 0 ? (activeCount / kkCount).toFixed(1) : "0";

  const dusunSubmissions = submissions.filter(
    (s) => !effectiveDusunId || s.dusun_id === effectiveDusunId
  );
  const filteredSubmissions = dusunSubmissions.filter((s) =>
    historyStatusFilter ? s.status === historyStatusFilter : true
  );
  const pendingCount =
    dusunStats?.pending_submissions ??
    dusunSubmissions.filter((s) => s.status === "PENDING").length;

  const currentTotal = dirMode === "warga" ? resTotal : hhTotal;
  const totalPages = Math.max(1, Math.ceil(currentTotal / limit));
  const startItem = currentTotal === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(currentTotal, page * limit);

  return (
    <div className="space-y-5">
      {/* =======================================================================
          1. STATISTIK LENGKAP WILAYAH BANJAR DINAS DI BAGIAN ATAS
         ======================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kartu 1: Total Warga Aktif + Komposisi Gender */}
        <div className="soft-card p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-ink-muted">
                Warga Aktif Br. Dinas {dusunName}
              </div>
              <div className="text-2xl sm:text-3xl font-bold tabular-nums text-ink mt-1">
                {activeCount.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-pastel-violetSoft overflow-hidden flex">
              <div
                className="h-full bg-[#15AABF]"
                style={{ width: `${malePct}%` }}
              />
              <div
                className="h-full bg-[#7C5CFC]"
                style={{ width: `${100 - malePct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-ink-secondary tabular-nums">
              <span>
                L: <strong className="text-ink">{maleCount.toLocaleString("id-ID")}</strong>
              </span>
              <span>
                P: <strong className="text-ink">{femaleCount.toLocaleString("id-ID")}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Kartu 2: Kartu Keluarga & Kelompok Usia Kunci */}
        <div className="soft-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-ink-muted">
                Kartu Keluarga (KK) Dusun
              </div>
              <div className="text-2xl sm:text-3xl font-bold tabular-nums text-ink mt-1">
                {kkCount.toLocaleString("id-ID")}
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                Rata-rata {avgPerKk} jiwa / KK
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pastel-mintSoft text-[#099268] flex items-center justify-center shrink-0">
              <Home className="w-5 h-5" />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px] tabular-nums">
            <span className="px-2 py-0.5 rounded-md bg-[#F4F6FB] text-ink-secondary font-medium">
              Wajib KTP:{" "}
              <strong className="text-ink">
                {(dusunStats?.wajib_ktp_count ?? 0).toLocaleString("id-ID")}
              </strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-pastel-mintSoft/70 text-[#099268] font-medium">
              Balita: <strong>{dusunStats?.balita_count ?? 0}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-pastel-honeySoft/70 text-[#B45309] font-medium">
              Lansia: <strong>{dusunStats?.lansia_count ?? 0}</strong>
            </span>
          </div>
        </div>

        {/* Kartu 3: Mutasi Wilayah Dusun */}
        <div className="soft-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-ink-muted">
                Mutasi Warga Dusun
              </div>
              <div className="text-2xl sm:text-3xl font-bold tabular-nums text-ink mt-1">
                {(
                  (dusunStats?.deceased_count ?? 0) +
                  (dusunStats?.moved_out_count ?? 0)
                ).toLocaleString("id-ID")}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pastel-aquaSoft text-[#0B7285] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="text-xs text-ink-secondary tabular-nums">
            Wafat:{" "}
            <strong className="text-[#C92A2A]">
              {dusunStats?.deceased_count ?? 0}
            </strong>{" "}
            • Pindah:{" "}
            <strong className="text-[#B45309]">
              {dusunStats?.moved_out_count ?? 0}
            </strong>{" "}
            • Bln ini:{" "}
            <strong className="text-ink">
              {dusunStats?.events_this_month ?? 0}
            </strong>
          </div>
        </div>

        {/* Kartu 4: Status Usulan ke Desa */}
        <button
          type="button"
          onClick={() => setMenuTab("riwayat")}
          className="soft-card p-5 text-left flex flex-col justify-between gap-3 hover:border-pastel-violet/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 w-full">
            <div>
              <div className="text-xs font-semibold text-ink-muted">
                Pantau Usulan ke Desa
              </div>
              <div className="text-2xl sm:text-3xl font-bold tabular-nums text-ink mt-1">
                {pendingCount}{" "}
                <span className="text-xs font-medium text-ink-muted">
                  menunggu
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pastel-honeySoft text-[#B45309] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="text-xs text-ink-secondary tabular-nums">
            Disetujui:{" "}
            <strong className="text-[#099268]">
              {dusunStats?.approved_submissions ?? 0}
            </strong>{" "}
            • Perlu Revisi:{" "}
            <strong className="text-[#C92A2A]">
              {dusunStats?.revision_submissions ?? 0}
            </strong>
          </div>
        </button>
      </div>

      {/* =======================================================================
          2. HEADER WILAYAH & MENU NAVIGASI 3 TAB OPERATOR KEPALA DUSUN
         ======================================================================= */}
      <div className="soft-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-pastel-aquaSoft px-2.5 py-0.5 text-xs font-semibold text-[#0B7285]">
              Wilayah Tugas Terkunci: Banjar Dinas {dusunName}
            </span>
            {!user.dusun_id && dusuns.length > 1 && (
              <select
                value={effectiveDusunId}
                onChange={(e) => {
                  setPreviewDusunId(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-line bg-[#F8FAFC] px-2.5 py-0.5 text-xs font-semibold text-ink"
              >
                {dusuns.map((d) => (
                  <option key={d.id} value={d.id}>
                    Pratinjau: Banjar Dinas {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-ink">
            Meja Kerja Kelian Banjar Dinas {dusunName}
          </h1>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-[#F8FAFC] border border-line p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMenuTab("penduduk")}
            className={
              menuTab === "penduduk"
                ? "pill-tab-active inline-flex items-center gap-1.5"
                : "pill-tab inline-flex items-center gap-1.5"
            }
          >
            <Users className="w-4 h-4" />
            Data Warga & KK ({activeCount.toLocaleString("id-ID")})
          </button>

          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setMenuTab("lapor");
            }}
            className={
              menuTab === "lapor"
                ? "pill-tab-active inline-flex items-center gap-1.5"
                : "pill-tab inline-flex items-center gap-1.5"
            }
          >
            <PlusCircle className="w-4 h-4" />
            Buat Laporan Mutasi
          </button>

          <button
            type="button"
            onClick={() => setMenuTab("riwayat")}
            className={
              menuTab === "riwayat"
                ? "pill-tab-active inline-flex items-center gap-1.5"
                : "pill-tab inline-flex items-center gap-1.5"
            }
          >
            <ClipboardList className="w-4 h-4" />
            Status Usulan ({dusunSubmissions.length})
          </button>
        </div>
      </div>

      {/* =======================================================================
          MENU 1: DIREKTORI WARGA & KARTU KELUARGA (KK) BANJAR DINAS
         ======================================================================= */}
      {menuTab === "penduduk" && (
        <div className="soft-card overflow-hidden">
          <div className="p-5 border-b border-line flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              {/* Toggle Per Warga vs Per KK */}
              <div className="inline-flex rounded-xl bg-[#F4F6FB] p-1 border border-line">
                <button
                  type="button"
                  onClick={() => {
                    setDirMode("warga");
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    dirMode === "warga"
                      ? "bg-white text-ink shadow-sm"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Per Warga
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDirMode("kk");
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    dirMode === "kk"
                      ? "bg-white text-ink shadow-sm"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Per Kartu Keluarga (KK)
                </button>
              </div>

              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={
                    dirMode === "warga"
                      ? `Cari nama warga, NIK, atau KK di Br. ${dusunName}...`
                      : `Cari Nomor KK atau nama Kepala Keluarga...`
                  }
                  className="soft-input pl-9"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {dirMode === "warga" && (
                <>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="soft-input sm:w-40"
                  >
                    <option value="">Semua Status</option>
                    <option value="AKTIF">AKTIF</option>
                    <option value="MENINGGAL">MENINGGAL</option>
                    <option value="PINDAH_KELUAR">PINDAH KELUAR</option>
                  </select>

                  <select
                    value={shdkFilter}
                    onChange={(e) => {
                      setShdkFilter(e.target.value);
                      setPage(1);
                    }}
                    className="soft-input sm:w-44"
                  >
                    <option value="">Semua Hubungan KK</option>
                    {SHDK_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => startNewBirthOrMoveIn("BIRTH")}
                className="soft-btn-secondary text-xs py-2.5 px-3.5 text-[#099268] border-pastel-mint/35 bg-pastel-mintSoft/45 hover:bg-pastel-mintSoft"
              >
                <Baby className="w-4 h-4" /> Lapor Kelahiran
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedResident(null);
                  setMenuTab("lapor");
                }}
                className="soft-btn-primary text-xs py-2.5 px-4"
              >
                <PlusCircle className="w-4 h-4" /> Buat Laporan Mutasi
              </button>
            </div>
          </div>

          {/* Sub-Tampilan 1A: Tabel Per Warga */}
          {dirMode === "warga" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFD] border-b border-line text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    <th className="py-3.5 px-4">NIK & Nomor KK</th>
                    <th className="py-3.5 px-4">Nama Lengkap & Tgl Lahir</th>
                    <th className="py-3.5 px-4">Hubungan KK & Kawin</th>
                    <th className="py-3.5 px-4">Pendidikan & Pekerjaan</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Aksi Cepat Dusun</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs sm:text-sm">
                  {resLoading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-sm text-ink-muted"
                      >
                        Memuat daftar warga Banjar Dinas {dusunName}...
                      </td>
                    </tr>
                  ) : residents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-sm text-ink-muted"
                      >
                        Tidak ada warga Banjar Dinas {dusunName} yang cocok
                        dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    residents.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-[#F9FBFF] transition-colors"
                      >
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-mono font-semibold text-xs text-ink tabular-nums">
                            {r.nik}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchInput(r.no_kk);
                              setPage(1);
                            }}
                            title="Klik untuk memfilter satu Kartu Keluarga ini"
                            className="font-mono text-[11px] text-[#6741D9] hover:underline tabular-nums mt-0.5"
                          >
                            KK: {r.no_kk || "-"}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-ink">
                              {r.full_name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                r.gender === "L"
                                  ? "bg-pastel-aquaSoft text-[#0B7285]"
                                  : "bg-pastel-violetSoft text-[#6741D9]"
                              }`}
                            >
                              {r.gender}
                            </span>
                          </div>
                          <div className="text-xs text-ink-muted mt-0.5">
                            {r.birth_place}, {r.birth_date} • {r.religion}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="text-xs font-semibold text-ink">
                            {r.shdk}
                          </div>
                          <div className="text-[11px] text-ink-muted mt-0.5">
                            {r.marital_status}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="text-xs text-ink line-clamp-1 max-w-[190px]">
                            {r.occupation || "-"}
                          </div>
                          <div className="text-[11px] text-ink-muted line-clamp-1 max-w-[190px] mt-0.5">
                            {r.education || "-"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${statusBadgeClass(
                              r.status
                            )}`}
                          >
                            {r.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openResidentDetail(r)}
                              className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:text-[#6741D9]"
                            >
                              <History className="w-3.5 h-3.5" /> Detail
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                startQuickMutationFromRow(r, "DEATH")
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-pastel-violet/30 bg-pastel-violetSoft/45 px-2.5 py-1.5 text-xs font-semibold text-[#6741D9] hover:bg-pastel-violetSoft"
                            >
                              <Send className="w-3.5 h-3.5" /> Lapor Mutasi
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Sub-Tampilan 1B: Tabel Per Kartu Keluarga (KK) */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFD] border-b border-line text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    <th className="py-3.5 px-4">Nomor Kartu Keluarga (KK)</th>
                    <th className="py-3.5 px-4">Kepala Keluarga</th>
                    <th className="py-3.5 px-4">Alamat Domisili</th>
                    <th className="py-3.5 px-4">Anggota Aktif</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs sm:text-sm">
                  {hhLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-sm text-ink-muted"
                      >
                        Memuat daftar Kartu Keluarga...
                      </td>
                    </tr>
                  ) : households.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-sm text-ink-muted"
                      >
                        Tidak ditemukan Kartu Keluarga yang cocok.
                      </td>
                    </tr>
                  ) : (
                    households.map((h) => (
                      <tr key={h.id} className="hover:bg-[#F9FBFF]">
                        <td className="py-3.5 px-4 font-mono font-semibold text-xs text-ink tabular-nums">
                          {h.no_kk}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-ink">
                          {h.head_name || (
                            <span className="text-ink-muted font-normal italic">
                              Belum tercatat Kepala Keluarga
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-ink-secondary">
                          {h.address || "-"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-pastel-mintSoft text-[#099268] tabular-nums">
                            {h.member_count} anggota
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setDirMode("warga");
                              setShdkFilter("");
                              setStatusFilter("");
                              setSearchInput(h.no_kk);
                              setPage(1);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-[#6741D9] hover:bg-pastel-violetSoft/40"
                          >
                            Lihat Anggota KK ➔
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginasi Bawah */}
          <div className="px-5 py-3.5 bg-[#FAFBFD] border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs text-ink-secondary">
            <div className="flex items-center gap-3">
              <span className="tabular-nums">
                Menampilkan{" "}
                <strong className="text-ink">
                  {startItem.toLocaleString("id-ID")}–
                  {endItem.toLocaleString("id-ID")}
                </strong>{" "}
                dari{" "}
                <strong className="text-ink">
                  {currentTotal.toLocaleString("id-ID")}
                </strong>{" "}
                {dirMode === "warga" ? "warga" : "Kartu Keluarga"}
              </span>

              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink"
              >
                <option value={25}>25 / hal</option>
                <option value={50}>50 / hal</option>
                <option value={100}>100 / hal</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold disabled:opacity-40 hover:bg-[#F4F6FB]"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
              </button>
              <span className="px-2.5 font-semibold tabular-nums text-ink">
                Hal. {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold disabled:opacity-40 hover:bg-[#F4F6FB]"
              >
                Berikutnya <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MENU 2: BUAT LAPORAN PERISTIWA / MUTASI (DENGAN INSTANT AUTOCOMPLETE)
         ======================================================================= */}
      {menuTab === "lapor" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSubmitReport}
            className="lg:col-span-8 soft-card p-6 space-y-5"
          >
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                Formulir Pelaporan Peristiwa Warga Br. Dinas {dusunName}
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Pilih jenis peristiwa di bawah, lalu ketik nama warga untuk
                memunculkan sugesti otomatis dari database Banjar Dinas{" "}
                {dusunName}.
              </p>
            </div>

            {feedback && (
              <div
                className={`rounded-xl p-3.5 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 border ${
                  feedback.kind === "ok"
                    ? "bg-pastel-mintSoft/80 border-pastel-mint/30 text-[#099268]"
                    : "bg-pastel-coralSoft/80 border-pastel-coral/30 text-[#C92A2A]"
                }`}
              >
                <span>{feedback.text}</span>
                {feedback.kind === "ok" && (
                  <button
                    type="button"
                    onClick={() => setMenuTab("riwayat")}
                    className="shrink-0 underline font-semibold"
                  >
                    Lihat Status Usulan ➔
                  </button>
                )}
              </div>
            )}

            {/* Pilihan Kartu Kategori Visual */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink-secondary">
                1. Pilih Kategori Peristiwa Kependudukan
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {SUBMISSION_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const active = subType === cat.code;
                  return (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => {
                        setSubType(cat.code);
                        if (!cat.needsExisting) {
                          setSelectedResident(null);
                        }
                      }}
                      className={`text-left rounded-xl p-3 border transition-all ${
                        active
                          ? "border-[#6741D9] bg-pastel-violetSoft/40 ring-2 ring-[#6741D9]/15"
                          : "border-line bg-white hover:bg-[#F8FAFD]"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${cat.tone}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="font-bold text-xs text-ink">
                        {cat.label}
                      </div>
                      <div className="text-[11px] text-ink-muted mt-0.5">
                        {cat.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bagian Pemilihan Warga / Input Warga Baru dengan Autocomplete */}
            {currentCatMeta.needsExisting ? (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-ink-secondary">
                  2. Cari & Pilih Warga Banjar Dinas {dusunName} *
                </label>
                <ResidentAutocomplete
                  selected={selectedResident}
                  onSelect={(res) => {
                    setSelectedResident(res);
                    if (res) {
                      setUpdEducation(res.education || "");
                      setUpdOccupation(res.occupation || "");
                      setUpdMarital(res.marital_status || "");
                      setUpdShdk(res.shdk || "");
                    }
                  }}
                  dusunId={effectiveDusunId}
                  statusFilter="AKTIF"
                  placeholder={`Ketik nama warga (mis. Made, Ketut, Putu) atau NIK di Br. ${dusunName}...`}
                  helperText="Klik kolom di atas atau mulai ketik 1 huruf nama warga untuk menampilkan daftar sugesti instan."
                />
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl bg-[#F8FAFD] border border-line p-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6741D9] mb-1.5">
                    2A. Bantu Isi Otomatis Nomor KK & Alamat (Cari Orang Tua /
                    Kepala Keluarga di Br. {dusunName})
                  </label>
                  <ResidentAutocomplete
                    onSelect={(parent) => {
                      if (parent) {
                        setNewNoKk(parent.no_kk || "");
                        if (parent.address) setNewAddress(parent.address);
                      }
                    }}
                    dusunId={effectiveDusunId}
                    statusFilter="AKTIF"
                    fillOnlyMode
                    placeholder="Ketik nama Kepala Keluarga / Ayah / Ibu untuk menyalin No. KK otomatis..."
                    helperText="Opsional: Memilih anggota keluarga di atas otomatis mengisi Nomor KK 16 digit & alamat di bawah."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Nama Lengkap {subType === "BIRTH" ? "Bayi" : "Warga Baru"}{" "}
                      *
                    </label>
                    <input
                      type="text"
                      required
                      value={newFullName}
                      onChange={(e) =>
                        setNewFullName(e.target.value.toUpperCase())
                      }
                      placeholder="Contoh: KOMANG AYU PRADNYA DEWI"
                      className="soft-input bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Jenis Kelamin *
                    </label>
                    <select
                      value={newGender}
                      onChange={(e) =>
                        setNewGender(e.target.value as "L" | "P")
                      }
                      className="soft-input bg-white"
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Hubungan Dalam Keluarga (SHDK)
                    </label>
                    <select
                      value={newShdk}
                      onChange={(e) => setNewShdk(e.target.value)}
                      className="soft-input bg-white"
                    >
                      {SHDK_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Nomor KK Induk (16 Digit)
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={newNoKk}
                      onChange={(e) =>
                        setNewNoKk(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="Otomatis dari pencarian KK atau ketik manual"
                      className="soft-input bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      NIK {subType === "BIRTH" ? "(Kosongkan bila belum ada)" : "(Opsional 16 Digit)"}
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={newNik}
                      onChange={(e) =>
                        setNewNik(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="16 digit angka"
                      className="soft-input bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Tempat Lahir
                    </label>
                    <input
                      type="text"
                      value={newBirthPlace}
                      onChange={(e) =>
                        setNewBirthPlace(e.target.value.toUpperCase())
                      }
                      className="soft-input bg-white"
                    />
                  </div>

                  {subType !== "BIRTH" && (
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1">
                        Tanggal Lahir Warga
                      </label>
                      <input
                        type="date"
                        value={newBirthDate}
                        onChange={(e) => setNewBirthDate(e.target.value)}
                        className="soft-input bg-white"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Alamat Domisili di Banjar Dinas {dusunName}
                    </label>
                    <input
                      type="text"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      className="soft-input bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Field Kontekstual untuk Perubahan Biodata / Perceraian */}
            {subType === "DIVORCE" && (
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Status Perkawinan Baru
                </label>
                <select
                  value={updMarital || "CERAI HIDUP"}
                  onChange={(e) => setUpdMarital(e.target.value)}
                  className="soft-input"
                >
                  <option value="CERAI HIDUP">CERAI HIDUP</option>
                  <option value="CERAI MATI">CERAI MATI</option>
                </select>
              </div>
            )}

            {subType === "UPDATE_BIODATA" && selectedResident && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 rounded-2xl bg-[#F8FAFD] border border-line p-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Pendidikan Terbaru
                  </label>
                  <select
                    value={updEducation}
                    onChange={(e) => setUpdEducation(e.target.value)}
                    className="soft-input bg-white"
                  >
                    {EDUCATION_OPTIONS.map((ed) => (
                      <option key={ed} value={ed}>
                        {ed}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Pekerjaan Terbaru
                  </label>
                  <input
                    type="text"
                    value={updOccupation}
                    onChange={(e) =>
                      setUpdOccupation(e.target.value.toUpperCase())
                    }
                    className="soft-input bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    SHDK Terbaru
                  </label>
                  <select
                    value={updShdk}
                    onChange={(e) => setUpdShdk(e.target.value)}
                    className="soft-input bg-white"
                  >
                    {SHDK_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  3. Tanggal Peristiwa *
                </label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="soft-input"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  4. Catatan Rincian Lapangan & Pengantar Banjar *
                </label>
                <textarea
                  rows={3}
                  required
                  value={fieldNote}
                  onChange={(e) => setFieldNote(e.target.value)}
                  placeholder={
                    subType === "DEATH"
                      ? "Contoh: Wafat di rumah / RSUD Buleleng pukul 06.30 WITA, pelapor anak kandung, pengantar Kelian Banjar terlampir."
                      : subType === "MOVE_OUT"
                      ? "Contoh: Pindah domisili sekeluarga ke Kec. Buleleng mengikuti pekerjaan."
                      : subType === "BIRTH"
                      ? "Contoh: Lahir sehat ditolong bidan Puskesmas Seririt I, anak ke-2."
                      : "Tulis rincian kejadian atau dokumen pendukung dari warga..."
                  }
                  className="soft-input"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-line flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMenuTab("penduduk")}
                className="soft-btn-secondary text-xs"
              >
                Lihat Tabel Warga
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="soft-btn-primary text-xs px-5 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                {submitting
                  ? "Mengirim Laporan..."
                  : "Kirim ke Validasi Operator Desa"}
              </button>
            </div>
          </form>

          {/* Kolom Kanan: Panduan Alur Berjenjang & Usulan Terakhir */}
          <div className="lg:col-span-4 space-y-4">
            <div className="soft-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <CheckCircle2 className="w-4 h-4 text-[#099268]" />
                Alur Validasi Satu Data Desa
              </div>
              <ol className="space-y-2.5 text-xs text-ink-secondary list-decimal pl-4">
                <li>
                  <strong>Kelian Banjar Dinas</strong> memilih warga melalui
                  sugesti nama/NIK dan mengirim laporan lapangan.
                </li>
                <li>
                  <strong>Operator Kependudukan Desa</strong> memeriksa
                  perbandingan data lama vs usulan baru di meja validasi.
                </li>
                <li>
                  Begitu disetujui, status warga &{" "}
                  <strong>Timeline Historis</strong> di database Desa Ringdikit
                  otomatis diperbarui tanpa input ulang.
                </li>
              </ol>
            </div>

            <div className="soft-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Usulan Terbaru Br. {dusunName}
                </h3>
                <button
                  type="button"
                  onClick={() => setMenuTab("riwayat")}
                  className="text-xs font-semibold text-[#6741D9] hover:underline"
                >
                  Semua ({dusunSubmissions.length})
                </button>
              </div>
              {dusunSubmissions.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  Belum ada laporan yang dikirim.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {dusunSubmissions.slice(0, 4).map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl bg-[#F8FAFD] border border-line p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#6741D9]">
                          {SUBMISSION_LABELS[s.submission_type] ||
                            s.submission_type}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            s.status === "APPROVED"
                              ? "bg-pastel-mintSoft text-[#099268]"
                              : s.status === "PENDING"
                              ? "bg-pastel-honeySoft text-[#B45309]"
                              : "bg-pastel-coralSoft text-[#C92A2A]"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <div className="font-bold text-ink">
                        {String(
                          s.payload_after?.full_name ||
                            s.payload_before?.full_name ||
                            "-"
                        )}
                      </div>
                      <div className="text-ink-muted line-clamp-2">
                        {String(s.payload_after?.summary || "-")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MENU 3: PANTAU RIWAYAT & STATUS USULAN DUSUN
         ======================================================================= */}
      {menuTab === "riwayat" && (
        <div className="space-y-4">
          <div className="soft-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: "", label: `Semua (${dusunSubmissions.length})` },
                { key: "PENDING", label: "Menunggu Validasi" },
                { key: "APPROVED", label: "Disetujui Desa" },
                { key: "REVISION_REQUESTED", label: "Perlu Revisi" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setHistoryStatusFilter(f.key)}
                  className={
                    historyStatusFilter === f.key
                      ? "pill-tab-active text-xs py-1.5 px-3"
                      : "pill-tab text-xs py-1.5 px-3 bg-[#F8FAFC]"
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setMenuTab("lapor")}
              className="soft-btn-primary text-xs py-2 px-3.5"
            >
              <PlusCircle className="w-4 h-4" /> Buat Laporan Baru
            </button>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="soft-card p-10 text-center space-y-2">
              <div className="text-sm font-bold text-ink">
                Belum Ada Riwayat Usulan pada Kategori Ini
              </div>
              <p className="text-xs text-ink-muted">
                Gunakan menu <strong>Buat Laporan Mutasi</strong> atau tombol{" "}
                <strong>Lapor Mutasi</strong> pada tabel warga untuk mengirim
                laporan ke Operator Desa.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((s) => (
                <div key={s.id} className="soft-card p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-pastel-violetSoft text-[#6741D9]">
                        {SUBMISSION_LABELS[s.submission_type] ||
                          s.submission_type}
                      </span>
                      <span className="text-xs text-ink-muted">
                        Diajukan: {s.created_at}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-lg ${
                        s.status === "APPROVED"
                          ? "bg-pastel-mintSoft text-[#099268]"
                          : s.status === "PENDING"
                          ? "bg-pastel-honeySoft text-[#B45309]"
                          : "bg-pastel-coralSoft text-[#C92A2A]"
                      }`}
                    >
                      {s.status === "PENDING"
                        ? "Menunggu Validasi Operator Desa"
                        : s.status === "APPROVED"
                        ? "Disetujui & Tercatat di Buku Desa"
                        : "Diminta Revisi oleh Operator Desa"}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-sm sm:text-base text-ink">
                      {String(
                        s.payload_after?.full_name ||
                          s.payload_before?.full_name ||
                          "-"
                      )}
                    </div>
                    <div className="font-mono text-xs text-ink-muted">
                      NIK:{" "}
                      {String(
                        s.payload_after?.nik || s.payload_before?.nik || "-"
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F8FAFD] border border-line p-3.5 text-xs text-ink-secondary">
                    <strong className="text-ink block mb-0.5">
                      Rincian Laporan Lapangan:
                    </strong>
                    {String(s.payload_after?.summary || "-")}
                  </div>

                  {s.review_notes && (
                    <div className="rounded-xl bg-pastel-honeySoft/55 border border-pastel-honey/30 p-3 text-xs text-[#92400E]">
                      <strong>Catatan Operator Desa:</strong> {s.review_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          MODAL DETAIL BIODATA & TIMELINE HISTORIS WARGA DUSUN
         ======================================================================= */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-line shadow-xl w-full max-w-2xl my-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-ink">
                    {detailTarget.full_name}
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${statusBadgeClass(
                      detailTarget.status
                    )}`}
                  >
                    {detailTarget.status}
                  </span>
                </div>
                <p className="font-mono text-xs text-ink-muted mt-0.5">
                  NIK: {detailTarget.nik} • KK: {detailTarget.no_kk || "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:bg-[#F4F6FB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl bg-[#F8FAFD] border border-line p-4 text-xs">
                <div>
                  <div className="text-ink-muted">Tempat, Tgl Lahir</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {detailTarget.birth_place}, {detailTarget.birth_date}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Kelamin / Gol. Darah</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {detailTarget.gender === "L" ? "Laki-laki" : "Perempuan"} /{" "}
                    {detailTarget.blood_type || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Agama</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {detailTarget.religion}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">SHDK / Status Kawin</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {detailTarget.shdk} • {detailTarget.marital_status}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Pendidikan</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {detailTarget.education || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Pekerjaan</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {detailTarget.occupation || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Ayah Kandung</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {detailTarget.father_name || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Ibu Kandung</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {detailTarget.mother_name || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Banjar Dinas</div>
                  <div className="font-semibold text-ink mt-0.5">
                    Banjar Dinas {detailTarget.dusun_name || dusunName}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#6741D9]" />
                  <h4 className="text-sm font-bold text-ink">
                    Timeline Historis Warga
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => startQuickMutationFromRow(detailTarget)}
                  className="soft-btn-primary text-xs py-1.5 px-3"
                >
                  <Send className="w-3.5 h-3.5" /> Lapor Peristiwa Warga Ini
                </button>
              </div>

              {detailLoading ? (
                <div className="text-xs text-ink-muted py-4">
                  Memuat riwayat peristiwa...
                </div>
              ) : !detailTarget.events || detailTarget.events.length === 0 ? (
                <div className="rounded-xl border border-line p-4 text-xs text-ink-muted">
                  Belum ada catatan peristiwa untuk warga ini.
                </div>
              ) : (
                <ol className="space-y-3 border-l-2 border-pastel-violetTrack pl-4 ml-2">
                  {detailTarget.events.map((ev) => (
                    <li key={ev.id} className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#6741D9]">
                          {ev.event_date}
                        </span>
                        <span className="text-[11px] font-semibold bg-pastel-violetSoft text-[#6741D9] px-2 py-0.5 rounded-md">
                          {ev.event_type}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-ink">
                        {ev.summary}
                      </div>
                      <div className="text-[11px] text-ink-muted">
                        Dicatat oleh: {ev.actor_name}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
