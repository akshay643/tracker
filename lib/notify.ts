// =============================================================================
// lib/notify.ts — Web/PWA notification plumbing (no backend required).
//
// Strategy: the app shows reminders via the service worker's
// `showNotification()` whenever it is open/foregrounded (this is what works
// reliably on iOS once the PWA is installed to the Home Screen). A `push`
// handler also lives in the service worker so a real push server can be wired
// in later via VAPID — see subscribeToPush() below.
// =============================================================================

import type { AppState } from "./types";
import { VAPID_PUBLIC_KEY } from "./push-config";
import { computeDue, type DueNotice, type Schedule } from "./due";

export type { DueNotice };

const FIRED_KEY = "fiscal.notify.fired.v1";
/** Set once this device is registered for server-sent (closed-app) push. */
const SERVER_KEY = "fiscal.notify.server.v1";

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

// --- Due-detection (delegates to the shared pure scheduler) ------------------

/** Reading the local dedupe ledger, what should notify right now? */
export function collectDue(state: AppState, now = new Date()): DueNotice[] {
  return computeDue(state, now, loadFired());
}

/** Mark an occurrence as fired so it won't notify again. */
export function markFired(key: string, now = new Date()): void {
  const fired = loadFired();
  fired[key] = now.toISOString();
  saveFired(fired);
}

export function serverPushActive(): boolean {
  try {
    return localStorage.getItem(SERVER_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Process due reminders for the app-open case and return them (for the in-app
 * toast). When this device is registered for server push, the cron delivers the
 * OS notification, so we only mark-fired + toast here to avoid duplicates.
 */
export async function flushDue(state: AppState, now = new Date()): Promise<DueNotice[]> {
  if ((state.settings?.notify?.enabled ?? false) === false) return [];
  if (permission() !== "granted") return [];
  const due = collectDue(state, now);
  const useServer = serverPushActive();
  const handled: DueNotice[] = [];
  for (const n of due) {
    if (!useServer) {
      const ok = await showNotification(n.title, n.body, n.key);
      if (!ok) continue;
    }
    markFired(n.key, now); // local ledger dedupes the toast
    handled.push(n);
  }
  return handled;
}

// --- Real push via VAPID + server cron ---------------------------------------

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Slice of state the server needs to evaluate the schedule. */
function toSchedule(state: AppState): Schedule {
  return {
    subscriptions: state.subscriptions,
    alerts: state.alerts ?? [],
    habits: state.habits ?? [],
    settings: { notify: state.settings.notify },
  };
}

/**
 * Register this device + its reminder schedule with the server so the cron can
 * deliver reminders while the app is fully closed. Safe to call repeatedly
 * (the server upserts by subscription). Sets a flag used to avoid double-firing.
 */
export async function registerForServerPush(state: AppState): Promise<boolean> {
  const sub = await subscribeToPush();
  if (!sub) return false;
  try {
    const res = await fetch("/api/push/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subscription: sub,
        schedule: toSchedule(state),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    const ok = res.ok && (await res.json().catch(() => ({})))?.stored === true;
    try {
      localStorage.setItem(SERVER_KEY, ok ? "1" : "0");
    } catch {
      /* ignore */
    }
    return ok;
  } catch {
    return false;
  }
}

/**
 * Subscribe this device to Web Push (reusing an existing subscription if one
 * exists). Returns the PushSubscription — the server uses it to deliver pushes
 * via APNs even when the app is closed.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const reg = swReg ?? (await registerServiceWorker());
  if (!reg || permission() !== "granted") return null;
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch {
    return null;
  }
}

/**
 * Ask the server to send a real push to this device. With `delaySeconds`, the
 * server holds the request then sends — so it arrives after you've closed the
 * app or locked the phone. Returns true if the server accepted the request.
 */
export async function sendServerPush(opts: {
  title: string;
  body: string;
  tag?: string;
  delaySeconds?: number;
}): Promise<boolean> {
  const sub = await subscribeToPush();
  if (!sub) return false;
  try {
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: sub, ...opts }),
      keepalive: true, // let the request survive the page being backgrounded
    });
    return res.ok;
  } catch {
    return false;
  }
}
