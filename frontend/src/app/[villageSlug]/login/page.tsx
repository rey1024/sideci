"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Lock, LogIn } from "lucide-react";
import { login } from "@/lib/api";

export default function TenantLoginPage() {
  const router = useRouter();
  const params = useParams<{ villageSlug?: string }>();
  const villageSlug = (params?.villageSlug || "ringdikit").toLowerCase();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleanUser = username.trim();
    const cleanPass = password.trim();
    setUsername(cleanUser);
    setPassword(cleanPass);
    setLoading(true);
    try {
      const res = await login(cleanUser, cleanPass);
      if (!res.ok) {
        setError(res.data.error || "Login gagal. Periksa kembali data Anda.");
        return;
      }
      router.push(`/${villageSlug}/panel`);
    } catch {
      setError("Server tidak dapat dihubungi. Pastikan backend berjalan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Link
          href={`/${villageSlug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Portal Desa
        </Link>

        <form onSubmit={handleSubmit} className="soft-card p-7 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-pastel-violetSoft text-[#6741D9] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink">Masuk Perangkat Desa</h1>
              <p className="text-xs text-ink-muted">
                Operator Desa, Kepala Dusun, Perbekel, dan Superadmin
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-pastel-coralSoft/70 border border-pastel-coral/30 px-4 py-3 text-xs font-medium text-[#C92A2A]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={(e) => setUsername(e.target.value.trim())}
              className="soft-input"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
              Kata Sandi
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={(e) => setPassword(e.target.value.trim())}
              className="soft-input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="soft-btn-primary w-full py-3 disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
