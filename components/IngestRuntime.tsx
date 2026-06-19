"use client";
// =============================================================================
// IngestRuntime — lets an iOS Shortcut (or any link) log a payment by opening
//   https://<app>/?ingest=<url-encoded message text>
// On load we parse the text, create the expense, then clean the URL. This is
// the closest thing to "automatic" capture that iOS permits for a web app.
// =============================================================================

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { convert } from "@/lib/currency";
import { parsePaymentMessage } from "@/lib/parseMessage";
import { todayISO } from "@/lib/algorithms";

export function IngestRuntime() {
  const { state, addEntry, ready } = useStore();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("ingest");
    if (!raw) return;

    const parsed = parsePaymentMessage(raw);
    if (parsed) {
      const expenseCats = state.categories.filter((c) => c.name !== "Income");
      const incomeCat = state.categories.find((c) => c.name === "Income");
      const categoryId =
        (parsed.kind === "income" ? incomeCat?.id : expenseCats[0]?.id) ??
        state.categories[0]?.id ??
        "";
      addEntry({
        kind: parsed.kind,
        amount: parsed.amount,
        currency: parsed.currency,
        baseAmount: convert(parsed.amount, parsed.currency, state.settings.baseCurrency),
        categoryId,
        note: parsed.note,
        date: parsed.date || todayISO(),
        method: parsed.method,
      });
      setToast(`Logged ${parsed.currency} ${parsed.amount.toLocaleString()} · ${parsed.note}`);
    } else {
      setToast("Couldn't read a payment from that message.");
    }

    // Clean the URL so a refresh doesn't double-log.
    const url = new URL(window.location.href);
    url.searchParams.delete("ingest");
    window.history.replaceState({}, "", url.pathname + url.search);
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
    // run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!toast) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-xl border border-good/40 bg-panel px-4 py-3 text-sm shadow-2xl">
      <span className="text-good">✓</span> {toast}
    </div>
  );
}
