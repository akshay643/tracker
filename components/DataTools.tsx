"use client";
// =============================================================================
// DataTools — export & danger-zone actions.
// • Download a month-wise Excel workbook (one worksheet per month + Summary).
// • Clear all data to start fresh (keeps your categories), behind a confirm.
// =============================================================================

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { downloadMonthlyExcel } from "@/lib/export";
import { Card } from "./ui";

export function DataTools() {
  const { state, resetData } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const hasData = state.entries.length > 0;

  function exportExcel() {
    if (!hasData) {
      setNote("Nothing to export yet — add a few transactions first.");
      return;
    }
    const meta = downloadMonthlyExcel(state);
    setNote(`Exported ${meta.rows} transactions across ${meta.months} month${meta.months === 1 ? "" : "s"}.`);
  }

  function clearAll() {
    resetData();
    setConfirming(false);
    setNote("All data cleared. You're starting fresh — your categories were kept.");
  }

  return (
    <Card title="Data & backup" icon="🗃">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-white/90">Export to Excel</div>
            <div className="text-xs text-muted">
              One worksheet per month, plus a summary tab. Opens in Excel, Numbers or Sheets.
            </div>
          </div>
          <button className="btn btn-accent shrink-0" onClick={exportExcel}>
            ⬇︎ Download .xls
          </button>
        </div>

        <div className="h-px bg-edge" />

        {/* Danger zone */}
        <div className="rounded-xl border border-bad/40 bg-bad/5 p-3">
          <div className="text-sm font-medium text-bad">Clear all data</div>
          <div className="mt-0.5 text-xs text-muted">
            Permanently deletes every transaction, group, subscription, client, rule and
            impulse on this device. Your categories are kept so you can keep logging.
          </div>

          {!confirming ? (
            <button className="btn mt-3 border-bad/50 text-bad hover:border-bad" onClick={() => setConfirming(true)}>
              Clear all data…
            </button>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/90">This can’t be undone. Are you sure?</span>
              <button className="btn btn-accent border-transparent bg-bad hover:bg-red-500" onClick={clearAll}>
                Yes, clear everything
              </button>
              <button className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {note && <p className="text-xs text-good">{note}</p>}
      </div>
    </Card>
  );
}
