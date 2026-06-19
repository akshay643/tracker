"use client";
// =============================================================================
// Feature 16: Monthly Trend Line Analysis — rolling income vs. spend per month,
// rendered as grouped bars + a net line, in a responsive SVG.
// =============================================================================

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { monthlyTrend } from "@/lib/algorithms";
import { Card } from "./ui";

const W = 520;
const H = 220;
const PAD = { l: 8, r: 8, t: 16, b: 24 };

export function TrendChart() {
  const { state } = useStore();
  const base = state.settings.baseCurrency;
  const data = useMemo(() => monthlyTrend(state.entries, 6), [state.entries]);
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.spend)));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const groupW = innerW / Math.max(1, data.length);
  const barW = groupW * 0.28;

  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;

  // Net line points
  const netMax = Math.max(1, ...data.map((d) => Math.abs(d.net)));
  const netY = (v: number) => PAD.t + innerH / 2 - (v / netMax) * (innerH / 2);
  const linePts = data
    .map((d, i) => `${PAD.l + groupW * i + groupW / 2},${netY(d.net)}`)
    .join(" ");

  return (
    <Card title="Income vs. Spend Trend" icon="📈">
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Not enough history yet.</p>
      ) : (
        <>
          <div className="mb-2 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-good" /> Income</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-accent" /> Spend</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-accent2" /> Net</span>
          </div>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[460px]">
              {/* baseline */}
              <line x1={PAD.l} y1={PAD.t + innerH} x2={W - PAD.r} y2={PAD.t + innerH} stroke="#243056" />
              {data.map((d, i) => {
                const gx = PAD.l + groupW * i;
                return (
                  <g
                    key={d.month}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {hover === i && (
                      <rect x={gx} y={PAD.t} width={groupW} height={innerH} fill="#ffffff08" />
                    )}
                    <rect
                      x={gx + groupW / 2 - barW - 2}
                      y={y(d.income)}
                      width={barW}
                      height={PAD.t + innerH - y(d.income)}
                      rx={3}
                      className="fill-good"
                    />
                    <rect
                      x={gx + groupW / 2 + 2}
                      y={y(d.spend)}
                      width={barW}
                      height={PAD.t + innerH - y(d.spend)}
                      rx={3}
                      className="fill-accent"
                    />
                    <text
                      x={gx + groupW / 2}
                      y={H - 6}
                      textAnchor="middle"
                      className="fill-[#8a93b2] text-[9px]"
                    >
                      {d.month.slice(2)}
                    </text>
                  </g>
                );
              })}
              {/* net line */}
              <polyline points={linePts} fill="none" stroke="#22d3ee" strokeWidth={2} />
              {data.map((d, i) => (
                <circle
                  key={d.month}
                  cx={PAD.l + groupW * i + groupW / 2}
                  cy={netY(d.net)}
                  r={3}
                  className="fill-accent2"
                />
              ))}
            </svg>
          </div>
          {hover !== null && (
            <div className="mt-2 flex justify-around rounded-xl border border-edge bg-panel2/60 p-2 text-xs">
              <span className="text-good">Income {formatMoney(data[hover].income, base)}</span>
              <span className="text-accent">Spend {formatMoney(data[hover].spend, base)}</span>
              <span className={data[hover].net >= 0 ? "text-accent2" : "text-bad"}>
                Net {formatMoney(data[hover].net, base)}
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
