"use client";
// =============================================================================
// Feature 19: "Safe-to-Spend" rolling daily allowance.
// Feature 20: Cash-Flow & Runway Simulator ("days of cash remaining").
// Both recompute live from the store via lib/algorithms.
// =============================================================================

import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { runway, safeToSpend } from "@/lib/algorithms";
import { Card, Stat } from "./ui";

export function SafeToSpend() {
  const { state, patchSettings } = useStore();
  const base = state.settings.baseCurrency;

  // Re-tick once a minute so the daily figures stay current across midnight.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const sts = safeToSpend(state);
  const rw = runway(state);
  const overToday = sts.spentToday > sts.dailyAllowance;
  const remainingToday = Math.max(0, sts.dailyAllowance - sts.spentToday);

  const runwayTone = rw.daysRemaining === Infinity ? "good" : rw.daysRemaining < 30 ? "bad" : rw.daysRemaining < 90 ? "warn" : "good";

  return (
    <Card title="Safe-to-Spend & Runway" icon="🧭">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Daily allowance"
          value={formatMoney(sts.dailyAllowance, base)}
          sub={`${sts.daysLeft} days left this month`}
        />
        <Stat
          label="Spent today"
          value={formatMoney(sts.spentToday, base)}
          tone={overToday ? "bad" : "good"}
          sub={overToday ? "over allowance" : `${formatMoney(remainingToday, base)} left today`}
        />
        <Stat
          label="Upcoming bills"
          value={formatMoney(sts.upcomingObligations, base)}
          sub="reserved before month-end"
        />
        <Stat
          label="Cash runway"
          value={rw.daysRemaining === Infinity ? "∞" : `${rw.daysRemaining}d`}
          tone={runwayTone as any}
          sub={rw.depletionDate ? `until ${rw.depletionDate}` : "no burn detected"}
        />
      </div>

      <div className="mt-3 rounded-xl border border-edge bg-ink/40 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">
            Avg daily burn <strong className="text-white">{formatMoney(rw.avgDailyBurn, base)}</strong> · reserves{" "}
            <strong className="text-white">{formatMoney(rw.reserves, base)}</strong>
          </span>
          <label className="flex items-center gap-2">
            <span className="label">Adjust reserves</span>
            <input
              inputMode="decimal"
              value={state.settings.liquidReserves}
              onChange={(e) => patchSettings({ liquidReserves: Number(e.target.value) || 0 })}
              className="input w-28 py-1"
            />
          </label>
        </div>
      </div>
    </Card>
  );
}
