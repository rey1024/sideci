"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Award, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from "lucide-react";

const STORAGE_KEY = "sideci_demo_access_v1";
const EXPECTED_CODE =
  process.env.NEXT_PUBLIC_DEMO_ACCESS_CODE?.trim() || "SideciHarmoni";

export default function DemoAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const [checked, setChecked] = useState<boolean>(false);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [code, setCode] = useState<string>("");
  const [rememberCache, setRememberCache] = useState<boolean>(true);
  const [showPass, setShowPass] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Biarkan halaman kebijakan privasi tetap dapat dibaca publik bila diperlukan
  const isExempt = pathname.endsWith("/privacy-policy");

  useEffect(() => {
    try {
      const savedLocal = localStorage.getItem(STORAGE_KEY)?.trim();
      const savedSession = sessionStorage.getItem(STORAGE_KEY)?.trim();
      if (savedLocal === EXPECTED_CODE || savedSession === EXPECTED_CODE) {
        setUnlocked(true);
      }
    } catch {
      /* penyimpanan browser dibatasi */
    } finally {
      setChecked(true);
    }
  }, []);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleaned = code.trim();
    setCode(cleaned);

    if (cleaned !== EXPECTED_CODE) {
      setError("Kode akses demo tidak sesuai. Silakan periksa kembali.");
      return;
    }

    try {
      if (rememberCache) {
        localStorage.setItem(STORAGE_KEY, EXPECTED_CODE);
      } else {
        sessionStorage.setItem(STORAGE_KEY, EXPECTED_CODE);
      }
    } catch {
      /* abaikan bila mode privat menolak storage */
    }
    setUnlocked(true);
  }

  if (isExempt) {
    return <>{children}</>;
  }

  // Jangan tampilkan dashboard sebelum pengecekan cache selesai (mencegah flash)
  if (!checked) {
    return (
      <div className="min-h-screen bg-[#132952] flex items-center justify-center p-4">
        <div className="text-xs font-medium text-[#9BB2DE]">
          Memuat portal SIDECI...
        </div>
      </div>
    );
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#132952] flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden">
      {/* Dekorasi cahaya halus */}
      <div
        className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#254A8F]/40 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#1E3F7A]/40 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div />

      <div className="w-full max-w-md mx-auto z-10">
        <form
          onSubmit={handleUnlock}
          className="bg-white rounded-2xl border border-line shadow-2xl p-6 sm:p-8 space-y-5 text-ink"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-pastel-honeySoft text-[#B45309] mb-1">
                Lingkungan Demo Terbatas
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-ink leading-snug">
                Akses Portal Demo SIDECI
              </h1>
              <p className="text-xs text-ink-muted mt-0.5">
                Sistem Desa Cerdas Terintegrasi • Desa Ringdikit
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            Masukkan kata sandi akses demo untuk membuka portal publik dan
            layanan digital Desa Ringdikit.
          </p>

          {error && (
            <div className="rounded-xl bg-pastel-coralSoft/80 border border-pastel-coral/30 px-4 py-3 text-xs font-medium text-[#C92A2A]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Kata Sandi Akses Demo
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPass ? "text" : "password"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onBlur={(e) => setCode(e.target.value.trim())}
                placeholder="Masukkan kata sandi demo..."
                autoFocus
                required
                className="soft-input pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1"
                title={showPass ? "Sembunyikan sandi" : "Tampilkan sandi"}
              >
                {showPass ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={rememberCache}
              onChange={(e) => setRememberCache(e.target.checked)}
              className="w-4 h-4 rounded border-line text-[#6741D9] focus:ring-[#6741D9]"
            />
            <span>Simpan di cache browser agar tidak perlu input berulang</span>
          </label>

          <button type="submit" className="soft-btn-primary w-full py-3">
            <CheckCircle2 className="w-4 h-4" />
            Buka Portal SIDECI
          </button>
        </form>
      </div>

      {/* Atribusi Bawah */}
      <div className="text-center text-xs text-[#9BB2DE] z-10 py-2 flex items-center justify-center gap-2">
        <Award className="w-4 h-4 text-[#FFD43B] shrink-0" />
        <span>
          Sistem Desa Cerdas Terintegrasi (SIDECI) — Produk Pengabdian Kepada
          Masyarakat{" "}
          <strong className="text-[#FFD43B] font-semibold">
            Universitas Pendidikan Ganesha
          </strong>
        </span>
      </div>
    </div>
  );
}
