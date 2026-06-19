// =============================================================================
// lib/currency.ts  — Feature 3: Multi-Currency Support
// Simulated "real-time" rates with a hook for swapping in a live FX API.
// All rates are expressed relative to USD (1 USD = rate units of currency).
// =============================================================================

import type { CurrencyCode } from "./types";

export const CURRENCIES: { code: CurrencyCode; symbol: string; label: string }[] = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
];

/** Baseline simulated rates (USD -> X). Replace `fetchLiveRates` for production. */
const BASE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  INR: 83.2,
  AUD: 1.52,
  EUR: 0.92,
  GBP: 0.79,
};

let liveRates: Record<CurrencyCode, number> = { ...BASE_RATES };

/**
 * In production, swap this for `await fetch('https://api.fx.../latest')`.
 * Here it nudges rates deterministically so the UI can demo "live" movement.
 */
export async function fetchLiveRates(seed = 0): Promise<Record<CurrencyCode, number>> {
  const jitter = (n: number, i: number) => +(n * (1 + Math.sin(seed + i) * 0.01)).toFixed(4);
  liveRates = {
    USD: 1,
    INR: jitter(BASE_RATES.INR, 1),
    AUD: jitter(BASE_RATES.AUD, 2),
    EUR: jitter(BASE_RATES.EUR, 3),
    GBP: jitter(BASE_RATES.GBP, 4),
  };
  return liveRates;
}

export function getRates(): Record<CurrencyCode, number> {
  return liveRates;
}

/** Convert `amount` from `from` to `to`, supporting a manual override rate. */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  manualRate?: number
): number {
  if (from === to) return amount;
  if (manualRate && manualRate > 0) return +(amount * manualRate).toFixed(2);
  const inUsd = amount / liveRates[from];
  return +(inUsd * liveRates[to]).toFixed(2);
}

export function symbolFor(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function formatMoney(amount: number, code: CurrencyCode): string {
  const sym = symbolFor(code);
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? "-" : ""}${sym}${formatted}`;
}
