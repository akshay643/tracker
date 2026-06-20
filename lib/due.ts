// =============================================================================
// lib/due.ts — pure reminder scheduling. No browser or server APIs, so it runs
// identically in the client (app-open notifications) and in the Vercel cron
// (closed-app push). Dedupe is delegated to the caller via the `fired` map.
// =============================================================================

import type { Alert, AppState } from "./types";
import { daysUntil } from "./algorithms";
import { habitDisplay, habitMessage } from "./habits";

export interface DueNotice {
  /** Stable key for the specific occurrence (prevents duplicate fires). */
  key: string;
  title: string;
  body: string;
}

/** Just the slices of state the scheduler needs (cron stores only these). */
export type Schedule = Pick<AppState, "subscriptions" | "alerts" | "habits"> & {
  settings: Pick<AppState["settings"], "notify">;
};

/** yyyy-mm-dd for `now`, in its own local frame so day boundaries feel right. */
export function localDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function toMins(t: string): number {
  const [h, m] = (t || "0:0").split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

/** Has the wall-clock passed this "HH:MM" today? */
function pastTimeToday(time: string, now: Date): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= toMins(time || "09:00");
}

/** Is `now` inside the nightly quiet window (handles windows past midnight)? */
export function inQuietHours(schedule: Schedule, now: Date): boolean {
  const n = schedule.settings?.notify;
  if (!n?.quietEnabled) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = toMins(n.quietStart);
  const end = toMins(n.quietEnd);
  if (start === end) return false;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

function alertDueToday(a: Alert, now: Date): boolean {
  if (!a.enabled) return false;
  if (!pastTimeToday(a.time, now)) return false;
  const today = localDay(now);
  const anchor = new Date(a.date + "T00:00:00");
  switch (a.recurrence) {
    case "none":
    case "daily":
      return today >= a.date;
    case "weekly":
      return now.getDay() === anchor.getDay() && today >= a.date;
    case "monthly": {
      const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return now.getDate() === Math.min(anchor.getDate(), dim) && today >= a.date;
    }
    default:
      return false;
  }
}

/**
 * Everything that should notify at `now` and isn't already in `fired`.
 * Pure: pass the dedupe ledger in, mark keys fired outside.
 */
export function computeDue(schedule: Schedule, now: Date, fired: Record<string, string>): DueNotice[] {
  const out: DueNotice[] = [];
  const notify = schedule.settings?.notify;
  const day = localDay(now);

  // 1) Subscription renewals within the lead window.
  const lead = notify?.subscriptionLeadDays ?? 0;
  if (lead > 0) {
    for (const s of schedule.subscriptions ?? []) {
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
  for (const a of schedule.alerts ?? []) {
    if (alertDueToday(a, now)) {
      const key = a.recurrence === "none" ? `alert:${a.id}` : `alert:${a.id}:${day}`;
      if (!fired[key]) out.push({ key, title: `⏰ ${a.label}`, body: "Reminder from Fiscal." });
    }
  }

  // 3) Habit reminders.
  const quiet = inQuietHours(schedule, now);
  for (const h of schedule.habits ?? []) {
    if (!h.enabled) continue;
    const disp = habitDisplay(h);
    let key: string;
    if (h.scheduleMode === "daily") {
      if (!pastTimeToday(h.atTime, now)) continue; // explicit time honored even at night
      key = `habit:${h.id}:daily:${day}`;
    } else {
      if (quiet) continue; // repeating reminders muted overnight
      const every = Math.max(10, h.everySeconds);
      key = `habit:${h.id}:${Math.floor(now.getTime() / 1000 / every)}`;
    }
    if (!fired[key]) out.push({ key, title: `${disp.icon} ${disp.title}`, body: habitMessage(h, now) });
  }

  return out;
}
