"use client";
// =============================================================================
// Feature 15: Interactive Category Breakdown — a hand-rolled SVG donut chart
// with hover tooltips (no chart library required; the same data shape feeds a
// Recharts <Pie> if you later add the dependency).
// =============================================================================

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { monthKey, spendByCategory, todayISO } from "@/lib/algorithms";
import { Card } from "./ui";

const R = 70;
const STROKE = 26;
const C = 2 * Math.PI * R;

export function CategoryChart() {
  const { state } = useStore();
  const base = state.settings.baseCurrency;
  const month = monthKey(todayISO());
  const data = useMemo(
    () => spendByCategory(state.entries, state.categories, month),
    [state.entries, state.categories, month]
  );
  const total = data.reduce((s, d) => s + d.total, 0);
  const [hover, setHover] = useState<number | null>(null);

  let offset = 0;
  const segments = data.map((d, i) => {
    const len = (d.pct / 100) * C;
    const seg = { ...d, dash: len, gap: C - len, offset, i };
    offset -= len;
    return seg;
  });

  const active = hover !== null ? data[hover] : null;

  return (
    <Card title="Category Breakdown" icon="📊" right={<span className="chip">{month}</span>}>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No spending logged this month yet.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative">
            <svg width={180} height={180} viewBox="0 0 180 180">
              <g transform="translate(90,90) rotate(-90)">
                {segments.map((s) => (
                  <circle
                    key={s.category.id}
                    r={R}
                    fill="none"
                    stroke={s.category.color}
                    strokeWidth={hover === s.i ? STROKE + 6 : STROKE}
                    strokeDasharray={`${s.dash} ${s.gap}`}
                    strokeDashoffset={s.offset}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHover(s.i)}
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-muted">{active ? active.category.name : "Total"}</span>
              <span className="text-lg font-semibold tabular-nums">
                {formatMoney(active ? active.total : total, base)}
              </span>
              {active && <span className="text-xs text-muted">{active.pct.toFixed(1)}%</span>}
            </div>
          </div>

          <ul className="flex-1 space-y-1 text-sm">
            {data.map((d, i) => (
              <li
                key={d.category.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
                  hover === i ? "bg-panel2" : ""
                }`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.category.color }} />
                <span className="flex-1">{d.category.name}</span>
                <span className="tabular-nums text-muted">{d.pct.toFixed(0)}%</span>
                <span className="w-20 text-right tabular-nums">{formatMoney(d.total, base)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
