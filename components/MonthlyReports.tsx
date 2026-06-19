"use client";
// =============================================================================
// MonthlyReports — monthly reset controls + downloadable archive of past months.
// • Toggle the automatic 1st-of-month reset.
// • "Close this month now" to archive + reset on demand.
// • Re-download any archived month as PDF or Excel.
// =============================================================================

import React, { useState } from "react";
import { useStore, currentMonth } from "@/lib/store";
import { downloadMonthlyPDF } from "@/lib/pdf";
import { downloadMonthlyExcel } from "@/lib/export";
import { todayISO } from "@/lib/algorithms";
import { Card } from "./ui";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function label(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

export function MonthlyReports() {
  const { state, patchSettings, closeMonth } = useStore();
  const auto = state.settings.autoMonthlyReset;
  const [confirming, setConfirming] = useState(false);

  const thisMonth = currentMonth();
  const liveCount = state.entries.length;

  function closeNow() {
    closeMonth(thisMonth);
    setConfirming(false);
  }

  function downloadCurrentPDF() {
    downloadMonthlyPDF(thisMonth, state.entries, state.categories, state.settings.baseCurrency);
  }

  return (
    <Card title="Monthly reports & reset" icon="🗓️">
      {/* Auto-reset toggle */}
      <label className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-panel2/40 p-3">
        <span>
          <span className="text-sm font-medium">Auto-reset on the 1st</span>
          <span className="block text-xs text-muted">
            On the first day of each month, archive last month and start the ledger fresh.
          </span>
        </span>
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => patchSettings({ autoMonthlyReset: e.target.checked })}
          className="h-5 w-5 accent-indigo-500"
        />
      </label>

      {/* Current month actions */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-panel2/30 p-3">
        <div className="text-sm">
          <span className="font-medium">This month ({label(thisMonth)})</span>
          <span className="block text-xs text-muted">{liveCount} transactions in the active ledger</span>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={downloadCurrentPDF} disabled={liveCount === 0}>
            ⬇︎ PDF
          </button>
          {!confirming ? (
            <button className="btn hover:border-warn hover:text-warn" onClick={() => setConfirming(true)} disabled={liveCount === 0}>
              Close month
            </button>
          ) : (
            <>
              <button className="btn btn-accent" onClick={closeNow}>
                Archive & reset
              </button>
              <button className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Archive list */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold">Past months</h3>
        {(state.archives ?? []).length === 0 ? (
          <p className="mt-1 text-xs text-muted">No archived months yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {(state.archives ?? []).map((a) => {
              const exp = a.entries
                .filter((e) => e.kind === "expense")
                .reduce((s, e) => s + e.baseAmount, 0);
              return (
                <li
                  key={a.month + a.closedAt}
                  className="flex items-center gap-3 rounded-xl border border-edge bg-panel2/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{label(a.month)}</div>
                    <div className="text-xs text-muted">
                      {a.entries.length} txns · spent {exp.toLocaleString()} {state.settings.baseCurrency}
                    </div>
                  </div>
                  <button
                    className="btn px-2 py-1 text-xs"
                    onClick={() =>
                      downloadMonthlyPDF(a.month, a.entries, state.categories, state.settings.baseCurrency)
                    }
                  >
                    PDF
                  </button>
                  <button
                    className="btn px-2 py-1 text-xs"
                    onClick={() => downloadMonthlyExcel({ ...state, entries: a.entries })}
                  >
                    Excel
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-3 text-[11px] text-muted">
        Resets only clear transactions — your categories, subscriptions, clients, rules and
        reminders are kept. Today is {todayISO()}.
      </p>
    </Card>
  );
}
