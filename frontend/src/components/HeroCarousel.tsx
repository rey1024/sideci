"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Award,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Mail,
  MapPin,
  Users,
} from "lucide-react";
import { RINGDIKIT_OVERVIEW } from "@/lib/ringdikit-data";

interface Slide {
  id: string;
  kicker: string;
  titleLines: { text: string; accent?: string; suffix?: string }[];
  description: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}

const SLIDES: Slide[] = [
  {
    id: "welcome",
    kicker: "Om Swastiastu • Selamat Datang di Portal Resmi",
    titleLines: [
      { text: "Selamat datang di" },
      { text: "Sistem Desa Cerdas Terintegrasi" },
      { text: "", accent: "(SIDECI)", suffix: " Desa Ringdikit" },
    ],
    description:
      "Wujudkan tata kelola pemerintahan desa modern melalui ekosistem layanan digital cerdas yang efektif, efisien, transparan, dan akuntabel—menyinergikan pelayanan publik prima di lima Banjar Dinas demi kemajuan masyarakat Desa Ringdikit.",
    primary: { label: "Ajukan Surat Online", href: "#layanan-surat" },
    secondary: { label: "Lihat Statistik Desa", href: "#statistik-desa" },
  },
  {
    id: "surat",
    kicker: "Pelayanan Mandiri Warga • Tanpa Perlu Login",
    titleLines: [
      { text: "Pengurusan Surat Desa" },
      { text: "Lebih Cepat ", accent: "Cukup dari Rumah" },
    ],
    description:
      "Cukup masukkan 16 digit NIK Anda, pantau proses verifikasi menggunakan Kode Lacak Tiket, dan terima dokumen resmi ber-QR Code keaslian maupun TTE Perbekel.",
    primary: { label: "Buat Permohonan Surat", href: "#layanan-surat" },
    secondary: { label: "Lacak Kode Tiket", href: "#layanan-surat" },
  },
  {
    id: "data",
    kicker: "Kecamatan Seririt • Kabupaten Buleleng, Bali",
    titleLines: [
      { text: "Sinergi Satu Data Warga" },
      { text: "Dari ", accent: "Lima Banjar Dinas" },
    ],
    description:
      "Menghubungkan pemutakhiran data kependudukan dari Banjar Dinas Kajanan, Kelodan, Sari Mekar, Kuwum, dan Rawa secara berjenjang demi pembangunan desa yang tepat sasaran.",
    primary: { label: "Jelajahi Data Demografi", href: "#statistik-desa" },
    secondary: { label: "Sebaran 5 Banjar Dinas", href: "#sebaran-banjar" },
  },
];

export default function HeroCarousel({
  totalResidents = 5392,
  totalHouseholds = 1698,
  totalBanjars = 5,
}: {
  totalResidents?: number;
  totalHouseholds?: number;
  totalBanjars?: number;
}) {
  const v = RINGDIKIT_OVERVIEW;
  const bandStats = [
    {
      icon: Users,
      value: totalResidents.toLocaleString("id-ID"),
      label: "Warga Terdata",
    },
    {
      icon: Home,
      value: totalHouseholds.toLocaleString("id-ID"),
      label: "Kartu Keluarga",
    },
    {
      icon: MapPin,
      value: String(totalBanjars),
      label: "Banjar Dinas",
    },
    {
      icon: Mail,
      value: "5",
      label: "Template Surat",
    },
  ];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(
      () => setIndex((prev) => (prev + 1) % SLIDES.length),
      7000
    );
    return () => clearInterval(timer);
  }, [paused]);

  const slide = SLIDES[index];

  return (
    <section
      id="beranda"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="flex flex-col lg:h-[calc(100vh-4rem)] lg:min-h-[620px]"
    >
      {/* Area Utama Hero — Solid Navy Blue dengan Sosok Perbekel Cutout Transparan Menyatu Alami */}
      <div className="flex-1 min-h-0 bg-[#132952] text-white overflow-hidden relative">
        <div className="max-w-7xl w-full h-full mx-auto px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Kolom Kiri (7/12): Teks Sambutan & Navigasi Carousel */}
          <div className="lg:col-span-7 flex flex-col justify-center py-8 lg:py-6 z-10">
            <span className="self-start inline-flex items-center gap-2 rounded-full bg-[#1D3B73] border border-[#2F5396] px-4 py-1.5 text-xs font-semibold text-[#DCE8FF]">
              <span className="w-2 h-2 rounded-full bg-[#FCC419]" />
              {slide.kicker}
            </span>

            <h1
              className="mt-5 text-2xl sm:text-4xl xl:text-[41px] font-bold tracking-tight text-white"
              style={{ lineHeight: 1.25 }}
            >
              {slide.titleLines.map((line, idx) => (
                <span key={idx} className="block">
                  {line.text}
                  {line.accent && (
                    <span className="text-[#FFD43B]">{line.accent}</span>
                  )}
                  {line.suffix}
                </span>
              ))}
            </h1>

            <p className="mt-4 max-w-xl text-sm sm:text-base text-[#C5D4F0] leading-relaxed">
              {slide.description}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3.5">
              <a
                href={slide.primary.href}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FCC419] px-6 py-3.5 text-sm font-bold text-[#102040] hover:bg-[#FFD43B] transition-colors shadow-sm"
              >
                <FileText className="w-4 h-4" />
                {slide.primary.label}
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href={slide.secondary.href}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1D3B73] border border-[#34599E] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#25488A] transition-colors"
              >
                {slide.secondary.label}
              </a>
            </div>

            {/* Kontrol Slide Carousel */}
            <div className="mt-8 flex items-center gap-2.5">
              {SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === index
                      ? "w-9 bg-[#FCC419]"
                      : "w-2.5 bg-[#3A5A96] hover:bg-[#5C7EC0]"
                  }`}
                />
              ))}
              <button
                type="button"
                aria-label="Slide sebelumnya"
                onClick={() =>
                  setIndex((index - 1 + SLIDES.length) % SLIDES.length)
                }
                className="ml-3 w-8 h-8 rounded-full bg-[#1D3B73] border border-[#34599E] text-white hover:bg-[#25488A] flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Slide berikutnya"
                onClick={() => setIndex((index + 1) % SLIDES.length)}
                className="w-8 h-8 rounded-full bg-[#1D3B73] border border-[#34599E] text-white hover:bg-[#25488A] flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Kolom Kanan (5/12): Cutout Transparan Bapak Perbekel Menyatu Alami di Atas Navy */}
          <div className="lg:col-span-5 h-full min-h-0 flex items-end justify-center lg:justify-end relative pt-4">
            {/* Cahaya belakang (rim glow) biru lembut agar jas hitam tetap berdimensi di atas latar navy */}
            <div
              className="absolute bottom-8 right-6 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-[#2B549E]/45 blur-3xl pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative h-[460px] sm:h-[520px] lg:h-[96%] flex items-end justify-center">
              {/* Ilustrasi kartun perangkat desa */}
              <img
                src="/images/perbekel-ilustrasi.png"
                alt="Ilustrasi perangkat desa Ringdikit"
                className="h-full w-auto max-w-none object-contain object-bottom select-none drop-shadow-[0_18px_28px_rgba(6,15,34,0.55)]"
              />

              {/* Kartu Identitas Mengambang Elegan di Bagian Bawah */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-2xl bg-[#0A1630]/88 backdrop-blur-md border border-[#315596]/80 px-4 py-2.5 shadow-xl text-white">
                <span className="text-[11px] font-bold text-[#102040] bg-[#FFD43B] px-2.5 py-1 rounded-lg">
                  5 {v.hamletTerm}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pita Bawah Layar Awal: Hook SIDECI & Atribusi PkM Universitas Pendidikan Ganesha */}
      <div className="bg-[#0A1630] text-white border-t border-[#1E3666] shrink-0">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Kiri: Identitas SIDECI & Atribusi PkM Undiksha */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#132952] border border-[#294A87] text-[#FFD43B] flex items-center justify-center shrink-0 shadow-sm">
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm sm:text-[15px] font-bold tracking-tight text-white">
                    Sistem Desa Cerdas Terintegrasi (SIDECI)
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#162F5C] text-[#9BB2DE] border border-[#274885]">
                    Desa Ringdikit
                  </span>
                </div>
                <div className="text-xs text-[#9BB2DE] mt-0.5 truncate sm:whitespace-normal">
                  Produk Pengabdian Kepada Masyarakat —{" "}
                  <strong className="font-semibold text-[#FFD43B]">
                    Universitas Pendidikan Ganesha
                  </strong>
                </div>
              </div>
            </div>

            {/* Kanan: 4 Metrik Kunci dengan Pembatas Rapi & Tombol Gulir */}
            <div className="flex items-center justify-between lg:justify-end gap-4 sm:gap-6">
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-y-3 gap-x-5 sm:gap-x-0 sm:divide-x sm:divide-[#1E3666]">
                {bandStats.map((s, idx) => (
                  <div
                    key={s.label}
                    className={`flex items-center gap-2.5 ${
                      idx > 0 ? "sm:pl-5 xl:pl-6" : ""
                    } ${idx < bandStats.length - 1 ? "sm:pr-5 xl:pr-6" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#132952]/90 border border-[#234177] flex items-center justify-center shrink-0">
                      <s.icon className="w-4 h-4 text-[#66D9E8]" />
                    </div>
                    <div className="leading-tight whitespace-nowrap">
                      <div className="text-base sm:text-lg font-bold tabular-nums text-white">
                        {s.value}
                      </div>
                      <div className="text-[11px] text-[#9BB2DE]">
                        {s.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href="#statistik-desa"
                className="hidden xl:inline-flex items-center gap-1.5 rounded-xl bg-[#132952] border border-[#294A87] px-3.5 py-2 text-xs font-semibold text-[#DCE8FF] hover:text-white hover:bg-[#1B3668] transition-colors shrink-0"
              >
                Gulir <ArrowDown className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
