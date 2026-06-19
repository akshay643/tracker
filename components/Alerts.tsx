"use client";
// =============================================================================
// Alerts — notification control center.
// • Turn on push/in-app reminders (asks OS permission, registers the SW).
// • Subscription-renewal reminders with a configurable lead time.
// • Fully custom reminders (one-off or daily/weekly/monthly) the user defines.
// • A "Send test" button and an iOS "Add to Home Screen" hint.
// =============================================================================

import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import type { Alert, AlertRecurrence } from "@/lib/types";
import {
  notificationsSupported,
  permission as getPermission,
  requestPermission,
  registerServiceWorker,
  showNotification,
  subscribeToPush,
  sendServerPush,
  isIOS,
  isStandalonePWA,
} from "@/lib/notify";
import { Card } from "./ui";

const RECURRENCES: AlertRecurrence[] = ["none", "daily", "weekly", "monthly"];
const recurrenceLabel: Record<AlertRecurrence, string> = {
  none: "One time",
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
};

export function Alerts() {
  const { state, patchSettings, upsertAlert, deleteAlert } = useStore();
  const notify = state.settings.notify ?? { enabled: false, subscriptionLeadDays: 3 };

  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [supported, setSupported] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setSupported(notificationsSupported());
    setPerm(getPermission());
  }, []);

  const iosNeedsInstall = isIOS() && !isStandalonePWA();

  async function enable() {
    if (iosNeedsInstall) {
      setMsg("On iPhone/iPad: tap Share → “Add to Home Screen”, then open Fiscal from there to allow notifications.");
      return;
    }
    const p = await requestPermission();
    setPerm(p);
    if (p === "granted") {
      await registerServiceWorker();
      // Register for real (server-sent) push so reminders arrive when closed.
      const sub = await subscribeToPush();
      patchSettings({ notify: { ...notify, enabled: true } });
      setMsg(
        sub
          ? "Notifications are on. Reminders can now arrive even when the app is closed."
          : "Notifications on, but this device couldn't register for background push. They'll still show while the app is open."
      );
    } else {
      setMsg("Permission was not granted. You can enable it later in your browser settings.");
    }
  }

  async function test() {
    // Use the server path so this proves real (closed-app capable) delivery.
    const ok = await sendServerPush({
      title: "✅ Fiscal test",
      body: "Push is working on this device.",
      tag: "test",
    });
    if (ok) {
      setMsg("Sent a real push from the server. (If it doesn't show, check Settings → Notifications → Fiscal.)");
    } else {
      // Fall back to a local notification (only visible while app is open).
      const local = await showNotification("✅ Fiscal test", "Local test (app must stay open).", "test");
      setMsg(local ? "Sent a local test notification." : "Couldn't send — enable notifications first.");
    }
  }

  // --- countdown test timer ---
  const [seconds, setSeconds] = useState(10);
  const [remaining, setRemaining] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }
  useEffect(() => clearTimer, []); // cleanup on unmount

  async function startTimer() {
    // Make sure we're allowed to notify before counting down.
    if (getPermission() !== "granted") {
      if (iosNeedsInstall) {
        setMsg("On iPhone/iPad: install to the Home Screen first, then open Fiscal from there.");
        return;
      }
      const p = await requestPermission();
      setPerm(p);
      if (p !== "granted") {
        setMsg("Allow notifications first, then start the timer.");
        return;
      }
      await registerServiceWorker();
    }
    // Server can hold the request at most ~55s before its function times out.
    const total = Math.min(55, Math.max(1, Math.floor(seconds) || 1));

    // Fire the request to the server NOW. It waits `total` seconds, then pushes
    // — so it arrives even after you close the app or lock the phone.
    const accepted = await sendServerPush({
      title: "⏱️ Timer reminder",
      body: `This fired ${total} second${total === 1 ? "" : "s"} after you started the timer.`,
      tag: "timer-test",
      delaySeconds: total,
    });

    const startedAt = Date.now();
    setRemaining(total);
    setMsg(
      accepted
        ? `Push scheduled on the server — you can close the app or lock the phone now. Arrives in ${total}s.`
        : `Couldn't reach the push server; this will fire locally only (keep the app open).`
    );
    clearTimer();
    timerRef.current = window.setInterval(async () => {
      const left = total - Math.floor((Date.now() - startedAt) / 1000);
      if (left <= 0) {
        clearTimer();
        setRemaining(null);
        // Local fallback only if the server didn't accept the push.
        if (!accepted) {
          await showNotification(
            "⏱️ Timer reminder",
            `This fired ${total} second${total === 1 ? "" : "s"} after you started the timer.`,
            "timer-test"
          );
        }
        setMsg(accepted ? "⏱️ Timer push should have arrived." : "⏱️ Timer notification fired locally.");
      } else {
        setRemaining(left);
      }
    }, 250);
  }

  function cancelTimer() {
    clearTimer();
    setRemaining(null);
    setMsg("Timer cancelled.");
  }

  // --- custom alert draft ---
  const [draft, setDraft] = useState<Alert | null>(null);
  function blankAlert(): Alert {
    return {
      id: uid("alert"),
      label: "",
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",
      recurrence: "monthly",
      enabled: true,
      createdAt: new Date().toISOString(),
    };
  }
  function saveAlert() {
    if (!draft || !draft.label.trim()) return;
    upsertAlert(draft);
    setDraft(null);
  }

  const on = notify.enabled && perm === "granted";

  return (
    <Card title="Reminders & notifications" icon="🔔">
      {/* Status / enable */}
      <div className="rounded-xl border border-edge bg-panel2/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-medium">Status: </span>
            {!supported ? (
              <span className="text-warn">Not supported on this browser</span>
            ) : on ? (
              <span className="text-good">On</span>
            ) : perm === "denied" ? (
              <span className="text-bad">Blocked in browser settings</span>
            ) : (
              <span className="text-muted">Off</span>
            )}
          </div>
          <div className="flex gap-2">
            {!on && supported && (
              <button className="btn btn-accent" onClick={enable}>
                Turn on
              </button>
            )}
            {on && (
              <>
                <button className="btn" onClick={test}>
                  Send test
                </button>
                <button
                  className="btn hover:border-bad hover:text-bad"
                  onClick={() => patchSettings({ notify: { ...notify, enabled: false } })}
                >
                  Turn off
                </button>
              </>
            )}
          </div>
        </div>

        {iosNeedsInstall && (
          <p className="mt-2 text-xs text-warn">
            📱 iPhone/iPad: notifications need the app installed. Tap <b>Share</b> → <b>Add to Home
            Screen</b>, then open Fiscal from the home screen.
          </p>
        )}
        {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
        <p className="mt-2 text-[11px] text-muted">
          Uses real server-sent Web Push, so the timer test and instant test arrive even when the
          app is closed or the phone is locked. Time-of-day reminders (renewals, custom alerts)
          still need a server cron to fire while closed — see notes.
        </p>
      </div>

      {/* Test timer — fire a notification after N seconds */}
      <div className="mt-3 rounded-xl border border-edge bg-panel2/30 p-3">
        <div className="text-sm font-medium">⏱️ Test with a timer</div>
        <div className="text-xs text-muted">
          Schedules a real push on the server, then sends it after the delay — start it, then{" "}
          <b>close the app or lock your phone</b> and it should still arrive. (Max 55s.)
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">After</span>
          <input
            inputMode="numeric"
            value={seconds}
            disabled={remaining !== null}
            onChange={(e) => setSeconds(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 0))}
            className="input w-20 text-center"
            aria-label="seconds"
          />
          <span className="text-sm text-muted">seconds</span>
          {remaining === null ? (
            <button className="btn btn-accent" onClick={startTimer}>
              Start timer
            </button>
          ) : (
            <>
              <span className="chip tabular-nums text-accent2 border-accent2/40">
                firing in {remaining}s…
              </span>
              <button className="btn hover:border-bad hover:text-bad" onClick={cancelTimer}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subscription reminders */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-panel2/30 p-3">
        <div>
          <div className="text-sm font-medium">Subscription renewals</div>
          <div className="text-xs text-muted">Remind me before a subscription renews.</div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Lead</span>
          <input
            inputMode="numeric"
            value={notify.subscriptionLeadDays}
            onChange={(e) =>
              patchSettings({
                notify: { ...notify, subscriptionLeadDays: Math.max(0, Number(e.target.value) || 0) },
              })
            }
            className="input w-16 text-center"
          />
          <span className="text-muted">days</span>
        </label>
      </div>

      {/* Custom alerts */}
      <div className="mt-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Custom reminders</h3>
        <button className="btn" onClick={() => setDraft(blankAlert())}>
          + New
        </button>
      </div>

      <ul className="mt-2 space-y-2">
        {(state.alerts ?? []).map((a) => (
          <li
            key={a.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              a.enabled ? "border-edge bg-panel2/50" : "border-edge/40 bg-panel2/20 opacity-60"
            }`}
          >
            <button
              onClick={() => upsertAlert({ ...a, enabled: !a.enabled })}
              className={`h-2.5 w-2.5 rounded-full ${a.enabled ? "bg-good" : "bg-edge"}`}
              aria-label="toggle alert"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{a.label}</div>
              <div className="text-xs text-muted">
                {recurrenceLabel[a.recurrence]} · {a.time}
                {a.recurrence === "none" ? ` · ${a.date}` : ""}
              </div>
            </div>
            <button className="btn px-2 py-1 text-xs" onClick={() => setDraft({ ...a })}>
              Edit
            </button>
            <button className="text-muted hover:text-bad" onClick={() => deleteAlert(a.id)} aria-label="delete">
              ✕
            </button>
          </li>
        ))}
        {(state.alerts ?? []).length === 0 && !draft && (
          <li className="rounded-xl border border-dashed border-edge px-3 py-4 text-center text-xs text-muted">
            No custom reminders yet. Add one — e.g. “Pay rent”, monthly.
          </li>
        )}
      </ul>

      {draft && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-ink/40 p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2">
              <span className="label">What to remind you</span>
              <input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                className="input mt-1 w-full"
                placeholder="e.g. Pay rent, Review budget"
                autoFocus
              />
            </label>
            <label>
              <span className="label">Repeat</span>
              <select
                value={draft.recurrence}
                onChange={(e) => setDraft({ ...draft, recurrence: e.target.value as AlertRecurrence })}
                className="input mt-1 w-full"
              >
                {RECURRENCES.map((r) => (
                  <option key={r} value={r}>
                    {recurrenceLabel[r]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Time</span>
              <input
                type="time"
                value={draft.time}
                onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                className="input mt-1 w-full"
              />
            </label>
            <label className="col-span-2">
              <span className="label">{draft.recurrence === "none" ? "Date" : "Starting from"}</span>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="input mt-1 w-full"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="btn btn-accent" onClick={saveAlert}>
              Save reminder
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
