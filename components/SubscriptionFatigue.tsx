"use client";
// =============================================================================
// Feature 23: "Subscription Fatigue" Lifetime Cost Auditor.
// Aggregates all active recurring subscriptions and projects their compounding
// cost over 1 and 5 years to trigger conscious cancellations.
// =============================================================================

import React, { useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { monthlyEquivalent, subscriptionFatigue } from "@/lib/algorithms";
import { Card, Stat } from "./ui";

export function SubscriptionFatigue() {
  const { state } = useStore();
  const base = state.settings.baseCurrency;
  const proj = useMemo(() => subscriptionFatigue(state.subscriptions), [state.subscriptions]);

  const active = state.subscriptions.filter((s) => s.active);
  const ranked = [...active].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
  const worst = ranked[0];

  return (
    <Card title="Subscription Fatigue Auditor" icon="🪫">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Per month" value={formatMoney(proj.monthly, base)} sub={`${proj.activeCount} active`} />
        <Stat label="1-year cost" value={formatMoney(proj.yearly, base)} tone="warn" />
        <Stat label="5-year cost" value={formatMoney(proj.fiveYear, base)} tone="bad" />
      </div>

      {worst && (
        <p className="mt-3 rounded-xl border border-bad/30 bg-bad/10 p-2 text-xs text-white/90">
          💡 <strong>{worst.name}</strong> is your priciest at{" "}
          {formatMoney(monthlyEquivalent(worst) * 60, base)} over 5 years. Cancelling it alone saves{" "}
          {formatMoney(monthlyEquivalent(worst) * 12, base)}/yr.
        </p>
      )}

      <div className="mt-3 space-y-1">
        {ranked.map((s) => {
          const fiveYr = monthlyEquivalent(s) * 60;
          const pct = proj.fiveYear ? (fiveYr / proj.fiveYear) * 100 : 0;
          return (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 truncate">{s.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/70">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-24 text-right tabular-nums text-muted">{formatMoney(fiveYr, base)}/5y</span>
            </div>
          );
        })}
        {ranked.length === 0 && <p className="text-sm text-muted">No active subscriptions.</p>}
      </div>
    </Card>
  );
}
