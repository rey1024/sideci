import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F4F6FB",
        ink: {
          DEFAULT: "#1E2438",
          secondary: "#5A6578",
          muted: "#8A94A6",
        },
        line: {
          DEFAULT: "#EAEFF7",
          strong: "#DCE3F0",
        },
        pastel: {
          violet: "#7950F2",
          violetSoft: "#F2EFFE",
          violetTrack: "#ECE8FD",
          aqua: "#22B8CF",
          aquaSoft: "#E3FAFC",
          mint: "#12B886",
          mintSoft: "#E6FCF5",
          coral: "#FF6B5B",
          coralSoft: "#FFE5E2",
          coralBar: "#FDD8D3",
          honey: "#F59F00",
          honeySoft: "#FFF8DB",
          lime: "#82C91E",
          limeSoft: "#EEFCE3",
        },
      },
      fontFamily: {
        sans: [
          '"Inter"',
          '"Plus Jakarta Sans"',
          '"Segoe UI"',
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        soft: "0 4px 24px -4px rgba(24, 39, 75, 0.04), 0 2px 6px -1px rgba(24, 39, 75, 0.02)",
        pill: "0 4px 12px rgba(24, 39, 75, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
