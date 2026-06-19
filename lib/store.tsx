"use client";
// =============================================================================
// lib/store.tsx — Feature 25: React state synced with the storage adapter.
// A single source of truth via Context + useReducer. Every mutation bumps `rev`
// and triggers a debounced persist() (localStorage now, /api/expenses best-effort).
// =============================================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  Alert,
  AppState,
  AutomationRule,
  Category,
  Client,
  Entry,
  Habit,
  ImpulseItem,
  Ledger,
  Subscription,
  AppSettings,
} from "./types";
import { bootstrap, persist } from "./storage";
import { defaultState, uid } from "./seed";
import { runRules } from "./rules";
import { extractTags } from "./hashtags";

// --- Actions ------------------------------------------------------------------

type Action =
  | { type: "HYDRATE"; state: AppState }
  | { type: "ADD_ENTRY"; entry: Entry }
  | { type: "UPDATE_ENTRY"; id: string; patch: Partial<Entry> }
  | { type: "DELETE_ENTRY"; id: string }
  | { type: "UPSERT_CATEGORY"; category: Category }
  | { type: "DELETE_CATEGORY"; id: string }
  | { type: "UPSERT_LEDGER"; ledger: Ledger }
  | { type: "UPSERT_SUBSCRIPTION"; sub: Subscription }
  | { type: "DELETE_SUBSCRIPTION"; id: string }
  | { type: "UPSERT_CLIENT"; client: Client }
  | { type: "UPSERT_RULE"; rule: AutomationRule }
  | { type: "DELETE_RULE"; id: string }
  | { type: "UPSERT_IMPULSE"; item: ImpulseItem }
  | { type: "DELETE_IMPULSE"; id: string }
  | { type: "UPSERT_ALERT"; alert: Alert }
  | { type: "DELETE_ALERT"; id: string }
  | { type: "UPSERT_HABIT"; habit: Habit }
  | { type: "PATCH_SETTINGS"; patch: Partial<AppSettings> }
  | { type: "RESET_DATA" }
  | { type: "CLOSE_MONTH"; month: string };

/** Local-time yyyy-mm for the current month (used for monthly rollover). */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const next = [...list];
  next[i] = item;
  return next;
}

function reducer(state: AppState, action: Action): AppState {
  const touch = (partial: Partial<AppState>): AppState => ({
    ...state,
    ...partial,
    rev: state.rev + 1,
    updatedAt: new Date().toISOString(),
  });

  switch (action.type) {
    case "HYDRATE":
      return action.state;
    case "ADD_ENTRY":
      return touch({ entries: [action.entry, ...state.entries] });
    case "UPDATE_ENTRY":
      return touch({
        entries: state.entries.map((e) =>
          e.id === action.id ? { ...e, ...action.patch } : e
        ),
      });
    case "DELETE_ENTRY":
      return touch({ entries: state.entries.filter((e) => e.id !== action.id) });
    case "UPSERT_CATEGORY":
      return touch({ categories: upsert(state.categories, action.category) });
    case "DELETE_CATEGORY":
      return touch({ categories: state.categories.filter((c) => c.id !== action.id) });
    case "UPSERT_LEDGER":
      return touch({ ledgers: upsert(state.ledgers, action.ledger) });
    case "UPSERT_SUBSCRIPTION":
      return touch({ subscriptions: upsert(state.subscriptions, action.sub) });
    case "DELETE_SUBSCRIPTION":
      return touch({ subscriptions: state.subscriptions.filter((s) => s.id !== action.id) });
    case "UPSERT_CLIENT":
      return touch({ clients: upsert(state.clients, action.client) });
    case "UPSERT_RULE":
      return touch({ rules: upsert(state.rules, action.rule) });
    case "DELETE_RULE":
      return touch({ rules: state.rules.filter((r) => r.id !== action.id) });
    case "UPSERT_IMPULSE":
      return touch({ impulses: upsert(state.impulses, action.item) });
    case "DELETE_IMPULSE":
      return touch({ impulses: state.impulses.filter((i) => i.id !== action.id) });
    case "UPSERT_ALERT":
      return touch({ alerts: upsert(state.alerts ?? [], action.alert) });
    case "DELETE_ALERT":
      return touch({ alerts: (state.alerts ?? []).filter((a) => a.id !== action.id) });
    case "UPSERT_HABIT": {
      const list = state.habits ?? [];
      const i = list.findIndex((h) => h.type === action.habit.type);
      const next = i === -1 ? [...list, action.habit] : list.map((h, idx) => (idx === i ? action.habit : h));
      return touch({ habits: next });
    }
    case "PATCH_SETTINGS":
      return touch({ settings: { ...state.settings, ...action.patch } });
    case "RESET_DATA":
      // Start fresh: clear all transactional data but keep the category
      // structure (logging needs at least one category) and base currency.
      return touch({
        entries: [],
        ledgers: [],
        subscriptions: [],
        clients: [],
        rules: [],
        impulses: [],
        alerts: [],
        archives: [],
        settings: { ...state.settings, liquidReserves: 0, monthlyIncomeTarget: 0 },
      });
    case "CLOSE_MONTH": {
      // Archive current transactions under `month`, then clear them. Config
      // (categories, subscriptions, clients, rules, alerts) is intentionally
      // kept — only the monthly transaction ledger resets.
      const archive = {
        month: action.month,
        entries: state.entries,
        closedAt: new Date().toISOString(),
      };
      return touch({
        entries: [],
        impulses: [],
        archives: [archive, ...(state.archives ?? [])].slice(0, 36),
        settings: { ...state.settings, lastResetMonth: currentMonth() },
      });
    }
    default:
      return state;
  }
}

// --- Context ------------------------------------------------------------------

interface StoreApi {
  state: AppState;
  ready: boolean;
  source: string;
  /** High-level helper: builds an entry, applies hashtags + automation rules. */
  addEntry: (input: NewEntryInput) => Entry;
  updateEntry: (id: string, patch: Partial<Entry>) => void;
  deleteEntry: (id: string) => void;
  upsertCategory: (c: Category) => void;
  deleteCategory: (id: string) => void;
  upsertLedger: (l: Ledger) => void;
  upsertSubscription: (s: Subscription) => void;
  deleteSubscription: (id: string) => void;
  upsertClient: (c: Client) => void;
  upsertRule: (r: AutomationRule) => void;
  deleteRule: (id: string) => void;
  upsertImpulse: (i: ImpulseItem) => void;
  deleteImpulse: (id: string) => void;
  upsertAlert: (a: Alert) => void;
  deleteAlert: (id: string) => void;
  upsertHabit: (h: Habit) => void;
  patchSettings: (patch: Partial<AppSettings>) => void;
  /** Wipe all transactional data and start fresh (keeps categories). */
  resetData: () => void;
  /** Archive the current transactions under `month` (yyyy-mm) and clear them. */
  closeMonth: (month: string) => void;
}

export interface NewEntryInput {
  kind?: Entry["kind"];
  amount: number;
  currency: Entry["currency"];
  baseAmount: number;
  categoryId: string;
  note: string;
  date: string;
  method: Entry["method"];
  reimbursable?: boolean;
  taxDeductible?: boolean;
  clientId?: string;
  satisfaction?: number;
  split?: Entry["split"];
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, defaultState);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState("seed");
  const firstPersistSkipped = useRef(false);

  // Bootstrap from remote/local on mount.
  useEffect(() => {
    let alive = true;
    bootstrap().then(({ state: s, source }) => {
      if (!alive) return;
      dispatch({ type: "HYDRATE", state: s });
      setSource(source);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Debounced persistence on every change (after hydration).
  useEffect(() => {
    if (!ready) return;
    if (!firstPersistSkipped.current) {
      firstPersistSkipped.current = true;
      return; // don't immediately re-persist the just-hydrated state
    }
    const t = setTimeout(() => void persist(state), 350);
    return () => clearTimeout(t);
  }, [state, ready]);

  const api = useMemo<StoreApi>(() => {
    return {
      state,
      ready,
      source,
      addEntry: (input) => {
        const base: Entry = {
          id: uid("e"),
          kind: input.kind ?? "expense",
          amount: input.amount,
          currency: input.currency,
          baseAmount: input.baseAmount,
          categoryId: input.categoryId,
          note: input.note,
          tags: extractTags(input.note),
          date: input.date,
          method: input.method,
          reimbursable: input.reimbursable,
          taxDeductible: input.taxDeductible,
          clientId: input.clientId,
          satisfaction: input.satisfaction,
          split: input.split,
          createdAt: new Date().toISOString(),
        };
        const withRules = runRules(state.rules, base);
        dispatch({ type: "ADD_ENTRY", entry: withRules });
        return withRules;
      },
      updateEntry: (id, patch) => dispatch({ type: "UPDATE_ENTRY", id, patch }),
      deleteEntry: (id) => dispatch({ type: "DELETE_ENTRY", id }),
      upsertCategory: (category) => dispatch({ type: "UPSERT_CATEGORY", category }),
      deleteCategory: (id) => dispatch({ type: "DELETE_CATEGORY", id }),
      upsertLedger: (ledger) => dispatch({ type: "UPSERT_LEDGER", ledger }),
      upsertSubscription: (sub) => dispatch({ type: "UPSERT_SUBSCRIPTION", sub }),
      deleteSubscription: (id) => dispatch({ type: "DELETE_SUBSCRIPTION", id }),
      upsertClient: (client) => dispatch({ type: "UPSERT_CLIENT", client }),
      upsertRule: (rule) => dispatch({ type: "UPSERT_RULE", rule }),
      deleteRule: (id) => dispatch({ type: "DELETE_RULE", id }),
      upsertImpulse: (item) => dispatch({ type: "UPSERT_IMPULSE", item }),
      deleteImpulse: (id) => dispatch({ type: "DELETE_IMPULSE", id }),
      upsertAlert: (alert) => dispatch({ type: "UPSERT_ALERT", alert }),
      deleteAlert: (id) => dispatch({ type: "DELETE_ALERT", id }),
      upsertHabit: (habit) => dispatch({ type: "UPSERT_HABIT", habit }),
      patchSettings: (patch) => dispatch({ type: "PATCH_SETTINGS", patch }),
      resetData: () => dispatch({ type: "RESET_DATA" }),
      closeMonth: (month) => dispatch({ type: "CLOSE_MONTH", month }),
    };
  }, [state, ready, source]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}

/** Convenience selector hook for derived category lookup. */
export function useCategoryMap(): Record<string, Category> {
  const { state } = useStore();
  return useMemo(
    () => Object.fromEntries(state.categories.map((c) => [c.id, c])),
    [state.categories]
  );
}
