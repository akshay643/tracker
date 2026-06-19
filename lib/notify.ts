// =============================================================================
// lib/notify.ts — Web/PWA notification plumbing (no backend required).
//
// Strategy: the app shows reminders via the service worker's
// `showNotification()` whenever it is open/foregrounded (this is what works
// reliably on iOS once the PWA is installed to the Home Screen). A `push`
// handler also lives in the service worker so a real push server can be wired
// in later via VAPID — see subscribeToPush() below.
// =============================================================================

import type { Alert, AppState } from "./types";
import { daysUntil } from "./algorithms";

const FIRED_KEY = "fiscal.notify.fired.v1";

export function notificationsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window
  );
}

/** iOS only allows web notifications for a PWA launched from the Home Screen. */
export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari exposes navigator.standalone; others use the display-mode query.
  // @ts-expect-error legacy iOS property
  const iosStandalone = window.navigator.standalone === true;
  const mql = window.matchMedia?.("(display-mode: standalone)").matches;
  return Boolean(iosStandalone || mql);
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Mac; sniff touch points
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)
  );
}

export function permission(): NotificationPermission {
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

let swReg: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!notificationsSupported()) return null;
  try {
    swReg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return swReg;
  } catch {
    return null;
  }
}

export async function showNotification(title: string, body: string, tag?: string): Promise<boolean> {
  if (permission() !== "granted") return false;
  const reg = swReg ?? (await registerServiceWorker());
  const options: NotificationOptions = {
    body,
    tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // @ts-expect-error vibrate is valid on mobile but missing from the lib types
    vibrate: [80, 40, 80],
  };
  try {
    if (reg) {
      await reg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    return true;
  } catch {
    return false;
  }
}

// --- Dedupe ledger (so an alert fires at most once per occurrence) -----------

function loadFired(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function saveFired(map: Record<string, string>): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

// --- Due-detection ------------------------------------------------------------

export interface DueNotice {
  /** Stable key for the specific occurrence (prevents duplicate fires). */
  key: string;
  title: string;
  body: string;
}

/** yyyy-mm-dd for `now`, in local time (not UTC) so day boundaries feel right. */
function localDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

/** Has the wall-clock passed this alert's "HH:MM" today? */
function pastTimeToday(time: string, now: Date): boolean {
  const [h, m] = (time || "09:00").split(":").map((n) => parseInt(n, 10));
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= (h || 0) * 60 + (m || 0);
}

/** Should this custom alert fire for the current local day? */
function alertDueToday(a: Alert, now: Date): boolean {
  if (!a.enabled) return false;
  if (!pastTimeToday(a.time, now)) return false;
  const today = localDay(now);
  const anchor = new Date(a.date + "T00:00:00");
  switch (a.recurrence) {
    case "none":
      // One-shot: due once the anchor day arrives (and we haven't fired it).
      return today >= a.date;
    case "daily":
      return today >= a.date;
    case "weekly":
      return now.getDay() === anchor.getDay() && today >= a.date;
    case "monthly": {
      // Same day-of-month as the anchor (clamped to short months).
      const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const target = Math.min(anchor.getDate(), dim);
      return now.getDate() === target && today >= a.date;
    }
    default:
      return false;
  }
}

/**
 * Compute everything that should notify right now and hasn't already fired for
 * this occurrence. Pure aside from reading the dedupe ledger.
 */
export function collectDue(state: AppState, now = new Date()): DueNotice[] {
  const out: DueNotice[] = [];
  const fired = loadFired();
  const notify = state.settings?.notify ?? { enabled: true, subscriptionLeadDays: 3 };
  const day = localDay(now);

  // 1) Subscription renewals within the lead window (once per renewal date).
  const lead = notify.subscriptionLeadDays ?? 0;
  if (lead > 0) {
    for (const s of state.subscriptions) {
      if (!s.active) continue;
      const d = daysUntil(s.nextRenewal, now);
      if (d <= lead && d >= 0) {
        const key = `sub:${s.id}:${s.nextRenewal}`;
        if (!fired[key]) {
          const when = d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`;
          out.push({
            key,
            title: `🔔 ${s.name} renews ${when}`,
            body: `${s.currency} ${s.amount} · ${s.cadence}. Renews ${s.nextRenewal}.`,
          });
        }
      }
    }
  }

  // 2) Custom alerts.
  for (const a of state.alerts ?? []) {
    if (alertDueToday(a, now)) {
      // For recurring alerts the occurrence key includes the day; one-shots use
      // a fixed key so they never repeat.
      const key = a.recurrence === "none" ? `alert:${a.id}` : `alert:${a.id}:${day}`;
      if (!fired[key]) {
        out.push({ key, title: `⏰ ${a.label}`, body: "Reminder from Fiscal." });
      }
    }
  }

  return out;
}

/** Mark an occurrence as fired so it won't notify again. */
export function markFired(key: string, now = new Date()): void {
  const fired = loadFired();
  fired[key] = now.toISOString();
  saveFired(fired);
}

/** Fire all currently-due notices (no-op if permission isn't granted). */
export async function flushDue(state: AppState, now = new Date()): Promise<number> {
  if ((state.settings?.notify?.enabled ?? false) === false) return 0;
  if (permission() !== "granted") return 0;
  const due = collectDue(state, now);
  let sent = 0;
  for (const n of due) {
    const ok = await showNotification(n.title, n.body, n.key);
    if (ok) {
      markFired(n.key, now);
      sent++;
    }
  }
  return sent;
}

// --- Optional: real push via VAPID (needs a backend to send) -----------------

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Subscribe this device to Web Push. Returns the PushSubscription to POST to
 * your server (which then sends pushes via web-push + the VAPID private key).
 * Left unwired by default because the demo backend doesn't send pushes.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  const reg = swReg ?? (await registerServiceWorker());
  if (!reg || permission() !== "granted") return null;
  try {
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  } catch {
    return null;
  }
}
