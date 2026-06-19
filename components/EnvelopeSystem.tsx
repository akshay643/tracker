"use client";
// =============================================================================
// Feature 11: The Envelope Allocation System.
// Splits monthly income into per-category caps by target %, then tracks spend
// against each "envelope". Edit a category's `envelopePct` in the Category
// manager to change allocations.
// =============================================================================

import React from "react";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { allocateEnvelopes, monthKey, todayISO, totalIncome } from "@/lib/algorithms";
import { Card, ProgressBar } from "./ui";

export function EnvelopeSystem() {
  const { state } = useStore();
  const base = state.settings.baseCurrency;
  const month = monthKey(todayISO());
  const income = Math.max(totalIncome(state.entries, month), state.settings.monthlyIncomeTarget);
  const envelopes = allocateEnvelopes(income, state.categories, state.entries, month);
  const totalPct = envelopes.reduce((s, e) => s + e.pct, 0);

  return (
    <Card
      title="Envelope Allocation"
      icon="✉️"
      right={<span className="chip">{totalPct}% of {formatMoney(income, base)}</span>}
    >
      {envelopes.length === 0 ? (
        <p className="text-sm text-muted">
          Set an <strong>Envelope %</strong> on categories to auto-divide your income.
        </p>
      ) : (
        <div className="space-y-3">
          {envelopes.map((e) => {
            const ratio = e.allocated > 0 ? e.spent / e.allocated : 0;
            return (
              <div key={e.category.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.category.color }} />
                    {e.category.name}
                    <span className="text-xs text-muted">({e.pct}%)</span>
                  </span>
                  <span className="tabular-nums text-muted">
                    {formatMoney(e.spent, base)} / {formatMoney(e.allocated, base)}
                  </span>
                </div>
                <ProgressBar ratio={ratio} />
                <div className="mt-0.5 text-right text-xs">
                  <span className={e.remaining < 0 ? "text-bad" : "text-good"}>
                    {e.remaining < 0 ? "over by " : "left "}
                    {formatMoney(Math.abs(e.remaining), base)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
