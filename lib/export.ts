// =============================================================================
// lib/export.ts — Dependency-free Excel export, broken out month-by-month.
// Emits the "XML Spreadsheet 2003" (.xls) format, which is plain XML yet opens
// natively in Excel / Google Sheets / Numbers with one real worksheet per month
// plus a Summary tab. No third-party library required.
// =============================================================================

import type { AppState, Category, Entry } from "./types";

const COLUMNS = [
  "Date",
  "Category",
  "Note",
  "Tags",
  "Method",
  "Currency",
  "Amount",
  `Base Amount`,
  "Type",
  "Reimbursable",
  "Tax Deductible",
] as const;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Excel worksheet names: ≤31 chars, none of : \ / ? * [ ]. */
function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31);
}

function numCell(n: number): string {
  return `<Cell ss:StyleID="money"><Data ss:Type="Number">${n}</Data></Cell>`;
}
function strCell(s: string, styleId?: string): string {
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Cell${style}><Data ss:Type="String">${xmlEscape(s)}</Data></Cell>`;
}

function headerRow(): string {
  return `<Row>${COLUMNS.map((c) => strCell(c, "hdr")).join("")}</Row>`;
}

function entryRow(e: Entry, catName: string): string {
  return (
    "<Row>" +
    strCell(e.date) +
    strCell(catName) +
    strCell(e.note ?? "") +
    strCell((e.tags ?? []).map((t) => `#${t}`).join(" ")) +
    strCell(e.method ?? "") +
    strCell(e.currency) +
    numCell(e.amount) +
    numCell(e.baseAmount) +
    strCell(e.kind) +
    strCell(e.reimbursable ? "Yes" : "") +
    strCell(e.taxDeductible ? "Yes" : "") +
    "</Row>"
  );
}

/** "2026-06" -> "Jun 2026" for a friendly worksheet tab label. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MONTHS[idx] ?? m} ${y}`;
}

function worksheet(name: string, rowsXml: string): string {
  return (
    `<Worksheet ss:Name="${xmlEscape(safeSheetName(name))}">` +
    `<Table>${rowsXml}</Table>` +
    `</Worksheet>`
  );
}

export interface MonthExport {
  /** Number of months (worksheets) written, excluding the Summary tab. */
  months: number;
  /** Total transactions exported. */
  rows: number;
}

/**
 * Build the workbook XML. Returns the XML string plus a small summary of what
 * was written so the caller can surface feedback.
 */
export function buildMonthlyWorkbook(state: AppState): { xml: string; meta: MonthExport } {
  const catMap: Record<string, Category> = Object.fromEntries(
    state.categories.map((c) => [c.id, c])
  );
  const base = state.settings.baseCurrency;

  // Group by YYYY-MM, newest month first.
  const byMonth = new Map<string, Entry[]>();
  for (const e of state.entries) {
    const key = (e.date || "").slice(0, 7) || "undated";
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);
  }
  const monthKeys = [...byMonth.keys()].sort((a, b) => (a < b ? 1 : -1));

  // Per-month worksheets (entries within a month sorted by date desc).
  const monthSheets = monthKeys.map((key) => {
    const rows = [...byMonth.get(key)!].sort((a, b) => (a.date < b.date ? 1 : -1));
    const expense = rows.filter((e) => e.kind === "expense").reduce((s, e) => s + e.baseAmount, 0);
    const income = rows.filter((e) => e.kind !== "expense").reduce((s, e) => s + e.baseAmount, 0);
    const body = rows.map((e) => entryRow(e, catMap[e.categoryId]?.name ?? "—")).join("");
    const totals =
      "<Row></Row>" +
      `<Row>${strCell("Income", "hdr")}${strCell("")}${strCell("")}${strCell("")}${strCell("")}${strCell(base)}${strCell("")}${numCell(income)}</Row>` +
      `<Row>${strCell("Expenses", "hdr")}${strCell("")}${strCell("")}${strCell("")}${strCell("")}${strCell(base)}${strCell("")}${numCell(expense)}</Row>` +
      `<Row>${strCell("Net", "hdr")}${strCell("")}${strCell("")}${strCell("")}${strCell("")}${strCell(base)}${strCell("")}${numCell(income - expense)}</Row>`;
    return worksheet(monthLabel(key), headerRow() + body + totals);
  });

  // Summary worksheet: one row per month.
  const summaryHeader =
    `<Row>${strCell("Month", "hdr")}${strCell("Transactions", "hdr")}${strCell(`Income (${base})`, "hdr")}${strCell(`Expenses (${base})`, "hdr")}${strCell(`Net (${base})`, "hdr")}</Row>`;
  const summaryRows = monthKeys
    .map((key) => {
      const rows = byMonth.get(key)!;
      const expense = rows.filter((e) => e.kind === "expense").reduce((s, e) => s + e.baseAmount, 0);
      const income = rows.filter((e) => e.kind !== "expense").reduce((s, e) => s + e.baseAmount, 0);
      return `<Row>${strCell(monthLabel(key))}${numCell(rows.length)}${numCell(income)}${numCell(expense)}${numCell(income - expense)}</Row>`;
    })
    .join("");
  const summary = worksheet("Summary", summaryHeader + summaryRows);

  const xml =
    `<?xml version="1.0"?>` +
    `<?mso-application progid="Excel.Sheet"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles>` +
    `<Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#161f3a" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style>` +
    `<Style ss:ID="money"><NumberFormat ss:Format="#,##0.00"/></Style>` +
    `</Styles>` +
    summary +
    monthSheets.join("") +
    `</Workbook>`;

  return { xml, meta: { months: monthKeys.length, rows: state.entries.length } };
}

/** Trigger a browser download of the monthly workbook. */
export function downloadMonthlyExcel(state: AppState): MonthExport {
  const { xml, meta } = buildMonthlyWorkbook(state);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fiscal-expenses-${stamp}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return meta;
}
