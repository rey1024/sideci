"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Inbox,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import {
  ApiLetterRecord,
  ApiLetterStats,
  ApiResidentItem,
  createLetter,
  fetchLetters,
  getLetterDocxUrl,
  getLetterPdfUrl,
  getLetterSignedFileUrl,
  uploadSignedLetterFile,
} from "@/lib/api";
import ResidentAutocomplete from "@/components/ResidentAutocomplete";

export type PersuratanSubTab =
  | "studio"
  | "register"
  | "public_queue"
  | "templates";

interface DiffDocRow {
  doc_type: string;
  doc_number: string;
  written_name: string;
}

interface HeirRow {
  full_name: string;
  ttl: string;
  nik: string;
  occupation: string;
}

interface TemplateMeta {
  code: string;
  title: string;
  docHeading: string;
  classCode: string;
  sourceDocx: string;
  description: string;
  badge: string;
}

const OFFICIAL_TEMPLATES: TemplateMeta[] = [
  {
    code: "SK_UMUM",
    title: "1. Surat Keterangan Umum",
    docHeading: "SURAT KETERANGAN",
    classCode: "470",
    sourceDocx: "1. SURAT KETERANGAN UMUM.docx",
    description:
      "Surat keterangan domisili, pengantar administrasi bank, sekolah, usaha, atau keterangan penduduk Desa Ringdikit.",
    badge: "1 NIK Pemohon",
  },
  {
    code: "SK_KELAHIRAN",
    title: "2. Surat Keterangan Kelahiran",
    docHeading: "SURAT KETERANGAN KELAHIRAN",
    classCode: "472.11",
    sourceDocx: "2. SURAT KETERANGAN KELAHIRAN.docx",
    description:
      "Surat keterangan kelahiran anak kandung lengkap dengan data penolong kelahiran serta biodata Ibu dan Ayah.",
    badge: "Data Anak + Ibu & Ayah",
  },
  {
    code: "SK_KEMATIAN",
    title: "3. Surat Keterangan Kematian",
    docHeading: "SURAT KETERANGAN KEMATIAN",
    classCode: "472.12",
    sourceDocx: "3. SURAT KETERANGAN KEMATIAN.docx",
    description:
      "Surat keterangan kematian warga lengkap dengan data Pelapor, biodata Almarhum/ah, waktu/sebab kematian, & otomatis memutakhirkan status warga.",
    badge: "Pelapor + Almarhum (Auto-Mutasi)",
  },
  {
    code: "SK_BEDA_NAMA",
    title: "4. Surat Keterangan Beda Nama",
    docHeading: "SURAT KETERANGAN BEDA NAMA",
    classCode: "470",
    sourceDocx: "4. SURAT KETERANGAN BEDA NAMA.docx",
    description:
      "Menerangkan bahwa perbedaan penulisan nama pada beberapa dokumen (KTP, KK, Ijazah, Akta, Sertifikat) adalah milik satu orang yang sama.",
    badge: "Multi-Dokumen Pembanding",
  },
  {
    code: "SK_WARIS",
    title: "5. Surat Keterangan Waris",
    docHeading: "SURAT KETERANGAN WARIS",
    classCode: "474",
    sourceDocx: "5. SURAT KETERANGAN WARIS.docx",
    description:
      "Daftar kolektif para ahli waris sah (Multi-NIK dalam satu surat) beserta keterangan Pewaris yang telah meninggal dunia.",
    badge: "Multi-NIK Ahli Waris",
  },
];

function formatDateID(iso?: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function todayFormattedID(): string {
  return new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatBirthDateDDMMYYYY(isoDate?: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoDate;
}

interface LetterStudioManagerProps {
  initialSubTab?: PersuratanSubTab;
  onDataChanged?: () => void;
}

export default function LetterStudioManager({
  initialSubTab = "studio",
  onDataChanged,
}: LetterStudioManagerProps) {
  const [subTab, setSubTab] = useState<PersuratanSubTab>(initialSubTab);

  // Daftar surat & statistik dari backend
  const [letters, setLetters] = useState<ApiLetterRecord[]>([]);
  const [stats, setStats] = useState<ApiLetterStats>({
    total: 0,
    awaiting_signature: 0,
    completed_signed: 0,
    public_queue: 0,
  });
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // State Studio Buat Surat Baru
  const [selectedCode, setSelectedCode] = useState<string>("SK_UMUM");
  const [letterNumber, setLetterNumber] = useState<string>("");
  const [purpose, setPurpose] = useState<string>(
    "Persyaratan Administrasi Kependudukan"
  );
  const [savingLetter, setSavingLetter] = useState(false);
  const [studioBanner, setStudioBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [lastCreatedLetter, setLastCreatedLetter] =
    useState<ApiLetterRecord | null>(null);

  // Field Pemohon Utama (SK_UMUM / SK_BEDA_NAMA / Almarhum di SK_KEMATIAN)
  const [applicantName, setApplicantName] = useState("");
  const [applicantNIK, setApplicantNIK] = useState("");
  const [applicantNoKK, setApplicantNoKK] = useState("");
  const [applicantTTL, setApplicantTTL] = useState("");
  const [applicantGender, setApplicantGender] = useState("LAKI-LAKI");
  const [applicantReligion, setApplicantReligion] = useState("HINDU");
  const [applicantMarital, setApplicantMarital] = useState("KAWIN");
  const [applicantOccupation, setApplicantOccupation] = useState("WIRASWASTA");
  const [applicantAddress, setApplicantAddress] = useState(
    "BD. Kelodan Desa Ringdikit"
  );
  const [statementText, setStatementText] = useState(
    "Sepengetahuan kami memang benar orang tersebut di atas adalah penduduk Desa Ringdikit Kecamatan Seririt Kabupaten Buleleng."
  );

  // Field SK_KELAHIRAN
  const [childName, setChildName] = useState("");
  const [childOrder, setChildOrder] = useState("1 (Satu)");
  const [childBirthPlace, setChildBirthPlace] = useState(
    "Puskesmas Seririt I, Tanggal 19 November 2026"
  );
  const [childAddress, setChildAddress] = useState(
    "BD. Kelodan Desa Ringdikit"
  );
  const [birthHelperName, setBirthHelperName] = useState("Bidan Puskesmas");
  const [birthHelperAddr, setBirthHelperAddr] = useState("Kecamatan Seririt");
  const [motherNIK, setMotherNIK] = useState("");
  const [motherName, setMotherName] = useState("");
  const [motherTTL, setMotherTTL] = useState("");
  const [motherAddress, setMotherAddress] = useState(
    "BD. Kelodan Desa Ringdikit"
  );
  const [fatherNIK, setFatherNIK] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherTTL, setFatherTTL] = useState("");
  const [fatherAddress, setFatherAddress] = useState(
    "BD. Kelodan Desa Ringdikit"
  );

  // Field SK_KEMATIAN
  const [reporterNIK, setReporterNIK] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterAddress, setReporterAddress] = useState(
    "BD. Kelodan Desa Ringdikit"
  );
  const [reporterRelation, setReporterRelation] = useState("Anak Kandung");
  const [deathDayDate, setDeathDayDate] = useState("Kamis, 19 November 2026");
  const [deathPlace, setDeathPlace] = useState("Desa Ringdikit");
  const [deathCause, setDeathCause] = useState("Sakit");

  // Field SK_BEDA_NAMA
  const [diffDocs, setDiffDocs] = useState<DiffDocRow[]>([
    {
      doc_type: "KTP Elektronik",
      doc_number: "5108040101900001",
      written_name: "",
    },
    {
      doc_type: "Ijazah / Akta",
      doc_number: "DN-22/D-SD/001234",
      written_name: "",
    },
  ]);
  const [referenceDocName, setReferenceDocName] = useState(
    "Kartu Tanda Penduduk (KTP-el) dan Kartu Keluarga (KK)"
  );

  // Field SK_WARIS
  const [heirs, setHeirs] = useState<HeirRow[]>([]);
  const [pewarisNIK, setPewarisNIK] = useState("");
  const [pewarisName, setPewarisName] = useState("");
  const [pewarisDeathDate, setPewarisDeathDate] = useState("10 Januari 2026");
  const [pewarisDeathPlace, setPewarisDeathPlace] = useState("Desa Ringdikit");

  // Modal Unggah Berkas TTD / TTE
  const [uploadTarget, setUploadTarget] = useState<ApiLetterRecord | null>(
    null
  );
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSigType, setUploadSigType] = useState<"TTD_BASAH" | "TTE_BSRE">(
    "TTD_BASAH"
  );
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadingSigned, setUploadingSigned] = useState(false);

  const loadLetters = useCallback(async () => {
    setLoadingList(true);
    const res = await fetchLetters({
      status: statusFilter,
      q: searchQuery,
      limit: 100,
    });
    if (res.ok && res.data.items) {
      setLetters(res.data.items);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    }
    setLoadingList(false);
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadLetters();
  }, [loadLetters]);

  const activeTemplate =
    OFFICIAL_TEMPLATES.find((t) => t.code === selectedCode) ||
    OFFICIAL_TEMPLATES[0];

  const applyResidentToMainApplicant = (r: ApiResidentItem | null) => {
    if (!r) return;
    setApplicantName(r.full_name);
    setApplicantNIK(r.nik);
    setApplicantNoKK(r.no_kk || "");
    setApplicantTTL(
      `${r.birth_place}, ${formatBirthDateDDMMYYYY(r.birth_date)}`
    );
    setApplicantGender(r.gender === "P" ? "PEREMPUAN" : "LAKI-LAKI");
    setApplicantReligion((r.religion || "HINDU").toUpperCase());
    setApplicantMarital((r.marital_status || "KAWIN").toUpperCase());
    setApplicantOccupation((r.occupation || "WIRASWASTA").toUpperCase());
    setApplicantAddress(
      r.dusun_name
        ? `BD. ${r.dusun_name} Desa Ringdikit`
        : "Desa Ringdikit"
    );
    if (selectedCode === "SK_BEDA_NAMA" && diffDocs.length > 0) {
      const next = [...diffDocs];
      next[0] = {
        ...next[0],
        doc_number: r.nik,
        written_name: r.full_name,
      };
      setDiffDocs(next);
    }
  };

  const applyResidentToMother = (r: ApiResidentItem | null) => {
    if (!r) return;
    setMotherNIK(r.nik);
    setMotherName(r.full_name);
    setMotherTTL(`${r.birth_place}, ${formatBirthDateDDMMYYYY(r.birth_date)}`);
    const addr = r.dusun_name
      ? `BD. ${r.dusun_name} Desa Ringdikit`
      : "Desa Ringdikit";
    setMotherAddress(addr);
    setChildAddress(addr);
  };

  const applyResidentToFather = (r: ApiResidentItem | null) => {
    if (!r) return;
    setFatherNIK(r.nik);
    setFatherName(r.full_name);
    setFatherTTL(`${r.birth_place}, ${formatBirthDateDDMMYYYY(r.birth_date)}`);
    setFatherAddress(
      r.dusun_name
        ? `BD. ${r.dusun_name} Desa Ringdikit`
        : "Desa Ringdikit"
    );
  };

  const applyResidentToReporter = (r: ApiResidentItem | null) => {
    if (!r) return;
    setReporterNIK(r.nik);
    setReporterName(r.full_name);
    setReporterAddress(
      r.dusun_name
        ? `BD. ${r.dusun_name} Desa Ringdikit`
        : "Desa Ringdikit"
    );
  };

  const addHeirFromResident = (r: ApiResidentItem | null) => {
    if (!r) return;
    if (heirs.some((h) => h.nik === r.nik)) return;
    setHeirs((prev) => [
      ...prev,
      {
        full_name: r.full_name,
        ttl: `${r.birth_place}, ${formatBirthDateDDMMYYYY(r.birth_date)}`,
        nik: r.nik,
        occupation: r.occupation || "WIRASWASTA",
      },
    ]);
  };

  const handleSaveAndIssueLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudioBanner(null);
    setSavingLetter(true);

    let primaryNIK = applicantNIK;
    if (selectedCode === "SK_KELAHIRAN" && !primaryNIK) {
      primaryNIK = motherNIK || fatherNIK;
    } else if (selectedCode === "SK_WARIS" && !primaryNIK && heirs.length > 0) {
      primaryNIK = heirs[0].nik;
    }

    const dynamicPayload: Record<string, unknown> = {
      applicant_name:
        selectedCode === "SK_KELAHIRAN"
          ? motherName || fatherName || childName
          : selectedCode === "SK_WARIS" && heirs.length > 0
          ? heirs[0].full_name
          : applicantName,
      applicant_nik: primaryNIK,
      applicant_no_kk: applicantNoKK,
      applicant_ttl: applicantTTL,
      applicant_gender: applicantGender,
      applicant_religion: applicantReligion,
      applicant_marital: applicantMarital,
      applicant_occupation: applicantOccupation,
      applicant_address: applicantAddress,
      statement_text: statementText,
      extra_statement: statementText,

      // SK_KELAHIRAN
      child_name: childName,
      child_order: childOrder,
      child_birth_place: childBirthPlace,
      child_address: childAddress,
      birth_helper_name: birthHelperName,
      birth_helper_addr: birthHelperAddr,
      mother_nik: motherNIK,
      mother_name: motherName,
      mother_ttl: motherTTL,
      mother_address: motherAddress,
      father_nik: fatherNIK,
      father_name: fatherName,
      father_ttl: fatherTTL,
      father_address: fatherAddress,

      // SK_KEMATIAN
      reporter_nik: reporterNIK,
      reporter_name: reporterName,
      reporter_address: reporterAddress,
      reporter_relation: reporterRelation,
      deceased_name: applicantName,
      deceased_nik: applicantNIK,
      deceased_no_kk: applicantNoKK,
      deceased_ttl: applicantTTL,
      deceased_address: applicantAddress,
      death_day_date: deathDayDate,
      death_place: deathPlace,
      death_cause: deathCause,

      // SK_BEDA_NAMA
      diff_docs: diffDocs,
      reference_doc_name: referenceDocName,

      // SK_WARIS
      heirs,
      pewaris_nik: pewarisNIK,
      pewaris_name: pewarisName,
      pewaris_death_date: pewarisDeathDate,
      pewaris_death_place: pewarisDeathPlace,
    };

    const res = await createLetter({
      template_code: selectedCode,
      letter_number: letterNumber.trim() || undefined,
      applicant_nik: primaryNIK.trim() || undefined,
      source: "WALK_IN",
      purpose: purpose.trim() || "Keperluan Administrasi Kependudukan",
      dynamic_payload: dynamicPayload,
    });

    setSavingLetter(false);
    if (!res.ok || !res.data.letter) {
      setStudioBanner({
        type: "err",
        text: res.data.error || "Gagal menyimpan & menerbitkan surat.",
      });
      return;
    }

    setLastCreatedLetter(res.data.letter);
    setStudioBanner({
      type: "ok",
      text:
        res.data.message ||
        "Surat berhasil diterbitkan, siap diunduh dalam format PDF & DOCX, serta tercatat otomatis pada riwayat historis warga!",
    });
    await loadLetters();
    onDataChanged?.();
  };

  const handleUploadSignedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTarget || !uploadFile) return;
    setUploadingSigned(true);
    const res = await uploadSignedLetterFile(
      uploadTarget.id,
      uploadFile,
      uploadSigType,
      uploadNotes
    );
    setUploadingSigned(false);
    if (!res.ok || !res.data.letter) {
      alert(res.data.error || "Gagal mengunggah berkas surat TTD/TTE.");
      return;
    }
    if (lastCreatedLetter && lastCreatedLetter.id === res.data.letter.id) {
      setLastCreatedLetter(res.data.letter);
    }
    setUploadTarget(null);
    setUploadFile(null);
    setUploadNotes("");
    await loadLetters();
    onDataChanged?.();
  };

  const loadPublicRequestIntoStudio = (rec: ApiLetterRecord) => {
    setSelectedCode(rec.template_code);
    setLetterNumber(rec.letter_number || "");
    setPurpose(rec.purpose || "Keperluan Administrasi Kependudukan");
    setApplicantName(rec.applicant_name || "");
    setApplicantNIK(rec.applicant_nik || "");
    setApplicantAddress(
      rec.applicant_dusun
        ? `BD. ${rec.applicant_dusun} Desa Ringdikit`
        : "Desa Ringdikit"
    );
    setLastCreatedLetter(rec);
    setSubTab("studio");
  };

  const publicQueueItems = letters.filter((l) => l.source === "PUBLIC_FORM");

  return (
    <div className="space-y-4">
      {/* =====================================================================
          1. KARTU RINGKASAN STATISTIK PERSURATAN DESA
         ===================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="soft-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-ink-muted">
              Total Surat Terbit
            </div>
            <div className="font-display text-2xl font-bold text-ink tabular-nums mt-1">
              {stats.total}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Tercatat di Buku Register
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="soft-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-ink-muted">
              Menunggu TTD / TTE
            </div>
            <div className="font-display text-2xl font-bold text-[#D97706] tabular-nums mt-1">
              {stats.awaiting_signature}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Siap Cetak PDF & DOCX
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-pastel-honeySoft text-[#D97706] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="soft-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-ink-muted">
              Arsip Sah (TTD / TTE)
            </div>
            <div className="font-display text-2xl font-bold text-[#087F5B] tabular-nums mt-1">
              {stats.completed_signed}
            </div>
            <div className="text-[11px] text-[#087F5B] font-medium mt-0.5">
              Terdokumentasi di Historis Warga
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-pastel-mintSoft text-[#087F5B] flex items-center justify-center">
            <FileCheck2 className="w-5 h-5" />
          </div>
        </div>

        <div className="soft-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-ink-muted">
              Permohonan Online Warga
            </div>
            <div className="font-display text-2xl font-bold text-[#1971C2] tabular-nums mt-1">
              {stats.public_queue}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              Dari Portal Publik Desa
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-pastel-skySoft text-[#1971C2] flex items-center justify-center">
            <Inbox className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. SUB-MENU NAVIGASI PERSURATAN YANG LENGKAP & TERSTRUKTUR
         ===================================================================== */}
      <div className="soft-card p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab("studio")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              subTab === "studio"
                ? "bg-[#6741D9] text-white shadow-sm"
                : "text-ink-secondary hover:bg-[#F4F6FB]"
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            1. Buat & Cetak Surat Baru (PDF & DOCX)
          </button>

          <button
            type="button"
            onClick={() => setSubTab("register")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              subTab === "register"
                ? "bg-[#6741D9] text-white shadow-sm"
                : "text-ink-secondary hover:bg-[#F4F6FB]"
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            2. Buku Register & Unggah Arsip TTD / TTE
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                subTab === "register"
                  ? "bg-white/20 text-white"
                  : "bg-pastel-violetSoft text-[#6741D9]"
              }`}
            >
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("public_queue")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              subTab === "public_queue"
                ? "bg-[#6741D9] text-white shadow-sm"
                : "text-ink-secondary hover:bg-[#F4F6FB]"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            3. Antrean Permohonan Publik
            {publicQueueItems.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  subTab === "public_queue"
                    ? "bg-white/20 text-white"
                    : "bg-pastel-skySoft text-[#1971C2]"
                }`}
              >
                {publicQueueItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab("templates")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              subTab === "templates"
                ? "bg-[#6741D9] text-white shadow-sm"
                : "text-ink-secondary hover:bg-[#F4F6FB]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            4. Katalog 5 Format Surat Resmi
          </button>
        </div>

        <button
          type="button"
          onClick={loadLetters}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-ink-secondary hover:bg-[#F4F6FB]"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loadingList ? "animate-spin" : ""}`}
          />
          Segarkan
        </button>
      </div>

      {/* =====================================================================
          SUB-TAB 1: STUDIO BUAT & CETAK SURAT BARU (5 FORMAT RESMI RINGDIKIT)
         ===================================================================== */}
      {subTab === "studio" && (
        <div className="space-y-4">
          {/* Pemilih 5 Template Surat */}
          <div className="soft-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Pilih Format Surat Resmi Desa Ringdikit
                </h3>
                <p className="text-xs text-ink-muted">
                  Seluruh format disesuaikan 100% dengan standar dokumen resmi{" "}
                  <code className="font-mono text-[#6741D9]">
                    docs/referensi/format-surat/*.docx
                  </code>{" "}
                  Pemerintah Kabupaten Buleleng • Perbekel Ringdikit.
                </p>
              </div>
              <span className="text-[11px] font-semibold bg-pastel-mintSoft text-[#087F5B] px-2.5 py-1 rounded-lg">
                Otomatis Tercatat di Timeline Historis Warga
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {OFFICIAL_TEMPLATES.map((tpl) => {
                const active = selectedCode === tpl.code;
                return (
                  <button
                    key={tpl.code}
                    type="button"
                    onClick={() => {
                      setSelectedCode(tpl.code);
                      setStudioBanner(null);
                    }}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      active
                        ? "border-[#6741D9] bg-pastel-violetSoft/60 ring-2 ring-[#6741D9]/15"
                        : "border-line bg-white hover:bg-[#F8FAFD]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] font-bold text-[#6741D9] bg-white px-1.5 py-0.5 rounded border border-line">
                        Kode {tpl.classCode}
                      </span>
                      <span className="text-[10px] font-medium text-ink-muted">
                        {tpl.badge}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-ink mt-1.5">
                      {tpl.title}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Banner Sukses + Tombol Unduh PDF / DOCX & Unggah TTD/TTE */}
          {studioBanner && (
            <div
              className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                studioBanner.type === "ok"
                  ? "bg-pastel-mintSoft/80 border-pastel-mint/40 text-[#087F5B]"
                  : "bg-pastel-roseSoft border-pastel-rose/40 text-[#C92A2A]"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{studioBanner.text}</span>
                </div>
                {lastCreatedLetter && (
                  <p className="text-xs opacity-90">
                    Nomor Surat:{" "}
                    <strong className="font-mono">
                      {lastCreatedLetter.letter_number}
                    </strong>{" "}
                    • Kode Tiket:{" "}
                    <strong className="font-mono">
                      {lastCreatedLetter.ticket_code}
                    </strong>{" "}
                    • Status:{" "}
                    <strong>
                      {lastCreatedLetter.has_signed_file
                        ? "SAH (Arsip TTD/TTE Terunggah)"
                        : "Siap Dicetak / Menunggu TTD"}
                    </strong>
                  </p>
                )}
              </div>

              {lastCreatedLetter && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={getLetterPdfUrl(lastCreatedLetter.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#087F5B] text-white px-3.5 py-2 text-xs font-bold shadow-sm hover:bg-[#066649]"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh PDF (.pdf)
                  </a>
                  <a
                    href={getLetterDocxUrl(lastCreatedLetter.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1971C2] text-white px-3.5 py-2 text-xs font-bold shadow-sm hover:bg-[#145A9E]"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Unduh Word (.docx)
                  </a>
                  <button
                    type="button"
                    onClick={() => setUploadTarget(lastCreatedLetter)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#087F5B]/30 text-[#087F5B] px-3.5 py-2 text-xs font-bold hover:bg-white/80"
                  >
                    <Upload className="w-3.5 h-3.5" /> Unggah TTD / TTE
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Split View: Form Input Dinamis (Kiri) + Pratinjau Kertas A4 Resmi (Kanan) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* KOLOM KIRI: FORMULIR DINAMIS */}
            <form
              onSubmit={handleSaveAndIssueLetter}
              className="xl:col-span-5 soft-card p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#6741D9] uppercase tracking-wider">
                    Formulir Studio Persuratan
                  </span>
                  <h4 className="text-base font-bold text-ink mt-0.5">
                    {activeTemplate.title}
                  </h4>
                </div>
                <span className="font-mono text-xs text-ink-muted">
                  {activeTemplate.code}
                </span>
              </div>

              {/* Nomor Surat & Keperluan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Nomor Surat (Kosongkan = Otomatis)
                  </label>
                  <input
                    type="text"
                    value={letterNumber}
                    onChange={(e) => setLetterNumber(e.target.value)}
                    placeholder={`${activeTemplate.classCode} / 0001 / XI / 2026`}
                    className="soft-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Surat Digunakan Untuk *
                  </label>
                  <input
                    type="text"
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Contoh: Persyaratan Administrasi Bank"
                    className="soft-input text-xs"
                  />
                </div>
              </div>

              {/* =============================================================
                  FORM KHUSUS 1: SK_UMUM
                 ============================================================= */}
              {selectedCode === "SK_UMUM" && (
                <div className="space-y-3 pt-1">
                  <ResidentAutocomplete
                    label="Cari Warga Pemohon (Ketik 1 Huruf Nama / NIK)"
                    placeholder="Ketik nama atau NIK warga Desa Ringdikit..."
                    onSelect={applyResidentToMainApplicant}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        required
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        className="soft-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1">
                        NIK (16 Digit) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={16}
                        value={applicantNIK}
                        onChange={(e) =>
                          setApplicantNIK(e.target.value.replace(/\D/g, ""))
                        }
                        className="soft-input font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1">
                        Tempat, Tanggal Lahir
                      </label>
                      <input
                        type="text"
                        value={applicantTTL}
                        onChange={(e) => setApplicantTTL(e.target.value)}
                        placeholder="Ringdikit, 01-01-1990"
                        className="soft-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1">
                        Jenis Kelamin
                      </label>
                      <input
                        type="text"
                        value={applicantGender}
                        onChange={(e) => setApplicantGender(e.target.value)}
                        className="soft-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1">
                        Agama
                      </label>
                      <input
                        type="text"
                        value={applicantReligion}
                        onChange={(e) => setApplicantReligion(e.target.value)}
                        className="soft-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1">
                        Status Perkawinan
                      </label>
                      <input
                        type="text"
                        value={applicantMarital}
                        onChange={(e) => setApplicantMarital(e.target.value)}
                        className="soft-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1">
                        Pekerjaan
                      </label>
                      <input
                        type="text"
                        value={applicantOccupation}
                        onChange={(e) => setApplicantOccupation(e.target.value)}
                        className="soft-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1">
                        Alamat (Banjar Dinas)
                      </label>
                      <input
                        type="text"
                        value={applicantAddress}
                        onChange={(e) => setApplicantAddress(e.target.value)}
                        className="soft-input text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Isi Keterangan Surat
                    </label>
                    <textarea
                      rows={3}
                      value={statementText}
                      onChange={(e) => setStatementText(e.target.value)}
                      className="soft-input text-xs"
                    />
                  </div>
                </div>
              )}

              {/* =============================================================
                  FORM KHUSUS 2: SK_KELAHIRAN
                 ============================================================= */}
              {selectedCode === "SK_KELAHIRAN" && (
                <div className="space-y-3.5 pt-1">
                  <div className="rounded-xl bg-[#F8FAFD] border border-line p-3.5 space-y-3">
                    <div className="text-xs font-bold text-ink">
                      A. Data Kelahiran Anak
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Nama Lengkap Anak *
                        </label>
                        <input
                          type="text"
                          required
                          value={childName}
                          onChange={(e) => setChildName(e.target.value)}
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
                          value={childOrder}
                          onChange={(e) => setChildOrder(e.target.value)}
                          placeholder="1 (Satu) / 2 (Dua)"
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Dilahirkan di (Tempat & Tanggal Lahir Anak)
                        </label>
                        <input
                          type="text"
                          value={childBirthPlace}
                          onChange={(e) => setChildBirthPlace(e.target.value)}
                          placeholder="Puskesmas Seririt I, 19 November 2026"
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Penolong Kelahiran
                        </label>
                        <input
                          type="text"
                          value={birthHelperName}
                          onChange={(e) => setBirthHelperName(e.target.value)}
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-1">
                          Alamat Penolong
                        </label>
                        <input
                          type="text"
                          value={birthHelperAddr}
                          onChange={(e) => setBirthHelperAddr(e.target.value)}
                          className="soft-input bg-white text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F8FAFD] border border-line p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-ink">
                      B. Data Ibu Kandung ("Dari seorang Ibu")
                    </div>
                    <ResidentAutocomplete
                      label="Cari Data Ibu dari Tabel Penduduk"
                      placeholder="Ketik nama atau NIK Ibu..."
                      onSelect={applyResidentToMother}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="NIK Ibu"
                        value={motherNIK}
                        onChange={(e) => setMotherNIK(e.target.value)}
                        className="soft-input bg-white font-mono text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Nama Lengkap Ibu *"
                        required
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Tempat / Tanggal Lahir Ibu"
                        value={motherTTL}
                        onChange={(e) => setMotherTTL(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Alamat Ibu"
                        value={motherAddress}
                        onChange={(e) => setMotherAddress(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F8FAFD] border border-line p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-ink">
                      C. Data Ayah Kandung ("Istri dari")
                    </div>
                    <ResidentAutocomplete
                      label="Cari Data Ayah dari Tabel Penduduk"
                      placeholder="Ketik nama atau NIK Ayah..."
                      onSelect={applyResidentToFather}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="NIK Ayah"
                        value={fatherNIK}
                        onChange={(e) => setFatherNIK(e.target.value)}
                        className="soft-input bg-white font-mono text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Nama Lengkap Ayah *"
                        required
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Tempat / Tanggal Lahir Ayah"
                        value={fatherTTL}
                        onChange={(e) => setFatherTTL(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Alamat Ayah"
                        value={fatherAddress}
                        onChange={(e) => setFatherAddress(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================
                  FORM KHUSUS 3: SK_KEMATIAN
                 ============================================================= */}
              {selectedCode === "SK_KEMATIAN" && (
                <div className="space-y-3.5 pt-1">
                  <div className="rounded-xl bg-[#F8FAFD] border border-line p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-ink">
                      A. Data Pelapor ("Berdasarkan laporan dari")
                    </div>
                    <ResidentAutocomplete
                      label="Cari Warga Pelapor"
                      placeholder="Ketik nama atau NIK pelapor..."
                      onSelect={applyResidentToReporter}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        required
                        placeholder="Nama Pelapor *"
                        value={reporterName}
                        onChange={(e) => setReporterName(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Alamat Pelapor"
                        value={reporterAddress}
                        onChange={(e) => setReporterAddress(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Status Pelapor (Anak/Istri)"
                        value={reporterRelation}
                        onChange={(e) => setReporterRelation(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F8FAFD] border border-line p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-ink">
                      B. Data Warga yang Meninggal Dunia ("Menerangkan bahwa")
                    </div>
                    <ResidentAutocomplete
                      label="Cari Data Almarhum / Almarhumah"
                      placeholder="Ketik nama atau NIK warga..."
                      onSelect={applyResidentToMainApplicant}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        required
                        placeholder="Nama Almarhum/ah *"
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="NIK Almarhum/ah"
                        value={applicantNIK}
                        onChange={(e) => setApplicantNIK(e.target.value)}
                        className="soft-input bg-white font-mono text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Nomor Kartu Keluarga (KK)"
                        value={applicantNoKK}
                        onChange={(e) => setApplicantNoKK(e.target.value)}
                        className="soft-input bg-white font-mono text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Tempat, Tanggal Lahir"
                        value={applicantTTL}
                        onChange={(e) => setApplicantTTL(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F8FAFD] border border-line p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-ink">
                      C. Waktu, Tempat, & Sebab Kematian
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        placeholder="Hari / Tanggal Meninggal"
                        value={deathDayDate}
                        onChange={(e) => setDeathDayDate(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Tempat Kematian"
                        value={deathPlace}
                        onChange={(e) => setDeathPlace(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Sebab Kematian"
                        value={deathCause}
                        onChange={(e) => setDeathCause(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================
                  FORM KHUSUS 4: SK_BEDA_NAMA
                 ============================================================= */}
              {selectedCode === "SK_BEDA_NAMA" && (
                <div className="space-y-3.5 pt-1">
                  <ResidentAutocomplete
                    label="Cari Warga Pemohon Beda Nama"
                    placeholder="Ketik nama atau NIK warga..."
                    onSelect={applyResidentToMainApplicant}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      placeholder="Nama Pemohon *"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      className="soft-input text-xs"
                    />
                    <input
                      type="text"
                      placeholder="NIK (16 Digit)"
                      value={applicantNIK}
                      onChange={(e) => setApplicantNIK(e.target.value)}
                      className="soft-input font-mono text-xs"
                    />
                  </div>

                  <div className="rounded-xl bg-[#F8FAFD] border border-line p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">
                        Daftar Dokumen dengan Penulisan Nama Berbeda
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDiffDocs((prev) => [
                            ...prev,
                            {
                              doc_type: "Dokumen Lain",
                              doc_number: "",
                              written_name: applicantName,
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6741D9] hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Dokumen
                      </button>
                    </div>

                    {diffDocs.map((doc, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-line"
                      >
                        <input
                          type="text"
                          placeholder="Jenis Dokumen (KTP/Ijazah)"
                          value={doc.doc_type}
                          onChange={(e) => {
                            const next = [...diffDocs];
                            next[idx] = {
                              ...next[idx],
                              doc_type: e.target.value,
                            };
                            setDiffDocs(next);
                          }}
                          className="sm:col-span-4 soft-input text-xs py-1.5"
                        />
                        <input
                          type="text"
                          placeholder="Nomor Dokumen"
                          value={doc.doc_number}
                          onChange={(e) => {
                            const next = [...diffDocs];
                            next[idx] = {
                              ...next[idx],
                              doc_number: e.target.value,
                            };
                            setDiffDocs(next);
                          }}
                          className="sm:col-span-3 soft-input font-mono text-xs py-1.5"
                        />
                        <input
                          type="text"
                          placeholder="Nama Tertulis di Dokumen"
                          value={doc.written_name}
                          onChange={(e) => {
                            const next = [...diffDocs];
                            next[idx] = {
                              ...next[idx],
                              written_name: e.target.value,
                            };
                            setDiffDocs(next);
                          }}
                          className="sm:col-span-4 soft-input text-xs py-1.5"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDiffDocs((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="sm:col-span-1 flex items-center justify-center text-[#C92A2A] hover:bg-pastel-roseSoft rounded-lg"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Dokumen Acuan Nama yang Benar
                    </label>
                    <input
                      type="text"
                      value={referenceDocName}
                      onChange={(e) => setReferenceDocName(e.target.value)}
                      className="soft-input text-xs"
                    />
                  </div>
                </div>
              )}

              {/* =============================================================
                  FORM KHUSUS 5: SK_WARIS (MULTI-NIK AHLI WARIS)
                 ============================================================= */}
              {selectedCode === "SK_WARIS" && (
                <div className="space-y-3.5 pt-1">
                  <div className="rounded-xl bg-[#F8FAFD] border border-line p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-ink">
                      A. Tambah Daftar Ahli Waris (Multi-NIK Kolektif)
                    </div>
                    <ResidentAutocomplete
                      label="Cari & Tambahkan Ahli Waris dari Database Warga"
                      placeholder="Ketik 1 huruf nama atau NIK ahli waris..."
                      onSelect={addHeirFromResident}
                    />

                    <div className="space-y-2 pt-1">
                      {heirs.length === 0 ? (
                        <div className="text-xs text-ink-muted bg-white rounded-xl border border-dashed border-line p-3 text-center">
                          Belum ada ahli waris ditambahkan. Cari warga di atas
                          atau klik tombol tambah manual di bawah.
                        </div>
                      ) : (
                        heirs.map((h, idx) => (
                          <div
                            key={idx}
                            className="bg-white rounded-xl border border-line p-2.5 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#6741D9]">
                                Ahli Waris #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setHeirs((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                className="text-xs text-[#C92A2A] hover:underline inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Hapus
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Nama Ahli Waris"
                                value={h.full_name}
                                onChange={(e) => {
                                  const next = [...heirs];
                                  next[idx] = {
                                    ...next[idx],
                                    full_name: e.target.value,
                                  };
                                  setHeirs(next);
                                }}
                                className="soft-input text-xs py-1.5"
                              />
                              <input
                                type="text"
                                placeholder="NIK (16 Digit)"
                                value={h.nik}
                                onChange={(e) => {
                                  const next = [...heirs];
                                  next[idx] = {
                                    ...next[idx],
                                    nik: e.target.value,
                                  };
                                  setHeirs(next);
                                }}
                                className="soft-input font-mono text-xs py-1.5"
                              />
                              <input
                                type="text"
                                placeholder="Tempat / Tanggal Lahir"
                                value={h.ttl}
                                onChange={(e) => {
                                  const next = [...heirs];
                                  next[idx] = {
                                    ...next[idx],
                                    ttl: e.target.value,
                                  };
                                  setHeirs(next);
                                }}
                                className="soft-input text-xs py-1.5"
                              />
                              <input
                                type="text"
                                placeholder="Pekerjaan"
                                value={h.occupation}
                                onChange={(e) => {
                                  const next = [...heirs];
                                  next[idx] = {
                                    ...next[idx],
                                    occupation: e.target.value,
                                  };
                                  setHeirs(next);
                                }}
                                className="soft-input text-xs py-1.5"
                              />
                            </div>
                          </div>
                        ))
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setHeirs((prev) => [
                            ...prev,
                            {
                              full_name: "",
                              ttl: "",
                              nik: "",
                              occupation: "WIRASWASTA",
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#6741D9] hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Baris Ahli Waris
                        Manual
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F8FAFD] border border-line p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-ink">
                      B. Data Pewaris (Almarhum / Almarhumah)
                    </div>
                    <ResidentAutocomplete
                      label="Cari Pewaris dari Database Warga (Opsional)"
                      placeholder="Ketik nama pewaris..."
                      onSelect={(r) => {
                        if (!r) return;
                        setPewarisNIK(r.nik);
                        setPewarisName(r.full_name);
                      }}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        required
                        placeholder="Nama Pewaris *"
                        value={pewarisName}
                        onChange={(e) => setPewarisName(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Tanggal Meninggal"
                        value={pewarisDeathDate}
                        onChange={(e) => setPewarisDeathDate(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Tempat Meninggal"
                        value={pewarisDeathPlace}
                        onChange={(e) => setPewarisDeathPlace(e.target.value)}
                        className="soft-input bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-ink-muted">
                  Tersedia format <strong>.PDF</strong> &{" "}
                  <strong>.DOCX (Word)</strong>
                </span>
                <button
                  type="submit"
                  disabled={savingLetter}
                  className="soft-btn-primary text-xs px-5 py-2.5 disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {savingLetter
                    ? "Menerbitkan & Mencatat Historis..."
                    : "Simpan & Terbitkan Surat (PDF & DOCX)"}
                </button>
              </div>
            </form>

            {/* KOLOM KANAN: PRATINJAU KERTAS A4 RESMI SESUAI FOLDER 'FORMAT SURAT' */}
            <div className="xl:col-span-7 soft-card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#087F5B] uppercase tracking-wider">
                    Pratinjau Dokumen Resmi A4 • Sesuai{" "}
                    {activeTemplate.sourceDocx}
                  </span>
                  <h4 className="text-sm font-bold text-ink">
                    Kop Resmi Pemerintah Kabupaten Buleleng — Perbekel Ringdikit
                  </h4>
                </div>
                {lastCreatedLetter && (
                  <div className="flex items-center gap-2">
                    <a
                      href={getLetterPdfUrl(lastCreatedLetter.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-[#087F5B] text-white px-3 py-1.5 text-xs font-bold hover:bg-[#066649]"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </a>
                    <a
                      href={getLetterDocxUrl(lastCreatedLetter.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-[#1971C2] text-white px-3 py-1.5 text-xs font-bold hover:bg-[#145A9E]"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> DOCX
                    </a>
                  </div>
                )}
              </div>

              {/* Kanvas Kertas A4 */}
              <div className="bg-[#E9EEF6] rounded-xl p-4 sm:p-6 overflow-x-auto">
                <div className="bg-white mx-auto shadow-md border border-[#D8E0EE] rounded-sm p-6 sm:p-10 max-w-[680px] text-[#111827] font-serif text-[12.5px] leading-relaxed">
                  {/* KOP SURAT RESMI KABUPATEN BULELENG */}
                  <div className="flex items-center gap-4 pb-2.5 border-b-[3px] border-double border-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/logo-buleleng.jpg"
                      alt="Logo Kabupaten Buleleng"
                      className="w-16 h-16 object-contain shrink-0"
                    />
                    <div className="flex-1 text-center leading-snug">
                      <div className="text-[14px] font-bold tracking-wide uppercase">
                        PEMERINTAH KABUPATEN BULELENG
                      </div>
                      <div className="text-[14px] font-bold tracking-wide uppercase">
                        KECAMATAN SERIRIT
                      </div>
                      <div className="text-[16px] font-extrabold tracking-wider uppercase">
                        PERBEKEL RINGDIKIT
                      </div>
                      <div className="text-[11px] font-normal mt-0.5">
                        Jalan Seririt – Pupuan Desa Ringdikit 81153
                      </div>
                      <div className="text-[11px] font-normal">
                        Telp.+62 878 5875 5564 e-mail : desaringdikit@gmail.com
                      </div>
                    </div>
                  </div>

                  {/* JUDUL & NOMOR SURAT */}
                  <div className="text-center my-4">
                    <div className="text-[14px] font-bold underline tracking-wide uppercase">
                      {activeTemplate.docHeading}
                    </div>
                    <div className="text-[12px] font-semibold mt-0.5">
                      Nomor :{" "}
                      {letterNumber.trim() ||
                        lastCreatedLetter?.letter_number ||
                        `${activeTemplate.classCode} / .... / XI / 2026`}
                    </div>
                  </div>

                  {/* PEMBUKA PERBEKEL */}
                  <p className="mb-2">Yang bertanda tangan di bawah ini :</p>
                  <table className="w-full mb-3 text-[12.5px]">
                    <tbody>
                      <tr>
                        <td className="w-44 pl-4 py-0.5">Nama</td>
                        <td className="w-3">:</td>
                        <td className="font-bold">I Made Sumadi</td>
                      </tr>
                      <tr>
                        <td className="pl-4 py-0.5">Jabatan</td>
                        <td>:</td>
                        <td>Perbekel Ringdikit</td>
                      </tr>
                      {selectedCode === "SK_UMUM" && (
                        <tr>
                          <td className="pl-4 py-0.5">Alamat</td>
                          <td>:</td>
                          <td>Desa Ringdikit</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* ISI SURAT DINAMIS SESUAI 5 FORMAT */}
                  {selectedCode === "SK_UMUM" && (
                    <>
                      <p className="mb-2">Dengan ini menerangkan bahwa :</p>
                      <table className="w-full mb-3 text-[12.5px]">
                        <tbody>
                          <tr>
                            <td className="w-44 pl-4 py-0.5">Nama</td>
                            <td className="w-3">:</td>
                            <td className="font-semibold">
                              {applicantName || "........................................"}
                            </td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">NIK</td>
                            <td>:</td>
                            <td className="font-mono">
                              {applicantNIK || "........................................"}
                            </td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">
                              Tempat, tanggal lahir
                            </td>
                            <td>:</td>
                            <td>{applicantTTL || "-"}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Jenis Kelamin</td>
                            <td>:</td>
                            <td>{applicantGender}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Agama</td>
                            <td>:</td>
                            <td>{applicantReligion}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Status Perkawinan</td>
                            <td>:</td>
                            <td>{applicantMarital}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Pekerjaan</td>
                            <td>:</td>
                            <td>{applicantOccupation}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Alamat</td>
                            <td>:</td>
                            <td>{applicantAddress}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5 align-top">
                              Keterangan
                            </td>
                            <td className="align-top">:</td>
                            <td className="text-justify">{statementText}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5 align-top">
                              Surat Keterangan ini digunakan untuk
                            </td>
                            <td className="align-top">:</td>
                            <td className="font-semibold">{purpose}</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}

                  {selectedCode === "SK_KELAHIRAN" && (
                    <>
                      <p className="mb-2">Dengan ini menerangkan bahwa :</p>
                      <table className="w-full mb-2 text-[12.5px]">
                        <tbody>
                          <tr>
                            <td className="w-44 pl-4 py-0.5">
                              Nama lengkap anak
                            </td>
                            <td className="w-3">:</td>
                            <td className="font-bold">
                              {childName || "........................................"}
                            </td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Anak ke</td>
                            <td>:</td>
                            <td>{childOrder}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Dilahirkan di</td>
                            <td>:</td>
                            <td>{childBirthPlace}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Alamat Anak</td>
                            <td>:</td>
                            <td>{childAddress}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Penolong Kelahiran</td>
                            <td>:</td>
                            <td>{birthHelperName}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Alamat Penolong</td>
                            <td>:</td>
                            <td>{birthHelperAddr}</td>
                          </tr>
                        </tbody>
                      </table>

                      <p className="font-semibold mt-2 mb-1">
                        Dari seorang Ibu :
                      </p>
                      <table className="w-full mb-2 text-[12.5px]">
                        <tbody>
                          <tr>
                            <td className="w-44 pl-4 py-0.5">NIK</td>
                            <td className="w-3">:</td>
                            <td className="font-mono">{motherNIK || "-"}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Nama</td>
                            <td>:</td>
                            <td className="font-semibold">
                              {motherName || "........................................"}
                            </td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">
                              Tempat / tanggal lahir
                            </td>
                            <td>:</td>
                            <td>{motherTTL || "-"}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Alamat</td>
                            <td>:</td>
                            <td>{motherAddress}</td>
                          </tr>
                        </tbody>
                      </table>

                      <p className="font-semibold mt-2 mb-1">Istri dari :</p>
                      <table className="w-full mb-3 text-[12.5px]">
                        <tbody>
                          <tr>
                            <td className="w-44 pl-4 py-0.5">NIK</td>
                            <td className="w-3">:</td>
                            <td className="font-mono">{fatherNIK || "-"}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Nama</td>
                            <td>:</td>
                            <td className="font-semibold">
                              {fatherName || "........................................"}
                            </td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">
                              Tempat / tanggal lahir
                            </td>
                            <td>:</td>
                            <td>{fatherTTL || "-"}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Alamat</td>
                            <td>:</td>
                            <td>{fatherAddress}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">
                              Surat Keterangan ini digunakan untuk
                            </td>
                            <td>:</td>
                            <td className="font-semibold">{purpose}</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}

                  {selectedCode === "SK_KEMATIAN" && (
                    <>
                      <p className="mb-1">Berdasarkan laporan dari :</p>
                      <table className="w-full mb-2 text-[12.5px]">
                        <tbody>
                          <tr>
                            <td className="w-44 pl-4 py-0.5">Nama</td>
                            <td className="w-3">:</td>
                            <td className="font-semibold">
                              {reporterName || "........................................"}
                            </td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Alamat</td>
                            <td>:</td>
                            <td>{reporterAddress}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Status Pelapor</td>
                            <td>:</td>
                            <td>{reporterRelation}</td>
                          </tr>
                        </tbody>
                      </table>

                      <p className="mb-1">Menerangkan bahwa :</p>
                      <table className="w-full mb-2 text-[12.5px]">
                        <tbody>
                          <tr>
                            <td className="w-44 pl-4 py-0.5">Nama</td>
                            <td className="w-3">:</td>
                            <td className="font-bold">
                              {applicantName || "........................................"}
                            </td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">NIK</td>
                            <td>:</td>
                            <td className="font-mono">{applicantNIK || "-"}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">
                              Nomor Kartu Keluarga
                            </td>
                            <td>:</td>
                            <td className="font-mono">
                              {applicantNoKK || "-"}
                            </td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">
                              Tempat, tanggal lahir
                            </td>
                            <td>:</td>
                            <td>{applicantTTL || "-"}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Alamat</td>
                            <td>:</td>
                            <td>{applicantAddress}</td>
                          </tr>
                        </tbody>
                      </table>

                      <p className="mb-1">Telah meninggal dunia, pada :</p>
                      <table className="w-full mb-3 text-[12.5px]">
                        <tbody>
                          <tr>
                            <td className="w-44 pl-4 py-0.5">Hari / tanggal</td>
                            <td className="w-3">:</td>
                            <td>{deathDayDate}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Tempat Kematian</td>
                            <td>:</td>
                            <td>{deathPlace}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Kecamatan / Kab.</td>
                            <td>:</td>
                            <td>Seririt, Kabupaten Buleleng, Provinsi Bali</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">Sebab kematian</td>
                            <td>:</td>
                            <td>{deathCause}</td>
                          </tr>
                          <tr>
                            <td className="pl-4 py-0.5">
                              Surat Keterangan ini digunakan untuk
                            </td>
                            <td>:</td>
                            <td className="font-semibold">{purpose}</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}

                  {selectedCode === "SK_BEDA_NAMA" && (
                    <>
                      <p className="mb-2">Dengan ini menerangkan bahwa :</p>
                      <div className="space-y-2 mb-3 pl-4">
                        {diffDocs.map((d, i) => (
                          <div key={i} className="border-l-2 border-black/30 pl-3">
                            <div>
                              Berdasarkan dokumen{" "}
                              <strong>{d.doc_type || "Dokumen"}</strong> Nomor:{" "}
                              <span className="font-mono">
                                {d.doc_number || "-"}
                              </span>
                            </div>
                            <div>
                              Nama Tertulis :{" "}
                              <strong>
                                {d.written_name ||
                                  applicantName ||
                                  "...................."}
                              </strong>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mb-2 text-justify">
                        Nama-nama tersebut di atas milik satu orang adalah nama
                        yang tercantum dalam{" "}
                        <strong>{referenceDocName}</strong> atas nama{" "}
                        <strong>{applicantName || "...................."}</strong>{" "}
                        (NIK: <span className="font-mono">{applicantNIK || "-"}</span>
                        ).
                      </p>
                      <p className="mb-3">
                        Surat Keterangan ini digunakan untuk keperluan :{" "}
                        <strong>{purpose}</strong>.
                      </p>
                    </>
                  )}

                  {selectedCode === "SK_WARIS" && (
                    <>
                      <p className="mb-2">Dengan ini menerangkan bahwa :</p>
                      <div className="space-y-2 mb-3 pl-4">
                        {(heirs.length > 0
                          ? heirs
                          : [
                              {
                                full_name:
                                  applicantName || "....................",
                                ttl: applicantTTL || "-",
                                nik: applicantNIK || "-",
                                occupation: applicantOccupation || "-",
                              },
                            ]
                        ).map((h, i) => (
                          <table key={i} className="w-full text-[12px] border-b border-dashed border-gray-200 pb-1">
                            <tbody>
                              <tr>
                                <td className="w-40 font-semibold">
                                  {i + 1}. Nama Ahli Waris
                                </td>
                                <td className="w-3">:</td>
                                <td className="font-bold">{h.full_name}</td>
                              </tr>
                              <tr>
                                <td className="pl-4">Tempat/tanggal lahir</td>
                                <td>:</td>
                                <td>{h.ttl}</td>
                              </tr>
                              <tr>
                                <td className="pl-4">NIK / Pekerjaan</td>
                                <td>:</td>
                                <td>
                                  <span className="font-mono">{h.nik}</span> •{" "}
                                  {h.occupation}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        ))}
                      </div>
                      <p className="mb-2 text-justify">
                        Sepengetahuan kami, bahwa orang tersebut di atas adalah
                        benar ahli waris dari{" "}
                        <strong>
                          {pewarisName || "...................."}
                        </strong>{" "}
                        yang telah meninggal dunia pada tanggal{" "}
                        <strong>{pewarisDeathDate}</strong> di{" "}
                        <strong>{pewarisDeathPlace}</strong>.
                      </p>
                      <p className="mb-3">
                        Surat keterangan ini digunakan untuk keperluan :{" "}
                        <strong>{purpose}</strong>.
                      </p>
                    </>
                  )}

                  {/* PENUTUP & TANDA TANGAN PERBEKEL */}
                  <p className="text-justify mb-5">
                    Demikian surat keterangan ini dibuat dengan sebenarnya agar
                    dapat dipergunakan sebagaimana mestinya.
                  </p>

                  <div className="flex justify-end">
                    <div className="text-center w-56">
                      <div>Ringdikit, {todayFormattedID()}</div>
                      <div className="font-semibold">Perbekel Ringdikit</div>
                      <div className="h-16 flex items-center justify-center text-[10px] text-gray-400 italic">
                        {lastCreatedLetter?.has_signed_file
                          ? `[TERVERIFIKASI ${lastCreatedLetter.signature_type}]`
                          : "[Ruang TTD Basah / QR TTE]"}
                      </div>
                      <div className="font-bold underline">I Made Sumadi</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: BUKU REGISTER PERSURATAN & UNGGAH ARSIP TTD / TTE
         ===================================================================== */}
      {subTab === "register" && (
        <div className="soft-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-ink">
                Buku Register Surat Keluar & Dokumentasi Arsip TTD / TTE
              </h3>
              <p className="text-xs text-ink-muted">
                Unduh ulang surat dalam format <strong>.PDF</strong> maupun{" "}
                <strong>.DOCX</strong>, atau unggah surat yang telah
                ditandatangani (TTD Basah / TTE BSrE) agar otomatis tercatat
                pada <strong>Timeline Historis Warga</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nomor surat, nama, NIK..."
                  className="soft-input pl-8 text-xs w-56"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="soft-input text-xs w-44"
              >
                <option value="">Semua Status Surat</option>
                <option value="AWAITING_SIGNATURE">Menunggu TTD / TTE</option>
                <option value="COMPLETED">Sah (TTD / TTE Terunggah)</option>
                <option value="SUBMITTED">Permohonan Publik</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase text-ink-muted bg-[#F8FAFD]">
                  <th className="py-3 px-3">Nomor Surat & Tiket</th>
                  <th className="py-3 px-3">Jenis Surat</th>
                  <th className="py-3 px-3">Warga Terkait / Pemohon</th>
                  <th className="py-3 px-3">Keperluan</th>
                  <th className="py-3 px-3">Status & Arsip TTD/TTE</th>
                  <th className="py-3 px-3 text-right">
                    Unduh PDF / DOCX & Unggah TTD
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {letters.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-ink-muted"
                    >
                      Belum ada surat tercatat di Buku Register. Buat surat baru
                      melalui tab <strong>1. Buat & Cetak Surat Baru</strong>.
                    </td>
                  </tr>
                ) : (
                  letters.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[#F8FAFD] transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-ink">
                          {item.letter_number || "-"}
                        </div>
                        <div className="font-mono text-[11px] text-ink-muted">
                          {item.ticket_code} • {formatDateID(item.created_at)}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#6741D9] bg-pastel-violetSoft px-2 py-0.5 rounded-md text-[11px]">
                          {item.template_code}
                        </span>
                        <div className="font-medium text-ink mt-0.5">
                          {item.template_title}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-ink">
                          {item.applicant_name || "-"}
                        </div>
                        <div className="font-mono text-[11px] text-ink-muted">
                          NIK: {item.applicant_nik || "-"}
                          {item.applicant_dusun
                            ? ` • BD. ${item.applicant_dusun}`
                            : ""}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="text-ink line-clamp-2">
                          {item.purpose}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {item.has_signed_file ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-md bg-pastel-mintSoft px-2 py-0.5 text-[11px] font-bold text-[#087F5B]">
                              <CheckCircle2 className="w-3 h-3" /> Sah •{" "}
                              {item.signature_type === "TTE_BSRE"
                                ? "TTE BSrE"
                                : "TTD Basah"}
                            </span>
                            {item.signed_file_name && (
                              <div className="text-[11px] text-ink-muted truncate max-w-[170px]">
                                Berkas: {item.signed_file_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-pastel-honeySoft px-2 py-0.5 text-[11px] font-semibold text-[#D97706]">
                            <Clock className="w-3 h-3" /> Menunggu Unggah TTD/TTE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <a
                            href={getLetterPdfUrl(item.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-[#F4F6FB] border border-line px-2.5 py-1.5 text-[11px] font-bold text-ink hover:bg-[#087F5B] hover:text-white transition-colors"
                            title="Unduh Format PDF"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </a>
                          <a
                            href={getLetterDocxUrl(item.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-[#F4F6FB] border border-line px-2.5 py-1.5 text-[11px] font-bold text-ink hover:bg-[#1971C2] hover:text-white transition-colors"
                            title="Unduh Format Word (.docx)"
                          >
                            <FileSpreadsheet className="w-3 h-3" /> DOCX
                          </a>
                          <button
                            type="button"
                            onClick={() => setUploadTarget(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-pastel-violetSoft px-2.5 py-1.5 text-[11px] font-bold text-[#6741D9] hover:bg-[#6741D9] hover:text-white transition-colors"
                          >
                            <Upload className="w-3 h-3" />{" "}
                            {item.has_signed_file
                              ? "Perbarui TTD/TTE"
                              : "Unggah TTD/TTE"}
                          </button>
                          {item.has_signed_file && (
                            <a
                              href={getLetterSignedFileUrl(item.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-pastel-mintSoft px-2.5 py-1.5 text-[11px] font-bold text-[#087F5B] hover:bg-[#087F5B] hover:text-white transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" /> Lihat Arsip
                              Sah
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: ANTREAN PERMOHONAN ONLINE WARGA
         ===================================================================== */}
      {subTab === "public_queue" && (
        <div className="soft-card p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-ink">
              Antrean Permohonan Surat dari Portal Publik Warga
            </h3>
            <p className="text-xs text-ink-muted">
              Daftar permohonan surat yang diajukan mandiri oleh warga melalui
              halaman depan portal desa. Klik{" "}
              <strong>Buka & Cetak di Studio</strong> untuk memverifikasi dan
              mencetak PDF/DOCX.
            </p>
          </div>

          {publicQueueItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-8 text-center text-xs text-ink-muted">
              Belum ada permohonan surat dari portal publik yang menunggu
              antrean.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {publicQueueItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-line bg-[#F8FAFD] p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#1971C2]">
                        {item.ticket_code}
                      </span>
                      <span className="text-[11px] font-semibold bg-pastel-skySoft text-[#1971C2] px-2 py-0.5 rounded-md">
                        {item.template_title}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-ink">
                      {item.applicant_name || "Pemohon Warga"}
                    </div>
                    <div className="font-mono text-xs text-ink-muted">
                      NIK: {item.applicant_nik || "-"} • WA:{" "}
                      {item.applicant_wa || "-"}
                    </div>
                    <div className="text-xs text-ink-secondary pt-1">
                      <strong>Keperluan:</strong> {item.purpose}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
                    <button
                      type="button"
                      onClick={() => loadPublicRequestIntoStudio(item)}
                      className="soft-btn-primary text-xs py-1.5 px-3"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Buka & Cetak di
                      Studio
                    </button>
                    <a
                      href={getLetterPdfUrl(item.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="soft-btn-secondary text-xs py-1.5 px-3"
                    >
                      Unduh PDF
                    </a>
                    <a
                      href={getLetterDocxUrl(item.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="soft-btn-secondary text-xs py-1.5 px-3"
                    >
                      Unduh DOCX
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 4: KATALOG 5 FORMAT STANDAR SURAT DESA RINGDIKIT
         ===================================================================== */}
      {subTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {OFFICIAL_TEMPLATES.map((tpl) => (
            <div
              key={tpl.code}
              className="soft-card p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#6741D9] bg-pastel-violetSoft px-2.5 py-0.5 rounded-md">
                    Klasifikasi {tpl.classCode}
                  </span>
                  <span className="text-[11px] font-semibold text-[#087F5B] bg-pastel-mintSoft px-2 py-0.5 rounded-md">
                    PDF & DOCX Ready
                  </span>
                </div>
                <h4 className="text-base font-bold text-ink">{tpl.title}</h4>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  {tpl.description}
                </p>
                <div className="text-[11px] font-mono text-ink-muted pt-1">
                  Referensi: {tpl.sourceDocx}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCode(tpl.code);
                  setSubTab("studio");
                }}
                className="soft-btn-primary text-xs w-full justify-center"
              >
                <Printer className="w-3.5 h-3.5" /> Buat {tpl.title}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* =====================================================================
          MODAL UNGGAH BERKAS SURAT YANG SUDAH TTD BASAH / TTE BSrE
         ===================================================================== */}
      {uploadTarget && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-line shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ink">
                  Unggah & Dokumentasikan Surat Sah (TTD / TTE)
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  {uploadTarget.template_title} • No:{" "}
                  <span className="font-mono font-semibold">
                    {uploadTarget.letter_number}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadTarget(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:bg-[#F4F6FB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSignedSubmit} className="p-6 space-y-4">
              <div className="rounded-xl bg-pastel-mintSoft/60 border border-pastel-mint/40 p-3 text-xs text-[#087F5B]">
                <strong>Tercatat Otomatis di Historis Warga:</strong> Begitu
                berkas ini diunggah, status surat berubah menjadi{" "}
                <strong>SAH / COMPLETED</strong> dan otomatis muncul di{" "}
                <strong>Timeline Historis Penduduk</strong> (atas nama{" "}
                <strong>{uploadTarget.applicant_name || "Warga"}</strong>)
                lengkap dengan tautan arsipnya.
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Jenis Pengesahan Tanda Tangan *
                </label>
                <select
                  value={uploadSigType}
                  onChange={(e) =>
                    setUploadSigType(
                      e.target.value as "TTD_BASAH" | "TTE_BSRE"
                    )
                  }
                  className="soft-input text-xs"
                >
                  <option value="TTD_BASAH">
                    TTD Basah Perbekel & Stempel Basah Desa (Hasil Scan/Foto)
                  </option>
                  <option value="TTE_BSRE">
                    Tanda Tangan Elektronik (TTE BSrE / QR Tersertifikasi)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Pilih Berkas Surat yang Sudah Ditandatangani (.PDF / .JPG /
                  .PNG) *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    setUploadFile(e.target.files?.[0] || null)
                  }
                  className="soft-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Catatan Dokumentasi Arsip (Opsional)
                </label>
                <input
                  type="text"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Contoh: Ditandatangani oleh Perbekel I Made Sumadi & diserahkan ke pemohon"
                  className="soft-input text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setUploadTarget(null)}
                  className="soft-btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploadingSigned || !uploadFile}
                  className="soft-btn-primary text-xs disabled:opacity-60"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingSigned
                    ? "Mengunggah & Mencatat Historis..."
                    : "Simpan Arsip Sah & Catat Historis Warga"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
