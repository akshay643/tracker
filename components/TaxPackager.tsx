"use client";
// =============================================================================
// Feature 24: Tax Season Report Packager.
// Maps outlays to their category tax bucket, aggregates deductible totals, and
// packages everything into a downloadable CSV or JSON.
// =============================================================================

import React, { useMemo, useState } from "react";
import { useStore, useCategoryMap } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { Card } from "./ui";

export function TaxPackager() {
  const { state } = useStore();
  const catMap = useCategoryMap();
  const base = state.settings.baseCurrency;
  const [year, setYear] = useState(new Date().getFullYear());

  const deductibles = useMemo(
    () =>
      state.entries.filter(
        (e) =>
          e.kind === "expense" &&
          new Date(e.date).getFullYear() === year &&
          (e.taxDeductible || catMap[e.categoryId]?.taxBucket)
      ),
    [state.entries, year, catMap]
  );

  const byBucket = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of deductibles) {
      const bucket = catMap[e.categoryId]?.taxBucket || "Uncategorized";
      const cur = map.get(bucket) ?? { total: 0, count: 0 };
      cur.total += e.baseAmount;
      cur.count += 1;
      map.set(bucket, cur);
    }
    return [...map.entries()].map(([bucket, v]) => ({ bucket, ...v })).sort((a, b) => b.total - a.total);
  }, [deductibles, catMap]);

  const grandTotal = byBucket.reduce((s, b) => s + b.total, 0);

  function trigger(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCSV() {
    const header = "date,category,tax_bucket,note,amount_base,currency,original_amount\n";
    const rows = deductibles
      .map((e) => {
        const note = (e.note || "").replace(/"/g, '""');
        return [
          e.date,
          catMap[e.categoryId]?.name ?? "",
          catMap[e.categoryId]?.taxBucket || "Uncategorized",
          `"${note}"`,
          e.baseAmount,
          e.currency,
          e.amount,
        ].join(",");
      })
      .join("\n");
    trigger(`tax-report-${year}.csv`, header + rows, "text/csv");
  }

  function downloadJSON() {
    const report = {
      taxYear: year,
      currency: base,
      generatedOn: new Date().toISOString().slice(0, 10),
      summaryByBucket: byBucket,
      total: +grandTotal.toFixed(2),
      lineItems: deductibles.map((e) => ({
        date: e.date,
        category: catMap[e.categoryId]?.name,
        bucket: catMap[e.categoryId]?.taxBucket || "Uncategorized",
        note: e.note,
        amount: e.baseAmount,
      })),
    };
    trigger(`tax-report-${year}.json`, JSON.stringify(report, null, 2), "application/json");
  }

  return (
    <Card
      title="Tax Season Packager"
      icon="📦"
      right={
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input py-1">
          {[0, 1, 2].map((d) => {
            const y = new Date().getFullYear() - d;
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </select>
      }
    >
      <div className="space-y-1">
        {byBucket.map((b) => (
          <div key={b.bucket} className="flex justify-between rounded-lg bg-panel2/40 px-3 py-1.5 text-sm">
            <span>
              {b.bucket} <span className="text-xs text-muted">({b.count})</span>
            </span>
            <span className="tabular-nums">{formatMoney(b.total, base)}</span>
          </div>
        ))}
        {byBucket.length === 0 && (
          <p className="text-sm text-muted">No deductible outlays found for {year}.</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-edge pt-3">
        <div>
          <div className="label">Total deductible</div>
          <div className="text-xl font-semibold tabular-nums text-good">{formatMoney(grandTotal, base)}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={downloadCSV} disabled={deductibles.length === 0}>
            ⬇ CSV
          </button>
          <button className="btn btn-accent" onClick={downloadJSON} disabled={deductibles.length === 0}>
            ⬇ JSON
          </button>
        </div>
      </div>
    </Card>
  );
}
