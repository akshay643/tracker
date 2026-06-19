"use client";
// =============================================================================
// Feature 2: Income & Windfall Logging.
// Primary income gets logged normally; "windfall" entries trigger an allocation
// modal that nudges the user to split the unexpected money before it's absorbed.
// =============================================================================

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { convert } from "@/lib/currency";
import { todayISO } from "@/lib/algorithms";
import type { CurrencyCode } from "@/lib/types";
import { Card, Modal, Stat } from "./ui";
import { formatMoney } from "@/lib/currency";

type Alloc = { save: number; invest: number; treat: number };

export function IncomeWindfall() {
  const { state, addEntry } = useStore();
  const incomeCat = state.categories.find((c) => c.name === "Income");
  const base = state.settings.baseCurrency;

  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [windfallOpen, setWindfallOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [alloc, setAlloc] = useState<Alloc>({ save: 50, invest: 30, treat: 20 });

  function logIncome(kind: "income" | "windfall") {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0 || !incomeCat) return;
    addEntry({
      kind,
      amount: amt,
      currency: base as CurrencyCode,
      baseAmount: convert(amt, base, base),
      categoryId: incomeCat.id,
      note: label || (kind === "windfall" ? "Windfall" : "Income"),
      date: todayISO(),
      method: "bank",
    });
    setAmount("");
    setLabel("");
    if (kind === "windfall") {
      setPending(amt);
      setWindfallOpen(true);
    }
  }

  const allocTotal = alloc.save + alloc.invest + alloc.treat;
  const part = (pct: number) => (pending * pct) / 100;

  return (
    <Card title="Income & Windfalls" icon="💰">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label">Amount ({base})</label>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input mt-1 w-full"
          />
        </div>
        <div className="flex-1">
          <label className="label">Source</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Salary, bonus, gift…"
            className="input mt-1 w-full"
          />
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => logIncome("income")}>
            + Income
          </button>
          <button className="btn btn-accent" onClick={() => logIncome("windfall")}>
            ✨ Windfall
          </button>
        </div>
      </div>

      <Modal
        open={windfallOpen}
        onClose={() => setWindfallOpen(false)}
        title="Allocate your windfall ✨"
      >
        <p className="mb-4 text-sm text-muted">
          You just received <strong className="text-white">{formatMoney(pending, base as CurrencyCode)}</strong>.
          Decide where it goes <em>now</em>, before it quietly disappears into everyday spending.
        </p>

        {(["save", "invest", "treat"] as const).map((k) => (
          <div key={k} className="mb-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="capitalize">{k}</span>
              <span className="tabular-nums text-muted">
                {alloc[k]}% · {formatMoney(part(alloc[k]), base as CurrencyCode)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={alloc[k]}
              onChange={(e) => setAlloc({ ...alloc, [k]: Number(e.target.value) })}
              className="w-full accent-accent"
            />
          </div>
        ))}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Save" value={formatMoney(part(alloc.save), base as CurrencyCode)} tone="good" />
          <Stat label="Invest" value={formatMoney(part(alloc.invest), base as CurrencyCode)} />
          <Stat label="Treat" value={formatMoney(part(alloc.treat), base as CurrencyCode)} tone="warn" />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className={`text-xs ${allocTotal === 100 ? "text-good" : "text-warn"}`}>
            {allocTotal === 100 ? "Balanced ✓" : `Allocations total ${allocTotal}% (aim for 100%)`}
          </span>
          <button className="btn btn-accent" onClick={() => setWindfallOpen(false)}>
            Lock plan
          </button>
        </div>
      </Modal>
    </Card>
  );
}
