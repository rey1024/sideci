"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Link2,
  Maximize2,
  Minimize2,
  Nfc,
  Printer,
  Radio,
  Search,
  Settings,
  Sparkles,
  Star,
  Unlink,
  UserCheck,
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
  submitGuestbookFeedback,
} from "@/lib/api";
import ResidentAutocomplete from "@/components/ResidentAutocomplete";
import KioskCameraKtpScanner, {
  ExtractedKtpResult,
} from "@/components/KioskCameraKtpScanner";

type KioskAdminTab = "kiosk_screen" | "rfid_settings" | "guestbook_log";
type KioskServiceMode = "home" | "letter" | "guestbook";
type LetterWizardStep = "pick_type" | "identify" | "confirm";
type GuestbookIdMethod = "CAMERA" | "RFID" | "NIK" | "MANUAL";

interface KioskTemplateOption {
  code: string;
  title: string;
  shortTag: string;
  classCode: string;
  accentBg: string;
  accentText: string;
}

const KIOSK_LETTER_OPTIONS: KioskTemplateOption[] = [
  {
    code: "SK_UMUM",
    title: "Surat Keterangan Umum",
    shortTag: "Domisili • Pengantar Bank • Usaha • Umum",
    classCode: "470",
    accentBg: "bg-pastel-violetSoft",
    accentText: "text-[#6741D9]",
  },
  {
    code: "SK_KELAHIRAN",
    title: "Surat Keterangan Kelahiran",
    shortTag: "Kelahiran Anak • Data Ibu & Ayah",
    classCode: "472.11",
    accentBg: "bg-pastel-mintSoft",
    accentText: "text-[#087F5B]",
  },
  {
    code: "SK_KEMATIAN",
    title: "Surat Keterangan Kematian",
    shortTag: "Pelaporan Warga Wafat & Ahli Keluarga",
    classCode: "472.12",
    accentBg: "bg-pastel-honeySoft",
    accentText: "text-[#D97706]",
  },
  {
    code: "SK_BEDA_NAMA",
    title: "Surat Keterangan Beda Nama",
    shortTag: "Perbedaan Ejaan Nama Antar Dokumen",
    classCode: "470",
    accentBg: "bg-pastel-skySoft",
    accentText: "text-[#1971C2]",
  },
  {
    code: "SK_WARIS",
    title: "Surat Keterangan Waris",
    shortTag: "Keterangan Daftar Ahli Waris Keluarga",
    classCode: "474",
    accentBg: "bg-pastel-roseSoft",
    accentText: "text-[#C92A2A]",
  },
];

const TARGET_OFFICIAL_OPTIONS = [
  "Perbekel Ringdikit",
  "Sekretaris Desa",
  "Loket Pelayanan Surat",
  "Kasi Pemerintahan",
  "Kelian Banjar Dinas",
  "BPD / Lembaga Desa",
];

const PURPOSE_CATEGORY_OPTIONS = [
  "Mengurus Surat Desa",
  "Konsultasi Pimpinan",
  "Lapor Data Penduduk",
  "Kunjungan Dinas / Kampus",
  "Aspirasi / Pengaduan",
  "Keperluan Lainnya",
];

const QUICK_LETTER_PURPOSES = [
  "Administrasi Bank",
  "Persyaratan Sekolah / Beasiswa",
  "Administrasi Usaha / UMKM",
  "Pengurusan KTP / KK / Akta",
  "Keperluan Keluarga / Adat",
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

  // Sinkronisasi Fullscreen API Browser (agar benar-benar 100% layar penuh di Tablet)
  const enterFullscreen = useCallback(async () => {
    setFullScreenKiosk(true);
    try {
      if (
        typeof document !== "undefined" &&
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      ) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* tetap gunakan fixed inset-0 apabila browser membatasi requestFullscreen */
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    setFullScreenKiosk(false);
    try {
      if (
        typeof document !== "undefined" &&
        document.fullscreenElement &&
        document.exitFullscreen
      ) {
        await document.exitFullscreen();
      }
    } catch {
      /* abaikan */
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      if (typeof document !== "undefined" && !document.fullscreenElement) {
        // Biarkan tombol bisa mengontrol state secara konsisten
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Jam digital live di Kiosk Tablet
  const [clockStr, setClockStr] = useState<string>("");
  useEffect(() => {
    const updateClock = () => {
      setClockStr(
        new Date().toLocaleString("id-ID", {
          weekday: "short",
          day: "2-digit",
          month: "short",
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

  // State Kiosk Interaktif (Tablet-Friendly Wizard)
  const [serviceMode, setServiceMode] = useState<KioskServiceMode>("home");
  const [letterStep, setLetterStep] = useState<LetterWizardStep>("pick_type");
  const [identifiedResident, setIdentifiedResident] =
    useState<ApiResidentItem | null>(null);
  const [identifiedMethod, setIdentifiedMethod] = useState<
    "CAMERA" | "RFID" | "NIK"
  >("CAMERA");
  const [croppedKtpImage, setCroppedKtpImage] = useState<string | null>(null);
  const [showHomeCameraModal, setShowHomeCameraModal] = useState(false);
  const [rfidInput, setRfidInput] = useState("");
  const [nikInput, setNikInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const rfidInputRef = useRef<HTMLInputElement>(null);

  // State Alur 1: Persuratan Kiosk
  const [kioskLetterCode, setKioskLetterCode] = useState<string>("SK_UMUM");
  const [kioskIdTab, setKioskIdTab] = useState<"CAMERA" | "RFID" | "NIK">(
    "CAMERA"
  );
  const [kioskLetterPurpose, setKioskLetterPurpose] =
    useState<string>("Administrasi Bank");
  const [kioskChildName, setKioskChildName] = useState("");
  const [kioskChildOrder, setKioskChildOrder] = useState("1 (Satu)");
  const [kioskChildBirthPlace, setKioskChildBirthPlace] = useState(
    "Puskesmas Seririt I"
  );
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
  const [gbMethod, setGbMethod] = useState<GuestbookIdMethod>("CAMERA");
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
  // State Form Penilaian Layanan (Rating Bintang 5 & Kesan Pengunjung) setelah Buku Tamu
  const [gbServiceRating, setGbServiceRating] = useState<number>(5);
  const [gbHoverRating, setGbHoverRating] = useState<number>(0);
  const [gbFeedbackImpression, setGbFeedbackImpression] = useState<string>("");
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [feedbackSaved, setFeedbackSaved] = useState<boolean>(false);

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
    method: "CAMERA" | "RFID" | "NIK",
    croppedImage?: string
  ) => {
    setIdentifiedResident(res);
    setIdentifiedMethod(method);
    if (croppedImage) {
      setCroppedKtpImage(croppedImage);
    }
    setShowHomeCameraModal(false);
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
    if (serviceMode === "letter" && letterStep === "identify") {
      setLetterStep("confirm");
    }
  };

  const handleCameraKtpDetected = (result: ExtractedKtpResult) => {
    applyResidentToKioskState(
      result.resident,
      "CAMERA",
      result.croppedImageDataUrl
    );
  };

  const handleScanRFID = async (uidToScan?: string) => {
    const cleanUid = (uidToScan ?? rfidInput).trim().toUpperCase();
    if (!cleanUid) {
      setLookupError("Tempelkan KTP-el pada alat scan RFID terlebih dahulu.");
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
          `Kartu RFID (${cleanUid}) belum terdaftar. Silakan gunakan pencarian NIK atau Isi Manual.`
      );
      return;
    }
    applyResidentToKioskState(res.data.resident, "RFID");
  };

  const handleLookupByNIK = async (nikToSearch?: string) => {
    const cleanNik = (nikToSearch ?? nikInput).replace(/\D/g, "").trim();
    if (cleanNik.length !== 16) {
      setLookupError("Masukkan tepat 16 angka NIK KTP Anda.");
      return;
    }
    setNikInput(cleanNik);
    setLookupLoading(true);
    setLookupError(null);
    const res = await kioskLookupResident({ nik: cleanNik });
    setLookupLoading(false);
    if (!res.ok || !res.data.resident) {
      setLookupError(
        res.data.error || `NIK ${cleanNik} tidak ditemukan di Desa Ringdikit.`
      );
      return;
    }
    applyResidentToKioskState(res.data.resident, "NIK");
  };

  const resetKioskSession = () => {
    setServiceMode("home");
    setLetterStep("pick_type");
    setIdentifiedResident(null);
    setCroppedKtpImage(null);
    setShowHomeCameraModal(false);
    setRfidInput("");
    setNikInput("");
    setLookupError(null);
    setIssuedKioskLetter(null);
    setCompletedGuestbook(null);
    setGbServiceRating(5);
    setGbHoverRating(0);
    setGbFeedbackImpression("");
    setFeedbackSaved(false);
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
      setLookupError("Silakan scan KTP-el atau masukkan NIK terlebih dahulu.");
      return;
    }
    setSubmittingKioskLetter(true);
    const r = identifiedResident;
    const ttl = `${r.birth_place}, ${formatBirthDateDDMMYYYY(r.birth_date)}`;
    const addr = r.dusun_name
      ? `BD. ${r.dusun_name} Desa Ringdikit`
      : "Desa Ringdikit";

    const statementText =
      "Sepengetahuan kami memang benar orang tersebut di atas adalah penduduk Desa Ringdikit Kecamatan Seririt Kabupaten Buleleng.";

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
      statement_text: statementText,
      extra_statement: statementText,
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
      father_name: r.gender === "L" ? r.full_name : r.father_name || "-",
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
        "Silakan scan RFID KTP-el, cari NIK, atau pilih Isi Manual."
      );
      return;
    }

    setSubmittingGuestbook(true);
    const backendMethod: "RFID" | "NIK" | "MANUAL" =
      gbMethod === "CAMERA" ? "NIK" : gbMethod;
    const res = await createGuestbookEntry({
      identification_method: backendMethod,
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
      setLookupError(res.data.error || "Gagal menyimpan buku tamu.");
      return;
    }
    setCompletedGuestbook(res.data.entry);
    setGbServiceRating(5);
    setGbHoverRating(0);
    setGbFeedbackImpression("");
    setFeedbackSaved(false);
    await loadGuestbook();
    onDataChanged?.();
  };

  const handleSubmitGuestbookFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completedGuestbook) return;
    setSubmittingFeedback(true);
    const res = await submitGuestbookFeedback(completedGuestbook.id, {
      service_rating: gbServiceRating,
      feedback_impression: gbFeedbackImpression.trim(),
    });
    setSubmittingFeedback(false);
    if (res.ok && res.data.entry) {
      setCompletedGuestbook(res.data.entry);
      setFeedbackSaved(true);
      await loadGuestbook();
      onDataChanged?.();
    }
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

  const activeLetterMeta =
    KIOSK_LETTER_OPTIONS.find((o) => o.code === kioskLetterCode) ||
    KIOSK_LETTER_OPTIONS[0];

  // ===========================================================================
  // RENDER TERMINAL KIOSK TABLET (100% MEMENUHI LAYAR SAAT FULLSCREEN)
  // ===========================================================================
  const renderKioskTerminal = () => (
    <div
      className={
        fullScreenKiosk
          ? "fixed inset-0 z-[100] w-screen h-screen overflow-y-auto bg-gradient-to-b from-[#132247] via-[#172955] to-[#0F1B38] text-white flex flex-col justify-between p-6 sm:p-10 select-none"
          : "rounded-3xl bg-gradient-to-b from-[#132247] via-[#172955] to-[#0F1B38] text-white p-6 sm:p-8 shadow-xl border border-white/10 space-y-6"
      }
    >
      {/* 1. HEADER TABLET KIOSK — BERSIH, TULISAN BESAR & JELAS */}
      <div className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/15">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-lg flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-buleleng.jpg"
              alt="Logo Kabupaten Buleleng"
              className="w-12 h-12 object-contain"
            />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/35 px-3.5 py-1 text-xs sm:text-sm font-bold text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              ANJUNGAN LAYANAN MANDIRI • RFID KTP-EL AKTIF
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              Pemerintah Desa Ringdikit
            </h2>
            <p className="text-sm sm:text-base text-slate-300 font-medium">
              {clockStr}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowHomeCameraModal((v) => !v)}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-[#072116] px-5 py-3.5 text-base font-extrabold shadow-md transition-all active:scale-95"
          >
            <Camera className="w-5 h-5" />
            {showHomeCameraModal ? "Tutup Kamera KTP" : "Scan KTP via Kamera"}
          </button>
          {serviceMode !== "home" && (
            <button
              type="button"
              onClick={resetKioskSession}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 px-5 py-3.5 text-base font-extrabold text-white transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" /> Menu Utama
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              fullScreenKiosk ? exitFullscreen() : enterFullscreen()
            }
            className="inline-flex items-center gap-2 rounded-2xl bg-[#FFD43B] hover:bg-[#FCC419] text-[#111A30] px-5 py-3.5 text-base font-extrabold shadow-md transition-all active:scale-95"
          >
            {fullScreenKiosk ? (
              <>
                <Minimize2 className="w-5 h-5" /> Tutup Layar Penuh
              </>
            ) : (
              <>
                <Maximize2 className="w-5 h-5" /> Layar Penuh Tablet
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. KONTEN TENGAH TABLET KIOSK (FOKUS, TULISAN BESAR, MINIM TEKS) */}
      <div className="w-full max-w-6xl mx-auto my-auto py-4 space-y-6">
        {/* PANEL SCANNER KAMERA KTP APABILA DIBUKA DARI HEADER */}
        {showHomeCameraModal && (
          <KioskCameraKtpScanner
            candidateResidents={rfidMappings}
            onDetected={handleCameraKtpDetected}
            onClose={() => setShowHomeCameraModal(false)}
          />
        )}

        {/* KARTU SAPAAN WARGA APABILA KTP-EL SUDAH DI-TAP / DI-SCAN KAMERA */}
        {identifiedResident && (
          <div className="rounded-3xl bg-emerald-500/20 border-2 border-emerald-400/50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-4">
              {croppedKtpImage && identifiedMethod === "CAMERA" ? (
                <div className="w-28 aspect-[1.586/1] rounded-xl overflow-hidden border-2 border-emerald-300 shadow shrink-0 bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={croppedKtpImage}
                    alt="Hasil Crop KTP-el"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-emerald-400 text-[#072116] flex items-center justify-center shrink-0 shadow">
                  <UserCheck className="w-9 h-9" />
                </div>
              )}
              <div>
                <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-300">
                  KTP-el Warga Terdeteksi (
                  {identifiedMethod === "CAMERA"
                    ? "KAMERA KTP • AUTO-CROP"
                    : identifiedMethod}
                  {identifiedResident.rfid_uid && identifiedMethod === "RFID"
                    ? ` • ${identifiedResident.rfid_uid}`
                    : ""}
                  )
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                  {identifiedResident.full_name}
                </div>
                <div className="text-sm sm:text-base text-slate-200 font-medium mt-0.5">
                  Banjar Dinas {identifiedResident.dusun_name || "Ringdikit"} •
                  NIK:{" "}
                  <span className="font-mono">{identifiedResident.nik}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIdentifiedResident(null);
                setCroppedKtpImage(null);
                setRfidInput("");
                setNikInput("");
              }}
              className="rounded-2xl bg-white/15 hover:bg-white/25 px-5 py-3 text-sm sm:text-base font-bold text-white shrink-0 active:scale-95"
            >
              Ganti KTP Warga
            </button>
          </div>
        )}

        {/* PESAN PERINGATAN / ERROR DENGAN FONT BESAR */}
        {lookupError && (
          <div className="rounded-2xl bg-rose-500/25 border-2 border-rose-400/50 p-4 sm:p-5 text-base sm:text-lg font-bold text-rose-100 flex items-center justify-between gap-4">
            <span>{lookupError}</span>
            <button
              type="button"
              onClick={() => setLookupError(null)}
              className="rounded-xl bg-white/15 px-4 py-2 text-sm font-extrabold text-white shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {/* ===================================================================
            LAYAR BERANDA TABLET: 2 TOMBOL RAKSASA (SURAT & BUKU TAMU)
           =================================================================== */}
        {serviceMode === "home" && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h3 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                Selamat Datang, Silakan Pilih Layanan
              </h3>
              <p className="text-base sm:text-xl text-slate-300 font-medium">
                Sentuh salah satu menu di bawah ini atau tempelkan E-KTP Anda
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* TOMBOL RAKSASA 1: BUAT SURAT */}
              <button
                type="button"
                onClick={() => {
                  setServiceMode("letter");
                  setLetterStep("pick_type");
                  setIssuedKioskLetter(null);
                  setLookupError(null);
                }}
                className="group text-left rounded-[2rem] bg-white text-ink p-8 sm:p-10 shadow-2xl hover:ring-4 hover:ring-[#FFD43B] transition-all active:scale-[0.98] flex flex-col justify-between min-h-[260px] sm:min-h-[300px]"
              >
                <div className="space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center shadow-sm">
                    <FileText className="w-11 h-11" />
                  </div>
                  <div className="font-display text-2xl sm:text-4xl font-extrabold text-ink group-hover:text-[#6741D9] transition-colors">
                    Buat & Cetak Surat
                  </div>
                  <p className="text-base sm:text-lg text-ink-secondary font-medium leading-snug">
                    Surat Keterangan Umum, Kelahiran, Kematian, Beda Nama, &
                    Ahli Waris
                  </p>
                </div>

                <div className="mt-6 inline-flex items-center gap-2 text-lg sm:text-xl font-extrabold text-[#6741D9]">
                  <span>Pilih Jenis Surat</span>
                  <ArrowRight className="w-6 h-6" />
                </div>
              </button>

              {/* TOMBOL RAKSASA 2: ISI BUKU TAMU */}
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
                className="group text-left rounded-[2rem] bg-white text-ink p-8 sm:p-10 shadow-2xl hover:ring-4 hover:ring-[#FFD43B] transition-all active:scale-[0.98] flex flex-col justify-between min-h-[260px] sm:min-h-[300px]"
              >
                <div className="space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-pastel-mintSoft text-[#087F5B] flex items-center justify-center shadow-sm">
                    <BookOpen className="w-11 h-11" />
                  </div>
                  <div className="font-display text-2xl sm:text-4xl font-extrabold text-ink group-hover:text-[#087F5B] transition-colors">
                    Isi Buku Tamu Desa
                  </div>
                  <p className="text-base sm:text-lg text-ink-secondary font-medium leading-snug">
                    Scan E-KTP RFID, Cari Nomor NIK Warga, atau Isi Manual Tamu
                  </p>
                </div>

                <div className="mt-6 inline-flex items-center gap-2 text-lg sm:text-xl font-extrabold text-[#087F5B]">
                  <span>Mulai Isi Buku Tamu</span>
                  <ArrowRight className="w-6 h-6" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            LAYAR LAYANAN 1: BUAT SURAT (WIZARD 3 LANGKAH TABLET BESAR)
           =================================================================== */}
        {serviceMode === "letter" && (
          <div className="rounded-[2rem] bg-white text-ink p-6 sm:p-10 shadow-2xl space-y-6">
            {issuedKioskLetter ? (
              /* LAYAR SELESAI CETAK SURAT */
              <div className="text-center max-w-2xl mx-auto py-6 space-y-6">
                <div className="w-24 h-24 rounded-full bg-pastel-mintSoft text-[#087F5B] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-14 h-14" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#087F5B]">
                    SURAT BERHASIL DITERBITKAN
                  </div>
                  <h3 className="font-display text-3xl sm:text-4xl font-extrabold text-ink">
                    {issuedKioskLetter.template_title}
                  </h3>
                  <p className="text-lg sm:text-xl font-bold text-ink-secondary">
                    {issuedKioskLetter.applicant_name}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-3xl bg-[#F8FAFD] border-2 border-line p-6">
                  <div>
                    <div className="text-sm text-ink-muted font-semibold">
                      Nomor Surat Resmi
                    </div>
                    <div className="font-mono text-xl sm:text-2xl font-extrabold text-ink mt-1">
                      {issuedKioskLetter.letter_number}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-ink-muted font-semibold">
                      Kode Tiket Layanan
                    </div>
                    <div className="font-mono text-xl sm:text-2xl font-extrabold text-[#6741D9] mt-1">
                      {issuedKioskLetter.ticket_code}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                  <a
                    href={getLetterPdfUrl(issuedKioskLetter.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-3 rounded-2xl bg-[#087F5B] hover:bg-[#066649] text-white font-extrabold text-lg sm:text-xl px-8 py-5 shadow-lg active:scale-95 transition-all"
                  >
                    <Download className="w-6 h-6" /> Cetak / Unduh PDF
                  </a>
                  <a
                    href={getLetterDocxUrl(issuedKioskLetter.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-3 rounded-2xl bg-[#1971C2] hover:bg-[#145A9E] text-white font-extrabold text-lg sm:text-xl px-8 py-5 shadow-lg active:scale-95 transition-all"
                  >
                    <FileSpreadsheet className="w-6 h-6" /> Unduh Word (DOCX)
                  </a>
                  <button
                    type="button"
                    onClick={resetKioskSession}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#F1F5F9] hover:bg-line text-ink font-extrabold text-lg px-7 py-5 active:scale-95 transition-all"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            ) : letterStep === "pick_type" ? (
              /* STEP 1: PILIH JENIS SURAT (TOMBOL BESAR TABLET) */
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div>
                    <div className="text-sm font-extrabold uppercase tracking-wider text-[#6741D9]">
                      LANGKAH 1 DARI 3
                    </div>
                    <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
                      Pilih Jenis Surat yang Ingin Dibuat
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setServiceMode("home")}
                    className="rounded-2xl bg-[#F1F5F9] hover:bg-line px-5 py-3 text-base font-bold text-ink"
                  >
                    Kembali
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {KIOSK_LETTER_OPTIONS.map((opt, idx) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        setKioskLetterCode(opt.code);
                        if (identifiedResident) {
                          setLetterStep("confirm");
                        } else {
                          setLetterStep("identify");
                        }
                      }}
                      className="text-left rounded-3xl border-2 border-line hover:border-[#6741D9] bg-[#F8FAFD] hover:bg-pastel-violetSoft/40 p-6 transition-all active:scale-[0.99] flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-14 h-14 rounded-2xl ${opt.accentBg} ${opt.accentText} font-display text-2xl font-extrabold flex items-center justify-center shrink-0`}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-display text-xl sm:text-2xl font-extrabold text-ink">
                            {opt.title}
                          </div>
                          <div className="text-sm sm:text-base text-ink-secondary font-medium mt-0.5">
                            {opt.shortTag}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-7 h-7 text-[#6741D9] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : letterStep === "identify" ? (
              /* STEP 2: SCAN KTP-EL ATAU MASUKKAN NIK */
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <div className="text-sm font-extrabold uppercase tracking-wider text-[#6741D9]">
                      LANGKAH 2 DARI 3 • {activeLetterMeta.title.toUpperCase()}
                    </div>
                    <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
                      Scan KTP-el atau Masukkan NIK Anda
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLetterStep("pick_type")}
                    className="rounded-2xl bg-[#F1F5F9] hover:bg-line px-5 py-3 text-base font-bold text-ink"
                  >
                    ← Ganti Jenis Surat
                  </button>
                </div>

                {/* 3 TAB BESAR: SCAN KAMERA KTP VS SCAN RFID VS CARI NIK */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <button
                    type="button"
                    onClick={() => setKioskIdTab("CAMERA")}
                    className={`rounded-2xl py-4 px-5 text-base sm:text-lg font-extrabold flex items-center justify-center gap-2.5 border-2 transition-all ${
                      kioskIdTab === "CAMERA"
                        ? "border-[#6741D9] bg-[#6741D9] text-white shadow-md"
                        : "border-line bg-[#F8FAFD] text-ink-secondary"
                    }`}
                  >
                    <Camera className="w-6 h-6" /> 1. Scan Kamera KTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setKioskIdTab("RFID")}
                    className={`rounded-2xl py-4 px-5 text-base sm:text-lg font-extrabold flex items-center justify-center gap-2.5 border-2 transition-all ${
                      kioskIdTab === "RFID"
                        ? "border-[#6741D9] bg-[#6741D9] text-white shadow-md"
                        : "border-line bg-[#F8FAFD] text-ink-secondary"
                    }`}
                  >
                    <Nfc className="w-6 h-6" /> 2. Scan RFID KTP-el
                  </button>
                  <button
                    type="button"
                    onClick={() => setKioskIdTab("NIK")}
                    className={`rounded-2xl py-4 px-5 text-base sm:text-lg font-extrabold flex items-center justify-center gap-2.5 border-2 transition-all ${
                      kioskIdTab === "NIK"
                        ? "border-[#6741D9] bg-[#6741D9] text-white shadow-md"
                        : "border-line bg-[#F8FAFD] text-ink-secondary"
                    }`}
                  >
                    <Search className="w-6 h-6" /> 3. Ketik NIK / Nama
                  </button>
                </div>

                {kioskIdTab === "CAMERA" ? (
                  <KioskCameraKtpScanner
                    candidateResidents={rfidMappings}
                    onDetected={handleCameraKtpDetected}
                  />
                ) : kioskIdTab === "RFID" ? (
                  <div className="rounded-3xl bg-[#F8FAFD] border-2 border-line p-6 sm:p-8 text-center space-y-5">
                    <div className="w-20 h-20 rounded-full bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center mx-auto">
                      <Radio className="w-10 h-10 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xl sm:text-2xl font-extrabold text-ink">
                        Tempelkan E-KTP pada Alat Pembaca RFID
                      </h4>
                      <p className="text-sm sm:text-base text-ink-secondary">
                        Atau sentuh salah satu kartu KTP warga di bawah untuk
                        simulasi
                      </p>
                    </div>

                    <div className="max-w-lg mx-auto flex items-center gap-3">
                      <input
                        type="text"
                        value={rfidInput}
                        onChange={(e) =>
                          setRfidInput(e.target.value.toUpperCase())
                        }
                        placeholder="UID RFID (cth: 04A28F01)..."
                        className="soft-input bg-white font-mono text-lg py-3.5 px-4 text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleScanRFID()}
                        className="rounded-2xl bg-[#6741D9] hover:bg-[#5633B8] text-white font-extrabold text-base sm:text-lg px-6 py-3.5 shrink-0"
                      >
                        Scan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl bg-[#F8FAFD] border-2 border-line p-6 sm:p-8 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-base font-bold text-ink mb-2">
                          Masukkan 16 Angka NIK KTP
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={16}
                            value={nikInput}
                            onChange={(e) =>
                              setNikInput(e.target.value.replace(/\D/g, ""))
                            }
                            placeholder="510802xxxxxxxxxx"
                            className="soft-input bg-white font-mono text-lg py-3.5 px-4"
                          />
                          <button
                            type="button"
                            onClick={() => handleLookupByNIK()}
                            className="rounded-2xl bg-[#6741D9] text-white font-extrabold text-base px-6 py-3.5 shrink-0"
                          >
                            Cari
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-base font-bold text-ink mb-2">
                          Atau Cari Nama Warga
                        </label>
                        <ResidentAutocomplete
                          placeholder="Ketik nama warga Desa Ringdikit..."
                          onSelect={(r) => {
                            if (r) applyResidentToKioskState(r, "NIK");
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* STEP 3: KONFIRMASI & CETAK SURAT */
              <form onSubmit={handleKioskIssueLetter} className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <div className="text-sm font-extrabold uppercase tracking-wider text-[#087F5B]">
                      LANGKAH 3 DARI 3 • KONFIRMASI & CETAK
                    </div>
                    <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
                      {activeLetterMeta.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLetterStep("pick_type")}
                    className="rounded-2xl bg-[#F1F5F9] hover:bg-line px-5 py-3 text-base font-bold text-ink"
                  >
                    ← Ganti Jenis Surat
                  </button>
                </div>

                {identifiedResident && (
                  <div className="rounded-3xl bg-pastel-mintSoft/50 border-2 border-pastel-mint/40 p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-ink-muted font-semibold block">
                        Nama Pemohon
                      </span>
                      <strong className="text-xl sm:text-2xl font-extrabold text-ink">
                        {identifiedResident.full_name}
                      </strong>
                    </div>
                    <div>
                      <span className="text-sm text-ink-muted font-semibold block">
                        Nomor NIK
                      </span>
                      <span className="font-mono text-lg sm:text-xl font-bold text-ink">
                        {identifiedResident.nik}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-ink-muted font-semibold block">
                        Banjar Dinas
                      </span>
                      <span className="text-lg sm:text-xl font-bold text-ink">
                        BD. {identifiedResident.dusun_name || "Ringdikit"}
                      </span>
                    </div>
                  </div>
                )}

                {kioskLetterCode === "SK_KELAHIRAN" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-3xl bg-[#F8FAFD] border border-line p-5">
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        Nama Lengkap Anak *
                      </label>
                      <input
                        type="text"
                        required
                        value={kioskChildName}
                        onChange={(e) => setKioskChildName(e.target.value)}
                        placeholder="Ketik nama bayi / anak..."
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        Tempat & Tanggal Lahir Anak
                      </label>
                      <input
                        type="text"
                        value={kioskChildBirthPlace}
                        onChange={(e) =>
                          setKioskChildBirthPlace(e.target.value)
                        }
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                  </div>
                )}

                {kioskLetterCode === "SK_KEMATIAN" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-3xl bg-[#F8FAFD] border border-line p-5">
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        Hari / Tanggal Meninggal
                      </label>
                      <input
                        type="text"
                        value={kioskDeathDate}
                        onChange={(e) => setKioskDeathDate(e.target.value)}
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        Sebab Kematian
                      </label>
                      <input
                        type="text"
                        value={kioskDeathCause}
                        onChange={(e) => setKioskDeathCause(e.target.value)}
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                  </div>
                )}

                {kioskLetterCode === "SK_BEDA_NAMA" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-3xl bg-[#F8FAFD] border border-line p-5">
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        Dokumen yang Berbeda Nama
                      </label>
                      <input
                        type="text"
                        value={kioskDiffDoc}
                        onChange={(e) => setKioskDiffDoc(e.target.value)}
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        Nama Tertulis di Dokumen Tersebut
                      </label>
                      <input
                        type="text"
                        value={kioskDiffName}
                        onChange={(e) => setKioskDiffName(e.target.value)}
                        placeholder="Ketik nama yang berbeda..."
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                  </div>
                )}

                {kioskLetterCode === "SK_WARIS" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-3xl bg-[#F8FAFD] border border-line p-5">
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        Nama Pewaris (Almarhum/ah) *
                      </label>
                      <input
                        type="text"
                        required
                        value={kioskPewarisName}
                        onChange={(e) => setKioskPewarisName(e.target.value)}
                        placeholder="Ketik nama pewaris..."
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        Tanggal Meninggal Pewaris
                      </label>
                      <input
                        type="text"
                        value={kioskPewarisDate}
                        onChange={(e) => setKioskPewarisDate(e.target.value)}
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                  </div>
                )}

                {/* PILIH KEPERLUAN SURAT DENGAN TOMBOL SENTUH BESAR */}
                <div className="space-y-3">
                  <label className="block text-base sm:text-lg font-extrabold text-ink">
                    Pilih Keperluan Surat:
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {QUICK_LETTER_PURPOSES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setKioskLetterPurpose(p)}
                        className={`rounded-2xl px-4 py-3 text-sm sm:text-base font-bold transition-all active:scale-95 ${
                          kioskLetterPurpose === p
                            ? "bg-[#6741D9] text-white shadow-md"
                            : "bg-[#F1F5F9] text-ink hover:bg-pastel-violetSoft"
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
                    className="soft-input text-lg py-3.5 px-4"
                  />
                </div>

                <div className="pt-4 border-t border-line flex items-center justify-end gap-4">
                  <button
                    type="submit"
                    disabled={submittingKioskLetter || !identifiedResident}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-[#6741D9] hover:bg-[#5633B8] text-white font-extrabold text-lg sm:text-xl px-8 py-5 shadow-xl disabled:opacity-50 active:scale-95 transition-all"
                  >
                    <Printer className="w-6 h-6" />
                    {submittingKioskLetter
                      ? "Memproses Surat..."
                      : "Terbitkan & Cetak Surat Sekarang"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ===================================================================
            LAYAR LAYANAN 2: ISI BUKU TAMU (TOMBOL BESAR & SEDERHANA DI TABLET)
           =================================================================== */}
        {serviceMode === "guestbook" && (
          <div className="rounded-[2rem] bg-white text-ink p-6 sm:p-10 shadow-2xl space-y-6">
            {completedGuestbook ? (
              /* LAYAR BUKTI CHECK-IN BUKU TAMU + FORM RATING BINTANG 5 & KESAN LAYANAN */
              <div className="max-w-2xl mx-auto py-3 space-y-6">
                {/* HEADER KONFIRMASI CHECK-IN */}
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#E6FCF5] to-[#C3FAE8] border-2 border-[#96F2D7] text-[#087F5B] flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-11 h-11" />
                  </div>
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-pastel-mintSoft px-3.5 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#087F5B]">
                      BUKU TAMU BERHASIL DISIMPAN
                    </div>
                    <h3 className="font-display text-2xl sm:text-4xl font-extrabold text-ink">
                      Selamat Datang, {completedGuestbook.full_name}
                    </h3>
                    <p className="text-base sm:text-lg text-ink-secondary font-medium">
                      Silakan menuju ke{" "}
                      <strong className="text-[#087F5B]">
                        {completedGuestbook.target_official}
                      </strong>{" "}
                      ({completedGuestbook.purpose_category})
                    </p>
                  </div>
                </div>

                {/* FORM ELEGAN PENILAIAN LAYANAN (RATING BINTANG 5 & KESAN PENGUNJUNG) */}
                {!feedbackSaved ? (
                  <form
                    onSubmit={handleSubmitGuestbookFeedback}
                    className="rounded-3xl bg-gradient-to-br from-[#F8F5FF] via-[#FFFDF7] to-[#F3FBF8] border-2 border-[#E5DBFF] p-6 sm:p-8 shadow-md space-y-6"
                  >
                    <div className="text-center space-y-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF3BF] border border-[#FFE066] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[#B45309]">
                        <Sparkles className="w-3.5 h-3.5" /> Indeks Kepuasan
                        Masyarakat (IKM)
                      </span>
                      <h4 className="text-xl sm:text-2xl font-extrabold text-ink">
                        Bagaimana Penilaian & Kesan Anda atas Pelayanan Desa
                        Ringdikit?
                      </h4>
                      <p className="text-xs sm:text-sm text-ink-secondary">
                        Sentuh bintang di bawah dan tuliskan kesan/masukan Anda
                        untuk kemajuan pelayanan cerdas Desa Ringdikit
                      </p>
                    </div>

                    {/* BINTANG 5 INTERAKTIF UKURAN BESAR (TABLET TOUCH-FRIENDLY) */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center justify-center gap-2 sm:gap-4">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const activeLevel = gbHoverRating || gbServiceRating;
                          const isFilled = star <= activeLevel;
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setGbServiceRating(star)}
                              onMouseEnter={() => setGbHoverRating(star)}
                              onMouseLeave={() => setGbHoverRating(0)}
                              className={`group rounded-2xl p-3 sm:p-4 border-2 transition-all active:scale-90 ${
                                isFilled
                                  ? "bg-[#FFF9DB] border-[#FCC419] shadow-md scale-105"
                                  : "bg-white border-line hover:border-[#FFE066]"
                              }`}
                              aria-label={`Beri ${star} Bintang`}
                            >
                              <Star
                                className={`w-9 h-9 sm:w-12 sm:h-12 transition-transform group-hover:scale-110 ${
                                  isFilled
                                    ? "fill-[#FCC419] text-[#F59F00]"
                                    : "text-slate-300"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>

                      {/* LABEL PREDIKAT BINTANG */}
                      <div className="inline-flex items-center gap-2 rounded-xl bg-white border border-line px-4 py-1.5 text-sm sm:text-base font-extrabold text-ink shadow-sm">
                        <span className="text-[#F59F00]">
                          {"★".repeat(gbHoverRating || gbServiceRating)}
                        </span>
                        <span>
                          {(gbHoverRating || gbServiceRating) === 5
                            ? "5/5 — Sangat Puas & Pelayanan Prima!"
                            : (gbHoverRating || gbServiceRating) === 4
                            ? "4/5 — Puas & Ramah"
                            : (gbHoverRating || gbServiceRating) === 3
                            ? "3/5 — Cukup Baik"
                            : (gbHoverRating || gbServiceRating) === 2
                            ? "2/5 — Perlu Peningkatan"
                            : "1/5 — Kurang Memuaskan"}
                        </span>
                      </div>
                    </div>

                    {/* CHIP KESAN CEPAT (1-TAP TABLET) */}
                    <div className="space-y-2">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">
                        Pilih Cepat Kesan Pelayanan (Opsional):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "Pelayanan cepat, ramah, dan modern!",
                          "Anjungan Kiosk KTP-el sangat memudahkan warga.",
                          "Perangkat desa sigap dan informatif.",
                          "Ruang pelayanan bersih, nyaman, dan tertib.",
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              setGbFeedbackImpression((prev) =>
                                prev.includes(preset)
                                  ? prev
                                  : prev
                                  ? `${prev} ${preset}`
                                  : preset
                              )
                            }
                            className="rounded-xl bg-white hover:bg-[#F3EFFE] border border-[#D0BFFF] px-3 py-1.5 text-xs sm:text-sm font-bold text-[#5F3DC4] transition-colors active:scale-95"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* TEXTAREA KESAN & PESAN */}
                    <div className="space-y-2">
                      <label className="block text-sm sm:text-base font-extrabold text-ink">
                        Kesan & Pesan Anda untuk Pemerintah Desa Ringdikit:
                      </label>
                      <textarea
                        rows={3}
                        value={gbFeedbackImpression}
                        onChange={(e) =>
                          setGbFeedbackImpression(e.target.value)
                        }
                        placeholder="Tuliskan kesan, apresiasi, atau saran Anda terhadap pelayanan Desa Ringdikit..."
                        className="soft-input bg-white text-base sm:text-lg p-4 rounded-2xl border-2 border-[#D0BFFF] focus:border-[#6741D9] w-full"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={resetKioskSession}
                        className="w-full sm:w-auto rounded-2xl bg-white hover:bg-slate-100 border border-line text-ink-secondary font-bold text-sm sm:text-base px-6 py-4 transition-all"
                      >
                        Lewati & Kembali ke Layar Awal
                      </button>

                      <button
                        type="submit"
                        disabled={submittingFeedback}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#6741D9] to-[#087F5B] hover:opacity-95 text-white font-extrabold text-base sm:text-lg px-8 py-4 shadow-xl active:scale-95 transition-all disabled:opacity-50"
                      >
                        <Star className="w-5 h-5 fill-[#FFD43B] text-[#FFD43B]" />
                        {submittingFeedback
                          ? "Menyimpan Penilaian..."
                          : "Kirim Rating & Kesan Layanan"}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* KARTU APRESIASI SETELAH RATING & KESAN TERKIRIM */
                  <div className="rounded-3xl bg-gradient-to-br from-[#FFF9DB] via-[#E6FCF5] to-[#F3EFFE] border-2 border-[#96F2D7] p-6 sm:p-8 text-center space-y-4 shadow-md">
                    <div className="inline-flex items-center gap-1 text-[#F59F00]">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-7 h-7 ${
                            s <= (completedGuestbook.service_rating || gbServiceRating)
                              ? "fill-[#FCC419] text-[#F59F00]"
                              : "text-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                    <h4 className="text-2xl font-extrabold text-ink">
                      Matur Suksma! Terima Kasih atas Penilaian Anda
                    </h4>
                    {(completedGuestbook.feedback_impression ||
                      gbFeedbackImpression) && (
                      <blockquote className="max-w-lg mx-auto rounded-2xl bg-white/85 border border-[#D0BFFF] px-5 py-3.5 text-sm sm:text-base italic font-medium text-ink">
                        &ldquo;
                        {completedGuestbook.feedback_impression ||
                          gbFeedbackImpression}
                        &rdquo;
                      </blockquote>
                    )}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={resetKioskSession}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#087F5B] hover:bg-[#066649] text-white font-extrabold text-lg sm:text-xl px-10 py-4 shadow-lg active:scale-95 transition-all"
                      >
                        Selesai & Kembali ke Layar Awal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* FORM BUKU TAMU TABLET */
              <form onSubmit={handleKioskGuestbookSubmit} className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
                    Buku Tamu Kantor Desa Ringdikit
                  </h3>
                  <button
                    type="button"
                    onClick={() => setServiceMode("home")}
                    className="rounded-2xl bg-[#F1F5F9] hover:bg-line px-5 py-3 text-base font-bold text-ink"
                  >
                    Kembali
                  </button>
                </div>

                {/* 4 TOMBOL METODE IDENTITAS BESAR (TERMASUK KAMERA KTP AUTO-CROP) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <button
                    type="button"
                    onClick={() => setGbMethod("CAMERA")}
                    className={`rounded-2xl p-4 sm:p-5 border-2 text-left flex items-center gap-3.5 transition-all ${
                      gbMethod === "CAMERA"
                        ? "border-[#6741D9] bg-[#6741D9] text-white shadow-md"
                        : "border-line bg-[#F8FAFD] text-ink"
                    }`}
                  >
                    <Camera className="w-8 h-8 shrink-0" />
                    <div>
                      <div className="text-base sm:text-lg font-extrabold">
                        1. Scan Kamera KTP
                      </div>
                      <div
                        className={`text-xs ${
                          gbMethod === "CAMERA"
                            ? "text-white/80"
                            : "text-ink-muted"
                        }`}
                      >
                        Auto-Crop Webcam
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGbMethod("RFID")}
                    className={`rounded-2xl p-4 sm:p-5 border-2 text-left flex items-center gap-3.5 transition-all ${
                      gbMethod === "RFID"
                        ? "border-[#6741D9] bg-[#6741D9] text-white shadow-md"
                        : "border-line bg-[#F8FAFD] text-ink"
                    }`}
                  >
                    <Nfc className="w-8 h-8 shrink-0" />
                    <div>
                      <div className="text-base sm:text-lg font-extrabold">
                        2. Scan RFID KTP
                      </div>
                      <div
                        className={`text-xs ${
                          gbMethod === "RFID"
                            ? "text-white/80"
                            : "text-ink-muted"
                        }`}
                      >
                        Tempel E-KTP Warga
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGbMethod("NIK")}
                    className={`rounded-2xl p-4 sm:p-5 border-2 text-left flex items-center gap-3.5 transition-all ${
                      gbMethod === "NIK"
                        ? "border-[#087F5B] bg-[#087F5B] text-white shadow-md"
                        : "border-line bg-[#F8FAFD] text-ink"
                    }`}
                  >
                    <Search className="w-8 h-8 shrink-0" />
                    <div>
                      <div className="text-base sm:text-lg font-extrabold">
                        3. Cari NIK Warga
                      </div>
                      <div
                        className={`text-xs ${
                          gbMethod === "NIK"
                            ? "text-white/80"
                            : "text-ink-muted"
                        }`}
                      >
                        Ketik NIK / Nama
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGbMethod("MANUAL");
                      setIdentifiedResident(null);
                    }}
                    className={`rounded-2xl p-4 sm:p-5 border-2 text-left flex items-center gap-3.5 transition-all ${
                      gbMethod === "MANUAL"
                        ? "border-[#D97706] bg-[#D97706] text-white shadow-md"
                        : "border-line bg-[#F8FAFD] text-ink"
                    }`}
                  >
                    <Edit3 className="w-8 h-8 shrink-0" />
                    <div>
                      <div className="text-base sm:text-lg font-extrabold">
                        4. Isi Manual
                      </div>
                      <div
                        className={`text-xs ${
                          gbMethod === "MANUAL"
                            ? "text-white/80"
                            : "text-ink-muted"
                        }`}
                      >
                        Tamu Luar / Instansi
                      </div>
                    </div>
                  </button>
                </div>

                {/* INPUT IDENTITAS SESUAI METODE */}
                {gbMethod === "CAMERA" && !identifiedResident && (
                  <KioskCameraKtpScanner
                    candidateResidents={rfidMappings}
                    onDetected={handleCameraKtpDetected}
                  />
                )}

                {gbMethod === "RFID" && !identifiedResident && (
                  <div className="rounded-3xl bg-[#F8FAFD] border-2 border-line p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center shrink-0">
                        <Radio className="w-8 h-8 animate-pulse" />
                      </div>
                      <div>
                        <div className="text-lg sm:text-xl font-extrabold text-ink">
                          Silakan Tempelkan E-KTP pada Alat Scan RFID
                        </div>
                        <div className="text-sm text-ink-secondary">
                          Atau pilih tombol simulasi KTP warga di bagian bawah
                          layar
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        value={rfidInput}
                        onChange={(e) =>
                          setRfidInput(e.target.value.toUpperCase())
                        }
                        placeholder="UID RFID..."
                        className="soft-input bg-white font-mono text-base py-3 px-4 w-44"
                      />
                      <button
                        type="button"
                        onClick={() => handleScanRFID()}
                        className="rounded-2xl bg-[#6741D9] text-white font-extrabold text-base px-5 py-3"
                      >
                        Scan
                      </button>
                    </div>
                  </div>
                )}

                {gbMethod === "NIK" && !identifiedResident && (
                  <div className="rounded-3xl bg-[#F8FAFD] border-2 border-line p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-base font-bold text-ink mb-2">
                        Ketik 16 Digit NIK KTP
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={16}
                          value={nikInput}
                          onChange={(e) =>
                            setNikInput(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="510802xxxxxxxxxx"
                          className="soft-input bg-white font-mono text-lg py-3.5 px-4"
                        />
                        <button
                          type="button"
                          onClick={() => handleLookupByNIK()}
                          className="rounded-2xl bg-[#087F5B] text-white font-extrabold text-base px-6 py-3.5"
                        >
                          Cari
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-base font-bold text-ink mb-2">
                        Atau Cari Nama Warga
                      </label>
                      <ResidentAutocomplete
                        placeholder="Ketik nama warga Desa Ringdikit..."
                        onSelect={(r) => {
                          if (r) applyResidentToKioskState(r, "NIK");
                        }}
                      />
                    </div>
                  </div>
                )}

                {gbMethod === "MANUAL" && (
                  <div className="rounded-3xl bg-[#F8FAFD] border-2 border-line p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        Nama Lengkap Anda *
                      </label>
                      <input
                        type="text"
                        required
                        value={gbFullName}
                        onChange={(e) => setGbFullName(e.target.value)}
                        placeholder="Ketik nama lengkap..."
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        Asal Instansi / Alamat *
                      </label>
                      <input
                        type="text"
                        required
                        value={gbInstitution}
                        onChange={(e) => {
                          setGbInstitution(e.target.value);
                          setGbAddress(e.target.value);
                        }}
                        placeholder="Instansi / Desa asal..."
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-bold text-ink mb-1.5">
                        No. HP / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={gbPhone}
                        onChange={(e) => setGbPhone(e.target.value)}
                        placeholder="0812xxxxxxxx"
                        className="soft-input bg-white text-lg py-3.5 px-4"
                      />
                    </div>
                  </div>
                )}

                {/* PILIH PEJABAT & KEPERLUAN DENGAN TOMBOL SENTUH BESAR */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-base sm:text-lg font-extrabold text-ink mb-2.5">
                      Bertemu dengan Siapa?
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {TARGET_OFFICIAL_OPTIONS.map((off) => (
                        <button
                          key={off}
                          type="button"
                          onClick={() => setGbTargetOfficial(off)}
                          className={`rounded-2xl px-4 py-3.5 text-sm sm:text-base font-extrabold border-2 transition-all active:scale-95 ${
                            gbTargetOfficial === off
                              ? "border-[#6741D9] bg-pastel-violetSoft text-[#6741D9]"
                              : "border-line bg-white text-ink-secondary"
                          }`}
                        >
                          {off}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-base sm:text-lg font-extrabold text-ink mb-2.5">
                      Keperluan Kunjungan:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {PURPOSE_CATEGORY_OPTIONS.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setGbPurposeCategory(cat);
                            setGbPurposeDetail(cat);
                          }}
                          className={`rounded-2xl px-4 py-3.5 text-sm sm:text-base font-extrabold border-2 transition-all active:scale-95 ${
                            gbPurposeCategory === cat
                              ? "border-[#087F5B] bg-pastel-mintSoft text-[#087F5B]"
                              : "border-line bg-white text-ink-secondary"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-line flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={
                      submittingGuestbook ||
                      (gbMethod !== "MANUAL" && !identifiedResident)
                    }
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-[#087F5B] hover:bg-[#066649] text-white font-extrabold text-lg sm:text-xl px-10 py-5 shadow-xl disabled:opacity-50 active:scale-95 transition-all"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    {submittingGuestbook
                      ? "Menyimpan..."
                      : "Simpan & Check-In Buku Tamu"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* 3. FOOTER SIMULASI TAP E-KTP WARGA (TOMBOL SENTUH BESAR UNTUK DEMO TABLET) */}
      <div className="w-full max-w-6xl mx-auto pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#FFD43B] mr-1">
            <Nfc className="w-4 h-4" /> Simulasi Tap E-KTP Warga:
          </span>
          {rfidMappings.slice(0, 5).map((m) => {
            const isSelected =
              identifiedResident?.id === m.id && identifiedMethod === "RFID";
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleScanRFID(m.rfid_uid)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                  isSelected
                    ? "bg-[#FFD43B] text-[#111A30] shadow-md font-extrabold"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/15"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>{m.full_name}</span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-400 font-medium">
          SIDECI Desa Ringdikit • Undiksha
        </span>
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
            1. Layar Anjungan Kiosk Tablet (Surat & Buku Tamu)
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
            enterFullscreen();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#6741D9] text-white hover:bg-[#5633B8] px-4 py-2 text-xs font-bold shadow-sm transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Buka Layar Penuh Tablet
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
                database kependudukan Desa Ringdikit.
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
                  Klik <strong>Uji Tap di Kiosk</strong> untuk langsung mencoba
                  pemindaian kartu warga tersebut.
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
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
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
              <div className="text-xs text-ink-muted">Via Kamera / NIK</div>
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
            <div className="rounded-2xl bg-[#FFF9DB] border border-[#FFE066] p-4">
              <div className="text-xs font-bold text-[#B45309]">
                Rata-rata Rating Layanan
              </div>
              <div className="font-display text-2xl font-extrabold text-[#B45309] mt-1 flex items-center gap-1.5">
                <Star className="w-5 h-5 fill-[#FCC419] text-[#F59F00]" />
                <span>
                  {guestbookStats.avg_rating && guestbookStats.avg_rating > 0
                    ? `${guestbookStats.avg_rating} / 5`
                    : "5.0 / 5"}
                </span>
              </div>
            </div>
          </div>

          <div className="soft-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink">
                  Buku Register Tamu & Penilaian Kepuasan Layanan Desa Ringdikit
                </h3>
                <p className="text-xs text-ink-muted">
                  Rekam jejak seluruh warga dan tamu instansi beserta rating
                  bintang & kesan pelayanan melalui Anjungan Kiosk Mandiri.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={guestbookSearch}
                  onChange={(e) => setGuestbookSearch(e.target.value)}
                  placeholder="Cari nama tamu, NIK, kesan..."
                  className="soft-input text-xs w-56"
                />
                <select
                  value={guestbookMethodFilter}
                  onChange={(e) => setGuestbookMethodFilter(e.target.value)}
                  className="soft-input text-xs w-44"
                >
                  <option value="">Semua Metode Identitas</option>
                  <option value="RFID">Scan RFID KTP-el</option>
                  <option value="NIK">Kamera KTP / NIK</option>
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
                    <th className="py-3 px-3">Rating & Kesan Layanan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {loadingGuestbook ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-6 text-center text-ink-muted"
                      >
                        Memuat daftar buku tamu...
                      </td>
                    </tr>
                  ) : guestbookItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
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
                        <td className="py-3 px-3">
                          {g.service_rating && g.service_rating > 0 ? (
                            <div className="space-y-0.5">
                              <div className="inline-flex items-center gap-1 rounded-md bg-[#FFF9DB] border border-[#FFE066] px-2 py-0.5 text-[11px] font-extrabold text-[#B45309]">
                                <span className="text-[#F59F00]">
                                  {"★".repeat(g.service_rating)}
                                </span>
                                <span>({g.service_rating}/5)</span>
                              </div>
                              {g.feedback_impression && (
                                <div className="text-[11px] italic text-ink-secondary max-w-xs">
                                  &ldquo;{g.feedback_impression}&rdquo;
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-ink-muted">
                              Belum dinilai
                            </span>
                          )}
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
