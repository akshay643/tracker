"use client";
// =============================================================================
// Feature 6: Search & Multi-Filter Data Table.
// Instant text search + compound filtering (date range, tag, category, method)
// + sortable columns. Pure client-side; operates over the in-memory entries.
// =============================================================================

import React, { useMemo, useState } from "react";
import { useStore, useCategoryMap } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { tokenizeNote } from "@/lib/hashtags";
import type { Entry } from "@/lib/types";
import { Card } from "./ui";

type SortKey = "date" | "baseAmount" | "categoryId";
type Dir = "asc" | "desc";

export function DataTable() {
  const { state, deleteEntry } = useStore();
  const catMap = useCategoryMap();
  const base = state.settings.baseCurrency;

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [tag, setTag] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [dir, setDir] = useState<Dir>("desc");

  const allTags = useMemo(
    () => [...new Set(state.entries.flatMap((e) => e.tags))].sort(),
    [state.entries]
  );

  const rows = useMemo(() => {
    const text = q.trim().toLowerCase();
    let r = state.entries.filter((e) => {
      if (cat && e.categoryId !== cat) return false;
      if (tag && !e.tags.includes(tag)) return false;
      if (method && e.method !== method) return false;
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      if (text) {
        const hay = `${e.note} ${e.tags.join(" ")} ${catMap[e.categoryId]?.name ?? ""}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
    r = [...r].sort((a, b) => {
      const av = sort === "categoryId" ? catMap[a.categoryId]?.name ?? "" : a[sort];
      const bv = sort === "categoryId" ? catMap[b.categoryId]?.name ?? "" : b[sort];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [state.entries, q, cat, tag, method, from, to, sort, dir, catMap]);

  const filteredTotal = rows.filter((e) => e.kind === "expense").reduce((s, e) => s + e.baseAmount, 0);

  function toggleSort(k: SortKey) {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(k);
      setDir("desc");
    }
  }
  const arrow = (k: SortKey) => (sort === k ? (dir === "asc" ? "▲" : "▼") : "");

  return (
    <Card
      title="Transactions"
      icon="🔎"
      right={<span className="chip">{rows.length} rows · {formatMoney(filteredTotal, base)}</span>}
    >
      {/* Filter bar */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-7">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="input col-span-2 md:col-span-2"
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
          <option value="">All categories</option>
          {state.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="input">
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="input capitalize">
          <option value="">All methods</option>
          {["card", "cash", "upi", "bank", "wallet", "other"].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
      </div>

      <div className="max-h-[420px] overflow-auto rounded-xl border border-edge">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-panel2 text-left text-xs uppercase text-muted">
            <tr>
              <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort("date")}>
                Date {arrow("date")}
              </th>
              <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort("categoryId")}>
                Category {arrow("categoryId")}
              </th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2">Method</th>
              <th className="cursor-pointer px-3 py-2 text-right" onClick={() => toggleSort("baseAmount")}>
                Amount {arrow("baseAmount")}
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e: Entry) => {
              const c = catMap[e.categoryId];
              const income = e.kind !== "expense";
              return (
                <tr key={e.id} className="border-t border-edge/60 hover:bg-panel2/40">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">{e.date}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c?.color ?? "#888" }} />
                      {c?.name ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {tokenizeNote(e.note).map((t, i) =>
                      t.isTag ? (
                        <span key={i} className="text-accent2">
                          {t.text}
                        </span>
                      ) : (
                        <span key={i}>{t.text}</span>
                      )
                    )}
                    {e.reimbursable && <span className="chip ml-1">reimbursable</span>}
                    {e.taxDeductible && <span className="chip ml-1">tax</span>}
                  </td>
                  <td className="px-3 py-2 capitalize text-muted">{e.method}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${income ? "text-good" : ""}`}>
                    {income ? "+" : "-"}
                    {formatMoney(e.amount, e.currency)}
                    {e.currency !== base && (
                      <span className="block text-[10px] text-muted">
                        = {formatMoney(e.baseAmount, base)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="text-muted hover:text-bad"
                      onClick={() => deleteEntry(e.id)}
                      aria-label="delete"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  No transactions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
