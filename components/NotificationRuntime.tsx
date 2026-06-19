"use client";
// =============================================================================
// NotificationRuntime — mounted once, always running while the app is open.
// Registers the service worker and, on an interval (plus whenever the app
// regains focus), fires any due subscription/alert reminders. This is the path
// that works on an installed iOS PWA without a push backend.
// =============================================================================

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { registerServiceWorker, flushDue, notificationsSupported, permission } from "@/lib/notify";

export function NotificationRuntime() {
  const { state, ready } = useStore();

  // Register the SW once the app is interactive.
  useEffect(() => {
    if (notificationsSupported()) void registerServiceWorker();
  }, []);

  // Poll for due reminders. Re-runs when state changes so new alerts are picked
  // up immediately; the dedupe ledger prevents repeat fires.
  useEffect(() => {
    if (!ready) return;
    if (!notificationsSupported() || permission() !== "granted") return;

    const check = () => void flushDue(state);
    check(); // run now
    const id = window.setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [state, ready]);

  return null;
}
