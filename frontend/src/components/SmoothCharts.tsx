import React from "react";

export function TrendPill({ label }: { label: string }) {
  return (
    <span className="trend-pill">
      <span className="w-4 h-4 rounded-full bg-pastel-mintSoft text-pastel-mint inline-flex items-center justify-center text-[10px] font-bold">
        ↑
      </span>
      <span>{label}</span>
    </span>
  );
}

export function SmoothVioletSparkline({ badgeText }: { badgeText: string }) {
  return (
    <div className="relative pt-6">
      <div className="absolute right-8 top-1 z-10">
        <TrendPill label={badgeText} />
      </div>
      <svg
        viewBox="0 0 280 115"
        className="w-full h-28 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="violetAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#845EF7" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#845EF7" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path
          d="M 4 98 C 28 84, 48 92, 72 74 C 98 54, 118 68, 146 46 C 170 28, 190 12, 212 16 C 236 20, 254 58, 276 86 L 276 112 L 4 112 Z"
          fill="url(#violetAreaFill)"
        />
        <path
          d="M 4 98 C 28 84, 48 92, 72 74 C 98 54, 118 68, 146 46 C 170 28, 190 12, 212 16 C 236 20, 254 58, 276 86"
          fill="none"
          stroke="#7950F2"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle
          cx="206"
          cy="15"
          r="5"
          fill="#FFFFFF"
          stroke="#7950F2"
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
}

export function SmoothHoneyAreaChart({
  badgeText,
  labels,
}: {
  badgeText: string;
  labels: string[];
}) {
  return (
    <div className="relative pt-4">
      <div className="absolute right-14 top-2 z-10">
        <TrendPill label={badgeText} />
      </div>
      <svg
        viewBox="0 0 460 135"
        className="w-full h-36 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="honeyAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FCC419" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#FCC419" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[28, 62, 96].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="460"
            y2={y}
            stroke="#F1F4F9"
            strokeWidth="1"
          />
        ))}
        <path
          d="M 6 66 C 48 72, 82 58, 128 38 C 174 18, 212 52, 260 44 C 306 36, 336 24, 372 26 C 406 28, 434 18, 454 22 L 454 115 L 6 115 Z"
          fill="url(#honeyAreaFill)"
        />
        <path
          d="M 6 66 C 48 72, 82 58, 128 38 C 174 18, 212 52, 260 44 C 306 36, 336 24, 372 26 C 406 28, 434 18, 454 22"
          fill="none"
          stroke="#F59F00"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle
          cx="372"
          cy="26"
          r="5"
          fill="#FFFFFF"
          stroke="#F59F00"
          strokeWidth="2.5"
        />
      </svg>
      <div className="flex justify-between text-xs text-ink-muted px-2 pt-1">
        {labels.map((lbl) => (
          <span key={lbl}>{lbl}</span>
        ))}
      </div>
    </div>
  );
}

export function PastelBarChart({
  items,
  badgeText,
}: {
  items: { short: string; label: string; count: number; highlight?: boolean }[];
  badgeText: string;
}) {
  const maxVal = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="space-y-2 pt-2">
      <div className="grid grid-cols-12 gap-2 items-end h-44 pt-6 relative border-b border-line pb-2">
        {/* Garis bantu tipis */}
        <div className="absolute inset-x-0 top-8 border-t border-dashed border-line pointer-events-none" />
        <div className="absolute inset-x-0 top-20 border-t border-dashed border-line pointer-events-none" />
        <div className="absolute inset-x-0 top-32 border-t border-dashed border-line pointer-events-none" />

        {items.map((item) => {
          const heightPct = Math.max(Math.round((item.count / maxVal) * 100), 12);
          return (
            <div
              key={item.short}
              className="col-span-2 flex flex-col items-center justify-end h-full relative group"
            >
              {item.highlight && (
                <div className="absolute -top-6 z-10 whitespace-nowrap">
                  <TrendPill label={badgeText} />
                </div>
              )}
              <div
                title={`${item.label}: ${item.count.toLocaleString("id-ID")} jiwa`}
                className="w-full max-w-[34px] rounded-t-lg transition-all duration-300"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: item.highlight ? "#FF6B5B" : "#FDD8D3",
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-2 text-center text-xs text-ink-muted">
        {items.map((item) => (
          <div key={item.short} className="col-span-2 font-medium truncate">
            {item.short}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SmoothSingleRingDonut({
  centerValue,
  centerLabel,
  percentage,
  badgeText,
}: {
  centerValue: string;
  centerLabel: string;
  percentage: number;
  badgeText: string;
}) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const dash = (percentage / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center py-2">
      <div className="relative w-44 h-44 flex items-center justify-center">
        <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90">
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke="#EAF6EC"
            strokeWidth="12"
          />
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke="#22B8CF"
            strokeWidth="12"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold tabular-nums text-ink">
            {centerValue}
          </span>
          <span className="text-xs text-ink-muted mt-0.5">{centerLabel}</span>
        </div>
      </div>

      <div className="-mt-3 self-end mr-2">
        <TrendPill label={badgeText} />
      </div>
    </div>
  );
}

export function MultiSegmentDonut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90">
          {segments.map((seg) => {
            const len = (seg.value / total) * circumference;
            const dashArray = `${Math.max(len - 3, 2)} ${circumference}`;
            const dashOffset = -cumulativeOffset;
            cumulativeOffset += len;
            return (
              <circle
                key={seg.label}
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="14"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-bold tabular-nums text-ink">
            {centerValue}
          </span>
          <span className="text-xs text-ink-muted">{centerLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full pt-3 text-xs">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-1.5">
            <span className="flex items-center gap-1.5 text-ink-secondary truncate">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {s.value.toLocaleString("id-ID")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
