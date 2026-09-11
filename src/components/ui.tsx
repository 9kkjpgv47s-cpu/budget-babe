import Link from "next/link";
import type { ReactNode } from "react";

/** Page title + subtitle + right-side actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">{title}</h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Label + big tabular number + hint. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-foreground";
  return (
    <div className="card card-hover p-4 md:p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className={`stat-value mt-1.5 text-[1.35rem] md:text-2xl ${toneClass}`}>{value}</div>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Envelope progress: emerald → amber past warnAt → red over 100. */
export function ProgressBar({
  value,
  max,
  warnAt = 80,
}: {
  value: number;
  max: number;
  warnAt?: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const over = value > max && max > 0;
  const color = over
    ? "var(--negative)"
    : pct >= warnAt
      ? "linear-gradient(90deg, var(--warning), #f59e0b)"
      : "linear-gradient(90deg, var(--accent-strong), var(--accent))";
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Empty state with a soft icon well. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Prev / month / next switcher used across month-scoped pages. */
export function MonthNav({ yearMonth, prevYm, nextYm }: { yearMonth: string; prevYm: string; nextYm: string }) {
  const label = new Date(`${yearMonth}-15T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="card flex items-center gap-1 px-1.5 py-1 text-sm">
      <Link
        href={`?ym=${prevYm}`}
        className="rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Previous month"
      >
        ←
      </Link>
      <span className="stat-value min-w-[8.5rem] text-center text-sm font-medium">{label}</span>
      <Link
        href={`?ym=${nextYm}`}
        className="rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Next month"
      >
        →
      </Link>
    </div>
  );
}

const DONUT_COLORS = [
  "#059669", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444",
  "#14b8a6", "#6366f1", "#ec4899", "#84cc16", "#f97316",
];

/** Lightweight SVG donut. segments: [{label, valueCents}] — renders top N + "Other". */
export function DonutChart({
  segments,
  totalCents,
  centerLabel,
  centerValue,
  size = 168,
  thickness = 22,
}: {
  segments: { label: string; valueCents: number }[];
  totalCents: number;
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const shown = segments.filter((s) => s.valueCents > 0).slice(0, 8);
  const shownSum = shown.reduce((s, x) => s + x.valueCents, 0);
  const other = Math.max(0, totalCents - shownSum);
  const slices = other > 0 ? [...shown, { label: "Other", valueCents: other }] : shown;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Spending breakdown">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={thickness}
      />
      {totalCents > 0
        ? slices.map((s, i) => {
            const frac = s.valueCents / totalCents;
            const dash = frac * c;
            const offset = -acc * c;
            acc += frac;
            return (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.label === "Other" ? "var(--border-strong)" : DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(0, dash - 1.5)} ${c - dash + 1.5}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
          })
        : null}
      {centerValue ? (
        <text
          x="50%"
          y={centerLabel ? "47%" : "50%"}
          textAnchor="middle"
          dominantBaseline="middle"
          className="stat-value"
          fill="var(--foreground)"
          fontSize="22"
          fontWeight="650"
        >
          {centerValue}
        </text>
      ) : null}
      {centerLabel ? (
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize="11"
        >
          {centerLabel}
        </text>
      ) : null}
    </svg>
  );
}

/** Stacked allocation bar: labeled colored segments sharing one track. */
export function StackedBar({
  segments,
  trackColor,
}: {
  segments: { label: string; valueCents: number; color: string }[];
  trackColor?: string;
}) {
  const total = Math.max(
    1,
    segments.reduce((s, x) => s + Math.max(0, x.valueCents), 0),
  );
  return (
    <div
      className="flex h-3 gap-px overflow-hidden rounded-full"
      style={{ background: trackColor ?? "var(--muted)" }}
    >
      {segments
        .filter((s) => s.valueCents > 0)
        .map((s) => (
          <div
            key={s.label}
            title={`${s.label}`}
            className="h-full"
            style={{ width: `${(s.valueCents / total) * 100}%`, background: s.color }}
          />
        ))}
    </div>
  );
}
