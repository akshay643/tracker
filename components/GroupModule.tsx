"use client";
// =============================================================================
// Module 2 — Features 7, 8, 9.
// 7: Multi-member ledgers.  8: even / percent / exact splitting.
// 9: debt-minimization engine (net balances → fewest peer-to-peer transfers).
// =============================================================================

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import { formatMoney } from "@/lib/currency";
import {
  computeNetBalances,
  minimizeDebts,
  todayISO,
} from "@/lib/algorithms";
import type { Ledger, LedgerMember, SplitMode, SplitShare } from "@/lib/types";
import { Card } from "./ui";

export function GroupModule() {
  const { state, upsertLedger, addEntry } = useStore();
  const base = state.settings.baseCurrency;
  const [ledgerId, setLedgerId] = useState(state.ledgers[0]?.id ?? "");
  const ledger = state.ledgers.find((l) => l.id === ledgerId) ?? state.ledgers[0];

  // ---- new ledger / member management (Feature 7) ----
  const [newLedger, setNewLedger] = useState("");
  const [newMember, setNewMember] = useState("");

  function createLedger() {
    if (!newLedger.trim()) return;
    const l: Ledger = {
      id: uid("led"),
      name: newLedger,
      members: [{ id: uid("m"), name: "You" }],
      createdAt: new Date().toISOString(),
    };
    upsertLedger(l);
    setLedgerId(l.id);
    setNewLedger("");
  }

  function addMember() {
    if (!ledger || !newMember.trim()) return;
    const m: LedgerMember = { id: uid("m"), name: newMember };
    upsertLedger({ ...ledger, members: [...ledger.members, m] });
    setNewMember("");
  }

  // ---- split builder (Feature 8) ----
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<SplitMode>("even");
  const [paidBy, setPaidBy] = useState(ledger?.members[0]?.id ?? "");
  const [raw, setRaw] = useState<Record<string, number>>({});

  const total = parseFloat(amount) || 0;

  const shares: SplitShare[] = useMemo(() => {
    if (!ledger) return [];
    const members = ledger.members;
    if (mode === "even") {
      const each = +(total / members.length).toFixed(2);
      return members.map((m) => ({ memberId: m.id, amount: each }));
    }
    if (mode === "percent") {
      return members.map((m) => {
        const pct = raw[m.id] ?? 0;
        return { memberId: m.id, amount: +((total * pct) / 100).toFixed(2), rawValue: pct };
      });
    }
    // exact
    return members.map((m) => ({ memberId: m.id, amount: raw[m.id] ?? 0, rawValue: raw[m.id] ?? 0 }));
  }, [ledger, mode, total, raw]);

  const sharesSum = shares.reduce((s, x) => s + x.amount, 0);
  const balanced =
    mode === "even" ||
    (mode === "percent" && Math.abs(Object.values(raw).reduce((a, b) => a + b, 0) - 100) < 0.5) ||
    (mode === "exact" && Math.abs(sharesSum - total) < 0.05);

  function logSplit() {
    if (!ledger || total <= 0 || !balanced) return;
    const incomeCat = state.categories.find((c) => c.name !== "Income");
    addEntry({
      amount: total,
      currency: base,
      baseAmount: total,
      categoryId: incomeCat?.id ?? state.categories[0].id,
      note: desc || `Split in ${ledger.name}`,
      date: todayISO(),
      method: "card",
      split: { ledgerId: ledger.id, paidBy, mode, shares },
    });
    setDesc("");
    setAmount("");
    setRaw({});
  }

  // ---- debt minimization (Feature 9) ----
  const net = useMemo(
    () => (ledger ? computeNetBalances(ledger, state.entries) : {}),
    [ledger, state.entries]
  );
  const settlements = useMemo(() => minimizeDebts(net), [net]);
  const nameOf = (id: string) => ledger?.members.find((m) => m.id === id)?.name ?? "?";

  if (!ledger) {
    return (
      <Card title="Group Splitting" icon="🤝">
        <div className="flex gap-2">
          <input
            value={newLedger}
            onChange={(e) => setNewLedger(e.target.value)}
            placeholder="New ledger name"
            className="input flex-1"
          />
          <button className="btn btn-accent" onClick={createLedger}>
            Create ledger
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Group Splitting & Debt Matrix"
      icon="🤝"
      right={
        <select
          value={ledgerId}
          onChange={(e) => setLedgerId(e.target.value)}
          className="input max-w-[55vw] truncate"
        >
          {state.ledgers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Members + new ledger */}
        <div>
          <div className="label mb-1">Members</div>
          <div className="mb-2 flex flex-wrap gap-2">
            {ledger.members.map((m) => (
              <span key={m.id} className="chip">
                {m.name}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="Add member"
              className="input flex-1"
            />
            <button className="btn" onClick={addMember}>
              + Add
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newLedger}
              onChange={(e) => setNewLedger(e.target.value)}
              placeholder="New ledger"
              className="input flex-1"
            />
            <button className="btn" onClick={createLedger}>
              + Ledger
            </button>
          </div>
        </div>

        {/* Split builder */}
        <div>
          <div className="label mb-1">Add a shared expense</div>
          <div className="flex gap-2">
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Dinner, taxi…"
              className="input flex-1"
            />
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input w-28"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="label">Paid by</span>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="input min-w-[120px] flex-1"
            >
              {ledger.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="flex flex-1 overflow-hidden rounded-xl border border-edge">
              {(["even", "percent", "exact"] as SplitMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 px-2.5 py-2 text-xs capitalize ${
                    mode === m ? "bg-accent text-white" : "text-muted"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {mode !== "even" && (
            <div className="mt-2 space-y-1">
              {ledger.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="w-24 text-sm">{m.name}</span>
                  <input
                    inputMode="decimal"
                    value={raw[m.id] ?? ""}
                    onChange={(e) => setRaw({ ...raw, [m.id]: Number(e.target.value) || 0 })}
                    placeholder={mode === "percent" ? "%" : base}
                    className="input flex-1 py-1"
                  />
                  <span className="w-20 text-right text-xs text-muted tabular-nums">
                    {formatMoney(shares.find((s) => s.memberId === m.id)?.amount ?? 0, base)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            <span className={`text-xs ${balanced ? "text-good" : "text-warn"}`}>
              {balanced ? "Balanced ✓" : mode === "percent" ? "Percentages must total 100%" : "Shares must equal total"}
            </span>
            <button className="btn btn-accent" disabled={!balanced || total <= 0} onClick={logSplit}>
              Log split
            </button>
          </div>
        </div>
      </div>

      {/* Debt matrix output (Feature 9) */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-edge bg-panel2/40 p-3">
          <div className="label mb-2">Net balances</div>
          <ul className="space-y-1 text-sm">
            {ledger.members.map((m) => {
              const bal = net[m.id] ?? 0;
              return (
                <li key={m.id} className="flex justify-between tabular-nums">
                  <span>{m.name}</span>
                  <span className={bal > 0.01 ? "text-good" : bal < -0.01 ? "text-bad" : "text-muted"}>
                    {bal > 0 ? "is owed " : bal < 0 ? "owes " : ""}
                    {formatMoney(Math.abs(bal), base)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-edge bg-panel2/40 p-3">
          <div className="label mb-2">
            Optimized settlement · {settlements.length} transfer{settlements.length === 1 ? "" : "s"}
          </div>
          {settlements.length === 0 ? (
            <p className="text-sm text-muted">Everyone is settled up. 🎉</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {settlements.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="font-medium text-bad">{nameOf(s.from)}</span>
                  <span className="text-muted">→</span>
                  <span className="font-medium text-good">{nameOf(s.to)}</span>
                  <span className="ml-auto tabular-nums">{formatMoney(s.amount, base)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
