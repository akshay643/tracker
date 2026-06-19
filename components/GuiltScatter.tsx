"use client";
// =============================================================================
// Feature 22: Guilt Score / Value-to-Cost Scatter Plot.
// X = cost, Y = self-reported 1–5 "Life Satisfaction". The top-right is great
// value; the bottom-right ("expensive but unfulfilling") is the guilt quadrant.
// Click any logged expense to rate it; rated points populate the chart.
// =============================================================================

import React, { useMemo, useState } from "react";
import { useStore, useCategoryMap } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { Card } from "./ui";

const W = 460;
const H = 280;
const PAD = { l: 40, r: 16, t: 16, b: 32 };

export function GuiltScatter() {
  const { state, updateEntry } = useStore();
  const catMap = useCategoryMap();
  const base = state.settings.baseCurrency;

  const rated = useMemo(
    () => state.entries.filter((e) => e.kind === "expense" && e.satisfaction),
    [state.entries]
  );
  const unrated = useMemo(
    () => state.entries.filter((e) => e.kind === "expense" && !e.satisfaction).slice(0, 6),
    [state.entries]
  );

  const maxCost = Math.max(1, ...rated.map((e) => e.baseAmount));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (cost: number) => PAD.l + (cost / maxCost) * innerW;
  const y = (sat: number) => PAD.t + innerH - ((sat - 0.5) / 4.5) * innerH;

  const [hover, setHover] = useState<string | null>(null);

  // "Guilt" = high cost, low satisfaction → big, red dots.
  const guiltScore = (cost: number, sat: number) =>
    +((cost / maxCost) * (1 - (sat - 1) / 4)).toFixed(2);

  return (
    <Card title="Value-to-Cost (Guilt Map)" icon="💔">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]">
          {/* guilt quadrant shading (high cost, low satisfaction) */}
          <rect x={PAD.l + innerW / 2} y={PAD.t + innerH / 2} width={innerW / 2} height={innerH / 2} fill="#ef444412" />
          <text x={PAD.l + innerW * 0.72} y={PAD.t + innerH - 8} className="fill-bad/70 text-[9px]">
            expensive · unfulfilling
          </text>
          <text x={PAD.l + 4} y={PAD.t + 12} className="fill-good/70 text-[9px]">
            cheap · joyful
          </text>

          {/* axes */}
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + innerH} stroke="#243056" />
          <line x1={PAD.l} y1={PAD.t + innerH} x2={W - PAD.r} y2={PAD.t + innerH} stroke="#243056" />
          {[1, 2, 3, 4, 5].map((s) => (
            <text key={s} x={PAD.l - 8} y={y(s) + 3} textAnchor="end" className="fill-[#8a93b2] text-[9px]">
              {"★".repeat(s)}
            </text>
          ))}

          {rated.map((e) => {
            const g = guiltScore(e.baseAmount, e.satisfaction!);
            const r = 4 + g * 10;
            const color = e.satisfaction! >= 4 ? "#22c55e" : e.satisfaction! >= 3 ? "#f59e0b" : "#ef4444";
            return (
              <circle
                key={e.id}
                cx={x(e.baseAmount)}
                cy={y(e.satisfaction!)}
                r={hover === e.id ? r + 3 : r}
                fill={color}
                fillOpacity={0.7}
                stroke={color}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHover(e.id)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </svg>
      </div>

      {hover && (() => {
        const e = rated.find((r) => r.id === hover)!;
        return (
          <div className="mb-2 rounded-xl border border-edge bg-panel2/60 p-2 text-xs">
            <strong>{e.note || catMap[e.categoryId]?.name}</strong> · {formatMoney(e.baseAmount, base)} ·{" "}
            {"★".repeat(e.satisfaction!)} · guilt {guiltScore(e.baseAmount, e.satisfaction!)}
          </div>
        );
      })()}

      {/* Rate recent unrated expenses */}
      {unrated.length > 0 && (
        <div className="mt-2 border-t border-edge pt-2">
          <div className="label mb-2">Rate recent purchases (1–5 satisfaction)</div>
          <div className="space-y-1">
            {unrated.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">
                  {e.note || catMap[e.categoryId]?.name} · {formatMoney(e.baseAmount, base)}
                </span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      className="px-0.5 text-muted hover:text-warn"
                      onClick={() => updateEntry(e.id, { satisfaction: s })}
                    >
                      ☆
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
