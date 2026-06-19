"use client";
// =============================================================================
// Feature 12: Billable Project & Client Linker (manage clients + their budgets;
//             entries link to a client via the Quick-Add HUD).
// Feature 13: Auto-Invoice Generator (aggregate reimbursable entries for a
//             client into a downloadable invoice).
// =============================================================================

import React, { useMemo, useState } from "react";
import { useStore, useCategoryMap } from "@/lib/store";
import { uid } from "@/lib/seed";
import { formatMoney } from "@/lib/currency";
import { todayISO } from "@/lib/algorithms";
import { Card, ProgressBar } from "./ui";

const COLORS = ["#6366f1", "#22d3ee", "#22c55e", "#f59e0b", "#ec4899"];

export function ClientInvoice() {
  const { state, upsertClient } = useStore();
  const catMap = useCategoryMap();
  const base = state.settings.baseCurrency;

  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [selected, setSelected] = useState(state.clients[0]?.id ?? "");

  function addClient() {
    if (!name.trim()) return;
    upsertClient({
      id: uid("cli"),
      name,
      budget: budget ? Number(budget) : undefined,
      color: COLORS[state.clients.length % COLORS.length],
      createdAt: new Date().toISOString(),
    });
    setName("");
    setBudget("");
  }

  const client = state.clients.find((c) => c.id === selected);
  const billable = useMemo(
    () =>
      state.entries.filter(
        (e) => e.kind === "expense" && e.clientId === selected && e.reimbursable
      ),
    [state.entries, selected]
  );
  const invoiceTotal = billable.reduce((s, e) => s + e.baseAmount, 0);
  const clientSpend = useMemo(
    () => state.entries.filter((e) => e.clientId === selected).reduce((s, e) => s + e.baseAmount, 0),
    [state.entries, selected]
  );

  function download() {
    if (!client) return;
    const lines = billable.map((e) => ({
      date: e.date,
      description: e.note || catMap[e.categoryId]?.name || "Expense",
      category: catMap[e.categoryId]?.name ?? "",
      amount: e.baseAmount,
    }));
    const invoice = {
      invoiceId: `INV-${client.name.slice(0, 3).toUpperCase()}-${todayISO().replace(/-/g, "")}`,
      client: client.name,
      issuedOn: todayISO(),
      currency: base,
      lineItems: lines,
      total: +invoiceTotal.toFixed(2),
    };
    const blob = new Blob([JSON.stringify(invoice, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoiceId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card title="Clients & Invoicing" icon="🧾">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Client management */}
        <div>
          <div className="label mb-1">Project budgets</div>
          <ul className="mb-3 space-y-2">
            {state.clients.map((c) => {
              const spent = state.entries
                .filter((e) => e.clientId === c.id)
                .reduce((s, e) => s + e.baseAmount, 0);
              const ratio = c.budget ? spent / c.budget : 0;
              return (
                <li
                  key={c.id}
                  className={`cursor-pointer rounded-xl border px-3 py-2 ${
                    selected === c.id ? "border-accent bg-panel2" : "border-edge bg-panel2/40"
                  }`}
                  onClick={() => setSelected(c.id)}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <span className="tabular-nums text-muted">
                      {formatMoney(spent, base)}
                      {c.budget ? ` / ${formatMoney(c.budget, base)}` : ""}
                    </span>
                  </div>
                  {c.budget ? <div className="mt-1"><ProgressBar ratio={ratio} /></div> : null}
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client / project" className="input flex-1" />
            <input
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Budget"
              className="input w-28"
            />
            <button className="btn" onClick={addClient}>
              + Add
            </button>
          </div>
        </div>

        {/* Invoice preview */}
        <div className="rounded-xl border border-edge bg-ink/40 p-3">
          <div className="flex items-center justify-between">
            <div className="label">Reimbursable invoice</div>
            <button className="btn btn-accent px-2 py-1 text-xs" disabled={!client || billable.length === 0} onClick={download}>
              ⬇ Download
            </button>
          </div>
          <div className="mt-1 text-xs text-muted">
            {client ? `${client.name} · ${billable.length} billable item(s)` : "Select a client"}
          </div>
          <div className="mt-2 max-h-40 overflow-auto text-sm">
            {billable.map((e) => (
              <div key={e.id} className="flex justify-between border-b border-edge/40 py-1">
                <span className="truncate">{e.note || catMap[e.categoryId]?.name}</span>
                <span className="tabular-nums text-muted">{formatMoney(e.baseAmount, base)}</span>
              </div>
            ))}
            {billable.length === 0 && (
              <p className="py-3 text-muted">
                No reimbursable expenses. Tag entries to this client in the Quick-Add bar.
              </p>
            )}
          </div>
          <div className="mt-2 flex justify-between border-t border-edge pt-2 font-semibold">
            <span>Total due</span>
            <span className="tabular-nums">{formatMoney(invoiceTotal, base)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
