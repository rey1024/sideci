"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  FileCheck2,
  Plus,
  QrCode,
  Search,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  DEMO_RESIDENTS,
  LETTER_TEMPLATES,
  maskCitizenName,
} from "@/lib/ringdikit-data";

interface CreatedTicket {
  ticketCode: string;
  templateTitle: string;
  maskedApplicant: string;
  qrToken: string;
}

export default function PublicLetterSection({
  villageSlug = "ringdikit",
}: {
  villageSlug?: string;
}) {
  const [selectedCode, setSelectedCode] = useState<string>("SK_UMUM");
  const [nik, setNik] = useState<string>("5108020101900001");
  const [birthDate, setBirthDate] = useState<string>("1990-01-01");
  const [whatsapp, setWhatsapp] = useState<string>("081239001122");
  const [purpose, setPurpose] = useState<string>(
    "Melengkapi administrasi melamar pekerjaan"
  );

  const [babyName, setBabyName] = useState<string>("");
  const [motherNik, setMotherNik] = useState<string>("5108025405930002");
  const [fatherNik, setFatherNik] = useState<string>("5108020101900001");
  const [midwifeName, setMidwifeName] = useState<string>("Bidan Desa Ringdikit");

  const [reporterName, setReporterName] = useState<string>("");
  const [deathCause, setDeathCause] = useState<string>("Sakit");
  const [deathDate, setDeathDate] = useState<string>("2026-11-18");

  const [diffDocs, setDiffDocs] = useState<
    { docType: string; docNumber: string; writtenName: string }[]
  >([
    {
      docType: "KTP Elektronik",
      docNumber: "5108020101900001",
      writtenName: "I Putu Pratama Wijaya",
    },
    {
      docType: "Ijazah SLTA",
      docNumber: "DN-22 Mk 0041921",
      writtenName: "Putu Pratama Wijaya",
    },
  ]);

  const [heirNiks, setHeirNiks] = useState<string[]>([
    "5108025405930002",
    "5108020101900001",
  ]);

  const [formError, setFormError] = useState<string>("");
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);

  const [trackInput, setTrackInput] = useState<string>("SRT-RDK-261119-0042");
  const [trackedResult, setTrackedResult] = useState<{
    code: string;
    title: string;
    maskedName: string;
    step: number;
    qrToken: string;
  }>({
    code: "SRT-RDK-261119-0042",
    title: "Surat Keterangan Umum / Pengantar",
    maskedName: "I P*** P****** W*****",
    step: 3,
    qrToken: "rdk-9f42a81c",
  });

  const activeTemplate =
    LETTER_TEMPLATES.find((t) => t.code === selectedCode) || LETTER_TEMPLATES[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const cleanNik = nik.trim();
    if (!/^\d{16}$/.test(cleanNik)) {
      setFormError("NIK wajib terdiri dari tepat 16 angka.");
      return;
    }
    if (!birthDate) {
      setFormError("Tanggal lahir wajib diisi untuk memverifikasi kepemilikan NIK.");
      return;
    }
    if (whatsapp.trim().length < 9) {
      setFormError("Nomor WhatsApp aktif wajib diisi.");
      return;
    }

    const matchedResident = DEMO_RESIDENTS.find((r) => r.nik === cleanNik);
    const rawName = matchedResident
      ? matchedResident.fullName
      : "Warga Terdaftar Ringdikit";
    const masked = maskCitizenName(rawName);
    const randomSuffix = Math.floor(1000 + Math.random() * 8999);
    const newCode = `SRT-RDK-261119-${randomSuffix}`;
    const newQr = `rdk-${randomSuffix}ab9`;

    const ticket: CreatedTicket = {
      ticketCode: newCode,
      templateTitle: activeTemplate.title,
      maskedApplicant: masked,
      qrToken: newQr,
    };

    setCreatedTicket(ticket);
    setTrackInput(newCode);
    setTrackedResult({
      code: newCode,
      title: activeTemplate.title,
      maskedName: masked,
      step: 1,
      qrToken: newQr,
    });
  }

  function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    const code = trackInput.trim().toUpperCase();
    if (!code) return;
    if (createdTicket && code === createdTicket.ticketCode) {
      setTrackedResult({
        code: createdTicket.ticketCode,
        title: createdTicket.templateTitle,
        maskedName: createdTicket.maskedApplicant,
        step: 1,
        qrToken: createdTicket.qrToken,
      });
      return;
    }
    setTrackedResult({
      code,
      title: "Surat Keterangan Umum / Pengantar",
      maskedName: "I P*** P****** W*****",
      step: 3,
      qrToken: "rdk-9f42a81c",
    });
  }

  return (
    <section id="layanan-surat" className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-lg bg-pastel-violetSoft px-3 py-1 text-xs font-semibold text-[#6741D9]">
                Layanan Mandiri Warga
              </span>
              <span className="text-xs text-ink-muted">Tanpa perlu akun login</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
              Pengajuan & Pelacakan Surat Desa
            </h2>
          </div>

          <Link
            href={`/${villageSlug}/privacy-policy`}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-line px-4 py-2 shadow-soft hover:border-pastel-violet/40 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-pastel-mint shrink-0" />
            <span className="text-xs font-medium text-ink-secondary">
              Privasi terlindungi UU PDP •{" "}
              <span className="text-[#6741D9] font-semibold underline">
                Kebijakan Privasi
              </span>
            </span>
          </Link>
        </div>

        {/* Segmented Pill Selector 5 Jenis Surat */}
        <div className="soft-card p-2 flex flex-wrap gap-1.5">
          {LETTER_TEMPLATES.map((tpl) => {
            const active = tpl.code === selectedCode;
            return (
              <button
                key={tpl.code}
                type="button"
                onClick={() => {
                  setSelectedCode(tpl.code);
                  setCreatedTicket(null);
                }}
                className={
                  active
                    ? "pill-tab-active flex items-center gap-2"
                    : "pill-tab flex items-center gap-2"
                }
              >
                <span>{tpl.shortLabel}</span>
                <span
                  className="text-[11px] font-mono px-1.5 py-0.5 rounded-md"
                  style={{
                    backgroundColor: active ? "#FFFFFF" : tpl.badgeBg,
                    color: tpl.badgeColor,
                  }}
                >
                  {tpl.classification}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Kolom Kiri: Form Pengajuan Halus */}
          <div className="lg:col-span-7 soft-card p-6 sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="border-b border-line pb-4">
                <h3 className="text-base font-bold text-ink">
                  {activeTemplate.title}
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted mt-1">
                  {activeTemplate.description}
                </p>
              </div>

              {formError && (
                <div className="rounded-xl bg-pastel-coralSoft/70 border border-pastel-coral/30 px-4 py-3 text-xs sm:text-sm font-medium text-[#C92A2A]">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    {activeTemplate.mode === "death_report"
                      ? "NIK Warga Wafat (16 Digit)"
                      : "NIK Pemohon (16 Digit)"}
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={nik}
                    onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
                    className="soft-input font-mono"
                    placeholder="510802..."
                  />
                  <span className="text-[11px] text-ink-muted mt-1 block">
                    Contoh simulasi:{" "}
                    <code className="font-mono text-ink-secondary">
                      5108020101900001
                    </code>
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Tanggal Lahir (Verifikasi Identitas)
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="soft-input"
                  />
                </div>
              </div>

              {activeTemplate.mode === "birth_two_parents" && (
                <div className="rounded-2xl bg-pastel-mintSoft/55 border border-pastel-mint/20 p-4 space-y-3">
                  <div className="text-xs font-semibold text-[#099268]">
                    Data Kelahiran Bayi & 2 NIK Orang Tua
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-secondary mb-1">
                        Nama Lengkap Bayi / Anak
                      </label>
                      <input
                        type="text"
                        value={babyName}
                        onChange={(e) => setBabyName(e.target.value)}
                        placeholder="Contoh: Putu Saka Danendra"
                        className="soft-input bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-secondary mb-1">
                        Penolong Kelahiran
                      </label>
                      <input
                        type="text"
                        value={midwifeName}
                        onChange={(e) => setMidwifeName(e.target.value)}
                        className="soft-input bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-secondary mb-1">
                        NIK Ibu Kandung
                      </label>
                      <input
                        type="text"
                        maxLength={16}
                        value={motherNik}
                        onChange={(e) =>
                          setMotherNik(e.target.value.replace(/\D/g, ""))
                        }
                        className="soft-input bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-secondary mb-1">
                        NIK Ayah Kandung
                      </label>
                      <input
                        type="text"
                        maxLength={16}
                        value={fatherNik}
                        onChange={(e) =>
                          setFatherNik(e.target.value.replace(/\D/g, ""))
                        }
                        className="soft-input bg-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTemplate.mode === "death_report" && (
                <div className="rounded-2xl bg-pastel-coralSoft/45 border border-pastel-coral/25 p-4 space-y-3">
                  <div className="text-xs font-semibold text-[#E03131]">
                    Rincian Laporan Kematian (Sinkron ke Status Kependudukan)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-secondary mb-1">
                        Nama Pelapor
                      </label>
                      <input
                        type="text"
                        value={reporterName}
                        onChange={(e) => setReporterName(e.target.value)}
                        placeholder="Nama kerabat"
                        className="soft-input bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-secondary mb-1">
                        Tanggal Wafat
                      </label>
                      <input
                        type="date"
                        value={deathDate}
                        onChange={(e) => setDeathDate(e.target.value)}
                        className="soft-input bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-secondary mb-1">
                        Sebab Kematian
                      </label>
                      <input
                        type="text"
                        value={deathCause}
                        onChange={(e) => setDeathCause(e.target.value)}
                        className="soft-input bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTemplate.mode === "name_diff_docs" && (
                <div className="rounded-2xl bg-pastel-honeySoft/55 border border-pastel-honey/25 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#B45309]">
                      Daftar Dokumen Pembanding Nama
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDiffDocs([
                          ...diffDocs,
                          {
                            docType: "Akta Kelahiran",
                            docNumber: "",
                            writtenName: "",
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary bg-white border border-line rounded-lg px-2.5 py-1 hover:text-ink"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Dokumen
                    </button>
                  </div>
                  {diffDocs.map((doc, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={doc.docType}
                        onChange={(e) => {
                          const next = [...diffDocs];
                          next[idx].docType = e.target.value;
                          setDiffDocs(next);
                        }}
                        placeholder="Jenis Dokumen"
                        className="soft-input bg-white sm:col-span-4 text-xs"
                      />
                      <input
                        type="text"
                        value={doc.docNumber}
                        onChange={(e) => {
                          const next = [...diffDocs];
                          next[idx].docNumber = e.target.value;
                          setDiffDocs(next);
                        }}
                        placeholder="Nomor Dokumen"
                        className="soft-input bg-white font-mono sm:col-span-4 text-xs"
                      />
                      <div className="sm:col-span-4 flex gap-1.5">
                        <input
                          type="text"
                          value={doc.writtenName}
                          onChange={(e) => {
                            const next = [...diffDocs];
                            next[idx].writtenName = e.target.value;
                            setDiffDocs(next);
                          }}
                          placeholder="Nama Tercantum"
                          className="soft-input bg-white text-xs"
                        />
                        {diffDocs.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDiffDocs(diffDocs.filter((_, i) => i !== idx))
                            }
                            className="px-2 text-pastel-coral hover:bg-white rounded-lg"
                            aria-label="Hapus dokumen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTemplate.mode === "heirs_multi_nik" && (
                <div className="rounded-2xl bg-pastel-aquaSoft/55 border border-pastel-aqua/25 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0B7285]">
                      Daftar Multi-NIK Ahli Waris
                    </span>
                    <button
                      type="button"
                      onClick={() => setHeirNiks([...heirNiks, ""])}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary bg-white border border-line rounded-lg px-2.5 py-1 hover:text-ink"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Ahli Waris
                    </button>
                  </div>
                  <div className="space-y-2">
                    {heirNiks.map((hNik, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-ink-muted w-20 shrink-0">
                          Waris #{idx + 1}
                        </span>
                        <input
                          type="text"
                          maxLength={16}
                          value={hNik}
                          onChange={(e) => {
                            const next = [...heirNiks];
                            next[idx] = e.target.value.replace(/\D/g, "");
                            setHeirNiks(next);
                          }}
                          placeholder="16 digit NIK Ahli Waris"
                          className="soft-input bg-white font-mono text-xs"
                        />
                        {heirNiks.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setHeirNiks(heirNiks.filter((_, i) => i !== idx))
                            }
                            className="p-2 text-pastel-coral hover:bg-white rounded-lg"
                            aria-label="Hapus ahli waris"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Nomor WhatsApp Aktif
                  </label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="soft-input font-mono"
                    placeholder="0812..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                    Keperluan Surat
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="soft-input"
                    placeholder="Contoh: Persyaratan administrasi"
                  />
                </div>
              </div>

              <button type="submit" className="soft-btn-primary w-full py-3">
                <Send className="w-4 h-4" />
                Kirim Permohonan & Terbitkan Kode Tiket
              </button>

              {createdTicket && (
                <div className="rounded-2xl bg-pastel-mintSoft/70 border border-pastel-mint/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-[#099268] font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Permohonan diterima oleh Sekretariat Desa Ringdikit
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-ink-muted block">Kode Tiket:</span>
                      <span className="font-mono font-semibold text-ink text-sm">
                        {createdTicket.ticketCode}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-muted block">
                        Pemohon Terverifikasi:
                      </span>
                      <span className="font-semibold text-ink text-sm">
                        {createdTicket.maskedApplicant}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Kolom Kanan: Lacak Tiket & Penjelasan QR */}
          <div className="lg:col-span-5 space-y-5">
            <div className="soft-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pastel-aquaSoft text-[#0B7285] flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">
                    Lacak Progres Tiket Surat
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Pantau tahapan verifikasi hingga surat siap diunduh
                  </p>
                </div>
              </div>

              <form onSubmit={handleTrack} className="flex gap-2">
                <input
                  type="text"
                  value={trackInput}
                  onChange={(e) => setTrackInput(e.target.value)}
                  className="soft-input font-mono uppercase text-xs"
                  placeholder="SRT-RDK-..."
                />
                <button type="submit" className="soft-btn-primary shrink-0">
                  Lacak
                </button>
              </form>

              <div className="rounded-2xl bg-[#F9FAFD] border border-line p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
                  <div>
                    <div className="font-mono text-xs font-semibold text-[#6741D9]">
                      {trackedResult.code}
                    </div>
                    <div className="font-semibold text-ink text-sm mt-0.5">
                      {trackedResult.title}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-ink-secondary bg-white border border-line px-2.5 py-1 rounded-lg">
                    {trackedResult.maskedName}
                  </span>
                </div>

                <ol className="space-y-2.5 text-xs sm:text-sm">
                  {[
                    "Permohonan diterima & identitas cocok",
                    "Diverifikasi Operator Persuratan Desa",
                    "Disahkan Perbekel (QR Code & TTE/Basah)",
                  ].map((label, index) => {
                    const done = trackedResult.step >= index + 1;
                    return (
                      <li key={label} className="flex items-center gap-2.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                            done
                              ? "bg-pastel-mintSoft text-[#099268]"
                              : "bg-white border border-line text-ink-muted"
                          }`}
                        >
                          {done ? "✓" : index + 1}
                        </span>
                        <span
                          className={
                            done ? "font-medium text-ink" : "text-ink-muted"
                          }
                        >
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <div className="pt-2.5 flex items-center justify-between gap-2 border-t border-line text-xs">
                  <span className="text-ink-muted flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-ink-secondary" />
                    Cek keaslian QR:
                  </span>
                  <Link
                    href={`/verify/${trackedResult.qrToken}`}
                    className="font-semibold text-[#6741D9] hover:underline inline-flex items-center gap-1"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    /verify/{trackedResult.qrToken}
                  </Link>
                </div>
              </div>
            </div>

            <div className="soft-card p-5 bg-gradient-to-br from-white to-pastel-violetSoft/40">
              <div className="text-xs font-semibold text-[#6741D9] mb-1">
                Pengesahan Hybrid Fleksibel
              </div>
              <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
                Mendukung pencetakan PDF ber-<strong>QR Code Keaslian</strong>{" "}
                untuk tanda tangan basah berstempel maupun unggah dokumen yang
                telah ditandatangani secara elektronik (<strong>TTE BSrE</strong>).
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
