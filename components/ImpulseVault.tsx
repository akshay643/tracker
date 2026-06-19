"use client";
// =============================================================================
// Feature 21: The "Impulse Purchase" Cooling-Off Vault.
// Non-essential wants are locked for a customizable timer. While locked, the
// card shows a live countdown + the savings goal it protects. After the timer
// the user can consciously buy (logs an expense) or release (banks the saving).
// =============================================================================

import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import { formatMoney } from "@/lib/currency";
import { coolingRemainingMs, formatDuration, todayISO } from "@/lib/algorithms";
import type { CurrencyCode } from "@/lib/types";
import { Card } from "./ui";

export function ImpulseVault() {
  const { state, upsertImpulse, deleteImpulse, addEntry } = useStore();
  const base = state.settings.baseCurrency;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [hours, setHours] = useState(48);

  // Tick every second for live countdowns.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  function lock() {
    if (!name.trim() || !amount) return;
    upsertImpulse({
      id: uid("imp"),
      name,
      amount: Number(amount),
      currency: base as CurrencyCode,
      coolingHours: hours,
      createdAt: new Date().toISOString(),
    });
    setName("");
    setAmount("");
  }

  function buy(id: string) {
    const item = state.impulses.find((i) => i.id === id);
    if (!item) return;
    const cat = state.categories.find((c) => c.name === "Entertainment") ?? state.categories[0];
    addEntry({
      amount: item.amount,
      currency: item.currency,
      baseAmount: item.amount,
      categoryId: cat.id,
      note: `${item.name} (cooled-off purchase)`,
      date: todayISO(),
      method: "card",
    });
    deleteImpulse(id);
  }

  const active = state.impulses.filter((i) => !i.purchased);
  const totalSaved = active.reduce(
    (s, i) => (coolingRemainingMs(i.createdAt, i.coolingHours) > 0 ? s + i.amount : s),
    0
  );

  return (
    <Card
      title="Cooling-Off Vault"
      icon="🧊"
      right={<span className="chip text-good">{formatMoney(totalSaved, base)} protected</span>}
    >
      <div className="space-y-2">
        {active.map((i) => {
          const ms = coolingRemainingMs(i.createdAt, i.coolingHours);
          const locked = ms > 0;
          return (
            <div key={i.id} className="rounded-xl border border-edge bg-panel2/50 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{i.name}</span>
                <span className="tabular-nums">{formatMoney(i.amount, i.currency)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className={locked ? "text-warn" : "text-good"}>
                  {locked ? `🔒 unlocks in ${formatDuration(ms)}` : "✅ cooled off — decide consciously"}
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn px-2 py-0.5 text-xs disabled:opacity-30"
                    disabled={locked}
                    onClick={() => buy(i.id)}
                  >
                    Buy
                  </button>
                  <button
                    className="btn px-2 py-0.5 text-xs hover:border-good hover:text-good"
                    onClick={() => deleteImpulse(i.id)}
                  >
                    Skip & save
                  </button>
                </div>
              </div>
              {locked && (
                <p className="mt-1 text-[11px] text-muted">
                  Skip this and you keep {formatMoney(i.amount, i.currency)} toward your goals.
                </p>
              )}
            </div>
          );
        })}
        {active.length === 0 && <p className="text-sm text-muted">Nothing in the vault. Add a tempting want below.</p>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Want…" className="input col-span-2" />
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Cost" className="input" />
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="input">
          <option value={24}>24h</option>
          <option value={48}>48h</option>
          <option value={72}>72h</option>
          <option value={168}>1 week</option>
        </select>
      </div>
      <button className="btn btn-accent mt-2 w-full" onClick={lock}>
        🔒 Lock in vault
      </button>
    </Card>
  );
}
