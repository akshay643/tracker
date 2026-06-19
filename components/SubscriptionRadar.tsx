"use client";
// =============================================================================
// Feature 14: Dedicated Subscription (SaaS) Radar.
// Tracks weekly/monthly/yearly recurring costs with live renewal countdowns.
// =============================================================================

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import { formatMoney } from "@/lib/currency";
import { daysUntil, monthlyEquivalent } from "@/lib/algorithms";
import type { RecurrenceCadence, Subscription } from "@/lib/types";
import { Card } from "./ui";

export function SubscriptionRadar() {
  const { state, upsertSubscription, deleteSubscription } = useStore();
  const base = state.settings.baseCurrency;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<RecurrenceCadence>("monthly");
  const [renewal, setRenewal] = useState("");

  function add() {
    if (!name.trim() || !amount || !renewal) return;
    const sub: Subscription = {
      id: uid("sub"),
      name,
      amount: Number(amount),
      currency: base,
      cadence,
      nextRenewal: renewal,
      active: true,
      createdAt: new Date().toISOString(),
    };
    upsertSubscription(sub);
    setName("");
    setAmount("");
    setRenewal("");
  }

  const sorted = [...state.subscriptions].sort(
    (a, b) => daysUntil(a.nextRenewal) - daysUntil(b.nextRenewal)
  );

  return (
    <Card title="Subscription Radar" icon="📡">
      <div className="space-y-2">
        {sorted.map((s) => {
          const days = daysUntil(s.nextRenewal);
          const soon = days <= 7;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                s.active ? "border-edge bg-panel2/50" : "border-edge/40 bg-panel2/20 opacity-60"
              }`}
            >
              <button
                onClick={() => upsertSubscription({ ...s, active: !s.active })}
                className={`h-2.5 w-2.5 rounded-full ${s.active ? "bg-good" : "bg-edge"}`}
                aria-label="toggle active"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-muted">
                  {formatMoney(s.amount, s.currency)} / {s.cadence} ·{" "}
                  {formatMoney(monthlyEquivalent(s), base)}/mo
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm tabular-nums ${soon ? "text-warn" : "text-muted"}`}>
                  {days < 0 ? "overdue" : days === 0 ? "today" : `in ${days}d`}
                </div>
                <div className="text-[10px] text-muted">{s.nextRenewal}</div>
              </div>
              <button className="text-muted hover:text-bad" onClick={() => deleteSubscription(s.id)}>
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Service" className="input" />
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="input" />
        <select value={cadence} onChange={(e) => setCadence(e.target.value as RecurrenceCadence)} className="input">
          <option value="weekly">weekly</option>
          <option value="monthly">monthly</option>
          <option value="yearly">yearly</option>
        </select>
        <input type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} className="input" />
      </div>
      <button className="btn btn-accent mt-2 w-full" onClick={add}>
        + Track subscription
      </button>
    </Card>
  );
}
