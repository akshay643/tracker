"use client";
// =============================================================================
// NotificationRuntime — mounted once, always running while the app is open.
// Registers the service worker and, on an interval (plus whenever the app
// regains focus), fires any due subscription/alert/habit reminders. Anything
// that fires also pops an animated in-app toast.
// =============================================================================

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import {
  registerServiceWorker,
  flushDue,
  notificationsSupported,
  permission,
  registerForServerPush,
} from "@/lib/notify";
import { Toast } from "./ui";

export function NotificationRuntime() {
  const { state, ready } = useStore();
  const [toast, setToast] = useState<{ icon: string; text: string } | null>(null);

  useEffect(() => {
    if (notificationsSupported()) void registerServiceWorker();
  }, []);

  // Keep the server's copy of the schedule fresh (for closed-app push). Debounced
  // so rapid edits collapse into one registration.
  useEffect(() => {
    if (!ready || permission() !== "granted") return;
    const t = window.setTimeout(() => void registerForServerPush(state), 1500);
    return () => window.clearTimeout(t);
  }, [ready, state.habits, state.alerts, state.subscriptions, state.settings.notify]);

  useEffect(() => {
    if (!ready) return;
    if (!notificationsSupported() || permission() !== "granted") return;

    let timer: number | undefined;
    const check = async () => {
      const sent = await flushDue(state);
      if (sent.length) {
        const last = sent[sent.length - 1];
        // Title is "<emoji> <name>" — peel the emoji for the toast icon.
        const [icon, ...rest] = last.title.split(" ");
        setToast({ icon, text: `${rest.join(" ")} — ${last.body}` });
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setToast(null), 6000);
      }
    };
    void check();
    // Poll often enough to honor the shortest interval habit (down to 5s),
    // but never tighter than needed.
    const shortest = (state.habits ?? [])
      .filter((h) => h.enabled && h.scheduleMode === "interval")
      .reduce((min, h) => Math.min(min, h.everySeconds), 60);
    const pollMs = Math.min(60_000, Math.max(5_000, shortest * 1000));
    const id = window.setInterval(check, pollMs);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [state, ready]);

  return (
    <Toast show={!!toast} icon={toast?.icon} onClose={() => setToast(null)}>
      {toast?.text}
    </Toast>
  );
}
