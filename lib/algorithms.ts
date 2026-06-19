// =============================================================================
// lib/algorithms.ts — the analytical engine
// Pure, dependency-free functions covering Features 9, 11, 16, 17, 19, 20, 23.
// Everything here is unit-testable and framework-agnostic.
// =============================================================================

import type {
  AppState,
  Category,
  Entry,
  Ledger,
  Subscription,
} from "./types";

const DAY = 86_400_000;

// -----------------------------------------------------------------------------
// Feature 9: Debt Minimization Algorithm
// Given who-owes-the-group-what, compute the net balance of each member, then
// greedily match the largest creditor with the largest debtor. This produces a
// near-optimal (and for typical group sizes, optimal) minimum transaction set —
// at most (n-1) transfers instead of the naive O(n^2).
// -----------------------------------------------------------------------------

export interface Settlement {
  from: string; // memberId paying
  to: string; // memberId receiving
  amount: number;
}

/** Net balance per member across all split entries in a ledger (+ = owed money). */
export function computeNetBalances(
  ledger: Ledger,
  entries: Entry[]
): Record<string, number> {
  const net: Record<string, number> = {};
  for (const m of ledger.members) net[m.id] = 0;

  for (const e of entries) {
    if (!e.split || e.split.ledgerId !== ledger.id) continue;
    const { paidBy, shares } = e.split;
    // The payer fronted baseAmount; each member owes their share back to the payer.
    net[paidBy] = (net[paidBy] ?? 0) + e.baseAmount;
    for (const s of shares) {
      net[s.memberId] = (net[s.memberId] ?? 0) - s.amount;
    }
  }
  // Round to cents to avoid floating dust.
  for (const k of Object.keys(net)) net[k] = +net[k].toFixed(2);
  return net;
}

/** Greedy min-cash-flow settlement: fewest transfers to zero out the matrix. */
export function minimizeDebts(net: Record<string, number>): Settlement[] {
  const creditors: [string, number][] = [];
  const debtors: [string, number][] = [];
  for (const [id, bal] of Object.entries(net)) {
    if (bal > 0.005) creditors.push([id, bal]);
    else if (bal < -0.005) debtors.push([id, -bal]);
  }
  // Largest first → fewer leftover fragments.
  creditors.sort((a, b) => b[1] - a[1]);
  debtors.sort((a, b) => b[1] - a[1]);

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const [cId, cAmt] = creditors[ci];
    const [dId, dAmt] = debtors[di];
    const pay = Math.min(cAmt, dAmt);
    settlements.push({ from: dId, to: cId, amount: +pay.toFixed(2) });
    creditors[ci][1] = +(cAmt - pay).toFixed(2);
    debtors[di][1] = +(dAmt - pay).toFixed(2);
    if (creditors[ci][1] <= 0.005) ci++;
    if (debtors[di][1] <= 0.005) di++;
  }
  return settlements;
}

// -----------------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------------

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // yyyy-mm
}

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function daysUntil(iso: string, now = new Date()): number {
  const target = new Date(iso + "T00:00:00").getTime();
  return Math.ceil((target - now.getTime()) / DAY);
}

export function daysInMonth(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function dayOfMonth(d = new Date()): number {
  return d.getDate();
}

// -----------------------------------------------------------------------------
// Spend aggregation
// -----------------------------------------------------------------------------

export function isExpense(e: Entry): boolean {
  return e.kind === "expense";
}
export function isIncome(e: Entry): boolean {
  return e.kind === "income" || e.kind === "windfall";
}

/** Total base-currency spend, optionally scoped to a month + category. */
export function totalSpend(
  entries: Entry[],
  opts: { month?: string; categoryId?: string } = {}
): number {
  return entries
    .filter(isExpense)
    .filter((e) => (opts.month ? monthKey(e.date) === opts.month : true))
    .filter((e) => (opts.categoryId ? e.categoryId === opts.categoryId : true))
    .reduce((sum, e) => sum + e.baseAmount, 0);
}

export function totalIncome(entries: Entry[], month?: string): number {
  return entries
    .filter(isIncome)
    .filter((e) => (month ? monthKey(e.date) === month : true))
    .reduce((sum, e) => sum + e.baseAmount, 0);
}

/** Feature 15: spend grouped by category for the breakdown chart. */
export function spendByCategory(
  entries: Entry[],
  categories: Category[],
  month?: string
): { category: Category; total: number; pct: number }[] {
  const totals = new Map<string, number>();
  let grand = 0;
  for (const e of entries.filter(isExpense)) {
    if (month && monthKey(e.date) !== month) continue;
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.baseAmount);
    grand += e.baseAmount;
  }
  return categories
    .map((c) => {
      const total = +(totals.get(c.id) ?? 0).toFixed(2);
      return { category: c, total, pct: grand ? (total / grand) * 100 : 0 };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Feature 16: rolling month-over-month income vs. spend. */
export interface MonthlyPoint {
  month: string;
  income: number;
  spend: number;
  net: number;
}
export function monthlyTrend(entries: Entry[], months = 6): MonthlyPoint[] {
  const map = new Map<string, MonthlyPoint>();
  for (const e of entries) {
    const k = monthKey(e.date);
    if (!map.has(k)) map.set(k, { month: k, income: 0, spend: 0, net: 0 });
    const p = map.get(k)!;
    if (isExpense(e)) p.spend += e.baseAmount;
    else p.income += e.baseAmount;
  }
  const points = [...map.values()].map((p) => ({
    ...p,
    income: +p.income.toFixed(2),
    spend: +p.spend.toFixed(2),
    net: +(p.income - p.spend).toFixed(2),
  }));
  return points.sort((a, b) => a.month.localeCompare(b.month)).slice(-months);
}

// -----------------------------------------------------------------------------
// Feature 17: Budget Burn-Rate
// -----------------------------------------------------------------------------

export type BurnStatus = "good" | "warn" | "bad";
export interface BurnInfo {
  spent: number;
  cap: number;
  ratio: number; // 0..>1
  status: BurnStatus;
}
export function burnRate(spent: number, cap: number): BurnInfo {
  const ratio = cap > 0 ? spent / cap : 0;
  const status: BurnStatus = ratio >= 1 ? "bad" : ratio >= 0.8 ? "warn" : "good";
  return { spent: +spent.toFixed(2), cap, ratio, status };
}

// -----------------------------------------------------------------------------
// Feature 11: Envelope Allocation System
// Divide incoming monthly income into category caps by target percentage.
// -----------------------------------------------------------------------------

export interface Envelope {
  category: Category;
  pct: number;
  allocated: number;
  spent: number;
  remaining: number;
}
export function allocateEnvelopes(
  income: number,
  categories: Category[],
  entries: Entry[],
  month: string
): Envelope[] {
  return categories
    .filter((c) => (c.envelopePct ?? 0) > 0)
    .map((c) => {
      const pct = c.envelopePct!;
      const allocated = +((income * pct) / 100).toFixed(2);
      const spent = totalSpend(entries, { month, categoryId: c.id });
      return { category: c, pct, allocated, spent, remaining: +(allocated - spent).toFixed(2) };
    });
}

// -----------------------------------------------------------------------------
// Feature 14 + 23: subscription cadence math & lifetime projection
// -----------------------------------------------------------------------------

/** Normalize any cadence to an equivalent monthly cost. */
export function monthlyEquivalent(sub: Subscription): number {
  switch (sub.cadence) {
    case "weekly":
      return (sub.amount * 52) / 12;
    case "monthly":
      return sub.amount;
    case "yearly":
      return sub.amount / 12;
  }
}

export interface FatigueProjection {
  activeCount: number;
  monthly: number;
  yearly: number;
  fiveYear: number;
}
export function subscriptionFatigue(subs: Subscription[]): FatigueProjection {
  const active = subs.filter((s) => s.active);
  const monthly = active.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
  return {
    activeCount: active.length,
    monthly: +monthly.toFixed(2),
    yearly: +(monthly * 12).toFixed(2),
    fiveYear: +(monthly * 60).toFixed(2),
  };
}

// -----------------------------------------------------------------------------
// Feature 19: "Safe-to-Spend" rolling daily allowance
// remaining discretionary cash, minus upcoming fixed obligations this month,
// spread across the days left in the month.
// -----------------------------------------------------------------------------

export interface SafeToSpend {
  remainingCash: number;
  upcomingObligations: number;
  daysLeft: number;
  dailyAllowance: number;
  spentToday: number;
}
export function safeToSpend(state: AppState, now = new Date()): SafeToSpend {
  const month = monthKey(todayISO(now));
  const income = totalIncome(state.entries, month);
  const spent = totalSpend(state.entries, { month });

  // Subscriptions / bills that renew before month end and haven't been paid.
  const lastDay = todayISO(new Date(now.getFullYear(), now.getMonth(), daysInMonth(now)));
  const upcoming = state.subscriptions
    .filter((s) => s.active && s.nextRenewal >= todayISO(now) && s.nextRenewal <= lastDay)
    .reduce((sum, s) => sum + monthlyEquivalentBase(s, state), 0);

  const remainingCash = Math.max(0, income - spent);
  const discretionary = Math.max(0, remainingCash - upcoming);
  const daysLeft = Math.max(1, daysInMonth(now) - dayOfMonth(now) + 1);

  const today = todayISO(now);
  const spentToday = totalSpend(
    state.entries.filter((e) => e.date === today),
    {}
  );

  return {
    remainingCash: +remainingCash.toFixed(2),
    upcomingObligations: +upcoming.toFixed(2),
    daysLeft,
    dailyAllowance: +(discretionary / daysLeft).toFixed(2),
    spentToday: +spentToday.toFixed(2),
  };
}

function monthlyEquivalentBase(sub: Subscription, _state: AppState): number {
  // Subscriptions store their own currency; for the demo we treat amount as base.
  return monthlyEquivalent(sub);
}

// -----------------------------------------------------------------------------
// Feature 20: Cash-Flow & Runway Simulator
// days of cash remaining = liquid reserves / average daily burn.
// -----------------------------------------------------------------------------

export interface Runway {
  avgDailyBurn: number;
  reserves: number;
  daysRemaining: number;
  depletionDate: string | null;
}
export function runway(state: AppState, lookbackDays = 30, now = new Date()): Runway {
  const since = todayISO(new Date(now.getTime() - lookbackDays * DAY));
  const recent = state.entries.filter((e) => isExpense(e) && e.date >= since);
  const totalRecent = recent.reduce((s, e) => s + e.baseAmount, 0);
  const avgDailyBurn = +(totalRecent / lookbackDays).toFixed(2);
  const reserves = state.settings.liquidReserves;

  if (avgDailyBurn <= 0) {
    return { avgDailyBurn: 0, reserves, daysRemaining: Infinity, depletionDate: null };
  }
  const daysRemaining = Math.floor(reserves / avgDailyBurn);
  const depletion = new Date(now.getTime() + daysRemaining * DAY);
  return {
    avgDailyBurn,
    reserves,
    daysRemaining,
    depletionDate: todayISO(depletion),
  };
}

// -----------------------------------------------------------------------------
// Feature 21: Impulse cooling-off remaining time
// -----------------------------------------------------------------------------

export function coolingRemainingMs(createdAt: string, hours: number, now = new Date()): number {
  const unlockAt = new Date(createdAt).getTime() + hours * 3_600_000;
  return Math.max(0, unlockAt - now.getTime());
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "Unlocked";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m ${s}s`;
}
