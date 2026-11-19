"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Search, UserCheck, X } from "lucide-react";
import { ApiResidentItem, fetchResidents } from "@/lib/api";

interface ResidentAutocompleteProps {
  /** Warga terpilih saat ini (opsional bila dipakai sebagai lookup pengisi KK). */
  selected?: ApiResidentItem | null;
  onSelect: (resident: ApiResidentItem | null) => void;
  /** Filter dusun tertentu (opsional; untuk kepala_dusun server juga mengunci otomatis). */
  dusunId?: string;
  /** Filter status warga, default "" (semua) atau "AKTIF". */
  statusFilter?: string;
  /** Filter SHDK opsional, mis. "KEPALA KELUARGA". */
  shdkFilter?: string;
  placeholder?: string;
  helperText?: string;
  label?: string;
  /** Bila true, setelah memilih item tidak mengunci tampilan menjadi kartu tunggal (cocok untuk auto-fill KK/Alamat). */
  fillOnlyMode?: boolean;
}

function calcAgeYears(birthDate: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-pastel-honeySoft text-[#92400E] rounded px-0.5 font-bold">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function ResidentAutocomplete({
  selected = null,
  onSelect,
  dusunId = "",
  statusFilter = "",
  shdkFilter = "",
  placeholder = "Ketik nama warga, NIK, atau Nomor KK...",
  helperText,
  label,
  fillOnlyMode = false,
}: ResidentAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [items, setItems] = useState<ApiResidentItem[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [filledNotice, setFilledNotice] = useState<string>("");

  // Tutup dropdown saat klik di luar komponen
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Ambil daftar sugesti langsung saat fokus maupun saat mengetik >= 1 huruf
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      const res = await fetchResidents(
        query.trim(),
        10,
        0,
        dusunId,
        statusFilter,
        shdkFilter
      );
      if (cancelled) return;
      if (res.ok) {
        setItems(res.data.residents || []);
        setTotalMatches(res.data.total ?? 0);
        setActiveIndex(0);
      }
      setLoading(false);
    }, 140);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, dusunId, statusFilter, shdkFilter]);

  function chooseItem(item: ApiResidentItem) {
    onSelect(item);
    setOpen(false);
    if (fillOnlyMode) {
      setQuery("");
      setFilledNotice(
        `Terisi otomatis dari KK ${item.full_name} (${item.no_kk})`
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        items.length > 0 ? (prev + 1) % items.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        items.length > 0 ? (prev - 1 + items.length) % items.length : 0
      );
    } else if (e.key === "Enter") {
      if (items[activeIndex]) {
        e.preventDefault();
        chooseItem(items[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Mode Kartu Terpilih (ketika warga sudah diklik pada form mutasi/surat)
  if (selected && !fillOnlyMode) {
    const age = calcAgeYears(selected.birth_date);
    return (
      <div className="rounded-2xl bg-pastel-violetSoft/40 border border-pastel-violet/35 p-3.5 flex items-start justify-between gap-3 transition-all">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white border border-pastel-violet/25 text-[#6741D9] flex items-center justify-center shrink-0 mt-0.5">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-sm text-ink">
                {selected.full_name}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  selected.gender === "L"
                    ? "bg-pastel-aquaSoft text-[#0B7285]"
                    : "bg-pastel-violetSoft text-[#6741D9]"
                }`}
              >
                {selected.gender}
              </span>
              {age !== null && (
                <span className="text-[11px] text-ink-muted">({age} th)</span>
              )}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-line text-ink-secondary">
                {selected.shdk}
              </span>
            </div>
            <div className="font-mono text-xs text-ink-secondary mt-0.5 tabular-nums">
              NIK: {selected.nik} • KK: {selected.no_kk || "-"}
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              {selected.dusun_name
                ? `Banjar Dinas ${selected.dusun_name}`
                : "Belum Terpetakan"}{" "}
              • {selected.birth_place}, {selected.birth_date} •{" "}
              {selected.marital_status}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
            setTimeout(() => {
              setOpen(true);
              inputRef.current?.focus();
            }, 30);
          }}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white border border-line px-2.5 py-1.5 text-xs font-semibold text-[#6741D9] hover:bg-[#F8FAFC]"
        >
          Ganti Warga
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-semibold text-ink-secondary mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setFilledNotice("");
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="soft-input pl-9 pr-16"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <Loader2 className="w-3.5 h-3.5 text-[#6741D9] animate-spin" />
          )}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-ink-muted hover:text-ink"
              title="Bersihkan pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-1 rounded-md text-ink-muted hover:text-ink"
            title="Buka daftar sugesti warga"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {helperText && !filledNotice && (
        <p className="text-[11px] text-ink-muted mt-1">{helperText}</p>
      )}

      {filledNotice && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#099268]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {filledNotice}
        </div>
      )}

      {/* Floating Popover Sugesti Warga */}
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1.5 rounded-2xl bg-white border border-line shadow-xl overflow-hidden">
          <div className="px-3.5 py-2 bg-[#F8FAFD] border-b border-line flex items-center justify-between text-[11px] text-ink-muted">
            <span>
              {query.trim()
                ? `Ditemukan ${totalMatches.toLocaleString(
                    "id-ID"
                  )} warga yang cocok`
                : "Sugesti cepat warga (ketik nama atau NIK untuk menyaring)"}
            </span>
            <span className="hidden sm:inline font-mono text-[10px]">
              ↑↓ Pilih • Enter
            </span>
          </div>

          {loading && items.length === 0 ? (
            <div className="py-6 text-center text-xs text-ink-muted">
              Mencari data warga...
            </div>
          ) : items.length === 0 ? (
            <div className="py-6 px-4 text-center text-xs text-ink-muted">
              Tidak ditemukan warga dengan kata kunci{" "}
              <strong className="text-ink">&ldquo;{query}&rdquo;</strong>.
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y divide-line">
              {items.map((item, idx) => {
                const age = calcAgeYears(item.birth_date);
                const active = idx === activeIndex;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => chooseItem(item)}
                      className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-start justify-between gap-3 ${
                        active ? "bg-pastel-violetSoft/55" : "hover:bg-[#F9FBFF]"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm text-ink">
                            <HighlightMatch
                              text={item.full_name}
                              query={query}
                            />
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              item.gender === "L"
                                ? "bg-pastel-aquaSoft text-[#0B7285]"
                                : "bg-pastel-violetSoft text-[#6741D9]"
                            }`}
                          >
                            {item.gender}
                          </span>
                          {age !== null && (
                            <span className="text-[11px] text-ink-muted">
                              {age} th
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-ink-secondary tabular-nums mt-0.5">
                          NIK:{" "}
                          <HighlightMatch text={item.nik} query={query} /> • KK:{" "}
                          <HighlightMatch
                            text={item.no_kk || "-"}
                            query={query}
                          />
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F1F5F9] text-ink-secondary">
                          {item.shdk}
                        </span>
                        <div className="text-[10px] text-ink-muted mt-1">
                          {item.dusun_name
                            ? `Br. ${item.dusun_name}`
                            : "Tanpa Banjar"}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
