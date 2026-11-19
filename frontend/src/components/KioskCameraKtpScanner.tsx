"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FlipHorizontal,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import { ApiResidentItem, fetchResidents, kioskLookupResident } from "@/lib/api";

export interface ExtractedKtpResult {
  resident: ApiResidentItem;
  croppedImageDataUrl: string;
  confidence: number;
  sourceLabel: string;
}

interface KioskCameraKtpScannerProps {
  /** Daftar warga yang sudah terpetakan (hanya dipakai jika operator menekan tombol Simulasi eksplisit) */
  candidateResidents?: ApiResidentItem[];
  /** Dipanggil ketika KTP memenuhi standar keyakinan (Confidence Threshold) dan cocok dengan database */
  onDetected: (result: ExtractedKtpResult) => void;
  onClose?: () => void;
}

interface OcrWordItem {
  text?: string;
  confidence?: number;
}

interface OcrRecognizeResult {
  data?: {
    text?: string;
    confidence?: number;
    words?: OcrWordItem[];
  };
}

interface OcrFailureInfo {
  title: string;
  reason: string;
  measuredConfidence: number;
  requiredConfidence: number;
  sharpnessScore: number;
  extractedRawNik: string | null;
  extractedRawName: string | null;
  ocrSnippet: string;
}

declare global {
  interface Window {
    Tesseract?: {
      recognize: (
        image: string,
        lang: string
      ) => Promise<OcrRecognizeResult>;
    };
  }
}

/**
 * Standar Keyakinan Minimum (Confidence Standard):
 * - MIN_OCR_CONFIDENCE: Skor keyakinan karakter dari engine OCR minimal 68%
 * - MIN_SHARPNESS_SCORE: Skor ketajaman gradien tepi gambar KTP minimal 14 (mencegah gambar blur/goyang)
 */
const MIN_OCR_CONFIDENCE = 68;
const MIN_SHARPNESS_SCORE = 14;

function normalizeOcrDigits(raw: string): string {
  return raw
    .replace(/[OoQD]/g, "0")
    .replace(/[Il|!]/g, "1")
    .replace(/[Zz]/g, "2")
    .replace(/[Ss$]/g, "5")
    .replace(/[Gg]/g, "6")
    .replace(/[Bb]/g, "8");
}

/**
 * Mengekstrak kandidat NIK 16 digit atau penggalan NIK provinsi Bali (5108 / 51...)
 * beserta estimasi tingkat keyakinan baris NIK.
 */
function extractNikCandidatesFromOcrText(text: string): {
  exact16: string | null;
  partialBaliNik: string | null;
} {
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    // Prioritaskan baris yang mengandung kata NIK atau diawali 51
    const cleaned = normalizeOcrDigits(line).replace(/[^0-9]/g, "");
    const m51 = cleaned.match(/51\d{14}/);
    if (m51) {
      return { exact16: m51[0], partialBaliNik: m51[0] };
    }
    const m16 = cleaned.match(/\d{16}/);
    if (m16) {
      return { exact16: m16[0], partialBaliNik: null };
    }
  }

  const allDigits = normalizeOcrDigits(text).replace(/[^0-9]/g, "");
  const mFull51 = allDigits.match(/51\d{14}/);
  if (mFull51) {
    return { exact16: mFull51[0], partialBaliNik: mFull51[0] };
  }
  const mFull16 = allDigits.match(/\d{16}/);
  if (mFull16) {
    return { exact16: mFull16[0], partialBaliNik: null };
  }

  // Cek apakah ada minimal 12-15 digit berawalan 5108 (Kabupaten Buleleng) yang jelas
  const mPartialBuleleng = allDigits.match(/5108\d{8,11}/);
  return {
    exact16: null,
    partialBaliNik: mPartialBuleleng ? mPartialBuleleng[0] : null,
  };
}

function extractNameFromOcrText(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/NAMA\s*[:\-]?\s*([A-Z\s.,']{4,})/i);
    if (m && m[1]) {
      const candidate = m[1]
        .replace(/[^A-Za-z\s.,']/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
      // Pastikan minimal 4 huruf dan bukan kata label KTP umum
      if (
        candidate.length >= 4 &&
        !candidate.includes("TEMPAT") &&
        !candidate.includes("LAHIR") &&
        !candidate.includes("KELAMIN")
      ) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Menghitung ketajaman gambar (Sharpness Score) dan menyiapkan gambar KTP kontras tinggi untuk OCR
 */
function measureSharpnessAndPreprocessOcr(
  sourceCanvas: HTMLCanvasElement
): { sharpnessScore: number; enhancedDataUrl: string } {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext("2d");
  if (!ctx) {
    return {
      sharpnessScore: 0,
      enhancedDataUrl: sourceCanvas.toDataURL("image/jpeg", 0.92),
    };
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Hitung rata-rata gradien ketajaman pada zona teks KTP (baris NIK & Nama berada di 12%..75% tinggi, 5%..72% lebar)
  const xStart = Math.floor(w * 0.05);
  const xEnd = Math.floor(w * 0.72);
  const yStart = Math.floor(h * 0.14);
  const yEnd = Math.floor(h * 0.72);

  let gradSum = 0;
  let sampleCount = 0;

  for (let y = yStart; y < yEnd; y += 2) {
    for (let x = xStart; x < xEnd; x += 2) {
      const idx = (y * w + x) * 4;
      const luma =
        (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;

      const rightIdx = (y * w + (x + 1)) * 4;
      const rightLuma =
        (data[rightIdx] * 77 +
          data[rightIdx + 1] * 150 +
          data[rightIdx + 2] * 29) >>
        8;

      const downIdx = ((y + 1) * w + x) * 4;
      const downLuma =
        (data[downIdx] * 77 +
          data[downIdx + 1] * 150 +
          data[downIdx + 2] * 29) >>
        8;

      gradSum += Math.abs(luma - rightLuma) + Math.abs(luma - downLuma);
      sampleCount++;
    }
  }

  const sharpnessScore =
    sampleCount > 0 ? Math.round((gradSum / sampleCount) * 1.4) : 0;

  // Buat canvas hasil peningkatan kontras grayscale untuk engine OCR agar angka NIK lebih tegas
  const ocrCanvas = document.createElement("canvas");
  ocrCanvas.width = w;
  ocrCanvas.height = h;
  const ocrCtx = ocrCanvas.getContext("2d");
  if (!ocrCtx) {
    return {
      sharpnessScore,
      enhancedDataUrl: sourceCanvas.toDataURL("image/jpeg", 0.94),
    };
  }

  const ocrImg = ocrCtx.createImageData(w, h);
  const dst = ocrImg.data;
  for (let i = 0; i < data.length; i += 4) {
    const luma =
      (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    // Contrast stretching untuk memperjelas teks hitam di atas latar biru KTP-el
    const stretched = Math.max(0, Math.min(255, Math.round((luma - 118) * 1.65 + 128)));
    dst[i] = stretched;
    dst[i + 1] = stretched;
    dst[i + 2] = stretched;
    dst[i + 3] = 255;
  }
  ocrCtx.putImageData(ocrImg, 0, 0);

  return {
    sharpnessScore,
    enhancedDataUrl: ocrCanvas.toDataURL("image/jpeg", 0.95),
  };
}

export default function KioskCameraKtpScanner({
  onDetected,
  onClose,
}: KioskCameraKtpScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const stabilityCounterRef = useRef<number>(0);

  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // PENTING: Default mirrorVideo = FALSE agar tampilan KTP di layar TIDAK TERBALIK (angka NIK terbaca normal dari kiri ke kanan)
  const [mirrorVideo, setMirrorVideo] = useState(false);
  // Flip pembacaan OCR jika webcam bawaan laptop melakukan hardware-mirroring
  const [flipHorizontalCapture, setFlipHorizontalCapture] = useState(false);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Skor deteksi kartu KTP & ketajaman di dalam bingkai (0..100)
  const [cardPresenceScore, setCardPresenceScore] = useState(0);
  const [liveSharpness, setLiveSharpness] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "Arahkan KTP-el Anda ke dalam kotak bingkai kamera (Pastikan angka NIK tidak terbalik)..."
  );

  // State hasil crop & ekstraksi OCR dengan standar keyakinan ketat
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);
  const [processingOcr, setProcessingOcr] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>("");
  const [detectedResult, setDetectedResult] =
    useState<ExtractedKtpResult | null>(null);
  const [ocrFailure, setOcrFailure] = useState<OcrFailureInfo | null>(null);

  // Muat Tesseract.js di background untuk pembacaan OCR KTP
  useEffect(() => {
    if (typeof window === "undefined" || window.Tesseract) return;
    const existing = document.getElementById("tesseract-cdn-script");
    if (existing) return;
    const script = document.createElement("script");
    script.id = "tesseract-cdn-script";
    script.src =
      "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopCamera();
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError(
            "Browser tidak mendukung akses kamera langsung. Gunakan tombol Unggah Foto KTP di bawah."
          );
          return;
        }
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              }
            : {
                facingMode: "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
        };
        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => {});
          setStreamActive(true);
        }

        const allDevs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = allDevs.filter((d) => d.kind === "videoinput");
        setDevices(videoDevs);
      } catch {
        setCameraError(
          "Kamera tidak dapat diakses (pastikan izin kamera browser telah diaktifkan)."
        );
      }
    },
    [stopCamera]
  );

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  /**
   * Memotong (Auto-Crop) area bingkai KTP-el dari video dan mengekstrak data warga
   * dengan STANDAR KEYAKINAN KETAT (Strict Confidence Gate).
   * Jika gambar buram, terbalik, atau NIK/Nama tidak terbaca jelas -> TOLAK & MINTA FOTO ULANG (Jangan dipaksa menebak warga acak!).
   */
  const captureAndExtractKtp = useCallback(
    async (customImageSource?: HTMLImageElement) => {
      if (processingOcr) return;

      const cropCanvas = cropCanvasRef.current;
      if (!cropCanvas) return;

      // Resolusi tinggi CR80 (1024 x 646 px) agar angka NIK lebih tajam saat di-OCR
      const targetW = 1024;
      const targetH = 646;
      cropCanvas.width = targetW;
      cropCanvas.height = targetH;
      const ctx = cropCanvas.getContext("2d");
      if (!ctx) return;

      if (customImageSource) {
        ctx.save();
        if (flipHorizontalCapture) {
          ctx.translate(targetW, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(customImageSource, 0, 0, targetW, targetH);
        ctx.restore();
      } else {
        const video = videoRef.current;
        if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

        const vw = video.videoWidth;
        const vh = video.videoHeight;

        const ktpAspect = 1.586;
        let cropW = vw * 0.72;
        let cropH = cropW / ktpAspect;
        if (cropH > vh * 0.76) {
          cropH = vh * 0.76;
          cropW = cropH * ktpAspect;
        }
        const sx = (vw - cropW) / 2;
        const sy = (vh - cropH) / 2;

        ctx.save();
        // Jika pengguna mengaktifkan koreksi balik gambar karena kamera ter-flip, balikkan hasil tangkapan agar sama persis dengan yang terlihat normal di layar
        if (mirrorVideo || flipHorizontalCapture) {
          ctx.translate(targetW, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, targetW, targetH);
        ctx.restore();
      }

      const colorDataUrl = cropCanvas.toDataURL("image/jpeg", 0.94);
      const { sharpnessScore, enhancedDataUrl } =
        measureSharpnessAndPreprocessOcr(cropCanvas);

      setCroppedDataUrl(colorDataUrl);
      setDetectedResult(null);
      setOcrFailure(null);
      setProcessingOcr(true);
      setProcessingStage(
        `1/3 Memeriksa Ketajaman & Orientasi KTP-el (Skor Fokus: ${sharpnessScore})...`
      );

      await new Promise((r) => setTimeout(r, 350));

      // GATE 1: Validasi Ketajaman Fokus Gambar (Tolak langsung jika gambar terlalu blur / goyang)
      if (sharpnessScore < MIN_SHARPNESS_SCORE) {
        setProcessingOcr(false);
        setOcrFailure({
          title: "Gambar KTP Kurang Fokus / Buram (Tidak Memenuhi Standar Keyakinan)",
          reason:
            "Tingkat ketajaman teks pada kartu terlalu rendah sehingga angka NIK rawan salah baca. Sistem menolak menebak data secara paksa demi keakuratan layanan.",
          measuredConfidence: Math.min(45, sharpnessScore * 3),
          requiredConfidence: MIN_OCR_CONFIDENCE,
          sharpnessScore,
          extractedRawNik: null,
          extractedRawName: null,
          ocrSnippet: "Gambar terlalu buram untuk diekstrak.",
        });
        return;
      }

      setProcessingStage(
        "2/3 Membaca Nomor NIK 16 Digit & Nama KTP-el (Optical Character Recognition)..."
      );

      let rawOcrText = "";
      let measuredConfidence = 0;

      if (typeof window !== "undefined" && window.Tesseract) {
        try {
          const ocrPromise = window.Tesseract.recognize(enhancedDataUrl, "eng");
          const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 5500)
          );
          const ocrRes = await Promise.race([ocrPromise, timeoutPromise]);
          if (ocrRes && ocrRes.data) {
            rawOcrText = (ocrRes.data.text || "").trim();
            measuredConfidence = Math.round(ocrRes.data.confidence || 0);
          }
        } catch {
          rawOcrText = "";
          measuredConfidence = 0;
        }
      } else {
        setProcessingOcr(false);
        setOcrFailure({
          title: "Modul Pembaca OCR Sedang Dimuat",
          reason:
            "Engine pembaca teks KTP sedang mempersiapkan model. Silakan tekan tombol Scan Ulang dalam 2 detik atau gunakan input NIK manual.",
          measuredConfidence: 0,
          requiredConfidence: MIN_OCR_CONFIDENCE,
          sharpnessScore,
          extractedRawNik: null,
          extractedRawName: null,
          ocrSnippet: "",
        });
        return;
      }

      const { exact16, partialBaliNik } =
        extractNikCandidatesFromOcrText(rawOcrText);
      const extractedName = extractNameFromOcrText(rawOcrText);

      // Hitung skor keyakinan efektif: gabungan confidence Tesseract + validitas struktur NIK 16 digit
      let effectiveConfidence = measuredConfidence;
      if (exact16 && exact16.startsWith("51")) {
        effectiveConfidence = Math.max(measuredConfidence, 78);
      } else if (exact16) {
        effectiveConfidence = Math.max(measuredConfidence, 70);
      }

      setProcessingStage(
        "3/3 Memverifikasi Standar Keyakinan & Mencocokkan Database Desa Ringdikit..."
      );
      await new Promise((r) => setTimeout(r, 300));

      // GATE 2: Pastikan NIK atau Nama benar-benar terbaca dengan tingkat keyakinan >= MIN_OCR_CONFIDENCE (68%)
      if (
        effectiveConfidence < MIN_OCR_CONFIDENCE ||
        (!exact16 && !partialBaliNik && !extractedName)
      ) {
        setProcessingOcr(false);
        setOcrFailure({
          title: "Teks KTP Tidak Terbaca Jelas (Di Bawah Ambang Keyakinan)",
          reason:
            "Angka NIK 16 digit atau Nama pada KTP tidak terbaca dengan keyakinan yang cukup (kemungkinan karena pantulan cahaya, jarak terlalu jauh, atau posisi kartu miring/terbalik). Sistem tidak memaksakan pembacaan agar tidak salah warga.",
          measuredConfidence: effectiveConfidence,
          requiredConfidence: MIN_OCR_CONFIDENCE,
          sharpnessScore,
          extractedRawNik: exact16 || partialBaliNik,
          extractedRawName: extractedName,
          ocrSnippet: rawOcrText.slice(0, 120),
        });
        return;
      }

      // GATE 3: Cocokkan HANYA dengan warga yang benar-benar sesuai di Database Desa Ringdikit (TANPA fallback warga acak!)
      let matchedResident: ApiResidentItem | null = null;
      let sourceLabel = "";

      if (exact16) {
        const resLookup = await kioskLookupResident({ nik: exact16 });
        if (resLookup.ok && resLookup.data.resident) {
          matchedResident = resLookup.data.resident;
          sourceLabel = `NIK Terverifikasi Penuh (${exact16})`;
        }
      }

      // Jika NIK terbaca sebagian (misal 12-15 digit awal 5108...) atau sedikit meleset 1 digit, cari di database yang cocok ketat
      if (!matchedResident && (partialBaliNik || exact16)) {
        const searchKey = partialBaliNik || (exact16 ? exact16.slice(0, 12) : "");
        if (searchKey.length >= 10) {
          const resSearch = await fetchResidents(searchKey, 2, 0, "", "AKTIF");
          if (
            resSearch.ok &&
            resSearch.data.residents &&
            resSearch.data.residents.length === 1
          ) {
            matchedResident = resSearch.data.residents[0];
            sourceLabel = `NIK Terverifikasi Database (${matchedResident.nik})`;
          }
        }
      }

      // Jika NIK belum cocok tetapi Nama KTP terbaca jelas (>= 5 karakter) dengan keyakinan memenuhi standar
      if (
        !matchedResident &&
        extractedName &&
        extractedName.length >= 5 &&
        effectiveConfidence >= MIN_OCR_CONFIDENCE
      ) {
        const resSearch = await fetchResidents(extractedName, 2, 0, "", "AKTIF");
        if (
          resSearch.ok &&
          resSearch.data.residents &&
          resSearch.data.residents.length === 1
        ) {
          matchedResident = resSearch.data.residents[0];
          sourceLabel = `Nama KTP Terverifikasi Database (${matchedResident.full_name})`;
        }
      }

      setProcessingOcr(false);

      // JIKA TIDAK ADA KECOCOKAN PASTI DI DATABASE -> JANGAN DIPAKSA! Tampilkan peringatan jujur & jelas
      if (!matchedResident) {
        setOcrFailure({
          title: "NIK / Data KTP Tidak Cocok dengan Database Desa Ringdikit",
          reason: `Hasil pembacaan kamera (${
            exact16
              ? `NIK: ${exact16}`
              : partialBaliNik
              ? `Penggalan NIK: ${partialBaliNik}...`
              : `Nama: ${extractedName || "-"}`
          }) belum ditemukan secara pasti di database penduduk aktif Desa Ringdikit. Pastikan angka pada kamera tidak terbalik dan KTP didekatkan ke bingkai, atau gunakan input NIK/RFID.`,
          measuredConfidence: effectiveConfidence,
          requiredConfidence: MIN_OCR_CONFIDENCE,
          sharpnessScore,
          extractedRawNik: exact16 || partialBaliNik,
          extractedRawName: extractedName,
          ocrSnippet: rawOcrText.slice(0, 120),
        });
        return;
      }

      const finalResult: ExtractedKtpResult = {
        resident: matchedResident,
        croppedImageDataUrl: colorDataUrl,
        confidence: effectiveConfidence,
        sourceLabel,
      };
      setDetectedResult(finalResult);
      onDetected(finalResult);
    },
    [flipHorizontalCapture, mirrorVideo, onDetected, processingOcr]
  );

  // Loop Analisis Frame Kamera (4x per detik) untuk mendeteksi kartu KTP yang TAJAM & STABIL di dalam bingkai
  useEffect(() => {
    if (
      !streamActive ||
      !autoDetectEnabled ||
      croppedDataUrl ||
      processingOcr
    ) {
      return;
    }

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0)
        return;

      const w = 160;
      const h = 100;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const sx = vw * 0.18;
      const sy = vh * 0.18;
      const sw = vw * 0.64;
      const sh = vh * 0.64;

      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h).data;

      let edgeCount = 0;
      let gradSum = 0;
      let brightPixels = 0;
      let motionDiff = 0;
      const prev = prevFrameDataRef.current;
      const currentLuma = new Uint8ClampedArray(w * h);

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          const luma =
            (imgData[idx] * 77 +
              imgData[idx + 1] * 150 +
              imgData[idx + 2] * 29) >>
            8;
          const pIdx = y * w + x;
          currentLuma[pIdx] = luma;

          if (luma > 95) brightPixels++;

          const leftIdx = (y * w + (x - 1)) * 4;
          const leftLuma =
            (imgData[leftIdx] * 77 +
              imgData[leftIdx + 1] * 150 +
              imgData[leftIdx + 2] * 29) >>
            8;
          const diff = Math.abs(luma - leftLuma);
          gradSum += diff;
          if (diff > 28) {
            edgeCount++;
          }

          if (prev) {
            motionDiff += Math.abs(luma - prev[pIdx]);
          }
        }
      }
      prevFrameDataRef.current = currentLuma;

      const totalPixels = w * h;
      const brightRatio = brightPixels / totalPixels;
      const edgeRatio = edgeCount / totalPixels;
      const avgGrad = Math.round((gradSum / totalPixels) * 1.8);
      const avgMotion = prev ? motionDiff / totalPixels : 99;

      setLiveSharpness(avgGrad);

      // Standar deteksi lebih ketat: kartu harus terang, memiliki kontras teks tajam (avgGrad >= MIN_SHARPNESS_SCORE), dan stabil
      const hasSharpCardTexture =
        brightRatio > 0.25 &&
        edgeRatio > 0.055 &&
        edgeRatio < 0.42 &&
        avgGrad >= MIN_SHARPNESS_SCORE;
      const isSteady = avgMotion < 8.5;

      const rawScore = Math.min(
        100,
        Math.round(
          (hasSharpCardTexture ? 55 : 15) +
            Math.min(30, edgeRatio * 280) +
            (isSteady ? 15 : 0)
        )
      );
      setCardPresenceScore(rawScore);

      if (hasSharpCardTexture && isSteady) {
        stabilityCounterRef.current += 1;
        const pct = Math.min(
          100,
          Math.round((stabilityCounterRef.current / 8) * 100)
        );
        setHoldProgress(pct);
        setStatusMessage(
          `KTP-el Fokus & Stabil (Ketajaman ${avgGrad}) — Tahan Posisi (${pct}%)...`
        );

        if (stabilityCounterRef.current >= 8) {
          stabilityCounterRef.current = 0;
          setHoldProgress(100);
          captureAndExtractKtp();
        }
      } else {
        stabilityCounterRef.current = Math.max(
          0,
          stabilityCounterRef.current - 1
        );
        const pct = Math.round((stabilityCounterRef.current / 8) * 100);
        setHoldProgress(pct);
        if (avgGrad < MIN_SHARPNESS_SCORE) {
          setStatusMessage(
            "Dekatkan KTP-el ke bingkai kamera hingga tulisan NIK terlihat fokus & tajam..."
          );
        } else {
          setStatusMessage(
            "Tahan posisi KTP-el tetap stabil di dalam bingkai kamera..."
          );
        }
      }
    }, 260);

    return () => clearInterval(interval);
  }, [
    autoDetectEnabled,
    captureAndExtractKtp,
    croppedDataUrl,
    processingOcr,
    streamActive,
  ]);

  const handleFileUploadFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        captureAndExtractKtp(img);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRescan = () => {
    setCroppedDataUrl(null);
    setDetectedResult(null);
    setOcrFailure(null);
    setHoldProgress(0);
    stabilityCounterRef.current = 0;
  };

  return (
    <div className="rounded-3xl bg-[#0E1936] text-white border-2 border-white/15 p-5 sm:p-7 shadow-2xl space-y-5">
      {/* Canvas tersembunyi untuk analisis frame & auto-crop KTP */}
      <canvas ref={analysisCanvasRef} className="hidden" />
      <canvas ref={cropCanvasRef} className="hidden" />

      {/* HEADER SCANNER KAMERA KTP */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FFD43B] text-[#111A30] flex items-center justify-center shrink-0 shadow">
            <Camera className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#FFD43B]">
              <ScanLine className="w-4 h-4" />
              PEMINDAI KAMERA KTP-EL (ORIENTASI NORMAL • STANDAR KEYAKINAN ≥{" "}
              {MIN_OCR_CONFIDENCE}%)
            </div>
            <h4 className="text-xl sm:text-2xl font-extrabold text-white">
              Arahkan KTP-el ke Kamera (Teks Tidak Di-Mirror)
            </h4>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMirrorVideo((v) => !v);
              setFlipHorizontalCapture((v) => !v);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-extrabold transition-colors ${
              mirrorVideo
                ? "bg-amber-400 text-[#111A30]"
                : "bg-white/15 hover:bg-white/25 text-white"
            }`}
            title="Gunakan hanya jika webcam perangkat Anda membalik gambar secara hardware"
          >
            <FlipHorizontal className="w-4 h-4" />
            {mirrorVideo
              ? "Orientasi: Dibalik (Mirror ON)"
              : "Orientasi: Teks Normal (Mirror OFF)"}
          </button>

          <button
            type="button"
            onClick={() => setAutoDetectEnabled((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-extrabold transition-colors ${
              autoDetectEnabled
                ? "bg-emerald-500 text-[#072116]"
                : "bg-white/10 text-slate-300"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {autoDetectEnabled ? "Auto-Crop: AKTIF" : "Auto-Crop: MANUAL"}
          </button>

          {devices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                startCamera(e.target.value);
              }}
              className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-xs sm:text-sm font-bold text-white"
            >
              {devices.map((d, i) => (
                <option
                  key={d.deviceId || i}
                  value={d.deviceId}
                  className="text-ink"
                >
                  {d.label || `Kamera ${i + 1}`}
                </option>
              ))}
            </select>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 hover:bg-white/20 p-2 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* INFO STANDAR KEYAKINAN (ANTI-SALAH BACA) */}
      <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 font-bold text-emerald-300">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>
            Mode Akurasi Ketat Aktif: Kamera tidak di-flip agar angka NIK
            terbaca lurus dari kiri ke kanan. Jika gambar buram/meragukan,
            sistem tidak akan memaksa membaca.
          </span>
        </div>
        <div className="font-mono text-xs font-extrabold text-[#FFD43B]">
          Ketajaman Lensa: {liveSharpness} (Min. {MIN_SHARPNESS_SCORE})
        </div>
      </div>

      {/* BODY: VIEWFINDER KAMERA ATAU HASIL AUTO-CROP KTP */}
      {!croppedDataUrl ? (
        <div className="space-y-4">
          {cameraError ? (
            <div className="rounded-2xl bg-rose-500/20 border border-rose-400/40 p-6 text-center space-y-4">
              <p className="text-base sm:text-lg font-bold text-rose-100">
                {cameraError}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="rounded-2xl bg-white/15 hover:bg-white/25 px-5 py-3 text-sm sm:text-base font-extrabold text-white"
                >
                  Coba Buka Kamera Lagi
                </button>
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-2xl bg-[#FFD43B] text-[#111A30] px-5 py-3 text-sm sm:text-base font-extrabold">
                  <Upload className="w-5 h-5" /> Pilih / Unggah Foto KTP
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUploadFallback}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="relative rounded-3xl overflow-hidden bg-black border-2 border-white/20 aspect-video max-h-[440px] w-full mx-auto flex items-center justify-center shadow-inner">
              {/* VIDEO STREAM WEBCAM — DEFAULT TANPA MIRROR AGAR ANGKA KTP TIDAK TERBALIK */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  mirrorVideo ? "-scale-x-100" : ""
                }`}
              />

              {/* OVERLAY GELAP DI LUAR BINGKAI KTP */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                {/* BINGKAI PANDUAN KTP-EL (RASIO CR80 1.586:1) */}
                <div
                  className={`relative w-[76%] max-w-[540px] aspect-[1.586/1] rounded-2xl transition-all duration-200 ${
                    holdProgress >= 50
                      ? "border-4 border-emerald-400 shadow-[0_0_0_9999px_rgba(7,15,34,0.65)]"
                      : "border-4 border-[#FFD43B] shadow-[0_0_0_9999px_rgba(7,15,34,0.60)]"
                  }`}
                >
                  {/* Sudut-sudut aksen scanner */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />

                  {/* Panduan Zona Dalam KTP-el (Header, NIK, Biodata, Pas Foto) */}
                  <div className="absolute inset-3 flex flex-col justify-between opacity-80">
                    <div className="text-center border-b border-dashed border-white/40 pb-1">
                      <span className="text-[11px] sm:text-xs font-extrabold tracking-widest uppercase text-white/95 bg-black/50 px-2.5 py-0.5 rounded">
                        PROVINSI BALI • KABUPATEN BULELENG
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center my-auto py-1">
                      <div className="col-span-8 space-y-1.5 pl-1">
                        <div className="rounded-lg border border-dashed border-[#FFD43B] bg-[#FFD43B]/20 px-2.5 py-1 text-[11px] sm:text-xs font-mono font-extrabold text-[#FFD43B]">
                          NIK: 5108xxxxxxxxxxxx (Kiri → Kanan)
                        </div>
                        <div className="rounded-lg border border-dashed border-white/40 bg-black/40 px-2.5 py-2 text-[10px] sm:text-xs text-white/90 space-y-0.5">
                          <div>• Pastikan tulisan NIK tajam & tidak silau</div>
                          <div>• Pas foto KTP berada di sisi KANAN</div>
                        </div>
                      </div>
                      <div className="col-span-4 flex flex-col items-center justify-center">
                        <div className="w-16 sm:w-20 aspect-[3/4] rounded-lg border-2 border-dashed border-white/60 bg-black/40 flex items-center justify-center text-[10px] font-bold text-white/85 text-center p-1">
                          PAS FOTO KTP (KANAN)
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar Auto-Detect & Stability */}
                    <div className="space-y-1">
                      <div className="w-full h-2.5 rounded-full bg-black/60 overflow-hidden border border-white/20">
                        <div
                          className={`h-full transition-all duration-200 ${
                            holdProgress >= 50
                              ? "bg-emerald-400"
                              : "bg-[#FFD43B]"
                          }`}
                          style={{
                            width: `${Math.max(
                              holdProgress,
                              cardPresenceScore > 60 ? 20 : 6
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BADGE STATUS DI BAGIAN ATAS VIDEO */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/80 backdrop-blur-md border border-white/20 px-4 py-1.5 text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    holdProgress >= 50
                      ? "bg-emerald-400 animate-ping"
                      : "bg-[#FFD43B] animate-pulse"
                  }`}
                />
                <span>{statusMessage}</span>
              </div>
            </div>
          )}

          {/* TOMBOL POTRET MANUAL & UNGGAH FILE */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => captureAndExtractKtp()}
              disabled={!streamActive || processingOcr}
              className="inline-flex items-center gap-3 rounded-2xl bg-[#FFD43B] hover:bg-[#FCC419] text-[#111A30] font-extrabold text-base sm:text-xl px-8 py-4 shadow-xl disabled:opacity-50 active:scale-95 transition-all"
            >
              <Camera className="w-6 h-6" />
              Potret & Baca KTP Sekarang
            </button>

            <label className="cursor-pointer inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm sm:text-base px-5 py-4 active:scale-95 transition-all">
              <Upload className="w-5 h-5" /> Unggah Foto KTP Jelas
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUploadFallback}
                className="hidden"
              />
            </label>
          </div>
        </div>
      ) : (
        /* LAYAR HASIL AUTO-CROP KTP & EVALUASI STANDAR KEYAKINAN */
        <div className="rounded-3xl bg-white/10 border border-white/20 p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* KOLOM KIRI: GAMBAR KTP HASIL AUTO-CROP */}
            <div className="md:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-slate-200">
                <span>Hasil Potongan KTP-el (CR80)</span>
                <span>Orientasi Lurus</span>
              </div>
              <div
                className={`rounded-2xl overflow-hidden border-2 shadow-lg bg-black aspect-[1.586/1] ${
                  ocrFailure ? "border-rose-400" : "border-emerald-400"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={croppedDataUrl}
                  alt="Hasil Auto-Crop KTP-el"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* KOLOM KANAN: LOADING / BERHASIL / DITOLAK KARENA TIDAK JELAS */}
            <div className="md:col-span-7 space-y-4">
              {processingOcr ? (
                <div className="py-8 text-center space-y-3">
                  <Loader2 className="w-12 h-12 text-[#FFD43B] animate-spin mx-auto" />
                  <div className="text-lg sm:text-xl font-extrabold text-white">
                    {processingStage}
                  </div>
                  <p className="text-sm text-slate-300">
                    Memverifikasi ketajaman gambar & tingkat keyakinan pembacaan
                    NIK...
                  </p>
                </div>
              ) : ocrFailure ? (
                /* TAMPILAN JIKA KTP TIDAK JELAS / DI BAWAH STANDAR KEYAKINAN (TIDAK DIPAKSA BACA) */
                <div className="rounded-2xl bg-rose-950/70 border-2 border-rose-400/60 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-rose-500/25 border border-rose-400/50 flex items-center justify-center shrink-0 text-rose-300">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <span className="inline-block rounded-full bg-rose-500/30 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-rose-200">
                        Pembacaan Dibatalkan • Keyakinan{" "}
                        {ocrFailure.measuredConfidence}% (Standar Minimum{" "}
                        {ocrFailure.requiredConfidence}%)
                      </span>
                      <h5 className="text-xl font-extrabold text-white">
                        {ocrFailure.title}
                      </h5>
                    </div>
                  </div>

                  <p className="text-sm sm:text-base text-rose-100 leading-relaxed">
                    {ocrFailure.reason}
                  </p>

                  <div className="rounded-xl bg-black/40 border border-white/10 p-3.5 text-xs sm:text-sm space-y-1 text-slate-200">
                    <div className="font-bold text-[#FFD43B]">
                      Diagnostik Kualitas Pembacaan:
                    </div>
                    <div>
                      • Skor Ketajaman Fokus:{" "}
                      <span className="font-mono font-bold">
                        {ocrFailure.sharpnessScore}
                      </span>{" "}
                      (Standar minimum: {MIN_SHARPNESS_SCORE})
                    </div>
                    <div>
                      • Tingkat Keyakinan OCR:{" "}
                      <span className="font-mono font-bold">
                        {ocrFailure.measuredConfidence}%
                      </span>{" "}
                      (Standar minimum: {ocrFailure.requiredConfidence}%)
                    </div>
                    <div>
                      • Karakter NIK Terdeteksi:{" "}
                      <span className="font-mono font-bold">
                        {ocrFailure.extractedRawNik ||
                          "Tidak terbaca jelas (buram/silau)"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleRescan}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#FFD43B] hover:bg-[#FCC419] text-[#111A30] font-extrabold text-base sm:text-lg px-6 py-3.5 shadow-lg active:scale-95 transition-all"
                    >
                      <RefreshCw className="w-5 h-5" /> Foto Ulang KTP Lebih
                      Dekat & Fokus
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMirrorVideo((v) => !v);
                        setFlipHorizontalCapture((v) => !v);
                        handleRescan();
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-sm sm:text-base px-4 py-3.5 active:scale-95 transition-all"
                    >
                      <FlipHorizontal className="w-4 h-4" /> Balik Orientasi
                      Kamera & Coba Lagi
                    </button>
                  </div>
                </div>
              ) : detectedResult ? (
                /* TAMPILAN JIKA KTP LOLOS STANDAR KEYAKINAN & TERVERIFIKASI DATABASE */
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/25 border border-emerald-400/40 px-3.5 py-1 text-xs sm:text-sm font-extrabold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    {detectedResult.sourceLabel} • Keyakinan{" "}
                    {detectedResult.confidence}% (Lolos Standar ≥{" "}
                    {MIN_OCR_CONFIDENCE}%)
                  </div>

                  <div className="rounded-2xl bg-white text-ink p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 shadow">
                    <div className="sm:col-span-2 border-b border-line pb-2">
                      <span className="text-xs font-bold text-ink-muted uppercase">
                        Nama Lengkap Sesuai KTP-el
                      </span>
                      <div className="text-2xl font-extrabold text-ink">
                        {detectedResult.resident.full_name}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-ink-muted uppercase">
                        Nomor Induk Kependudukan (NIK)
                      </span>
                      <div className="font-mono text-lg font-extrabold text-[#6741D9]">
                        {detectedResult.resident.nik}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-ink-muted uppercase">
                        Banjar Dinas / Alamat
                      </span>
                      <div className="text-base font-bold text-ink">
                        Banjar Dinas{" "}
                        {detectedResult.resident.dusun_name || "Ringdikit"}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-ink-muted uppercase">
                        Tempat, Tgl Lahir
                      </span>
                      <div className="text-sm font-semibold text-ink">
                        {detectedResult.resident.birth_place},{" "}
                        {detectedResult.resident.birth_date}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-ink-muted uppercase">
                        Pekerjaan & Agama
                      </span>
                      <div className="text-sm font-semibold text-ink">
                        {detectedResult.resident.occupation || "-"} •{" "}
                        {detectedResult.resident.religion || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onDetected(detectedResult)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-[#072116] font-extrabold text-base sm:text-lg px-6 py-3.5 shadow-lg active:scale-95 transition-all"
                    >
                      <UserCheck className="w-5 h-5" /> Gunakan Data KTP Ini
                    </button>
                    <button
                      type="button"
                      onClick={handleRescan}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-sm sm:text-base px-5 py-3.5 active:scale-95 transition-all"
                    >
                      <RefreshCw className="w-4 h-4" /> Scan Ulang KTP Lain
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
