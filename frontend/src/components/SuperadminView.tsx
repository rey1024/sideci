"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Globe, Shield, UserPlus } from "lucide-react";
import {
  AdminVillageSummary,
  createAdminUser,
  createAdminVillage,
  fetchAdminVillages,
} from "@/lib/api";
import { MULTI_VILLAGE_TENANTS } from "@/lib/ringdikit-data";

const AVAILABLE_VILLAGE_ROLES = [
  { code: "admin_desa", label: "Admin Desa" },
  { code: "operator_kependudukan", label: "Operator Kependudukan" },
  { code: "operator_persuratan", label: "Operator Persuratan" },
  { code: "kepala_desa", label: "Kepala Desa / Perbekel" },
];

export default function SuperadminView() {
  const [villages, setVillages] = useState<AdminVillageSummary[]>([]);
  const [loadedFromApi, setLoadedFromApi] = useState(false);
  const [showVillageForm, setShowVillageForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  // State form tambah desa
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [districtName, setDistrictName] = useState("Seririt");
  const [regencyName, setRegencyName] = useState("Kabupaten Buleleng");
  const [provinceName, setProvinceName] = useState("Bali");
  const [leaderTitle, setLeaderTitle] = useState("Perbekel");
  const [leaderName, setLeaderName] = useState("");
  const [hamletTerm, setHamletTerm] = useState("Banjar Dinas");
  const [dusunsCsv, setDusunsCsv] = useState("Kajanan, Kelodan");

  // State form tambah akun awal desa
  const [targetVillageId, setTargetVillageId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([
    "admin_desa",
    "operator_kependudukan",
    "operator_persuratan",
  ]);

  const loadVillages = useCallback(async () => {
    const res = await fetchAdminVillages();
    if (res.ok && res.data.villages) {
      setVillages(res.data.villages);
      setLoadedFromApi(true);
      if (res.data.villages.length > 0) {
        setTargetVillageId((prev) => prev || res.data.villages![0].id);
      }
    }
  }, []);

  useEffect(() => {
    loadVillages();
  }, [loadVillages]);

  async function handleCreateVillage(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const dusuns = dusunsCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await createAdminVillage({
      slug: slug.trim().toLowerCase(),
      custom_domain: customDomain.trim().toLowerCase() || undefined,
      name: name.trim(),
      district_name: districtName.trim(),
      regency_name: regencyName.trim(),
      province_name: provinceName.trim(),
      leader_title: leaderTitle.trim() || "Kepala Desa",
      leader_name: leaderName.trim(),
      hamlet_term: hamletTerm.trim() || "Dusun",
      hamlet_leader_term:
        hamletTerm.trim() === "Banjar Dinas"
          ? "Kelian Banjar Dinas"
          : "Kepala Dusun",
      dusuns,
    });
    if (!res.ok) {
      setFeedback({
        tone: "err",
        text: res.data.error || "Gagal menambahkan desa baru.",
      });
      return;
    }
    setFeedback({
      tone: "ok",
      text: `Desa '${name}' (${res.data.slug}) berhasil didaftarkan.`,
    });
    setSlug("");
    setName("");
    setCustomDomain("");
    setLeaderName("");
    setShowVillageForm(false);
    await loadVillages();
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const res = await createAdminUser({
      village_id: targetVillageId,
      username: newUsername.trim().toLowerCase(),
      full_name: newFullName.trim(),
      password: newPassword.trim(),
      roles: selectedRoles,
    });
    if (!res.ok) {
      setFeedback({
        tone: "err",
        text: res.data.error || "Gagal membuat akun pengguna desa.",
      });
      return;
    }
    setFeedback({
      tone: "ok",
      text: `Akun '${res.data.username}' berhasil dibuat dengan ${selectedRoles.length} role.`,
    });
    setNewUsername("");
    setNewFullName("");
    setNewPassword("");
    setShowUserForm(false);
  }

  function toggleRole(code: string) {
    setSelectedRoles((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code]
    );
  }

  return (
    <div className="space-y-5">
      <div className="soft-card p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="rounded-lg bg-pastel-violetSoft px-3 py-1 text-xs font-semibold text-[#6741D9]">
            Superadmin Platform
          </span>
          <h1 className="text-lg sm:text-xl font-bold text-ink mt-1.5">
            Manajemen Multi-Desa, Subdomain & Akun Desa
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setShowUserForm(!showUserForm);
              setShowVillageForm(false);
            }}
            className="soft-btn-secondary text-xs sm:text-sm"
          >
            <UserPlus className="w-4 h-4" /> Buat Akun Desa
          </button>
          <button
            type="button"
            onClick={() => {
              setShowVillageForm(!showVillageForm);
              setShowUserForm(false);
            }}
            className="soft-btn-primary text-xs sm:text-sm"
          >
            <Building2 className="w-4 h-4" /> Tambah Desa Baru
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl p-4 text-xs sm:text-sm font-medium flex items-center gap-2 border ${
            feedback.tone === "ok"
              ? "bg-pastel-mintSoft/70 border-pastel-mint/30 text-[#099268]"
              : "bg-pastel-coralSoft/70 border-pastel-coral/30 text-[#C92A2A]"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {showVillageForm && (
        <form
          onSubmit={handleCreateVillage}
          className="soft-card p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-ink">
            Onboarding Tenant Desa Baru
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Slug Subdomain
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="contoh: ularan"
                className="soft-input font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Nama Desa (tanpa kata Desa)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="contoh: Ularan"
                className="soft-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Custom Domain (Opsional)
              </label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="ularan.desa.id"
                className="soft-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Kecamatan
              </label>
              <input
                type="text"
                value={districtName}
                onChange={(e) => setDistrictName(e.target.value)}
                className="soft-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Kabupaten
              </label>
              <input
                type="text"
                value={regencyName}
                onChange={(e) => setRegencyName(e.target.value)}
                className="soft-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Provinsi
              </label>
              <input
                type="text"
                value={provinceName}
                onChange={(e) => setProvinceName(e.target.value)}
                className="soft-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Sebutan Kepala Desa
              </label>
              <input
                type="text"
                value={leaderTitle}
                onChange={(e) => setLeaderTitle(e.target.value)}
                className="soft-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Nama Pejabat Kepala Desa
              </label>
              <input
                type="text"
                value={leaderName}
                onChange={(e) => setLeaderName(e.target.value)}
                placeholder="Nama lengkap pejabat"
                className="soft-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Sebutan Dusun / Banjar
              </label>
              <input
                type="text"
                value={hamletTerm}
                onChange={(e) => setHamletTerm(e.target.value)}
                className="soft-input"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Daftar Dusun / Banjar Awal (pisahkan dengan koma)
            </label>
            <input
              type="text"
              value={dusunsCsv}
              onChange={(e) => setDusunsCsv(e.target.value)}
              className="soft-input"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowVillageForm(false)}
              className="soft-btn-secondary text-xs"
            >
              Batal
            </button>
            <button type="submit" className="soft-btn-primary text-xs">
              Simpan Desa Baru
            </button>
          </div>
        </form>
      )}

      {showUserForm && (
        <form onSubmit={handleCreateUser} className="soft-card p-6 space-y-4">
          <h2 className="text-base font-bold text-ink">
            Buat Akun Staf / Pimpinan Desa (Multi-Role)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Pilih Desa
              </label>
              <select
                value={targetVillageId}
                onChange={(e) => setTargetVillageId(e.target.value)}
                className="soft-input"
                required
              >
                <option value="">-- Pilih Desa --</option>
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    Desa {v.name} ({v.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Username Login
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="contoh: operator.ringdikit"
                className="soft-input font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Nama lengkap staf"
                className="soft-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Kata Sandi Awal (Minimal 10 Karakter)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="soft-input"
                minLength={10}
                required
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-ink-secondary mb-2">
              Hak Akses Role (Bisa lebih dari 1)
            </div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VILLAGE_ROLES.map((r) => {
                const checked = selectedRoles.includes(r.code);
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => toggleRole(r.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      checked
                        ? "bg-pastel-violetSoft border-pastel-violet/40 text-[#6741D9]"
                        : "bg-white border-line text-ink-muted"
                    }`}
                  >
                    {checked ? "✓ " : ""}
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUserForm(false)}
              className="soft-btn-secondary text-xs"
            >
              Batal
            </button>
            <button type="submit" className="soft-btn-primary text-xs">
              Buat Akun
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {(loadedFromApi && villages.length > 0
          ? villages.map((v) => ({
              slug: v.slug,
              name: `Desa ${v.name}`,
              district: `Kec. ${v.district_name}, ${v.regency_name}`,
              leaderTitle: v.leader_title,
              leaderName: v.leader_name,
              subdomain: `${v.slug}.sideci.reisys.id`,
              customDomain: v.custom_domain || "—",
              residents: v.residents,
              dusuns: v.dusuns,
              status: v.is_active ? "Aktif (Database)" : "Nonaktif",
            }))
          : MULTI_VILLAGE_TENANTS
        ).map((t) => (
          <div
            key={t.slug}
            className="soft-card p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-base text-ink">{t.name}</span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-pastel-mintSoft text-[#099268]">
                  {t.status}
                </span>
              </div>
              <div className="text-xs text-ink-muted">
                {t.district} • {t.dusuns} wilayah dusun/banjar
              </div>
              <div className="rounded-xl bg-[#F9FAFD] border border-line p-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-mono text-ink-secondary">
                  <Globe className="w-3.5 h-3.5 text-pastel-violet" />
                  {t.subdomain}
                </div>
                <div className="flex items-center gap-1.5 font-mono text-ink-muted">
                  <Shield className="w-3.5 h-3.5 text-pastel-mint" />
                  Custom: {t.customDomain}
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-line flex items-center justify-between text-xs text-ink-secondary">
              <span>
                {t.leaderTitle}:{" "}
                <strong className="text-ink">{t.leaderName}</strong>
              </span>
              <span className="font-semibold tabular-nums text-ink">
                {t.residents.toLocaleString("id-ID")} jiwa
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
