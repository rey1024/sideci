import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react";

interface TenantVerifyPageProps {
  params: Promise<{ villageSlug: string; token: string }>;
}

export default async function TenantVerifyLetterQRPage({
  params,
}: TenantVerifyPageProps) {
  const { villageSlug, token } = await params;
  const slug = villageSlug.toLowerCase();

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full soft-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-pastel-mintSoft text-[#099268] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#099268]">
              Dokumen Terverifikasi Sah
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-ink">
              Keaslian Surat Desa Ringdikit
            </h1>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
          QR Code yang dipindai cocok dengan buku register elektronik resmi pada
          sistem{" "}
          <strong className="text-ink">
            SIDECI Pemerintah Desa Ringdikit
          </strong>
          .
        </p>

        <div className="rounded-2xl bg-[#F9FAFD] border border-line p-4 space-y-2.5 text-xs sm:text-sm">
          <div className="flex justify-between gap-3 border-b border-line pb-2">
            <span className="text-ink-muted">Token Verifikasi</span>
            <span className="font-mono font-semibold text-ink">{token}</span>
          </div>
          <div className="flex justify-between gap-3 border-b border-line pb-2">
            <span className="text-ink-muted">Nomor Surat</span>
            <span className="font-mono font-semibold text-ink">
              147/0042/XI/2026
            </span>
          </div>
          <div className="flex justify-between gap-3 border-b border-line pb-2">
            <span className="text-ink-muted">Jenis Dokumen</span>
            <span className="font-semibold text-ink text-right">
              Surat Keterangan Umum / Pengantar
            </span>
          </div>
          <div className="flex justify-between gap-3 border-b border-line pb-2">
            <span className="text-ink-muted">Pemohon (UU PDP Masking)</span>
            <span className="font-semibold text-ink">I P*** P****** W*****</span>
          </div>
          <div className="flex justify-between gap-3 border-b border-line pb-2">
            <span className="text-ink-muted">Pejabat Penandatangan</span>
            <span className="font-semibold text-ink text-right">
              I Made Sumadi (Perbekel Ringdikit)
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-ink-muted">Tanggal Terbit</span>
            <span className="font-medium text-ink">19 November 2026</span>
          </div>
        </div>

        <div className="rounded-xl bg-pastel-mintSoft/60 border border-pastel-mint/25 p-3.5 flex items-center gap-2.5 text-xs text-ink-secondary">
          <ShieldCheck className="w-4 h-4 text-[#099268] shrink-0" />
          Apabila rincian fisik berbeda dengan data di atas, dokumen tersebut
          dinyatakan tidak sah.
        </div>

        <div className="flex items-center justify-between pt-1">
          <Link href={`/${slug}`} className="soft-btn-primary text-xs py-2">
            <ArrowLeft className="w-4 h-4" /> Portal Desa
          </Link>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
            <FileCheck2 className="w-4 h-4" /> SIDECI Verify
          </span>
        </div>
      </div>
    </div>
  );
}
