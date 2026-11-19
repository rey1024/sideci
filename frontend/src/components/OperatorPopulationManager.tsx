"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  ApiDusunItem,
  ApiPopulationStats,
  ApiResidentDetail,
  ApiResidentItem,
  createResident,
  deleteResident,
  fetchResidentDetail,
  fetchResidents,
  getLetterDocxUrl,
  getLetterPdfUrl,
  getLetterSignedFileUrl,
  recordResidentEvent,
  RecordResidentEventPayload,
  updateResident,
  UpsertResidentPayload,
} from "@/lib/api";
import SmartImportBox from "@/components/SmartImportBox";
import ResidentAutocomplete from "@/components/ResidentAutocomplete";

interface OperatorPopulationManagerProps {
  stats: ApiPopulationStats | null;
  dusuns: ApiDusunItem[];
  onDataChanged: () => void;
}

const RELIGION_OPTIONS = [
  "Hindu",
  "Islam",
  "Kristen",
  "Katolik",
  "Buddha",
  "Konghucu",
  "Kepercayaan",
];

const MARITAL_OPTIONS = [
  "BELUM KAWIN",
  "KAWIN",
  "CERAI HIDUP",
  "CERAI MATI",
];

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
  "LAINNYA",
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

const EVENT_TYPE_LABELS: Record<string, string> = {
  INITIAL_IMPORT: "Impor Awal SIAK",
  NEW_RESIDENT: "Penduduk Baru",
  UPDATE_BIODATA: "Perubahan Biodata",
  DATA_UPSERT: "Pemutakhiran Data",
  BIRTH: "Kelahiran",
  DEATH: "Kematian",
  MOVE_OUT: "Pindah Keluar",
  MOVE_IN: "Pindah Masuk",
  CHANGE_DUSUN: "Pindah Banjar / KK",
  MARRIAGE: "Perkawinan",
  DIVORCE: "Perceraian",
  LETTER_ISSUED: "Pembuatan Surat Desa",
  LETTER_SIGNED_UPLOADED: "Arsip Surat TTD / TTE Sah",
  RFID_PAIRED: "Pemetaan RFID KTP-el",
  GUESTBOOK_CHECKIN: "Kunjungan Buku Tamu Desa",
  OTHER_NOTE: "Catatan Administrasi",
};

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

const EMPTY_FORM: UpsertResidentPayload = {
  nik: "",
  no_kk: "",
  full_name: "",
  gender: "L",
  birth_place: "RINGDIKIT",
  birth_date: "1995-01-01",
  blood_type: "-",
  religion: "Hindu",
  marital_status: "BELUM KAWIN",
  shdk: "FAMILI LAIN",
  education: "SLTA/SEDERAJAT",
  occupation: "WIRASWASTA",
  father_name: "",
  mother_name: "",
  dusun_id: "",
  address: "DESA RINGDIKIT",
  postal_code: "81153",
  status: "AKTIF",
  event_type: "NEW_RESIDENT",
  event_date: new Date().toISOString().slice(0, 10),
  event_summary: "",
};

export default function OperatorPopulationManager({
  stats,
  dusuns,
  onDataChanged,
}: OperatorPopulationManagerProps) {
  const [rows, setRows] = useState<ApiResidentItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [dusunFilter, setDusunFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [limit, setLimit] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  const [showImporter, setShowImporter] = useState<boolean>(false);
  const [bannerMsg, setBannerMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  // Modal Create / Edit Resident
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UpsertResidentPayload>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");

  // Modal Detail & Timeline Historis
  const [detailTarget, setDetailTarget] = useState<ApiResidentDetail | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Modal Catat Mutasi / Peristiwa (seperti Kepala Dusun namun langsung tercatat di Desa)
  const [eventModalOpen, setEventModalOpen] = useState<boolean>(false);
  const [eventResident, setEventResident] = useState<ApiResidentItem | null>(
    null
  );
  const [eventType, setEventType] =
    useState<RecordResidentEventPayload["event_type"]>("DEATH");
  const [eventDate, setEventDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [eventSummary, setEventSummary] = useState<string>("");
  const [eventDusunId, setEventDusunId] = useState<string>("");
  const [eventNoKk, setEventNoKk] = useState<string>("");
  const [eventAddress, setEventAddress] = useState<string>("");
  const [eventMarital, setEventMarital] = useState<string>("KAWIN");
  const [eventShdk, setEventShdk] = useState<string>("");
  const [eventExtraNote, setEventExtraNote] = useState<string>("");
  const [eventSaving, setEventSaving] = useState<boolean>(false);
  const [eventError, setEventError] = useState<string>("");

  // Modal Konfirmasi Hapus
  const [deleteTarget, setDeleteTarget] = useState<ApiResidentItem | null>(
    null
  );
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchInput);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    const offset = (page - 1) * limit;
    const res = await fetchResidents(
      debouncedQuery,
      limit,
      offset,
      dusunFilter,
      statusFilter
    );
    if (res.ok) {
      setRows(res.data.residents || []);
      setTotal(res.data.total ?? 0);
    }
    setLoading(false);
  }, [debouncedQuery, limit, page, dusunFilter, statusFilter]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  async function openDetail(row: ApiResidentItem) {
    setDetailLoading(true);
    setDetailTarget({ ...row, events: [] });
    const det = await fetchResidentDetail(row.id);
    if (det.ok) {
      setDetailTarget(det.data);
    }
    setDetailLoading(false);
  }

  function openCreateModal() {
    setEditingId(null);
    setFormError("");
    setFormData({
      ...EMPTY_FORM,
      dusun_id: dusuns[0]?.id || "",
      event_date: new Date().toISOString().slice(0, 10),
    });
    setFormOpen(true);
  }

  async function openEditModal(row: ApiResidentItem) {
    setEditingId(row.id);
    setFormError("");
    // Muat detail penuh (termasuk ayah, ibu, gol darah)
    const det = await fetchResidentDetail(row.id);
    const src = det.ok ? det.data : row;
    setFormData({
      nik: src.nik,
      no_kk: src.no_kk || "",
      full_name: src.full_name,
      gender: src.gender,
      birth_place: src.birth_place || "",
      birth_date: src.birth_date || "1990-01-01",
      blood_type: src.blood_type || "-",
      religion: src.religion || "Hindu",
      marital_status: src.marital_status || "BELUM KAWIN",
      shdk: src.shdk || "FAMILI LAIN",
      education: src.education || "SLTA/SEDERAJAT",
      occupation: src.occupation || "",
      father_name: src.father_name || "",
      mother_name: src.mother_name || "",
      dusun_id: src.dusun_id || "",
      address: src.address || "",
      postal_code: "81153",
      status: src.status || "AKTIF",
      event_summary: "",
    });
    setFormOpen(true);
  }

  async function handleSaveResident(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (formData.nik.length !== 16 || formData.no_kk.length !== 16) {
      setFormError("NIK dan Nomor KK wajib tepat 16 digit angka.");
      return;
    }
    setFormSaving(true);
    try {
      const res = editingId
        ? await updateResident(editingId, formData)
        : await createResident(formData);

      if (!res.ok) {
        setFormError(res.data.error || "Gagal menyimpan data penduduk.");
        return;
      }

      const warnText = res.data.duplicate_head_warning
        ? " (Catatan: KK ini kini memiliki lebih dari 1 Kepala Keluarga aktif)."
        : "";
      setBannerMsg({
        kind: "ok",
        text: editingId
          ? `Biodata ${formData.full_name} berhasil diperbarui.${warnText}`
          : `Penduduk baru ${formData.full_name} berhasil ditambahkan ke database.${warnText}`,
      });
      setFormOpen(false);
      await loadTable();
      onDataChanged();
      if (detailTarget && editingId === detailTarget.id) {
        const refreshed = await fetchResidentDetail(editingId);
        if (refreshed.ok) setDetailTarget(refreshed.data);
      }
    } finally {
      setFormSaving(false);
    }
  }

  function openEventModal(row?: ApiResidentItem) {
    setEventError("");
    setEventResident(row || null);
    setEventType("DEATH");
    setEventDate(new Date().toISOString().slice(0, 10));
    setEventSummary("");
    setEventDusunId(row?.dusun_id || dusuns[0]?.id || "");
    setEventNoKk(row?.no_kk || "");
    setEventAddress(row?.address || "");
    setEventMarital("KAWIN");
    setEventShdk(row?.shdk || "");
    setEventExtraNote("");
    setEventModalOpen(true);
  }

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault();
    setEventError("");
    if (!eventResident) {
      setEventError("Pilih penduduk terlebih dahulu melalui kolom pencarian.");
      return;
    }
    if (!eventSummary.trim()) {
      setEventError("Keterangan rincian peristiwa wajib diisi.");
      return;
    }
    if (eventNoKk.trim() && eventNoKk.trim().length !== 16) {
      setEventError("Nomor KK tujuan harus 16 digit angka (atau kosongkan).");
      return;
    }

    setEventSaving(true);
    try {
      const payload: RecordResidentEventPayload = {
        event_type: eventType,
        event_date: eventDate,
        summary: eventSummary.trim(),
        dusun_id:
          eventType === "CHANGE_DUSUN" || eventType === "MOVE_IN"
            ? eventDusunId
            : undefined,
        no_kk: eventNoKk.trim() || undefined,
        address: eventAddress.trim() || undefined,
        marital_status:
          eventType === "MARRIAGE" || eventType === "DIVORCE"
            ? eventMarital
            : undefined,
        shdk: eventShdk.trim() || undefined,
        metadata: eventExtraNote.trim()
          ? { detail: eventExtraNote.trim() }
          : undefined,
      };

      const res = await recordResidentEvent(eventResident.id, payload);
      if (!res.ok) {
        setEventError(res.data.error || "Gagal mencatat peristiwa mutasi.");
        return;
      }

      setBannerMsg({
        kind: "ok",
        text: `Peristiwa ${
          EVENT_TYPE_LABELS[eventType] || eventType
        } untuk ${eventResident.full_name} berhasil dicatat ke historis kependudukan.`,
      });
      setEventModalOpen(false);
      await loadTable();
      onDataChanged();

      if (detailTarget && detailTarget.id === eventResident.id) {
        const refreshed = await fetchResidentDetail(eventResident.id);
        if (refreshed.ok) setDetailTarget(refreshed.data);
      }
    } finally {
      setEventSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteResident(deleteTarget.id);
      if (!res.ok) {
        setBannerMsg({
          kind: "err",
          text: res.data.error || "Gagal menghapus data penduduk.",
        });
      } else {
        setBannerMsg({
          kind: "ok",
          text: `Data penduduk ${deleteTarget.full_name} (${deleteTarget.nik}) telah dihapus.`,
        });
        if (detailTarget?.id === deleteTarget.id) {
          setDetailTarget(null);
        }
        await loadTable();
        onDataChanged();
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(total, page * limit);

  return (
    <div className="space-y-4">
      {bannerMsg && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 border ${
            bannerMsg.kind === "ok"
              ? "bg-pastel-mintSoft/80 border-pastel-mint/30 text-[#099268]"
              : "bg-pastel-coralSoft/80 border-pastel-coral/30 text-[#C92A2A]"
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="p-1 rounded-lg hover:bg-black/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Cepat Sebaran 5 Banjar Dinas */}
      <div className="soft-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setDusunFilter("");
              setPage(1);
            }}
            className={
              dusunFilter === ""
                ? "pill-tab-active text-xs py-1.5 px-3"
                : "pill-tab text-xs py-1.5 px-3 bg-[#F8FAFC]"
            }
          >
            Semua Wilayah (
            {(stats?.active_residents ?? total).toLocaleString("id-ID")})
          </button>

          {(stats?.dusuns || dusuns).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDusunFilter(d.id);
                setPage(1);
              }}
              className={
                dusunFilter === d.id
                  ? "pill-tab-active text-xs py-1.5 px-3"
                  : "pill-tab text-xs py-1.5 px-3 bg-[#F8FAFC]"
              }
            >
              Banjar {d.name} ({d.residents.toLocaleString("id-ID")})
            </button>
          ))}

          {(stats?.unmapped_dusun_count ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                setDusunFilter("UNMAPPED");
                setPage(1);
              }}
              className={
                dusunFilter === "UNMAPPED"
                  ? "rounded-xl px-3 py-1.5 text-xs font-semibold bg-[#B45309] text-white"
                  : "rounded-xl px-3 py-1.5 text-xs font-semibold bg-pastel-honeySoft text-[#B45309] hover:opacity-90"
              }
            >
              Belum Terpetakan ({stats?.unmapped_dusun_count})
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowImporter((v) => !v)}
          className="soft-btn-secondary text-xs py-2 px-3"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#099268]" />
          {showImporter ? "Tutup Panel Impor SIAK" : "Impor / Sinkron Excel SIAK"}
        </button>
      </div>

      {showImporter && (
        <div className="soft-card p-5">
          <SmartImportBox
            onImported={() => {
              loadTable();
              onDataChanged();
            }}
          />
        </div>
      )}

      {/* Kartu Utama Tabel Data Penduduk CRUD */}
      <div className="soft-card overflow-hidden">
        {/* Toolbar Pencarian, Filter Status & Tombol Tambah/Mutasi */}
        <div className="p-5 border-b border-line flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari NIK, Nomor KK, atau nama warga Ringdikit..."
                className="soft-input pl-9"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="soft-input sm:w-48"
            >
              <option value="">Semua Status Warga</option>
              <option value="AKTIF">Status: AKTIF</option>
              <option value="MENINGGAL">Status: MENINGGAL</option>
              <option value="PINDAH_KELUAR">Status: PINDAH KELUAR</option>
              <option value="TIDAK_AKTIF">Status: TIDAK AKTIF</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openEventModal()}
              className="soft-btn-secondary text-xs py-2.5 px-3.5 border-pastel-violet/30 text-[#6741D9] bg-pastel-violetSoft/40 hover:bg-pastel-violetSoft/70"
            >
              <Activity className="w-4 h-4" />
              Catat Mutasi / Kematian / Pindah
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="soft-btn-primary text-xs py-2.5 px-4"
            >
              <UserPlus className="w-4 h-4" />
              Tambah Penduduk
            </button>
          </div>
        </div>

        {/* Tabel Data Penduduk Responsif */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFD] border-b border-line text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                <th className="py-3.5 px-4">NIK & Nomor KK</th>
                <th className="py-3.5 px-4">Nama Lengkap & Tgl Lahir</th>
                <th className="py-3.5 px-4">Banjar Dinas & Alamat</th>
                <th className="py-3.5 px-4">SHDK & Kawin</th>
                <th className="py-3.5 px-4">Pendidikan & Pekerjaan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi CRUD & Mutasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-sm text-ink-muted"
                  >
                    Memuat data kependudukan Desa Ringdikit dari database...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-sm text-ink-muted"
                  >
                    Tidak ada data penduduk yang cocok dengan pencarian / filter
                    saat ini.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
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
                        title="Klik untuk memfilter seluruh anggota Kartu Keluarga ini"
                        className="font-mono text-[11px] text-[#6741D9] hover:underline tabular-nums mt-0.5"
                      >
                        KK: {r.no_kk || "-"}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-ink">{r.full_name}</span>
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
                      {r.dusun_name ? (
                        <span className="inline-block text-xs font-semibold text-ink">
                          Banjar Dinas {r.dusun_name}
                        </span>
                      ) : (
                        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-pastel-honeySoft text-[#B45309]">
                          Belum Terpetakan
                        </span>
                      )}
                      <div className="text-[11px] text-ink-muted line-clamp-1 max-w-[200px] mt-0.5">
                        {r.address || "-"}
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
                      <div className="text-xs text-ink line-clamp-1 max-w-[180px]">
                        {r.occupation || "-"}
                      </div>
                      <div className="text-[11px] text-ink-muted line-clamp-1 max-w-[180px] mt-0.5">
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
                          title="Detail Biodata & Timeline Historis"
                          onClick={() => openDetail(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:text-[#6741D9] hover:border-pastel-violet/40"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">Historis</span>
                        </button>

                        <button
                          type="button"
                          title="Catat Mutasi (Kematian, Pindah, Kawin, Pecah KK)"
                          onClick={() => openEventModal(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-pastel-violet/30 bg-pastel-violetSoft/45 px-2.5 py-1.5 text-xs font-semibold text-[#6741D9] hover:bg-pastel-violetSoft"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">Mutasi</span>
                        </button>

                        <button
                          type="button"
                          title="Edit Biodata Penduduk"
                          onClick={() => openEditModal(r)}
                          className="inline-flex items-center justify-center rounded-lg border border-line bg-white p-1.5 text-ink-secondary hover:text-ink hover:bg-[#F8FAFC]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          title="Hapus Baris Data"
                          onClick={() => setDeleteTarget(r)}
                          className="inline-flex items-center justify-center rounded-lg border border-line bg-white p-1.5 text-ink-muted hover:text-[#C92A2A] hover:border-pastel-coral/40 hover:bg-pastel-coralSoft/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Paginasi */}
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
                {total.toLocaleString("id-ID")}
              </strong>{" "}
              penduduk
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

      {/* =========================================================================
          MODAL 1: TAMBAH / EDIT BIODATA PENDUDUK (CRUD LENGKAP)
         ========================================================================= */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-line shadow-xl w-full max-w-3xl my-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ink">
                  {editingId
                    ? "Edit Biodata Penduduk Desa Ringdikit"
                    : "Tambah Data Penduduk Baru"}
                </h3>
                <p className="text-xs text-ink-muted">
                  Setiap perubahan tercatat otomatis ke dalam jejak historis
                  kependudukan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-lg text-ink-muted hover:bg-[#F4F6FB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveResident}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              {formError && (
                <div className="rounded-xl bg-pastel-coralSoft/80 border border-pastel-coral/30 px-4 py-3 text-xs font-medium text-[#C92A2A]">
                  {formError}
                </div>
              )}

              {!editingId && (
                <div className="space-y-3 rounded-xl bg-pastel-violetSoft/45 border border-pastel-violet/25 p-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#6741D9] mb-1">
                        Jenis Pencatatan Awal (Historis)
                      </label>
                      <select
                        value={formData.event_type || "NEW_RESIDENT"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            event_type: e.target.value,
                          })
                        }
                        className="soft-input bg-white"
                      >
                        <option value="NEW_RESIDENT">
                          Input Penduduk Baru (Reguler)
                        </option>
                        <option value="BIRTH">
                          Kelahiran Bayi Baru (Catat Historis Kelahiran)
                        </option>
                        <option value="MOVE_IN">
                          Warga Pindah Masuk (Catat Historis Pindah Masuk)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#6741D9] mb-1">
                        Tanggal Peristiwa
                      </label>
                      <input
                        type="date"
                        value={formData.event_date || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            event_date: e.target.value,
                          })
                        }
                        className="soft-input bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#6741D9] mb-1">
                      Bantu Isi Otomatis Nomor KK, Banjar & Alamat (Ketik Nama
                      Kepala Keluarga / Orang Tua)
                    </label>
                    <ResidentAutocomplete
                      fillOnlyMode
                      statusFilter="AKTIF"
                      placeholder="Ketik nama anggota KK yang sudah ada untuk menyalin No. KK, Banjar, & Alamat..."
                      onSelect={(refRes) => {
                        if (refRes) {
                          setFormData((prev) => ({
                            ...prev,
                            no_kk: refRes.no_kk || prev.no_kk,
                            dusun_id: refRes.dusun_id || prev.dusun_id,
                            address: refRes.address || prev.address,
                          }));
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    NIK (16 Digit) *
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    required
                    value={formData.nik}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nik: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="soft-input font-mono"
                    placeholder="510802..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Nomor Kartu Keluarga / KK (16 Digit) *
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    required
                    value={formData.no_kk}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        no_kk: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="soft-input font-mono"
                    placeholder="510802..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Nama Lengkap Sesuai KTP/KK *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        full_name: e.target.value.toUpperCase(),
                      })
                    }
                    className="soft-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Jenis Kelamin *
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        gender: e.target.value as "L" | "P",
                      })
                    }
                    className="soft-input"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Golongan Darah
                  </label>
                  <select
                    value={formData.blood_type || "-"}
                    onChange={(e) =>
                      setFormData({ ...formData, blood_type: e.target.value })
                    }
                    className="soft-input"
                  >
                    <option value="-">Tidak Tahu (-)</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Tempat Lahir *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.birth_place}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        birth_place: e.target.value.toUpperCase(),
                      })
                    }
                    className="soft-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Tanggal Lahir *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.birth_date}
                    onChange={(e) =>
                      setFormData({ ...formData, birth_date: e.target.value })
                    }
                    className="soft-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Agama
                  </label>
                  <select
                    value={formData.religion}
                    onChange={(e) =>
                      setFormData({ ...formData, religion: e.target.value })
                    }
                    className="soft-input"
                  >
                    {RELIGION_OPTIONS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Status Perkawinan
                  </label>
                  <select
                    value={formData.marital_status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        marital_status: e.target.value,
                      })
                    }
                    className="soft-input"
                  >
                    {MARITAL_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Status Hubungan Dalam Keluarga (SHDK)
                  </label>
                  <select
                    value={formData.shdk}
                    onChange={(e) =>
                      setFormData({ ...formData, shdk: e.target.value })
                    }
                    className="soft-input"
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
                    Banjar Dinas *
                  </label>
                  <select
                    value={formData.dusun_id || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, dusun_id: e.target.value })
                    }
                    className="soft-input"
                  >
                    <option value="">-- Pilih Banjar Dinas --</option>
                    {dusuns.map((d) => (
                      <option key={d.id} value={d.id}>
                        Banjar Dinas {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Pendidikan Terakhir
                  </label>
                  <select
                    value={formData.education}
                    onChange={(e) =>
                      setFormData({ ...formData, education: e.target.value })
                    }
                    className="soft-input"
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
                    Pekerjaan
                  </label>
                  <input
                    type="text"
                    value={formData.occupation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        occupation: e.target.value.toUpperCase(),
                      })
                    }
                    className="soft-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Nama Ayah Kandung
                  </label>
                  <input
                    type="text"
                    value={formData.father_name || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        father_name: e.target.value.toUpperCase(),
                      })
                    }
                    className="soft-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Nama Ibu Kandung
                  </label>
                  <input
                    type="text"
                    value={formData.mother_name || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        mother_name: e.target.value.toUpperCase(),
                      })
                    }
                    className="soft-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Alamat Domisili
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="soft-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Status Kependudukan
                  </label>
                  <select
                    value={formData.status || "AKTIF"}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="soft-input"
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="MENINGGAL">MENINGGAL</option>
                    <option value="PINDAH_KELUAR">PINDAH KELUAR</option>
                    <option value="TIDAK_AKTIF">TIDAK AKTIF</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Catatan Historis Pemutakhiran (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formData.event_summary || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        event_summary: e.target.value,
                      })
                    }
                    placeholder="Contoh: Perbaikan penulisan Banjar Dinas / Nomor KK sesuai KK terbaru"
                    className="soft-input"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="soft-btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="soft-btn-primary text-xs disabled:opacity-60"
                >
                  {formSaving
                    ? "Menyimpan..."
                    : editingId
                    ? "Simpan Perubahan"
                    : "Simpan Penduduk Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: CATAT MUTASI / PERISTIWA KEPENDUDUKAN (KEMATIAN, PINDAH, DSB.)
         ========================================================================= */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-line shadow-xl w-full max-w-xl my-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ink">
                  Catat Peristiwa & Mutasi Kependudukan
                </h3>
                <p className="text-xs text-ink-muted">
                  Otomatis memperbarui status warga & menambah jejak historis
                  permanen
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="p-1.5 rounded-lg text-ink-muted hover:bg-[#F4F6FB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
              {eventError && (
                <div className="rounded-xl bg-pastel-coralSoft/80 border border-pastel-coral/30 px-4 py-3 text-xs font-medium text-[#C92A2A]">
                  {eventError}
                </div>
              )}

              {/* Pemilihan Warga dengan Instant Autocomplete */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink-secondary">
                  Cari & Pilih Warga (Ketik Nama atau NIK) *
                </label>
                <ResidentAutocomplete
                  selected={eventResident}
                  onSelect={(cand) => {
                    setEventResident(cand);
                    if (cand) {
                      setEventDusunId(cand.dusun_id || dusuns[0]?.id || "");
                      setEventNoKk(cand.no_kk || "");
                      setEventAddress(cand.address || "");
                    }
                  }}
                  placeholder="Ketik nama warga (mis. Made, Ketut, Komang) atau NIK..."
                  helperText="Klik kolom pencarian atau ketik mulai 1 huruf untuk melihat daftar sugesti warga."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Kategori Peristiwa / Mutasi *
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) =>
                      setEventType(
                        e.target.value as RecordResidentEventPayload["event_type"]
                      )
                    }
                    className="soft-input"
                  >
                    <option value="DEATH">Kematian Warga (Status ➔ MENINGGAL)</option>
                    <option value="MOVE_OUT">
                      Pindah Keluar Desa (Status ➔ PINDAH KELUAR)
                    </option>
                    <option value="CHANGE_DUSUN">
                      Pindah Banjar Dinas / Pecah KK
                    </option>
                    <option value="MOVE_IN">
                      Pindah Masuk / Aktif Kembali
                    </option>
                    <option value="MARRIAGE">Perkawinan (Status ➔ KAWIN)</option>
                    <option value="DIVORCE">Perceraian (Cerai Hidup/Mati)</option>
                    <option value="OTHER_NOTE">Catatan Historis Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Tanggal Peristiwa *
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="soft-input"
                  />
                </div>
              </div>

              {(eventType === "CHANGE_DUSUN" || eventType === "MOVE_IN") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-xl bg-[#F8FAFD] border border-line p-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Banjar Dinas Tujuan
                    </label>
                    <select
                      value={eventDusunId}
                      onChange={(e) => setEventDusunId(e.target.value)}
                      className="soft-input bg-white"
                    >
                      {dusuns.map((d) => (
                        <option key={d.id} value={d.id}>
                          Banjar Dinas {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      Nomor KK Baru (Opsional 16 Digit)
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={eventNoKk}
                      onChange={(e) =>
                        setEventNoKk(e.target.value.replace(/\D/g, ""))
                      }
                      className="soft-input bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              {eventType === "DIVORCE" && (
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    Status Pasca Perceraian
                  </label>
                  <select
                    value={eventMarital}
                    onChange={(e) => setEventMarital(e.target.value)}
                    className="soft-input"
                  >
                    <option value="CERAI HIDUP">CERAI HIDUP</option>
                    <option value="CERAI MATI">CERAI MATI</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Uraian / Ringkasan Historis *
                </label>
                <textarea
                  rows={3}
                  required
                  value={eventSummary}
                  onChange={(e) => setEventSummary(e.target.value)}
                  placeholder={
                    eventType === "DEATH"
                      ? "Contoh: Meninggal dunia di RSUD Buleleng, pelapor anak kandung sesuai surat pengantar Kelian Banjar."
                      : eventType === "MOVE_OUT"
                      ? "Contoh: Pindah domisili mengikuti keluarga ke Kota Denpasar sesuai SKPWNI."
                      : "Tulis ringkasan peristiwa, nomor surat pengantar, atau keterangan dokumen..."
                  }
                  className="soft-input"
                />
              </div>

              {(eventType === "MOVE_OUT" || eventType === "DEATH") && (
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    {eventType === "MOVE_OUT"
                      ? "Alamat Tujuan Pindah (Opsional)"
                      : "Tempat / Nomor Surat Kematian (Opsional)"}
                  </label>
                  <input
                    type="text"
                    value={eventExtraNote}
                    onChange={(e) => setEventExtraNote(e.target.value)}
                    className="soft-input"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="soft-btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={eventSaving}
                  className="soft-btn-primary text-xs disabled:opacity-60"
                >
                  {eventSaving
                    ? "Menyimpan..."
                    : "Simpan Mutasi & Catat Historis"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: DETAIL LENGKAP & TIMELINE HISTORIS PENDUDUK
         ========================================================================= */}
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
                  {detailTarget.rfid_uid ? (
                    <span className="ml-2 inline-flex items-center rounded bg-pastel-violetSoft px-2 py-0.5 text-[11px] font-bold text-[#6741D9]">
                      RFID KTP-el: {detailTarget.rfid_uid}
                    </span>
                  ) : null}
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
                    {detailTarget.dusun_name
                      ? `Banjar Dinas ${detailTarget.dusun_name}`
                      : "Belum Terpetakan"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#6741D9]" />
                  <h4 className="text-sm font-bold text-ink">
                    Timeline Historis Peristiwa & Mutasi
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(detailTarget)}
                    className="soft-btn-secondary text-xs py-1.5 px-3"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Biodata
                  </button>
                  <button
                    type="button"
                    onClick={() => openEventModal(detailTarget)}
                    className="soft-btn-primary text-xs py-1.5 px-3"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Historis / Mutasi
                  </button>
                </div>
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
                  {detailTarget.events.map((ev) => {
                    const meta = (ev.metadata || {}) as Record<string, unknown>;
                    const letterId =
                      typeof meta.letter_id === "string" ? meta.letter_id : "";
                    const hasSigned =
                      ev.event_type === "LETTER_SIGNED_UPLOADED" ||
                      Boolean(meta.has_signed_file);
                    return (
                      <li key={ev.id} className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[#6741D9]">
                            {ev.event_date}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                              ev.event_type === "LETTER_SIGNED_UPLOADED"
                                ? "bg-pastel-mintSoft text-[#087F5B]"
                                : ev.event_type === "LETTER_ISSUED"
                                ? "bg-pastel-skySoft text-[#1971C2]"
                                : "bg-pastel-violetSoft text-[#6741D9]"
                            }`}
                          >
                            {EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-ink">
                          {ev.summary}
                        </div>
                        {letterId && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {hasSigned && (
                              <a
                                href={getLetterSignedFileUrl(letterId)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-pastel-mintSoft px-2.5 py-1 text-[11px] font-semibold text-[#087F5B] hover:bg-[#087F5B]/15"
                              >
                                Lihat Arsip TTD / TTE Sah
                              </a>
                            )}
                            <a
                              href={getLetterPdfUrl(letterId)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[#F4F6FB] border border-line px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-pastel-violetSoft hover:text-[#6741D9]"
                            >
                              Unduh PDF
                            </a>
                            <a
                              href={getLetterDocxUrl(letterId)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[#F4F6FB] border border-line px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-pastel-skySoft hover:text-[#1971C2]"
                            >
                              Unduh DOCX
                            </a>
                          </div>
                        )}
                        <div className="text-[11px] text-ink-muted">
                          Dicatat oleh: {ev.actor_name}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: KONFIRMASI HAPUS BARIS PENDUDUK
         ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-line shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-ink">
              Hapus Data Penduduk?
            </h3>
            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
              Anda akan menghapus permanen baris data{" "}
              <strong className="text-ink">{deleteTarget.full_name}</strong>{" "}
              (NIK: <span className="font-mono">{deleteTarget.nik}</span>).
            </p>
            <div className="rounded-xl bg-pastel-honeySoft/70 border border-pastel-honey/30 p-3 text-xs text-[#B45309]">
              <strong>Tips Administrasi Desa:</strong> Gunakan fitur{" "}
              <strong>Mutasi</strong> (bukan Hapus) apabila warga meninggal atau
              pindah keluar agar rekam jejak historis tetap tersimpan. Gunakan
              Hapus hanya untuk data salah input atau duplikat.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="soft-btn-secondary text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="rounded-xl bg-[#C92A2A] hover:bg-[#A61E1E] text-white font-semibold text-xs px-4 py-2.5 transition-colors disabled:opacity-60"
              >
                {deleting ? "Menghapus..." : "Ya, Hapus Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
