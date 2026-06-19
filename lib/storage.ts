// =============================================================================
// lib/storage.ts — Feature 25: Offline-First Local-Sync Architecture
// A storage adapter that prefers the network (/api/expenses) but transparently
// falls back to localStorage, so the app is 100% functional with zero backend
// configuration. Last-write-wins via a monotonic `rev` counter.
// =============================================================================

import type { AppState } from "./types";
import { defaultState } from "./seed";

const KEY = "fiscal.appstate.v1";
const API = "/api/expenses";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

/**
 * Backfill fields added in later versions so state persisted by an older build
 * never crashes the UI (forward-compatible migration on read).
 */
function normalize(s: AppState): AppState {
  return {
    ...s,
    alerts: Array.isArray(s.alerts) ? s.alerts : [],
    archives: Array.isArray(s.archives) ? s.archives : [],
    settings: {
      ...s.settings,
      notify: s.settings?.notify ?? { enabled: false, subscriptionLeadDays: 3 },
      // Default to ON, but anchor lastResetMonth to *now* so upgrading never
      // triggers a surprise wipe — it only fires at the next real month change.
      autoMonthlyReset: s.settings?.autoMonthlyReset ?? true,
      lastResetMonth: s.settings?.lastResetMonth ?? new Date().toISOString().slice(0, 7),
    },
  };
}

// --- localStorage layer -------------------------------------------------------

export function loadLocal(): AppState | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

export function saveLocal(state: AppState): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private-mode — degrade silently to in-memory state */
  }
}

// --- network layer (graceful, never throws to the UI) ------------------------

export async function loadRemote(): Promise<AppState | null> {
  if (!hasWindow()) return null;
  try {
    const res = await fetch(API, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as AppState;
    return data && Array.isArray(data.entries) ? data : null;
  } catch {
    return null; // offline — caller falls back to local
  }
}

export async function saveRemote(state: AppState): Promise<boolean> {
  if (!hasWindow()) return false;
  try {
    const res = await fetch(API, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- unified bootstrap + sync -------------------------------------------------

export interface SyncResult {
  state: AppState;
  source: "remote" | "local" | "seed";
}

/** Resolve initial state: newest of {remote, local}, else a seeded demo. */
export async function bootstrap(): Promise<SyncResult> {
  const [remote, local] = [await loadRemote(), loadLocal()];

  if (remote && local) {
    const winner = remote.rev >= local.rev ? remote : local;
    return { state: normalize(winner), source: winner === remote ? "remote" : "local" };
  }
  if (remote) return { state: normalize(remote), source: "remote" };
  if (local) return { state: normalize(local), source: "local" };
  return { state: defaultState(), source: "seed" };
}

/** Persist everywhere; local write is synchronous, remote is best-effort. */
export async function persist(state: AppState): Promise<void> {
  saveLocal(state);
  void saveRemote(state); // fire-and-forget; offline is fine
}
