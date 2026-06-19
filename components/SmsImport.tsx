"use client";
// =============================================================================
// SmsImport — paste one or more payment messages and turn them into expenses.
// iOS can't read your SMS automatically, so you paste/share the text here (or
// an iOS Shortcut posts it via ?ingest=…). Each detected payment becomes an
// editable row you confirm with one tap.
// =============================================================================

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { convert } from "@/lib/currency";
import { parseMany, type ParsedPayment } from "@/lib/parseMessage";
import { todayISO } from "@/lib/algorithms";
import { Card } from "./ui";

interface Row extends ParsedPayment {
  categoryId: string;
  use: boolean;
}

export function SmsImport() {
  const { state, addEntry } = useStore();
  const expenseCats = state.categories.filter((c) => c.name !== "Income");
  const incomeCat = state.categories.find((c) => c.name === "Income");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const defaultCat = expenseCats[0]?.id ?? state.categories[0]?.id ?? "";

  function detect() {
    const parsed = parseMany(text);
    if (parsed.length === 0) {
      setRows(null);
      setMsg("No payment details found. Paste the full SMS/notification text.");
      return;
    }
    setRows(
      parsed.map((p) => ({
        ...p,
        categoryId: p.kind === "income" ? incomeCat?.id ?? defaultCat : defaultCat,
        use: true,
      }))
    );
    setMsg(`Found ${parsed.length} payment${parsed.length === 1 ? "" : "s"}. Review and log.`);
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs && rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function logAll() {
    if (!rows) return;
    const chosen = rows.filter((r) => r.use);
    for (const r of chosen) {
      const baseAmount = convert(r.amount, r.currency, state.settings.baseCurrency);
      addEntry({
        kind: r.kind,
        amount: r.amount,
        currency: r.currency,
        baseAmount,
        categoryId: r.categoryId,
        note: r.note,
        date: r.date || todayISO(),
        method: r.method,
      });
    }
    setRows(null);
    setText("");
    setMsg(`Logged ${chosen.length} transaction${chosen.length === 1 ? "" : "s"}.`);
  }

  const total = useMemo(
    () => (rows ? rows.filter((r) => r.use).reduce((s, r) => s + r.amount, 0) : 0),
    [rows]
  );

  return (
    <Card title="Auto-log from message" icon="💬">
      <p className="mb-2 text-xs text-muted">
        Paste a payment SMS or notification (UPI, card, GPay, CRED, Scapia…). Multiple messages?
        Separate them with a blank line.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. Rs.250 debited to SWIGGY via UPI on 12-06-2026 -HDFC Bank"
        className="input w-full resize-y"
      />
      <div className="mt-2 flex gap-2">
        <button className="btn btn-accent flex-1" onClick={detect} disabled={!text.trim()}>
          Detect payments
        </button>
        {text && (
          <button className="btn" onClick={() => { setText(""); setRows(null); setMsg(null); }}>
            Clear
          </button>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className={`rounded-xl border px-3 py-2 ${
                r.use ? "border-edge bg-panel2/50" : "border-edge/40 opacity-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={r.use}
                  onChange={(e) => update(i, { use: e.target.checked })}
                  className="h-4 w-4 accent-indigo-500"
                />
                <span className={`text-sm font-semibold tabular-nums ${r.kind === "income" ? "text-good" : ""}`}>
                  {r.kind === "income" ? "+" : "-"}
                  {r.currency} {r.amount.toLocaleString()}
                </span>
                <span className="ml-auto text-[11px] uppercase tracking-wide text-muted">{r.method}</span>
              </div>
              <input
                value={r.note}
                onChange={(e) => update(i, { note: e.target.value })}
                className="input mt-2 w-full text-sm"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  value={r.categoryId}
                  onChange={(e) => update(i, { categoryId: e.target.value })}
                  className="input"
                >
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={r.date || todayISO()}
                  onChange={(e) => update(i, { date: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          ))}
          <button className="btn btn-accent w-full" onClick={logAll}>
            + Log {rows.filter((r) => r.use).length} ({total.toLocaleString()})
          </button>
        </div>
      )}

      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </Card>
  );
}
