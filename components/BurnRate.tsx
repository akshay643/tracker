"use client";
// =============================================================================
// Feature 17: Budget Burn-Rate Indicators — per-category progress bars that
// shift Green → Yellow → Red as spend crosses 80% / 100% of the monthly cap.
// =============================================================================

import React, { useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { burnRate, monthKey, todayISO, totalSpend } from "@/lib/algorithms";
import { Card, ProgressBar } from "./ui";

export function BurnRate() {
  const { state } = useStore();
  const base = state.settings.baseCurrency;
  const month = monthKey(todayISO());

  const rows = useMemo(
    () =>
      state.categories
        .filter((c) => (c.cap ?? 0) > 0)
        .map((c) => {
          const spent = totalSpend(state.entries, { month, categoryId: c.id });
          return { category: c, burn: burnRate(spent, c.cap!) };
        })
        .sort((a, b) => b.burn.ratio - a.burn.ratio),
    [state.categories, state.entries, month]
  );

  return (
    <Card title="Budget Burn-Rate" icon="🔥">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Add a monthly cap to a category to track burn-rate.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ category, burn }) => (
            <div key={category.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: category.color }} />
                  {category.name}
                </span>
                <span
                  className={`tabular-nums ${
                    burn.status === "bad" ? "text-bad" : burn.status === "warn" ? "text-warn" : "text-muted"
                  }`}
                >
                  {formatMoney(burn.spent, base)} / {formatMoney(burn.cap, base)} · {(burn.ratio * 100).toFixed(0)}%
                </span>
              </div>
              <ProgressBar ratio={burn.ratio} />
              {burn.status !== "good" && (
                <div className={`mt-0.5 text-xs ${burn.status === "bad" ? "text-bad" : "text-warn"}`}>
                  {burn.status === "bad"
                    ? `Over budget by ${formatMoney(burn.spent - burn.cap, base)}`
                    : "Approaching limit — slow down"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
