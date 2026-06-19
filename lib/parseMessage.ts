// =============================================================================
// lib/parseMessage.ts — turn a payment SMS / app-notification into a draft
// expense. Handles the common Indian bank/UPI/card and wallet-app formats
// (HDFC/ICICI/SBI/Axis, Google Pay, PhonePe, Paytm, CRED, Scapia, etc.).
//
// This is text parsing only — it cannot read your messages by itself (iOS
// forbids that); the user pastes/shares the text or an iOS Shortcut passes it.
// =============================================================================

import type { CurrencyCode, PaymentMethod } from "./types";

export interface ParsedPayment {
  amount: number;
  currency: CurrencyCode;
  /** "expense" for debits/spends, "income" for credits/received. */
  kind: "expense" | "income";
  merchant?: string;
  method: PaymentMethod;
  date?: string; // yyyy-mm-dd
  /** The cleaned note we'll attach to the entry. */
  note: string;
}

const CURRENCY_WORDS: Record<string, CurrencyCode> = {
  rs: "INR",
  "rs.": "INR",
  inr: "INR",
  "₹": "INR",
  usd: "USD",
  "$": "USD",
  eur: "EUR",
  "€": "EUR",
  gbp: "GBP",
  "£": "GBP",
  aud: "AUD",
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Extract the most likely transaction amount + its currency. */
function extractAmount(text: string): { amount: number; currency: CurrencyCode } | null {
  // Patterns like "Rs. 1,250.50", "INR 500", "₹250", "$12.99", "1250 INR".
  const re =
    /(rs\.?|inr|usd|eur|gbp|aud|[₹$€£])\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(rs\.?|inr|usd|eur|gbp|aud)/gi;
  let best: { amount: number; currency: CurrencyCode } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const sym = (m[1] || m[4] || "").toLowerCase();
    const num = (m[2] || m[3] || "").replace(/,/g, "");
    const amount = parseFloat(num);
    if (!isFinite(amount) || amount <= 0) continue;
    const currency = CURRENCY_WORDS[sym] ?? "INR";
    // Prefer the largest amount found (avoids picking up "balance is X" style
    // trailing numbers that tend to be smaller than the debit in practice is
    // not guaranteed — so we just take the first solid match).
    if (!best) best = { amount, currency };
  }
  return best;
}

/** Debit vs credit. */
function detectKind(text: string): "expense" | "income" {
  const t = text.toLowerCase();
  if (/\b(credited|received|refund|cashback|deposited|added)\b/.test(t)) return "income";
  return "expense"; // debited / spent / paid / purchase / withdrawn
}

function detectMethod(text: string): PaymentMethod {
  const t = text.toLowerCase();
  if (/\bupi\b|vpa|@ok|@y|@paytm|phonepe|gpay|google pay/.test(t)) return "upi";
  if (/\bcard\b|credit card|debit card|cred\b|scapia/.test(t)) return "card";
  if (/\bwallet\b|paytm wallet/.test(t)) return "wallet";
  if (/\bneft|imps|rtgs|a\/c|account|bank\b/.test(t)) return "bank";
  return "card";
}

/** Try to pull the merchant/payee name. */
function extractMerchant(text: string): string | undefined {
  // "to AMAZON", "at SWIGGY", "to Mr X via UPI", "paid to Zomato"
  const patterns = [
    /(?:paid to|to|at|towards|in favour of)\s+([A-Za-z0-9 .&'@_-]{2,40}?)(?:\s+(?:via|on|using|ref|upi|txn|a\/c|dated|\.)|[.,;\n]|$)/i,
    /\bvpa\s+([A-Za-z0-9.@_-]{2,40})/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) {
      const name = m[1].trim().replace(/\s{2,}/g, " ");
      if (name && !/^(your|the|a|an)$/i.test(name)) return name;
    }
  }
  return undefined;
}

/** Find a date in the message; default to undefined (caller uses today). */
function extractDate(text: string): string | undefined {
  // 12/06/2026, 12-06-26, 2026-06-12
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/.exec(text);
  if (m) {
    let [_, d, mo, y] = m;
    const yr = y.length === 2 ? `20${y}` : y;
    return `${yr}-${pad(Number(mo))}-${pad(Number(d))}`;
  }
  // 12 Jun 2026  /  12-Jun-26
  m = /\b(\d{1,2})[ -]([A-Za-z]{3})[A-Za-z]*[ -](\d{2,4})\b/.exec(text);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) {
      const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${yr}-${pad(mo)}-${pad(Number(m[1]))}`;
    }
  }
  return undefined;
}

/**
 * Parse one payment message. Returns null if no amount can be found (i.e. the
 * text almost certainly isn't a payment alert).
 */
export function parsePaymentMessage(text: string): ParsedPayment | null {
  if (!text || !text.trim()) return null;
  const amt = extractAmount(text);
  if (!amt) return null;

  const kind = detectKind(text);
  const method = detectMethod(text);
  const merchant = extractMerchant(text);
  const date = extractDate(text);

  const note = merchant
    ? `${kind === "income" ? "From" : "To"} ${merchant}`
    : text.replace(/\s+/g, " ").trim().slice(0, 80);

  return { amount: amt.amount, currency: amt.currency, kind, method, merchant, date, note };
}

/** Parse a blob containing several messages (split on blank lines / long gaps). */
export function parseMany(text: string): ParsedPayment[] {
  return text
    .split(/\n\s*\n|\r\n\r\n/)
    .map((chunk) => parsePaymentMessage(chunk))
    .filter((x): x is ParsedPayment => x !== null);
}
