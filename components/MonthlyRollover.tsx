"use client";
// =============================================================================
// MonthlyRollover — on the first open of a new month, archive the previous
// month's transactions, clear the active ledger, and surface a banner offering
// the PDF report. Auto-download isn't reliable across browsers, so the actual
// download is one tap (a real user gesture) from the banner.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useStore, currentMonth } from "@/lib/store";
import { downloadMonthlyPDF } from "@/lib/pdf";

export function MonthlyRollover() {
  const { state, ready, closeMonth } = useStore();
  const [closedMonth, setClosedMonth] = useState<string | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!ready || fired.current) return;
    const s = state.settings;
    const cur = currentMonth();
    if (s.autoMonthlyReset && s.lastResetMonth !== cur && state.entries.length > 0) {
      fired.current = true;
      const closing = s.lastResetMonth || cur;
      closeMonth(closing);
      setClosedMonth(closing);
    }
  }, [ready, state.settings, state.entries, closeMonth]);

  if (!closedMonth) return null;
  const archive = (state.archives ?? []).find((a) => a.month === closedMonth);

  return (
    <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-2xl border border-accent/40 bg-panel p-4 shadow-2xl">
      <div className="text-sm font-semibold">🗓️ New month — fresh start</div>
      <p className="mt-1 text-xs text-muted">
        Last month was archived and the ledger reset. Download {closedMonth}&apos;s report:
      </p>
      <div className="mt-3 flex gap-2">
        <button
          className="btn btn-accent flex-1"
          onClick={() =>
            archive && downloadMonthlyPDF(archive.month, archive.entries, state.categories, state.settings.baseCurrency)
          }
        >
          ⬇︎ Download PDF
        </button>
        <button className="btn" onClick={() => setClosedMonth(null)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
