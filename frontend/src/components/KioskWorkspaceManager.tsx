"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Link2,
  Maximize2,
  Minimize2,
  Nfc,
  Phone,
  Plus,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Unlink,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  ApiGuestbookEntry,
  ApiGuestbookStats,
  ApiLetterRecord,
  ApiResidentItem,
  bindResidentRFID,
  createGuestbookEntry,
  createLetter,
  fetchGuestbookEntries,
  fetchRFIDMappings,
  getLetterDocxUrl,
  getLetterPdfUrl,
  kioskLookupResident,
} from "@/lib/api";
import ResidentAutocomplete from "@/components/ResidentAutocomplete";

type KioskAdminTab = "kiosk_screen" | "rfid_settings" | "guestbook_log";
type KioskServiceMode = "home" | "letter" | "guestbook";
type GuestbookIdMethod = "RFID" | "NIK" | "MANUAL";

interface KioskTemplateOption {
  code: string;
  title: string;
  subtitle: string;
  classCode: string;
  accent: string;
  bgSoft: string;
}

const KIOSK_LETTER_OPTIONS: KioskTemplateOption[] = [
  {
    code: "SK_UMUM",
    title: "1. Surat Keterangan Umum",
    subtitle:
      "Keterangan domisili, pengantar bank, sekolah, usaha, & administrasi umum",
    classCode: "470",
    accent: "text-[#6741D9]",
    bgSoft: "bg-pastel-violetSoft",
  },
  {
    code: "SK_KELAHIRAN",
    title: "2. Surat Keterangan Kelahiran",
    subtitle:
      "Keterangan kelahiran anak kandung beserta data Ibu & Ayah kandung",
    classCode: "472.11",
    accent: "text-[#087F5B]",
    bgSoft: "bg-pastel-mintSoft",
  },
  {
    code: "SK_KEMATIAN",
    title: "3. Surat Keterangan Kematian",
    subtitle:
      "Keterangan kematian warga lengkap dengan data Pelapor & Almarhum/ah",
    classCode: "472.12",
    accent: "text-[#D97706]",
    bgSoft: "bg-pastel-honeySoft",
  },
  {
    code: "SK_BEDA_NAMA",
    title: "4. Surat Keterangan Beda Nama",
    subtitle:
      "Menerangkan perbedaan penulisan nama pada beberapa dokumen resmi",
    classCode: "470",
    accent: "text-[#1971C2]",
    bgSoft: "bg-pastel-skySoft",
  },
  {
    code: "SK_WARIS",
    title: "5. Surat Keterangan Waris",
    subtitle:
      "Keterangan daftar ahli waris sah beserta data Pewaris yang telah wafat",
    classCode: "474",
    accent: "text-[#C92A2A]",
    bgSoft: "bg-pastel-roseSoft",
  },
];

const TARGET_OFFICIAL_OPTIONS = [
  "Perbekel Ringdikit (I Made Sumadi)",
  "Sekretaris Desa Ringdikit",
  "Loket Pelayanan & Persuratan Desa",
  "Kasi Pemerintahan & Kependudukan",
  "Kelian Banjar Dinas",
  "BPD / Lembaga Kemasyarakatan Desa",
];

const PURPOSE_CATEGORY_OPTIONS = [
  "Pelayanan Surat & Administrasi",
  "Konsultasi / Audiensi Pimpinan",
  "Pelaporan Mutasi Kependudukan",
  "Kunjungan Dinas / Instansi / Kampus",
  "Pengaduan & Aspirasi Masyarakat",
  "Keperluan Lainnya",
];

const QUICK_LETTER_PURPOSES = [
  "Persyaratan Administrasi Bank",
  "Persyaratan Pendaftaran Sekolah / Beasiswa",
  "Kelengkapan Administrasi Usaha / UMKM",
  "Pengurusan Dokumen Kependudukan (KTP / KK / Akta)",
  "Keperluan Administrasi Keluarga / Adat",
];

function formatDateTimeID(iso?: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatBirthDateDDMMYYYY(isoDate?: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoDate;
}

interface KioskWorkspaceManagerProps {
  onDataChanged?: () => void;
}

export default function KioskWorkspaceManager({
  onDataChanged,
}: KioskWorkspaceManagerProps) {
  const [adminTab, setAdminTab] = useState<KioskAdminTab>("kiosk_screen");
  const [fullScreenKiosk, setFullScreenKiosk] = useState(false);

  // Jam digital live di Kiosk
  const [clockStr, setClockStr] = useState<string>("");
  useEffect(() => {
    const updateClock = () => {
      setClockStr(
        new Date().toLocaleString("id-ID", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, []);

  // Daftar pemetaan RFID <-> NIK & Buku Tamu
  const [rfidMappings, setRfidMappings] = useState<ApiResidentItem[]>([]);
  const [totalMappedRfid, setTotalMappedRfid] = useState(0);
  const [rfidSearch, setRfidSearch] = useState("");
  const [loadingRfid, setLoadingRfid] = useState(false);

  const [guestbookItems, setGuestbookItems] = useState<ApiGuestbookEntry[]>([]);
  const [guestbookStats, setGuestbookStats] = useState<ApiGuestbookStats>({
    total: 0,
    today: 0,
    rfid_count: 0,
    nik_count: 0,
    manual_count: 0,
  });
  const [guestbookSearch, setGuestbookSearch] = useState("");
  const [guestbookMethodFilter, setGuestbookMethodFilter] = useState("");
  const [loadingGuestbook, setLoadingGuestbook] = useState(false);

  // State Kiosk Interaktif
  const [serviceMode, setServiceMode] = useState<KioskServiceMode>("home");
  const [identifiedResident, setIdentifiedResident] =
    useState<ApiResidentItem | null>(null);
  const [identifiedMethod, setIdentifiedMethod] = useState<"RFID" | "NIK">(
    "RFID"
  );
  const [rfidInput, setRfidInput] = useState("");
  const [nikInput, setNikInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const rfidInputRef = useRef<HTMLInputElement>(null);

  // State Alur 1: Persuratan Kiosk
  const [kioskLetterCode, setKioskLetterCode] = useState<string>("SK_UMUM");
  const [kioskIdTab, setKioskIdTab] = useState<"RFID" | "NIK">("RFID");
  const [kioskLetterPurpose, setKioskLetterPurpose] = useState<string>(
    "Persyaratan Administrasi Bank"
  );
  const [kioskLetterStatement, setKioskLetterStatement] = useState<string>(
    "Sepengetahuan kami memang benar orang tersebut di atas adalah penduduk Desa Ringdikit Kecamatan Seririt Kabupaten Buleleng."
  );
  // Field tambahan untuk surat khusus di Kiosk
  const [kioskChildName, setKioskChildName] = useState("");
  const [kioskChildOrder, setKioskChildOrder] = useState("1 (Satu)");
  const [kioskChildBirthPlace, setKioskChildBirthPlace] = useState(
    "Puskesmas Seririt I"
  );
  const [kioskFatherName, setKioskFatherName] = useState("");
  const [kioskDeathDate, setKioskDeathDate] = useState(
    "Kamis, 19 November 2026"
  );
  const [kioskDeathCause, setKioskDeathCause] = useState("Sakit");
  const [kioskDiffName, setKioskDiffName] = useState("");
  const [kioskDiffDoc, setKioskDiffDoc] = useState("Ijazah / Akta Kelahiran");
  const [kioskPewarisName, setKioskPewarisName] = useState("");
  const [kioskPewarisDate, setKioskPewarisDate] = useState("10 Januari 2026");

  const [submittingKioskLetter, setSubmittingKioskLetter] = useState(false);
  const [issuedKioskLetter, setIssuedKioskLetter] =
    useState<ApiLetterRecord | null>(null);

  // State Alur 2: Buku Tamu Kiosk
  const [gbMethod, setGbMethod] = useState<GuestbookIdMethod>("RFID");
  const [gbFullName, setGbFullName] = useState("");
  const [gbNIK, setGbNIK] = useState("");
  const [gbRFID, setGbRFID] = useState("");
  const [gbDusun, setGbDusun] = useState("");
  const [gbAddress, setGbAddress] = useState("");
  const [gbPhone, setGbPhone] = useState("");
  const [gbInstitution, setGbInstitution] = useState("");
  const [gbTargetOfficial, setGbTargetOfficial] = useState(
    TARGET_OFFICIAL_OPTIONS[0]
  );
  const [gbPurposeCategory, setGbPurposeCategory] = useState(
    PURPOSE_CATEGORY_OPTIONS[0]
  );
  const [gbPurposeDetail, setGbPurposeDetail] = useState("");
  const [submittingGuestbook, setSubmittingGuestbook] = useState(false);
  const [completedGuestbook, setCompletedGuestbook] =
    useState<ApiGuestbookEntry | null>(null);

  // State Tab 2: Pengaturan Pairing RFID <-> NIK
  const [pairTargetResident, setPairTargetResident] =
    useState<ApiResidentItem | null>(null);
  const [pairRfidUid, setPairRfidUid] = useState("");
  const [pairSaving, setPairSaving] = useState(false);
  const [pairNotice, setPairNotice] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const loadRFIDMappings = useCallback(async () => {
    setLoadingRfid(true);
    const res = await fetchRFIDMappings(rfidSearch);
    if (res.ok && res.data.items) {
      setRfidMappings(res.data.items);
      setTotalMappedRfid(res.data.total_mapped ?? res.data.items.length);
    }
    setLoadingRfid(false);
  }, [rfidSearch]);

  const loadGuestbook = useCallback(async () => {
    setLoadingGuestbook(true);
    const res = await fetchGuestbookEntries({
      q: guestbookSearch,
      method: guestbookMethodFilter,
      limit: 100,
    });
    if (res.ok && res.data.items) {
      setGuestbookItems(res.data.items);
      if (res.data.stats) {
        setGuestbookStats(res.data.stats);
      }
    }
    setLoadingGuestbook(false);
  }, [guestbookSearch, guestbookMethodFilter]);

  useEffect(() => {
    loadRFIDMappings();
  }, [loadRFIDMappings]);

  useEffect(() => {
    loadGuestbook();
  }, [loadGuestbook]);

  const applyResidentToKioskState = (
    res: ApiResidentItem,
    method: "RFID" | "NIK"
  ) => {
    setIdentifiedResident(res);
    setIdentifiedMethod(method);
    setLookupError(null);
    setGbFullName(res.full_name);
    setGbNIK(res.nik);
    setGbRFID(res.rfid_uid || "");
    setGbDusun(res.dusun_name || "");
    setGbAddress(
      res.dusun_name
        ? `Banjar Dinas ${res.dusun_name}, Desa Ringdikit`
        : res.address || "Desa Ringdikit"
    );
    setGbInstitution(
      res.dusun_name
        ? `Warga Banjar Dinas ${res.dusun_name}`
        : "Warga Desa Ringdikit"
    );
  };

  const handleScanRFID = async (uidToScan?: string) => {
    const cleanUid = (uidToScan ?? rfidInput).trim().toUpperCase();
    if (!cleanUid) {
      setLookupError("Tempelkan KTP-el pada alat pembaca RFID terlebih dahulu.");
      return;
    }
    setRfidInput(cleanUid);
    setLookupLoading(true);
    setLookupError(null);
    const res = await kioskLookupResident({ rfid: cleanUid });
    setLookupLoading(false);
    if (!res.ok || !res.data.resident) {
      setLookupError(
        res.data.error ||
          `Kartu RFID (${cleanUid}) belum terdaftar. Silakan gunakan pencarian NIK atau isi manual.`
      );
      return;
    }
    applyResidentToKioskState(res.data.resident, "RFID");
  };

  const handleLookupByNIK = async (nikToSearch?: string) => {
    const cleanNik = (nikToSearch ?? nikInput).replace(/\D/g, "").trim();
    if (cleanNik.length !== 16) {
      setLookupError("Masukkan tepat 16 digit angka NIK KTP Anda.");
      return;
    }
    setNikInput(cleanNik);
    setLookupLoading(true);
    setLookupError(null);
    const res = await kioskLookupResident({ nik: cleanNik });
    setLookupLoading(false);
    if (!res.ok || !res.data.resident) {
      setLookupError(
        res.data.error ||
          `NIK ${cleanNik} tidak ditemukan di database penduduk Desa Ringdikit.`
      );
      return;
    }
    applyResidentToKioskState(res.data.resident, "NIK");
  };

  const resetKioskSession = () => {
    setServiceMode("home");
    setIdentifiedResident(null);
    setRfidInput("");
    setNikInput("");
    setLookupError(null);
    setIssuedKioskLetter(null);
    setCompletedGuestbook(null);
    setGbFullName("");
    setGbNIK("");
    setGbRFID("");
    setGbDusun("");
    setGbAddress("");
    setGbPhone("");
    setGbInstitution("");
    setGbPurposeDetail("");
  };

  const handleKioskIssueLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifiedResident) {
      setLookupError(
        "Silakan scan KTP-el RFID atau cari NIK Anda terlebih dahulu."
      );
      return;
    }
    setSubmittingKioskLetter(true);
    const r = identifiedResident;
    const ttl = `${r.birth_place}, ${formatBirthDateDDMMYYYY(r.birth_date)}`;
    const addr = r.dusun_name
      ? `BD. ${r.dusun_name} Desa Ringdikit`
      : "Desa Ringdikit";

    const dynamicPayload: Record<string, unknown> = {
      applicant_name: r.full_name,
      applicant_nik: r.nik,
      applicant_no_kk: r.no_kk || "",
      applicant_ttl: ttl,
      applicant_gender: r.gender === "P" ? "PEREMPUAN" : "LAKI-LAKI",
      applicant_religion: (r.religion || "HINDU").toUpperCase(),
      applicant_marital: (r.marital_status || "KAWIN").toUpperCase(),
      applicant_occupation: (r.occupation || "WIRASWASTA").toUpperCase(),
      applicant_address: addr,
      statement_text: kioskLetterStatement,
      extra_statement: kioskLetterStatement,
      kiosk_identification_method: identifiedMethod,
      kiosk_rfid_uid: r.rfid_uid || "",

      // SK_KELAHIRAN
      child_name: kioskChildName || `Anak dari ${r.full_name}`,
      child_order: kioskChildOrder,
      child_birth_place: kioskChildBirthPlace,
      child_address: addr,
      birth_helper_name: "Bidan / Tenaga Kesehatan",
      birth_helper_addr: "Kecamatan Seririt",
      mother_nik: r.gender === "P" ? r.nik : "",
      mother_name: r.gender === "P" ? r.full_name : r.mother_name || "",
      mother_ttl: r.gender === "P" ? ttl : "-",
      mother_address: addr,
      father_nik: r.gender === "L" ? r.nik : "",
      father_name:
        r.gender === "L"
          ? r.full_name
          : kioskFatherName || r.father_name || "-",
      father_ttl: r.gender === "L" ? ttl : "-",
      father_address: addr,

      // SK_KEMATIAN
      reporter_name: r.full_name,
      reporter_address: addr,
      reporter_relation: "Keluarga",
      deceased_name: r.full_name,
      deceased_nik: r.nik,
      deceased_no_kk: r.no_kk || "",
      deceased_ttl: ttl,
      deceased_address: addr,
      death_day_date: kioskDeathDate,
      death_place: "Desa Ringdikit",
      death_cause: kioskDeathCause,

      // SK_BEDA_NAMA
      diff_docs: [
        {
          doc_type: "KTP Elektronik",
          doc_number: r.nik,
          written_name: r.full_name,
        },
        {
          doc_type: kioskDiffDoc,
          doc_number: "-",
          written_name: kioskDiffName || r.full_name,
        },
      ],
      reference_doc_name: "KTP Elektronik & Kartu Keluarga (KK)",

      // SK_WARIS
      heirs: [
        {
          full_name: r.full_name,
          ttl,
          nik: r.nik,
          occupation: r.occupation || "WIRASWASTA",
        },
      ],
      pewaris_name: kioskPewarisName || r.father_name || "Almarhum",
      pewaris_death_date: kioskPewarisDate,
      pewaris_death_place: "Desa Ringdikit",
    };

    const res = await createLetter({
      template_code: kioskLetterCode,
      applicant_nik: r.nik,
      source: "WALK_IN",
      purpose:
        kioskLetterPurpose.trim() || "Keperluan Administrasi Kependudukan",
      dynamic_payload: dynamicPayload,
    });
    setSubmittingKioskLetter(false);
    if (!res.ok || !res.data.letter) {
      setLookupError(
        res.data.error || "Gagal menerbitkan surat melalui Anjungan Kiosk."
      );
      return;
    }
    setIssuedKioskLetter(res.data.letter);
    onDataChanged?.();
  };

  const handleKioskGuestbookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gbMethod !== "MANUAL" && !identifiedResident && !gbFullName.trim()) {
      setLookupError(
        "Silakan scan RFID KTP-el, cari NIK Anda, atau pilih tab Isi Manual."
      );
      return;
    }

    setSubmittingGuestbook(true);
    const res = await createGuestbookEntry({
      identification_method: gbMethod,
      rfid_uid:
        gbMethod === "RFID"
          ? identifiedResident?.rfid_uid || gbRFID || rfidInput
          : undefined,
      nik:
        gbMethod !== "MANUAL"
          ? identifiedResident?.nik || gbNIK || nikInput
          : gbNIK || undefined,
      resident_id:
        gbMethod !== "MANUAL" ? identifiedResident?.id : undefined,
      full_name:
        gbMethod !== "MANUAL" && identifiedResident
          ? identifiedResident.full_name
          : gbFullName.trim(),
      dusun_name:
        gbMethod !== "MANUAL" && identifiedResident
          ? identifiedResident.dusun_name
          : gbDusun.trim(),
      address:
        gbMethod !== "MANUAL" && identifiedResident
          ? identifiedResident.dusun_name
            ? `BD. ${identifiedResident.dusun_name} Desa Ringdikit`
            : identifiedResident.address
          : gbAddress.trim(),
      phone: gbPhone.trim(),
      institution: gbInstitution.trim(),
      purpose_category: gbPurposeCategory,
      purpose_detail: gbPurposeDetail.trim() || gbPurposeCategory,
      target_official: gbTargetOfficial,
    });
    setSubmittingGuestbook(false);

    if (!res.ok || !res.data.entry) {
      setLookupError(res.data.error || "Gagal menyimpan data buku tamu.");
      return;
    }
    setCompletedGuestbook(res.data.entry);
    await loadGuestbook();
    onDataChanged?.();
  };

  const handleSaveRFIDPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairNotice(null);
    if (!pairTargetResident) {
      setPairNotice({
        type: "err",
        text: "Pilih penduduk terlebih dahulu sebelum menyimpan ID RFID.",
      });
      return;
    }
    if (!pairRfidUid.trim()) {
      setPairNotice({
        type: "err",
        text: "Masukkan atau scan ID Tag RFID KTP-el.",
      });
      return;
    }
    setPairSaving(true);
    const res = await bindResidentRFID(
      pairTargetResident.id,
      pairRfidUid.trim().toUpperCase()
    );
    setPairSaving(false);
    if (!res.ok) {
      setPairNotice({
        type: "err",
        text: res.data.error || "Gagal menyimpan pemetaan RFID.",
      });
      return;
    }
    setPairNotice({
      type: "ok",
      text:
        res.data.message ||
        `Berhasil memetakan RFID ${pairRfidUid.toUpperCase()} ke ${
          pairTargetResident.full_name
        }`,
    });
    setPairRfidUid("");
    setPairTargetResident(null);
    await loadRFIDMappings();
    onDataChanged?.();
  };

  const handleUnbindRFID = async (resItem: ApiResidentItem) => {
    const res = await bindResidentRFID(resItem.id, "");
    if (res.ok) {
      await loadRFIDMappings();
      onDataChanged?.();
    }
  };

  const generateDemoUID = () => {
    const hex = Math.floor(100000 + Math.random() * 900000)
      .toString(16)
      .toUpperCase();
    setPairRfidUid(`04A2${hex}`);
  };

  // ===========================================================================
  // RENDER KOMPONEN LAYAR KIOSK UTAMA (BISA INLINE ATAU FULLSCREEN)
  // ===========================================================================
  const renderKioskTerminal = () => (
    <div
      className={
        fullScreenKiosk
          ? "fixed inset-0 z-50 bg-[#EEF2FA] overflow-y-auto p-4 sm:p-8 flex flex-col"
          : "rounded-3xl bg-gradient-to-b from-[#162347] via-[#1B2B56] to-[#121D3B] text-white p-5 sm:p-7 shadow-xl border border-white/10 space-y-6"
      }
    >
      <div
        className={
          fullScreenKiosk
            ? "max-w-6xl w-full mx-auto rounded-3xl bg-gradient-to-b from-[#162347] via-[#1B2B56] to-[#121D3B] text-white p-6 sm:p-9 shadow-2xl border border-white/10 space-y-6 flex-1"
            : "space-y-6"
        }
      >
        {/* HEADER ANJUNGAN KIOSK */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/15">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo-buleleng.jpg"
                alt="Logo Kabupaten Buleleng"
                className="w-11 h-11 object-contain"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-0.5 text-[11px] font-semibold text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ANJUNGAN MANDIRI & RFID KTP-EL SIAP MELAYANI
              </div>
              <h2 className="font-display text-lg sm:text-2xl font-extrabold tracking-tight text-white mt-1">
                Kiosk Pelayanan Mandiri & Buku Tamu — Desa Ringdikit
              </h2>
              <p className="text-xs text-slate-300">
                Kecamatan Seririt • Kabupaten Buleleng • {clockStr}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {serviceMode !== "home" && (
              <button
                type="button"
                onClick={resetKioskSession}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-2 text-xs font-bold text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Layar Utama Kiosk
              </button>
            )}
            <button
              type="button"
              onClick={() => setFullScreenKiosk((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFD43B] hover:bg-[#FCC419] text-[#111A30] px-3.5 py-2 text-xs font-extrabold shadow-sm transition-colors"
            >
              {fullScreenKiosk ? (
                <>
                  <Minimize2 className="w-4 h-4" /> Keluar Layar Penuh
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" /> Buka Layar Penuh Kiosk
                </>
              )}
            </button>
          </div>
        </div>

        {/* BAR SIMULASI & SCANNER RFID CEPAT (MEMUDAHKAN DEMO & USB READER) */}
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFD43B]/20 border border-[#FFD43B]/40 text-[#FFD43B] flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Scanner RFID E-KTP (13.56 MHz / Keyboard Wedge)</span>
                  <span className="text-[10px] font-semibold bg-white/15 px-2 py-0.5 rounded text-[#FFD43B]">
                    {totalMappedRfid} Kartu RFID Terdaftar
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Tempelkan E-KTP pada RFID Reader USB atau klik salah satu{" "}
                  <strong>Kartu E-KTP Demo</strong> di bawah untuk mensimulasikan
                  scan KTP warga secara instan.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScanRFID();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={rfidInputRef}
                type="text"
                value={rfidInput}
                onChange={(e) => setRfidInput(e.target.value.toUpperCase())}
                placeholder="UID RFID (cth: 04A28F01)..."
                className="rounded-xl bg-[#0F1830] border border-white/20 px-3.5 py-2 text-xs font-mono text-white placeholder:text-slate-400 focus:outline-none focus:border-[#FFD43B] w-48"
              />
              <button
                type="submit"
                disabled={lookupLoading}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#091826] font-extrabold text-xs px-4 py-2 transition-colors"
              >
                {lookupLoading ? "Memindai..." : "Scan RFID"}
              </button>
            </form>
          </div>

          {/* KARTU TAP CEPAT DEMO E-KTP WARGA RINGDIKIT */}
          {rfidMappings.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10">
              <span className="text-[11px] font-semibold text-[#FFD43B] mr-1">
                Simulasi Tap E-KTP Warga:
              </span>
              {rfidMappings.slice(0, 6).map((m) => {
                const isSelected =
                  identifiedResident?.id === m.id &&
                  identifiedMethod === "RFID";
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleScanRFID(m.rfid_uid)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      isSelected
                        ? "bg-[#FFD43B] text-[#111A30] shadow-sm font-bold"
                        : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                    }`}
                  >
                    <CreditCard className="w-3 h-3" />
                    <span className="font-mono">{m.rfid_uid}</span>
                    <span>• {m.full_name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* BANNER IDENTITAS WARGA YANG SUDAH TERDETEKSI KTP-EL */}
        {identifiedResident && (
          <div className="rounded-2xl bg-emerald-500/15 border border-emerald-400/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-400 text-[#0B1F17] font-extrabold text-sm flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                    KTP-el Warga Terverifikasi ({identifiedMethod})
                  </span>
                  {identifiedResident.rfid_uid && (
                    <span className="font-mono text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded text-white">
                      UID: {identifiedResident.rfid_uid}
                    </span>
                  )}
                </div>
                <div className="text-base sm:text-lg font-extrabold text-white">
                  Om Swastiastu, {identifiedResident.full_name}
                </div>
                <div className="text-xs text-slate-200 font-mono">
                  NIK: {identifiedResident.nik} • KK:{" "}
                  {identifiedResident.no_kk || "-"} • Banjar Dinas{" "}
                  {identifiedResident.dusun_name || "Ringdikit"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIdentifiedResident(null);
                setRfidInput("");
                setNikInput("");
              }}
              className="rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white self-start sm:self-center"
            >
              Ganti Warga / Reset KTP
            </button>
          </div>
        )}

        {lookupError && (
          <div className="rounded-2xl bg-rose-500/20 border border-rose-400/40 p-3.5 text-xs font-semibold text-rose-200 flex items-center justify-between">
            <span>{lookupError}</span>
            <button
              type="button"
              onClick={() => setLookupError(null)}
              className="text-rose-200 hover:text-white underline ml-3"
            >
              Tutup
            </button>
          </div>
        )}

        {/* ===================================================================
            MODE 0: BERANDA ANJUNGAN KIOSK (PILIH 2 LAYANAN UTAMA)
           =================================================================== */}
        {serviceMode === "home" && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="font-display text-xl sm:text-2xl font-extrabold text-white">
                Silakan Pilih Layanan Anjungan Desa Ringdikit
              </h3>
              <p className="text-xs sm:text-sm text-slate-300">
                Sentuh salah satu kartu layanan di bawah ini untuk mengurus
                surat keterangan atau mengisi buku tamu desa
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* KARTU 1: LAYANAN PERSURATAN MANDIRI */}
              <button
                type="button"
                onClick={() => {
                  setServiceMode("letter");
                  setIssuedKioskLetter(null);
                  setLookupError(null);
                }}
                className="group text-left rounded-3xl bg-white text-ink p-6 sm:p-7 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-5 border-2 border-transparent hover:border-[#FFD43B]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center">
                      <FileText className="w-7 h-7" />
                    </div>
                    <span className="rounded-full bg-pastel-violetSoft text-[#6741D9] px-3 py-1 text-xs font-extrabold">
                      5 Format Surat Resmi (.PDF & .DOCX)
                    </span>
                  </div>
                  <h4 className="font-display text-xl font-extrabold text-ink group-hover:text-[#6741D9] transition-colors">
                    1. Layanan Pembuatan Surat Desa
                  </h4>
                  <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
                    Pilih jenis surat (Surat Keterangan Umum, Kelahiran,
                    Kematian, Beda Nama, atau Ahli Waris). Cukup{" "}
                    <strong>Tap KTP-el RFID</strong> atau masukkan{" "}
                    <strong>NIK</strong>, biodata terisi otomatis dan siap
                    dicetak!
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-line text-xs font-extrabold text-[#6741D9]">
                  <span>Pilih Jenis Surat & Cetak Dokumen →</span>
                  <span className="rounded-lg bg-pastel-violetSoft px-2.5 py-1">
                    Mulai Layanan Surat
                  </span>
                </div>
              </button>

              {/* KARTU 2: BUKU TAMU DIGITAL (RFID / NIK / MANUAL) */}
              <button
                type="button"
                onClick={() => {
                  setServiceMode("guestbook");
                  setCompletedGuestbook(null);
                  setLookupError(null);
                  if (identifiedResident) {
                    setGbMethod(identifiedMethod);
                  }
                }}
                className="group text-left rounded-3xl bg-white text-ink p-6 sm:p-7 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-5 border-2 border-transparent hover:border-[#FFD43B]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-pastel-mintSoft text-[#087F5B] flex items-center justify-center">
                      <BookOpen className="w-7 h-7" />
                    </div>
                    <span className="rounded-full bg-pastel-mintSoft text-[#087F5B] px-3 py-1 text-xs font-extrabold">
                      Scan RFID • Cari NIK • Isi Manual
                    </span>
                  </div>
                  <h4 className="font-display text-xl font-extrabold text-ink group-hover:text-[#087F5B] transition-colors">
                    2. Isi Buku Tamu Digital Desa
                  </h4>
                  <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
                    Catat kunjungan Anda ke Kantor Perbekel Ringdikit. Warga
                    desa cukup <strong>Tap KTP-el RFID</strong> atau memasukkan{" "}
                    <strong>NIK</strong>; tamu dinas/instansi luar desa dapat
                    memilih <strong>Isi Manual</strong>.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-line text-xs font-extrabold text-[#087F5B]">
                  <span>Buka Formulir Buku Tamu →</span>
                  <span className="rounded-lg bg-pastel-mintSoft px-2.5 py-1">
                    Check-In Buku Tamu
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            MODE 1: ALUR PERSURATAN KIOSK (SURAT -> PILIH JENIS SURAT)
           =================================================================== */}
        {serviceMode === "letter" && (
          <div className="rounded-3xl bg-white text-ink p-6 sm:p-8 shadow-xl space-y-6">
            {issuedKioskLetter ? (
              /* LAYAR SUKSES TERBIT SURAT DI KIOSK */
              <div className="text-center max-w-2xl mx-auto py-4 space-y-5">
                <div className="w-16 h-16 rounded-3xl bg-pastel-mintSoft text-[#087F5B] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#087F5B]">
                    Surat Desa Berhasil Diterbitkan & Tercatat di Historis Warga
                  </span>
                  <h3 className="font-display text-2xl font-extrabold text-ink">
                    {issuedKioskLetter.template_title}
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-secondary">
                    Pemohon: <strong>{issuedKioskLetter.applicant_name}</strong>{" "}
                    (NIK:{" "}
                    <span className="font-mono">
                      {issuedKioskLetter.applicant_nik}
                    </span>
                    )
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl bg-[#F8FAFD] border border-line p-4 text-xs">
                  <div>
                    <div className="text-ink-muted">Nomor Surat Resmi</div>
                    <div className="font-mono font-bold text-ink text-sm mt-0.5">
                      {issuedKioskLetter.letter_number}
                    </div>
                  </div>
                  <div>
                    <div className="text-ink-muted">Kode Tiket Antrean</div>
                    <div className="font-mono font-bold text-[#6741D9] text-sm mt-0.5">
                      {issuedKioskLetter.ticket_code}
                    </div>
                  </div>
                  <div>
                    <div className="text-ink-muted">Token QR Keaslian</div>
                    <div className="font-mono font-semibold text-[#087F5B] text-xs mt-0.5">
                      {issuedKioskLetter.verify_qr_token}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <a
                    href={getLetterPdfUrl(issuedKioskLetter.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#087F5B] hover:bg-[#066649] text-white font-extrabold text-sm px-6 py-3.5 shadow-md transition-colors"
                  >
                    <Download className="w-4 h-4" /> Unduh / Cetak PDF (.pdf)
                  </a>
                  <a
                    href={getLetterDocxUrl(issuedKioskLetter.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#1971C2] hover:bg-[#145A9E] text-white font-extrabold text-sm px-6 py-3.5 shadow-md transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Unduh Word (.docx)
                  </a>
                  <button
                    type="button"
                    onClick={resetKioskSession}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#F4F6FB] hover:bg-line text-ink font-bold text-sm px-5 py-3.5 transition-colors"
                  >
                    Selesai & Kembali ke Beranda
                  </button>
                </div>
              </div>
            ) : (
              /* FORM PILIH JENIS SURAT & IDENTIFIKASI KTP DI KIOSK */
              <form onSubmit={handleKioskIssueLetter} className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#6741D9]">
                      Anjungan Persuratan Mandiri Desa Ringdikit
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-ink">
                      Langkah 1: Pilih Jenis Surat Keterangan
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setServiceMode("home")}
                    className="soft-btn-secondary text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Kembali
                  </button>
                </div>

                {/* PILIH 5 JENIS SURAT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {KIOSK_LETTER_OPTIONS.map((opt) => {
                    const active = kioskLetterCode === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => setKioskLetterCode(opt.code)}
                        className={`text-left rounded-2xl p-4 border-2 transition-all flex flex-col justify-between gap-2 ${
                          active
                            ? "border-[#6741D9] bg-pastel-violetSoft/60 shadow-sm"
                            : "border-line bg-white hover:bg-[#F8FAFD]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${opt.bgSoft} ${opt.accent}`}
                          >
                            Kode {opt.classCode}
                          </span>
                          {active && (
                            <CheckCircle2 className="w-4 h-4 text-[#6741D9]" />
                          )}
                        </div>
                        <div className="font-bold text-xs sm:text-sm text-ink">
                          {opt.title}
                        </div>
                        <div className="text-[11px] text-ink-muted leading-snug">
                          {opt.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* LANGKAH 2: IDENTIFIKASI PEMOHON (RFID ATAU NIK) */}
                <div className="rounded-2xl bg-[#F8FAFD] border border-line p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-ink">
                        Langkah 2: Identifikasi KTP-el Pemohon
                      </h4>
                      <p className="text-xs text-ink-muted">
                        Gunakan Scan RFID E-KTP atau ketik 16 digit NIK untuk
                        menarik biodata resmi Desa Ringdikit
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white border border-line p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setKioskIdTab("RFID")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          kioskIdTab === "RFID"
                            ? "bg-[#6741D9] text-white"
                            : "text-ink-secondary hover:bg-[#F4F6FB]"
                        }`}
                      >
                        1. Scan RFID KTP-el
                      </button>
                      <button
                        type="button"
                        onClick={() => setKioskIdTab("NIK")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          kioskIdTab === "NIK"
                            ? "bg-[#6741D9] text-white"
                            : "text-ink-secondary hover:bg-[#F4F6FB]"
                        }`}
                      >
                        2. Masukkan NIK
                      </button>
                    </div>
                  </div>

                  {kioskIdTab === "RFID" ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={rfidInput}
                          onChange={(e) =>
                            setRfidInput(e.target.value.toUpperCase())
                          }
                          placeholder="Tempelkan KTP-el pada RFID Reader (UID cth: 04A28F01)..."
                          className="soft-input bg-white font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleScanRFID()}
                          className="soft-btn-primary text-xs shrink-0"
                        >
                          <Nfc className="w-4 h-4" /> Baca RFID
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={16}
                          value={nikInput}
                          onChange={(e) =>
                            setNikInput(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="Ketik 16 digit NIK KTP Anda..."
                          className="soft-input bg-white font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleLookupByNIK()}
                          className="soft-btn-primary text-xs shrink-0"
                        >
                          <Search className="w-4 h-4" /> Cari NIK
                        </button>
                      </div>
                      <ResidentAutocomplete
                        placeholder="Atau ketik nama / NIK warga di sini..."
                        onSelect={(r) => {
                          if (r) applyResidentToKioskState(r, "NIK");
                        }}
                      />
                    </div>
                  )}

                  {identifiedResident && (
                    <div className="rounded-xl bg-white border border-pastel-mint/50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-ink-muted block">
                          Nama Lengkap
                        </span>
                        <strong className="text-ink">
                          {identifiedResident.full_name}
                        </strong>
                      </div>
                      <div>
                        <span className="text-ink-muted block">
                          NIK / No. KK
                        </span>
                        <span className="font-mono font-semibold text-ink">
                          {identifiedResident.nik}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">
                          Tempat, Tgl Lahir
                        </span>
                        <span className="text-ink">
                          {identifiedResident.birth_place},{" "}
                          {identifiedResident.birth_date}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">
                          Banjar Dinas & Pekerjaan
                        </span>
                        <span className="text-ink">
                          BD. {identifiedResident.dusun_name || "-"} •{" "}
                          {identifiedResident.occupation || "-"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* LANGKAH 3: RINCIAN & KEPERLUAN SURAT */}
                <div className="space-y-4">
                  <h4 className="text-sm sm:text-base font-extrabold text-ink">
                    Langkah 3: Isi Keperluan & Rincian Surat
                  </h4>

                  {kioskLetterCode === "SK_KELAHIRAN" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-[#F8FAFD] border border-line p-4">
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Nama Lengkap Anak *
                        </label>
                        <input
                          type="text"
                          required
                          value={kioskChildName}
                          onChange={(e) => setKioskChildName(e.target.value)}
                          placeholder="Contoh: Kadek Ayu Lestari"
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Anak Ke-
                        </label>
                        <input
                          type="text"
                          value={kioskChildOrder}
                          onChange={(e) => setKioskChildOrder(e.target.value)}
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Dilahirkan di / Tanggal
                        </label>
                        <input
                          type="text"
                          value={kioskChildBirthPlace}
                          onChange={(e) =>
                            setKioskChildBirthPlace(e.target.value)
                          }
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {kioskLetterCode === "SK_KEMATIAN" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-[#F8FAFD] border border-line p-4">
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Hari / Tanggal Meninggal Dunia
                        </label>
                        <input
                          type="text"
                          value={kioskDeathDate}
                          onChange={(e) => setKioskDeathDate(e.target.value)}
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Sebab Kematian
                        </label>
                        <input
                          type="text"
                          value={kioskDeathCause}
                          onChange={(e) => setKioskDeathCause(e.target.value)}
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {kioskLetterCode === "SK_BEDA_NAMA" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-[#F8FAFD] border border-line p-4">
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Dokumen yang Berbeda Penulisan
                        </label>
                        <input
                          type="text"
                          value={kioskDiffDoc}
                          onChange={(e) => setKioskDiffDoc(e.target.value)}
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Nama Tertulis pada Dokumen Tersebut
                        </label>
                        <input
                          type="text"
                          value={kioskDiffName}
                          onChange={(e) => setKioskDiffName(e.target.value)}
                          placeholder="Nama yang berbeda ejaan..."
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {kioskLetterCode === "SK_WARIS" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-[#F8FAFD] border border-line p-4">
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Nama Pewaris (Almarhum/ah) *
                        </label>
                        <input
                          type="text"
                          required
                          value={kioskPewarisName}
                          onChange={(e) => setKioskPewarisName(e.target.value)}
                          placeholder="Nama orang tua / pewaris..."
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Tanggal Meninggal Pewaris
                        </label>
                        <input
                          type="text"
                          value={kioskPewarisDate}
                          onChange={(e) => setKioskPewarisDate(e.target.value)}
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-ink-secondary">
                      Keperluan Penggunaan Surat * (Pilih Cepat atau Ketik)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_LETTER_PURPOSES.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setKioskLetterPurpose(p)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                            kioskLetterPurpose === p
                              ? "bg-[#6741D9] text-white"
                              : "bg-[#F4F6FB] text-ink-secondary hover:bg-pastel-violetSoft"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      required
                      value={kioskLetterPurpose}
                      onChange={(e) => setKioskLetterPurpose(e.target.value)}
                      className="soft-input text-xs"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-line flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setServiceMode("home")}
                    className="soft-btn-secondary text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingKioskLetter || !identifiedResident}
                    className="soft-btn-primary text-xs sm:text-sm px-6 py-3 disabled:opacity-50"
                  >
                    <Printer className="w-4 h-4" />
                    {submittingKioskLetter
                      ? "Memproses & Mencetak Surat..."
                      : "Terbitkan & Cetak Surat Sekarang (PDF & DOCX)"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ===================================================================
            MODE 2: ALUR BUKU TAMU DIGITAL (SCAN RFID / CARI NIK / ISI MANUAL)
           =================================================================== */}
        {serviceMode === "guestbook" && (
          <div className="rounded-3xl bg-white text-ink p-6 sm:p-8 shadow-xl space-y-6">
            {completedGuestbook ? (
              /* BUKTI KUNJUNGAN BUKU TAMU */
              <div className="text-center max-w-xl mx-auto py-4 space-y-5">
                <div className="w-16 h-16 rounded-3xl bg-pastel-mintSoft text-[#087F5B] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#087F5B]">
                    Check-In Buku Tamu Desa Berhasil Tercatat
                  </span>
                  <h3 className="font-display text-2xl font-extrabold text-ink">
                    Selamat Datang, {completedGuestbook.full_name}
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-secondary">
                    Terima kasih telah berkunjung ke Kantor Perbekel Ringdikit.
                    Kunjungan Anda telah terdokumentasi di Buku Tamu Digital.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F8FAFD] border border-line p-4 text-left grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-ink-muted block">
                      Metode Identifikasi
                    </span>
                    <strong className="text-[#6741D9]">
                      {completedGuestbook.identification_method === "RFID"
                        ? `Scan RFID KTP-el (${completedGuestbook.rfid_uid})`
                        : completedGuestbook.identification_method === "NIK"
                        ? `Pencarian NIK (${completedGuestbook.nik})`
                        : "Input Manual Tamu"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-ink-muted block">
                      Pejabat / Unit Dituju
                    </span>
                    <strong className="text-ink">
                      {completedGuestbook.target_official}
                    </strong>
                  </div>
                  <div>
                    <span className="text-ink-muted block">
                      Asal / Banjar Dinas
                    </span>
                    <span className="text-ink">
                      {completedGuestbook.dusun_name
                        ? `Banjar Dinas ${completedGuestbook.dusun_name}`
                        : completedGuestbook.institution ||
                          completedGuestbook.address ||
                          "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-muted block">
                      Keperluan Kunjungan
                    </span>
                    <span className="text-ink">
                      {completedGuestbook.purpose_detail}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={resetKioskSession}
                    className="soft-btn-primary text-sm px-6 py-3"
                  >
                    Selesai & Kembali ke Beranda Kiosk
                  </button>
                </div>
              </div>
            ) : (
              /* FORM BUKU TAMU DENGAN 3 METODE IDENTITAS (RFID, NIK, MANUAL) */
              <form onSubmit={handleKioskGuestbookSubmit} className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#087F5B]">
                      Buku Tamu Elektronik Kantor Perbekel Ringdikit
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-ink">
                      Pilih Cara Pengisian Identitas Buku Tamu
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setServiceMode("home")}
                    className="soft-btn-secondary text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Kembali
                  </button>
                </div>

                {/* 3 PILIHAN METODE IDENTITAS BUKU TAMU */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setGbMethod("RFID")}
                    className={`text-left rounded-2xl p-4 border-2 transition-all ${
                      gbMethod === "RFID"
                        ? "border-[#6741D9] bg-pastel-violetSoft/60"
                        : "border-line bg-white hover:bg-[#F8FAFD]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-9 h-9 rounded-xl bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center">
                        <Nfc className="w-5 h-5" />
                      </span>
                      <span className="text-[11px] font-bold text-[#6741D9]">
                        Otomatis & Cepat
                      </span>
                    </div>
                    <div className="font-bold text-sm text-ink mt-2">
                      1. Scan RFID KTP-el
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Tempelkan KTP-el pada RFID reader, biodata langsung terisi
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGbMethod("NIK")}
                    className={`text-left rounded-2xl p-4 border-2 transition-all ${
                      gbMethod === "NIK"
                        ? "border-[#087F5B] bg-pastel-mintSoft/60"
                        : "border-line bg-white hover:bg-[#F8FAFD]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-9 h-9 rounded-xl bg-pastel-mintSoft text-[#087F5B] flex items-center justify-center">
                        <Search className="w-5 h-5" />
                      </span>
                      <span className="text-[11px] font-bold text-[#087F5B]">
                        Database Desa
                      </span>
                    </div>
                    <div className="font-bold text-sm text-ink mt-2">
                      2. Cari Nomor NIK Warga
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Masukkan 16 digit NIK atau cari nama warga Desa Ringdikit
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGbMethod("MANUAL");
                      setIdentifiedResident(null);
                    }}
                    className={`text-left rounded-2xl p-4 border-2 transition-all ${
                      gbMethod === "MANUAL"
                        ? "border-[#D97706] bg-pastel-honeySoft/60"
                        : "border-line bg-white hover:bg-[#F8FAFD]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-9 h-9 rounded-xl bg-pastel-honeySoft text-[#D97706] flex items-center justify-center">
                        <Edit3 className="w-5 h-5" />
                      </span>
                      <span className="text-[11px] font-bold text-[#D97706]">
                        Tamu Umum / Instansi
                      </span>
                    </div>
                    <div className="font-bold text-sm text-ink mt-2">
                      3. Isi Manual Buku Tamu
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Untuk tamu luar desa, instansi pemerintah, atau kampus
                    </p>
                  </button>
                </div>

                {/* PANEL IDENTITAS SESUAI METODE YANG DIPILIH */}
                {gbMethod === "RFID" && (
                  <div className="rounded-2xl bg-[#F8FAFD] border border-line p-4 space-y-3">
                    <div className="text-xs font-bold text-ink">
                      Identifikasi Tamu dengan Scan RFID KTP-el
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <input
                        type="text"
                        value={rfidInput}
                        onChange={(e) =>
                          setRfidInput(e.target.value.toUpperCase())
                        }
                        placeholder="Tempelkan KTP-el pada RFID Reader atau pilih kartu demo di atas..."
                        className="soft-input bg-white font-mono text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleScanRFID()}
                        className="soft-btn-primary text-xs shrink-0"
                      >
                        <Nfc className="w-4 h-4" /> Pindai RFID KTP-el
                      </button>
                    </div>
                  </div>
                )}

                {gbMethod === "NIK" && (
                  <div className="rounded-2xl bg-[#F8FAFD] border border-line p-4 space-y-3">
                    <div className="text-xs font-bold text-ink">
                      Pencarian Identitas Warga Berdasarkan NIK
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={16}
                          value={nikInput}
                          onChange={(e) =>
                            setNikInput(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="Masukkan 16 digit NIK KTP..."
                          className="soft-input bg-white font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleLookupByNIK()}
                          className="soft-btn-primary text-xs shrink-0"
                        >
                          <Search className="w-4 h-4" /> Cari NIK
                        </button>
                      </div>
                      <ResidentAutocomplete
                        placeholder="Atau ketik nama / NIK warga Desa Ringdikit..."
                        onSelect={(r) => {
                          if (r) applyResidentToKioskState(r, "NIK");
                        }}
                      />
                    </div>
                  </div>
                )}

                {gbMethod === "MANUAL" ? (
                  /* FORM INPUT MANUAL BUKU TAMU */
                  <div className="rounded-2xl bg-[#F8FAFD] border border-line p-5 space-y-4">
                    <div className="text-xs font-bold text-[#D97706] uppercase tracking-wider">
                      Formulir Pengisian Manual Identitas Tamu
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Nama Lengkap Pengunjung *
                        </label>
                        <input
                          type="text"
                          required
                          value={gbFullName}
                          onChange={(e) => setGbFullName(e.target.value)}
                          placeholder="Ketik nama lengkap Anda..."
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Asal Instansi / Desa / Lembaga *
                        </label>
                        <input
                          type="text"
                          required
                          value={gbInstitution}
                          onChange={(e) => setGbInstitution(e.target.value)}
                          placeholder="Contoh: Kecamatan Seririt / Undiksha / Umum"
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Nomor HP / WhatsApp
                        </label>
                        <input
                          type="text"
                          value={gbPhone}
                          onChange={(e) => setGbPhone(e.target.value)}
                          placeholder="0812xxxxxxxx"
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Alamat Lengkap *
                        </label>
                        <input
                          type="text"
                          required
                          value={gbAddress}
                          onChange={(e) => setGbAddress(e.target.value)}
                          placeholder="Alamat domisili / kantor..."
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* RINGKASAN DATA OTOMATIS DARI RFID / NIK */
                  identifiedResident && (
                    <div className="rounded-2xl bg-pastel-mintSoft/50 border border-pastel-mint/40 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-ink-muted block">
                          Nama Pengunjung
                        </span>
                        <strong className="text-ink text-sm">
                          {identifiedResident.full_name}
                        </strong>
                      </div>
                      <div>
                        <span className="text-ink-muted block">NIK Warga</span>
                        <span className="font-mono font-bold text-ink">
                          {identifiedResident.nik}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">
                          Banjar Dinas
                        </span>
                        <span className="font-semibold text-ink">
                          Banjar Dinas{" "}
                          {identifiedResident.dusun_name || "Ringdikit"}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">
                          No. HP / WhatsApp (Opsional)
                        </span>
                        <input
                          type="text"
                          value={gbPhone}
                          onChange={(e) => setGbPhone(e.target.value)}
                          placeholder="Isi No. WA bila ada..."
                          className="soft-input bg-white text-xs py-1 mt-0.5"
                        />
                      </div>
                    </div>
                  )
                )}

                {/* DETAIL KUNJUNGAN: PEJABAT DITUJU & KEPERLUAN */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Pejabat / Unit Pelayanan yang Ditemui *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {TARGET_OFFICIAL_OPTIONS.map((off) => (
                        <button
                          key={off}
                          type="button"
                          onClick={() => setGbTargetOfficial(off)}
                          className={`text-left rounded-xl px-3.5 py-2.5 text-xs font-semibold border transition-all ${
                            gbTargetOfficial === off
                              ? "border-[#6741D9] bg-pastel-violetSoft text-[#6741D9] font-bold"
                              : "border-line bg-white text-ink-secondary hover:bg-[#F8FAFD]"
                          }`}
                        >
                          {off}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Kategori Keperluan Kunjungan *
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PURPOSE_CATEGORY_OPTIONS.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setGbPurposeCategory(cat);
                            if (!gbPurposeDetail) setGbPurposeDetail(cat);
                          }}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${
                            gbPurposeCategory === cat
                              ? "border-[#087F5B] bg-pastel-mintSoft text-[#087F5B] font-bold"
                              : "border-line bg-white text-ink-secondary hover:bg-[#F8FAFD]"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Uraian / Rincian Keperluan Kunjungan *
                    </label>
                    <input
                      type="text"
                      required
                      value={gbPurposeDetail}
                      onChange={(e) => setGbPurposeDetail(e.target.value)}
                      placeholder="Contoh: Mengurus pengantar SKCK / Konsultasi program pemberdayaan masyarakat..."
                      className="soft-input text-xs"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-line flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setServiceMode("home")}
                    className="soft-btn-secondary text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submittingGuestbook ||
                      (gbMethod !== "MANUAL" && !identifiedResident)
                    }
                    className="soft-btn-primary text-xs sm:text-sm px-6 py-3 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submittingGuestbook
                      ? "Menyimpan Buku Tamu..."
                      : "Simpan & Check-In Buku Tamu Desa"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* =====================================================================
          SUB-MENU NAVIGASI KIOSK, PAIRING RFID, & REKAP BUKU TAMU
         ===================================================================== */}
      <div className="soft-card p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAdminTab("kiosk_screen")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              adminTab === "kiosk_screen"
                ? "bg-[#6741D9] text-white shadow-sm"
                : "text-ink-secondary hover:bg-[#F4F6FB]"
            }`}
          >
            <Nfc className="w-4 h-4" />
            1. Layar Anjungan Kiosk Mandiri (Surat & Buku Tamu)
          </button>

          <button
            type="button"
            onClick={() => setAdminTab("rfid_settings")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              adminTab === "rfid_settings"
                ? "bg-[#6741D9] text-white shadow-sm"
                : "text-ink-secondary hover:bg-[#F4F6FB]"
            }`}
          >
            <Settings className="w-4 h-4" />
            2. Pengaturan Pemetaan ID RFID KTP-el ↔ NIK ({totalMappedRfid})
          </button>

          <button
            type="button"
            onClick={() => setAdminTab("guestbook_log")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              adminTab === "guestbook_log"
                ? "bg-[#6741D9] text-white shadow-sm"
                : "text-ink-secondary hover:bg-[#F4F6FB]"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            3. Buku Register & Rekapitulasi Tamu Desa ({guestbookStats.total})
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setAdminTab("kiosk_screen");
            setFullScreenKiosk(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-pastel-violetSoft text-[#6741D9] hover:bg-[#6741D9] hover:text-white px-3.5 py-2 text-xs font-bold transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Mode Layar Penuh Kiosk
        </button>
      </div>

      {/* =====================================================================
          TAB 1: LAYAR ANJUNGAN KIOSK MANDIRI
         ===================================================================== */}
      {adminTab === "kiosk_screen" && renderKioskTerminal()}

      {/* =====================================================================
          TAB 2: PENGATURAN PEMETAAN ID RFID KTP-EL <-> NIK PENDUDUK
         ===================================================================== */}
      {adminTab === "rfid_settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* FORM PAIRING RFID <-> NIK */}
          <form
            onSubmit={handleSaveRFIDPairing}
            className="lg:col-span-5 soft-card p-5 space-y-4"
          >
            <div className="border-b border-line pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6741D9]">
                Registrasi & Pairing Kartu KTP-el
              </span>
              <h3 className="text-base font-bold text-ink mt-0.5">
                Petakan ID RFID KTP-el ke NIK Penduduk
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Hubungkan UID chip RFID KTP-el warga dengan data NIK pada
                database kependudukan Desa Ringdikit agar saat warga menempelkan
                KTP di Kiosk, identitasnya langsung dikenali.
              </p>
            </div>

            {pairNotice && (
              <div
                className={`rounded-xl p-3 text-xs font-semibold ${
                  pairNotice.type === "ok"
                    ? "bg-pastel-mintSoft text-[#087F5B]"
                    : "bg-pastel-roseSoft text-[#C92A2A]"
                }`}
              >
                {pairNotice.text}
              </div>
            )}

            <div>
              <ResidentAutocomplete
                label="1. Cari & Pilih Warga Desa Ringdikit (Nama / NIK) *"
                selected={pairTargetResident}
                onSelect={(r) => {
                  setPairTargetResident(r);
                  if (r?.rfid_uid) {
                    setPairRfidUid(r.rfid_uid);
                  }
                }}
                placeholder="Ketik 1 huruf nama atau NIK penduduk..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-ink-secondary">
                  2. ID Tag / UID RFID KTP-el *
                </label>
                <button
                  type="button"
                  onClick={generateDemoUID}
                  className="text-[11px] font-bold text-[#6741D9] hover:underline"
                >
                  + Buat UID RFID Demo Otomatis
                </button>
              </div>
              <input
                type="text"
                required
                value={pairRfidUid}
                onChange={(e) => setPairRfidUid(e.target.value.toUpperCase())}
                placeholder="Klik di sini lalu tap KTP-el di RFID Reader (cth: 04A28F09)..."
                className="soft-input font-mono text-xs"
              />
              <p className="text-[11px] text-ink-muted mt-1">
                Tips: Arahkan kursor ke kolom di atas lalu tempelkan fisik
                KTP-el pada USB RFID Reader; nomor UID akan terketik otomatis.
              </p>
            </div>

            <button
              type="submit"
              disabled={pairSaving || !pairTargetResident}
              className="soft-btn-primary text-xs w-full justify-center py-2.5 disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              {pairSaving
                ? "Menyimpan Pemetaan..."
                : "Simpan Pemetaan ID RFID ↔ NIK Warga"}
            </button>
          </form>

          {/* TABEL DAFTAR WARGA YANG SUDAH TERPETAKAN RFID */}
          <div className="lg:col-span-7 soft-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-ink">
                  Daftar Pemetaan Aktif RFID KTP-el ({totalMappedRfid} Warga)
                </h3>
                <p className="text-xs text-ink-muted">
                  Klik tombol <strong>Uji Tap di Kiosk</strong> pada baris mana
                  pun untuk langsung mencoba pemindaian kartu warga tersebut di
                  layar Kiosk.
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rfidSearch}
                  onChange={(e) => setRfidSearch(e.target.value)}
                  placeholder="Cari UID RFID, NIK, nama..."
                  className="soft-input pl-8 text-xs w-52"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-[11px] font-bold uppercase text-ink-muted bg-[#F8FAFD]">
                    <th className="py-2.5 px-3">UID RFID KTP-el</th>
                    <th className="py-2.5 px-3">Nama Warga & NIK</th>
                    <th className="py-2.5 px-3">Banjar Dinas</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {loadingRfid ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-ink-muted"
                      >
                        Memuat data pemetaan RFID...
                      </td>
                    </tr>
                  ) : rfidMappings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-ink-muted"
                      >
                        Belum ada kartu RFID yang dipetakan.
                      </td>
                    </tr>
                  ) : (
                    rfidMappings.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F8FAFD]">
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[#6741D9] bg-pastel-violetSoft px-2.5 py-1 rounded-lg">
                            <CreditCard className="w-3.5 h-3.5" />
                            {item.rfid_uid}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-ink">
                            {item.full_name}
                          </div>
                          <div className="font-mono text-[11px] text-ink-muted">
                            NIK: {item.nik}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          Banjar Dinas {item.dusun_name || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAdminTab("kiosk_screen");
                                handleScanRFID(item.rfid_uid);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-pastel-mintSoft text-[#087F5B] hover:bg-[#087F5B] hover:text-white px-2.5 py-1 text-[11px] font-bold transition-colors"
                            >
                              <Nfc className="w-3 h-3" /> Uji Tap di Kiosk
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUnbindRFID(item)}
                              className="inline-flex items-center gap-1 rounded-lg bg-pastel-roseSoft text-[#C92A2A] hover:bg-[#C92A2A] hover:text-white px-2 py-1 text-[11px] font-bold transition-colors"
                              title="Lepas Pemetaan RFID"
                            >
                              <Unlink className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: BUKU REGISTER & REKAPITULASI TAMU DESA
         ===================================================================== */}
      {adminTab === "guestbook_log" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="soft-card p-4">
              <div className="text-xs text-ink-muted">Total Kunjungan</div>
              <div className="font-display text-2xl font-bold text-ink mt-1">
                {guestbookStats.total}
              </div>
            </div>
            <div className="soft-card p-4">
              <div className="text-xs text-ink-muted">Tamu Hari Ini</div>
              <div className="font-display text-2xl font-bold text-[#087F5B] mt-1">
                {guestbookStats.today}
              </div>
            </div>
            <div className="soft-card p-4">
              <div className="text-xs text-ink-muted">Via Scan RFID E-KTP</div>
              <div className="font-display text-2xl font-bold text-[#6741D9] mt-1">
                {guestbookStats.rfid_count}
              </div>
            </div>
            <div className="soft-card p-4">
              <div className="text-xs text-ink-muted">Via Pencarian NIK</div>
              <div className="font-display text-2xl font-bold text-[#1971C2] mt-1">
                {guestbookStats.nik_count}
              </div>
            </div>
            <div className="soft-card p-4">
              <div className="text-xs text-ink-muted">Via Input Manual</div>
              <div className="font-display text-2xl font-bold text-[#D97706] mt-1">
                {guestbookStats.manual_count}
              </div>
            </div>
          </div>

          <div className="soft-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink">
                  Buku Register Tamu Kantor Perbekel Ringdikit
                </h3>
                <p className="text-xs text-ink-muted">
                  Rekam jejak seluruh warga dan tamu instansi yang berkunjung
                  melalui Anjungan Kiosk Mandiri.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={guestbookSearch}
                  onChange={(e) => setGuestbookSearch(e.target.value)}
                  placeholder="Cari nama tamu, NIK, keperluan..."
                  className="soft-input text-xs w-56"
                />
                <select
                  value={guestbookMethodFilter}
                  onChange={(e) => setGuestbookMethodFilter(e.target.value)}
                  className="soft-input text-xs w-44"
                >
                  <option value="">Semua Metode Identitas</option>
                  <option value="RFID">Scan RFID KTP-el</option>
                  <option value="NIK">Pencarian NIK</option>
                  <option value="MANUAL">Input Manual</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-[11px] font-bold uppercase text-ink-muted bg-[#F8FAFD]">
                    <th className="py-3 px-3">Waktu Check-In</th>
                    <th className="py-3 px-3">Metode Identitas</th>
                    <th className="py-3 px-3">Nama Pengunjung & Identitas</th>
                    <th className="py-3 px-3">Asal / Banjar Dinas</th>
                    <th className="py-3 px-3">Pejabat Dituju</th>
                    <th className="py-3 px-3">Keperluan Kunjungan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {loadingGuestbook ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-ink-muted"
                      >
                        Memuat daftar buku tamu...
                      </td>
                    </tr>
                  ) : guestbookItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-ink-muted"
                      >
                        Belum ada data kunjungan di Buku Tamu Digital.
                      </td>
                    </tr>
                  ) : (
                    guestbookItems.map((g) => (
                      <tr key={g.id} className="hover:bg-[#F8FAFD]">
                        <td className="py-3 px-3 font-mono text-[11px] text-ink-secondary">
                          {formatDateTimeID(g.checkin_at)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              g.identification_method === "RFID"
                                ? "bg-pastel-violetSoft text-[#6741D9]"
                                : g.identification_method === "NIK"
                                ? "bg-pastel-mintSoft text-[#087F5B]"
                                : "bg-pastel-honeySoft text-[#D97706]"
                            }`}
                          >
                            {g.identification_method}
                            {g.rfid_uid ? ` • ${g.rfid_uid}` : ""}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-ink">
                            {g.full_name}
                          </div>
                          {g.nik && (
                            <div className="font-mono text-[11px] text-ink-muted">
                              NIK: {g.nik}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {g.dusun_name
                            ? `Banjar Dinas ${g.dusun_name}`
                            : g.institution || g.address || "-"}
                        </td>
                        <td className="py-3 px-3 font-semibold text-ink">
                          {g.target_official}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-ink">
                            {g.purpose_category}
                          </div>
                          <div className="text-[11px] text-ink-muted">
                            {g.purpose_detail}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
