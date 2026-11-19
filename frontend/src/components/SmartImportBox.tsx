"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { importResidentsXlsx, SIAKImportReport } from "@/lib/api";

export default function SmartImportBox({
  onImported,
}: {
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SIAKImportReport | null>(null);
  const [message, setMessage] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  async function runImport(dryRun: boolean) {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await importResidentsXlsx(file, dryRun);
      if (!res.ok) {
        setMessage({
          tone: "err",
          text: res.data.error || "Gagal memproses berkas Excel.",
        });
        return;
      }
      if (res.data.report) setReport(res.data.report);
      if (!dryRun) {
        setMessage({
          tone: "ok",
          text: `Berhasil mengimpor ${res.data.imported_count?.toLocaleString(
            "id-ID"
          )} penduduk ke PostgreSQL!`,
        });
        onImported();
      }
    } catch {
      setMessage({
        tone: "err",
        text: "Tidak dapat menghubungi server backend.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-[#F9FAFD] border border-line p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-[#099268]" />
          <span className="text-xs sm:text-sm font-semibold text-ink">
            Smart Excel SIAK Importer (Normalisasi Kode & Auto-Heal Banjar)
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs font-semibold text-[#6741D9] bg-pastel-violetSoft px-3 py-1 rounded-lg hover:bg-pastel-violetTrack transition-colors"
        >
          {open ? "Tutup Importer" : "Unggah Excel SIAK"}
        </button>
      </div>

      {open && (
        <div className="pt-2 border-t border-line space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setReport(null);
                setMessage(null);
              }}
              className="soft-input bg-white text-xs py-2"
            />
            <button
              type="button"
              disabled={!file || loading}
              onClick={() => runImport(true)}
              className="soft-btn-secondary text-xs shrink-0 disabled:opacity-50"
            >
              Pratinjau & Cek Anomali
            </button>
            {report && (
              <button
                type="button"
                disabled={loading}
                onClick={() => runImport(false)}
                className="soft-btn-primary text-xs shrink-0 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" /> Simpan ke Database
              </button>
            )}
          </div>

          {message && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 ${
                message.tone === "ok"
                  ? "bg-pastel-mintSoft text-[#099268]"
                  : "bg-pastel-coralSoft text-[#C92A2A]"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{message.text}</span>
            </div>
          )}

          {report && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-xl bg-white border border-line p-2.5">
                  <div className="text-ink-muted">Baris Valid</div>
                  <div className="font-bold text-sm tabular-nums text-ink">
                    {report.valid_rows.toLocaleString("id-ID")} /{" "}
                    {report.total_rows.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-line p-2.5">
                  <div className="text-ink-muted">Kartu Keluarga</div>
                  <div className="font-bold text-sm tabular-nums text-ink">
                    {report.unique_households.toLocaleString("id-ID")} KK
                  </div>
                </div>
                <div className="rounded-xl bg-pastel-mintSoft/60 border border-pastel-mint/20 p-2.5">
                  <div className="text-[#099268]">Banjar Auto-Healed</div>
                  <div className="font-bold text-sm tabular-nums text-[#099268]">
                    {report.auto_healed_dusun_count} baris
                  </div>
                </div>
                <div className="rounded-xl bg-pastel-honeySoft/60 border border-pastel-honey/25 p-2.5">
                  <div className="text-[#B45309]">Perlu Cek Manual</div>
                  <div className="font-bold text-sm tabular-nums text-[#B45309]">
                    {report.unmapped_dusun_count} dusun •{" "}
                    {report.duplicate_kk_head_count} KK ganda
                  </div>
                </div>
              </div>

              {report.anomalies && report.anomalies.length > 0 && (
                <div className="rounded-xl bg-white border border-line p-3 max-h-36 overflow-y-auto space-y-1 text-[11px]">
                  <div className="font-semibold text-ink-secondary flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-pastel-honey" />
                    Sampel Catatan Pembersihan Data ({report.anomalies.length}):
                  </div>
                  {report.anomalies.slice(0, 8).map((a, idx) => (
                    <div key={idx} className="text-ink-muted">
                      <span className="font-mono text-ink-secondary">
                        Baris {a.row_number || "-"} [{a.code}]:
                      </span>{" "}
                      {a.detail}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
