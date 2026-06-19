// =============================================================================
// lib/seed.ts — id generation + a realistic out-of-the-box demo dataset so the
// dashboard is alive on first launch (no DB, no manual entry required).
// =============================================================================

import type { AppState, Entry } from "./types";

export function uid(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function iso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function future(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const CATS = {
  food: "cat_food",
  rent: "cat_rent",
  software: "cat_software",
  travel: "cat_travel",
  fun: "cat_fun",
  health: "cat_health",
  income: "cat_income",
};

function entry(p: Partial<Entry> & Pick<Entry, "amount" | "categoryId">): Entry {
  return {
    id: uid("e"),
    kind: "expense",
    currency: "USD",
    baseAmount: p.amount,
    note: "",
    tags: [],
    date: iso(0),
    method: "card",
    createdAt: new Date().toISOString(),
    ...p,
  } as Entry;
}

export function defaultState(): AppState {
  const entries: Entry[] = [
    entry({ amount: 1800, categoryId: CATS.rent, note: "Monthly rent", date: iso(28), method: "bank" }),
    entry({ amount: 4200, categoryId: CATS.income, kind: "income", note: "Salary", date: iso(28), method: "bank" }),
    entry({ amount: 64.2, categoryId: CATS.food, note: "Groceries #weekly", tags: ["weekly"], date: iso(6) }),
    entry({ amount: 22, categoryId: CATS.food, note: "Lunch #work", tags: ["work"], date: iso(3), satisfaction: 3 }),
    entry({ amount: 12.99, categoryId: CATS.software, note: "Cloud IDE #saas", tags: ["saas"], reimbursable: true, taxDeductible: true, date: iso(10) }),
    entry({ amount: 320, categoryId: CATS.travel, note: "Flights #trip2026", tags: ["trip2026"], date: iso(12), satisfaction: 5 }),
    entry({ amount: 89, categoryId: CATS.fun, note: "Concert tickets #trip2026", tags: ["trip2026"], date: iso(9), satisfaction: 5 }),
    entry({ amount: 240, categoryId: CATS.fun, note: "Impulse gadget", date: iso(15), satisfaction: 2 }),
    entry({ amount: 45, categoryId: CATS.health, note: "Pharmacy", date: iso(2) }),
    entry({ amount: 500, categoryId: CATS.income, kind: "windfall", note: "Freelance bonus", date: iso(5), method: "bank" }),
    entry({ amount: 1750, categoryId: CATS.rent, note: "Rent", date: iso(58), method: "bank" }),
    entry({ amount: 3900, categoryId: CATS.income, kind: "income", note: "Salary", date: iso(58), method: "bank" }),
    entry({ amount: 280, categoryId: CATS.food, note: "Groceries", date: iso(50) }),
    entry({ amount: 150, categoryId: CATS.travel, note: "Train", date: iso(45) }),
  ];

  return {
    entries,
    categories: [
      { id: CATS.food, name: "Food & Dining", color: "#22c55e", cap: 600, envelopePct: 15, taxBucket: "" },
      { id: CATS.rent, name: "Rent & Housing", color: "#6366f1", cap: 2000, envelopePct: 40, taxBucket: "Home Office" },
      { id: CATS.software, name: "Software", color: "#22d3ee", cap: 200, envelopePct: 5, taxBucket: "Business Tools" },
      { id: CATS.travel, name: "Travel", color: "#f59e0b", cap: 800, envelopePct: 10, taxBucket: "Business Travel" },
      { id: CATS.fun, name: "Entertainment", color: "#ec4899", cap: 400, envelopePct: 8, taxBucket: "" },
      { id: CATS.health, name: "Health", color: "#ef4444", cap: 300, envelopePct: 7, taxBucket: "Medical" },
      { id: CATS.income, name: "Income", color: "#10b981", taxBucket: "" },
    ],
    ledgers: [
      {
        id: "led_trip",
        name: "Goa Trip 2026",
        members: [
          { id: "m_you", name: "You" },
          { id: "m_alex", name: "Alex" },
          { id: "m_sam", name: "Sam" },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
    subscriptions: [
      { id: "sub_1", name: "Streaming+", amount: 15.99, currency: "USD", cadence: "monthly", nextRenewal: future(8), categoryId: CATS.fun, active: true, createdAt: new Date().toISOString() },
      { id: "sub_2", name: "Cloud IDE", amount: 12.99, currency: "USD", cadence: "monthly", nextRenewal: future(3), categoryId: CATS.software, active: true, createdAt: new Date().toISOString() },
      { id: "sub_3", name: "Domain", amount: 14, currency: "USD", cadence: "yearly", nextRenewal: future(120), categoryId: CATS.software, active: true, createdAt: new Date().toISOString() },
      { id: "sub_4", name: "Gym", amount: 9.99, currency: "USD", cadence: "weekly", nextRenewal: future(2), categoryId: CATS.health, active: true, createdAt: new Date().toISOString() },
    ],
    clients: [
      { id: "cli_acme", name: "Acme Corp", budget: 5000, color: "#6366f1", createdAt: new Date().toISOString() },
      { id: "cli_globex", name: "Globex", budget: 3000, color: "#22d3ee", createdAt: new Date().toISOString() },
    ],
    rules: [
      {
        id: "rule_1",
        name: "Software → Tax + Reimbursable",
        enabled: true,
        condition: { field: "categoryId", operator: "eq", value: CATS.software },
        actions: [
          { type: "setTaxDeductible", value: true },
          { type: "setReimbursable", value: true },
          { type: "addTag", value: "tax-deductible" },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
    impulses: [
      { id: "imp_1", name: "Mechanical keyboard", amount: 180, currency: "USD", coolingHours: 48, createdAt: new Date(Date.now() - 3_600_000 * 6).toISOString() },
    ],
    alerts: [
      {
        id: "alert_rent",
        label: "Pay rent",
        date: iso(-3),
        time: "09:00",
        recurrence: "monthly",
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    ],
    habits: [],
    archives: [],
    settings: {
      baseCurrency: "USD",
      liquidReserves: 8200,
      monthlyIncomeTarget: 4200,
      canvas: "micro",
      notify: {
        enabled: false,
        subscriptionLeadDays: 3,
        quietEnabled: true,
        quietStart: "22:00",
        quietEnd: "08:00",
      },
      autoMonthlyReset: true,
      lastResetMonth: new Date().toISOString().slice(0, 7),
    },
    rev: 1,
    updatedAt: new Date().toISOString(),
  };
}
