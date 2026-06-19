"use client";
// Shared presentational primitives reused across feature components.

import React, { useState } from "react";
import { FEATURE_INFO } from "@/lib/featureInfo";

export function Card({
  title,
  icon,
  right,
  info,
  className = "",
  children,
}: {
  title?: string;
  icon?: string;
  right?: React.ReactNode;
  /** Explanation shown behind the ⓘ button. Falls back to FEATURE_INFO[title]. */
  info?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const help = info ?? (title ? FEATURE_INFO[title] : undefined);

  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="card-title">
            {icon && <span aria-hidden>{icon}</span>}
            {title}
            {help && (
              <button
                type="button"
                onClick={() => setShowInfo((s) => !s)}
                aria-label={`About ${title}`}
                aria-expanded={showInfo}
                className={`ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                  showInfo
                    ? "border-accent bg-accent text-white"
                    : "border-edge text-muted hover:border-accent hover:text-white"
                }`}
              >
                i
              </button>
            )}
          </h2>
          {right}
        </header>
      )}
      {help && showInfo && (
        <div className="mb-3 rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs leading-relaxed text-white/80">
          {help}
        </div>
      )}
      {children}
    </section>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-edge bg-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn px-2 py-1" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border-t border-edge bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-[sheet-up_.22s_ease-out] sm:max-w-lg sm:rounded-3xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-edge sm:hidden" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn px-2 py-1" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A color-aware progress bar (green → yellow → red by ratio). */
export function ProgressBar({ ratio }: { ratio: number }) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const color = ratio >= 1 ? "bg-bad" : ratio >= 0.8 ? "bg-warn" : "bg-good";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink/70">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    default: "text-white",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
  }[tone];
  return (
    <div className="rounded-xl border border-edge bg-panel2/60 p-3">
      <div className="label">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function TagPill({ tag }: { tag: string }) {
  return <span className="chip text-accent2 border-accent2/30">#{tag}</span>;
}
