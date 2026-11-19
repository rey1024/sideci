import type { Metadata } from "next";
import "./globals.css";
import DemoAccessGate from "@/components/DemoAccessGate";

export const metadata: Metadata = {
  title: "SIDECI — Sistem Desa Cerdas Terintegrasi | Desa Ringdikit",
  description:
    "Portal pelayanan publik, kependudukan berjenjang Banjar Dinas, persuratan otomatis ber-QR Code, dan statistik Desa Ringdikit, Kec. Seririt, Kab. Buleleng.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-canvas text-ink min-h-screen">
        <DemoAccessGate>{children}</DemoAccessGate>
      </body>
    </html>
  );
}
