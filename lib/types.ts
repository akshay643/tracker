// =============================================================================
// lib/types.ts
// Central, strongly-typed data model. Every entity carries an `id` (string uuid)
// and ISO `createdAt`, so the same shapes map cleanly onto PostgreSQL tables.
// =============================================================================

export type CurrencyCode = "USD" | "INR" | "AUD" | "EUR" | "GBP";

export type PaymentMethod = "card" | "cash" | "upi" | "bank" | "wallet" | "other";

export type EntryKind = "expense" | "income" | "windfall";

/** Per-member share for a split line-item. */
export interface SplitShare {
  memberId: string;
  /** Resolved absolute amount owed by this member (in the entry's currency). */
  amount: number;
  /** Original input used to derive `amount` (percent or exact value). */
  rawValue?: number;
}

export type SplitMode = "even" | "percent" | "exact";

export interface SplitConfig {
  ledgerId: string;
  /** Member who actually paid the bill up front. */
  paidBy: string;
  mode: SplitMode;
  shares: SplitShare[];
}

/** A single financial transaction — expense, income, or windfall. */
export interface Entry {
  id: string;
  kind: EntryKind;
  /** Amount in the original currency (always positive). */
  amount: number;
  currency: CurrencyCode;
  /** Amount normalized to the base currency at log time (cached for analytics). */
  baseAmount: number;
  categoryId: string;
  note: string;
  /** Hashtags extracted from the note, e.g. ["trip2026", "client-acme"]. */
  tags: string[];
  date: string; // ISO yyyy-mm-dd
  method: PaymentMethod;

  // --- Automation / SaaS flags (Modules 3) ---
  reimbursable?: boolean;
  taxDeductible?: boolean;
  clientId?: string;
  recurring?: boolean;

  // --- Group splitting (Module 2) ---
  split?: SplitConfig;

  // --- Psychology (Module 5) ---
  satisfaction?: number; // 1–5 "Life Satisfaction" rating

  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  /** Optional monthly spending cap used by burn-rate + envelope system. */
  cap?: number;
  /** Target % of monthly income for the Envelope Allocation System. */
  envelopePct?: number;
  /** Maps the category onto a standard tax-deduction bucket. */
  taxBucket?: string;
}

export interface LedgerMember {
  id: string;
  name: string;
}

export interface Ledger {
  id: string;
  name: string;
  members: LedgerMember[];
  createdAt: string;
}

export type RecurrenceCadence = "weekly" | "monthly" | "yearly";

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: CurrencyCode;
  cadence: RecurrenceCadence;
  /** ISO date of the next renewal. */
  nextRenewal: string;
  categoryId?: string;
  active: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  /** Hourly/period budget cap for the project profile. */
  budget?: number;
  color: string;
  createdAt: string;
}

// --- If-This-Then-That automation rules (Feature 10) ---
export type RuleField = "categoryId" | "note" | "amount" | "method";
export type RuleOperator = "eq" | "contains" | "gt" | "lt";
export type RuleAction =
  | { type: "addTag"; value: string }
  | { type: "setReimbursable"; value: boolean }
  | { type: "setTaxDeductible"; value: boolean }
  | { type: "setCategory"; value: string };

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: { field: RuleField; operator: RuleOperator; value: string };
  actions: RuleAction[];
  createdAt: string;
}

// --- Impulse "Cooling-Off" vault (Feature 21) ---
export interface ImpulseItem {
  id: string;
  name: string;
  amount: number;
  currency: CurrencyCode;
  /** Hours the item stays locked. */
  coolingHours: number;
  createdAt: string; // lock start
  purchased?: boolean;
  released?: boolean;
}

// --- Custom reminders / push alerts ------------------------------------------
export type AlertRecurrence = "none" | "daily" | "weekly" | "monthly";

/** A user-defined reminder that fires a notification when due. */
export interface Alert {
  id: string;
  label: string;
  /** Anchor date (yyyy-mm-dd). For recurring alerts this is the first occurrence. */
  date: string;
  /** Local time of day to fire, "HH:MM" (24h). */
  time: string;
  recurrence: AlertRecurrence;
  enabled: boolean;
  /** ISO timestamp of the last time this alert fired (dedupe guard). */
  lastFired?: string;
  createdAt: string;
}

// --- Habits / wellness (toggleable life modules) -----------------------------
export type HabitType = "quit-smoking" | "hydrate" | "daily-log" | "no-spend";

export interface Habit {
  type: HabitType;
  enabled: boolean;
  /** Reminder cadence in minutes. */
  intervalMinutes: number;
  /** User's own motivational line; overrides the rotating defaults. */
  customMessage?: string;
  /** When the habit/streak began (ISO). */
  startedAt: string;
  // quit-smoking economics (optional):
  cigarettesPerDay?: number;
  pricePerPack?: number;
  cigarettesPerPack?: number;
}

/** A closed (reset) month's transactions, kept so its report stays downloadable. */
export interface MonthArchive {
  /** yyyy-mm of the month that was closed. */
  month: string;
  entries: Entry[];
  closedAt: string;
}

/** Root persisted document — one object that round-trips to localStorage or /api/expenses. */
export interface AppState {
  entries: Entry[];
  categories: Category[];
  ledgers: Ledger[];
  subscriptions: Subscription[];
  clients: Client[];
  rules: AutomationRule[];
  impulses: ImpulseItem[];
  alerts: Alert[];
  /** Toggleable wellness/life habits. */
  habits: Habit[];
  /** Past months archived at reset time (newest first). */
  archives: MonthArchive[];
  settings: AppSettings;
  /** Monotonic clock for last-write-wins sync conflict resolution. */
  rev: number;
  updatedAt: string;
}

export interface AppSettings {
  baseCurrency: CurrencyCode;
  /** Current liquid reserves used by the runway simulator. */
  liquidReserves: number;
  monthlyIncomeTarget: number;
  /** "macro" = minimalist logging, "micro" = data-dense expert dashboard. */
  canvas: "macro" | "micro";
  /** Notification preferences. */
  notify: NotifySettings;
  /** Auto-archive + clear transactions at the start of each month. */
  autoMonthlyReset: boolean;
  /** yyyy-mm of the last month we reset for (prevents repeat resets). */
  lastResetMonth: string;
}

export interface NotifySettings {
  /** Master switch for in-app/push reminders. */
  enabled: boolean;
  /** Remind about subscription renewals this many days ahead (0 disables). */
  subscriptionLeadDays: number;
}

// Added to AppSettings below via declaration; see autoMonthlyReset/lastResetMonth.
