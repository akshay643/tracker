"use client";
// =============================================================================
// Feature 1: Quick-Add HUD — a single responsive bar for amount/category/date.
// Also surfaces Feature 3 (currency), Feature 5 (live hashtag preview),
// Feature 12 (client linker toggle) inline for frictionless logging.
// =============================================================================

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CURRENCIES, convert, getRates } from "@/lib/currency";
import { extractTags } from "@/lib/hashtags";
import { todayISO } from "@/lib/algorithms";
import type { CurrencyCode, PaymentMethod } from "@/lib/types";
import { TagPill } from "./ui";

const METHODS: PaymentMethod[] = ["card", "cash", "upi", "bank", "wallet", "other"];

export function QuickAddHUD({
  bare = false,
  onLogged,
}: {
  /** When true, drop the sticky floating-card styling (e.g. inside a sheet). */
  bare?: boolean;
  /** Called after a successful log — lets a host sheet close itself. */
  onLogged?: () => void;
} = {}) {
  const { state, addEntry } = useStore();
  const expenseCats = state.categories.filter((c) => c.name !== "Income");

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(state.settings.baseCurrency);
  const [categoryId, setCategoryId] = useState(expenseCats[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [note, setNote] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [flash, setFlash] = useState(false);

  const tags = useMemo(() => extractTags(note), [note]);
  const numericAmount = parseFloat(amount) || 0;
  const baseAmount = convert(numericAmount, currency, state.settings.baseCurrency);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (numericAmount <= 0 || !categoryId) return;
    addEntry({
      amount: numericAmount,
      currency,
      baseAmount,
      categoryId,
      note,
      date,
      method,
      clientId: clientId || undefined,
      reimbursable: !!clientId,
    });
    setAmount("");
    setNote("");
    setClientId("");
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
    onLogged?.();
  }

  return (
    <form
      onSubmit={submit}
      className={
        bare
          ? `transition ${flash ? "ring-2 ring-good rounded-2xl" : ""}`
          : `card sticky top-3 z-30 shadow-hud transition ${flash ? "ring-2 ring-good" : ""}`
      }
    >
      {/* Amount + currency — the hero field, full width on mobile */}
      <div>
        <label className="label">Amount</label>
        <div className="mt-1 flex gap-2">
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input w-full text-2xl font-semibold tabular-nums"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="input w-24"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Secondary fields — 2-up on mobile, flows to a row on desktop */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <label className="label">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input mt-1 w-full"
          >
            {expenseCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label className="label">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="input mt-1 w-full capitalize"
          >
            {METHODS.map((m) => (
              <option key={m} value={m} className="capitalize">
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Client (optional)</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="input mt-1 w-full"
          >
            <option value="">—</option>
            {state.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Note line w/ live hashtag extraction */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note… use #tags (e.g. #trip2026 #work)"
          className="input w-full"
        />
        {tags.map((t) => (
          <TagPill key={t} tag={t} />
        ))}
        {currency !== state.settings.baseCurrency && numericAmount > 0 && (
          <span className="chip">
            ≈ {state.settings.baseCurrency} {baseAmount.toLocaleString()} @{" "}
            {getRates()[currency].toFixed(2)}
          </span>
        )}
      </div>

      <button type="submit" className="btn btn-accent mt-3 h-12 w-full text-base">
        + Log expense
      </button>
    </form>
  );
}
