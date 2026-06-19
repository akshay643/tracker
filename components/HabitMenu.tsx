"use client";
// =============================================================================
// HabitMenu — the "menu of switches". Toggle wellness/life modules on; each one
// can fire motivational reminders at your chosen interval and (some) show a
// live tracker on Home. Expand a module to tune its interval & message.
// =============================================================================

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { HABIT_CATALOG, defaultHabit } from "@/lib/habits";
import type { HabitType } from "@/lib/types";
import { Card, Switch } from "./ui";
import { requestPermission, registerServiceWorker, subscribeToPush } from "@/lib/notify";

const INTERVAL_PRESETS = [
  { label: "30 min", v: 30 },
  { label: "Hourly", v: 60 },
  { label: "2 hrs", v: 120 },
  { label: "4 hrs", v: 240 },
  { label: "Daily", v: 1440 },
];

export function HabitMenu() {
  const { state, upsertHabit, patchSettings } = useStore();
  const notifyOn = state.settings.notify?.enabled;
  const get = (t: HabitType) => (state.habits ?? []).find((h) => h.type === t);
  const [open, setOpen] = useState<HabitType | null>(null);

  async function enableNotifications() {
    const p = await requestPermission();
    if (p === "granted") {
      await registerServiceWorker();
      await subscribeToPush();
    }
    patchSettings({
      notify: { ...(state.settings.notify ?? { subscriptionLeadDays: 3 }), enabled: p === "granted" },
    });
  }

  function toggle(t: HabitType, on: boolean) {
    const existing = get(t);
    if (on) {
      upsertHabit(existing ? { ...existing, enabled: true } : defaultHabit(t));
      setOpen(t);
    } else if (existing) {
      upsertHabit({ ...existing, enabled: false });
    }
  }

  return (
    <Card title="Habits & wellness" icon="🌱" info="Toggle life modules on. Each can send you motivational reminders at your chosen interval, and the ones with a tracker appear on your Home screen.">
      {!notifyOn && (
        <p className="mb-3 rounded-xl border border-warn/30 bg-warn/5 p-2 text-xs text-warn">
          Turn on notifications (Reminders tab) to actually receive these reminders.
        </p>
      )}
      <ul className="space-y-3">
        {HABIT_CATALOG.map((meta) => {
          const h = get(meta.type);
          const on = !!h?.enabled;
          const isOpen = open === meta.type;
          return (
            <li
              key={meta.type}
              className="rounded-xl border border-edge bg-panel2/40 p-3 transition"
              style={on ? { borderColor: meta.color + "66" } : undefined}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ background: meta.color + "22" }}
                >
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{meta.title}</div>
                  <div className="text-xs text-muted">{meta.blurb}</div>
                </div>
                <Switch checked={on} onChange={(v) => toggle(meta.type, v)} label={meta.title} />
              </div>

              {on && h && (
                <div className="mt-3">
                  <button
                    className="text-xs text-accent2"
                    onClick={() => setOpen(isOpen ? null : meta.type)}
                  >
                    {isOpen ? "Hide settings ▲" : "Settings ▾"}
                  </button>

                  {isOpen && (
                    <div className="mt-2 animate-rise space-y-3 border-t border-edge/60 pt-3">
                      {/* interval */}
                      <div>
                        <div className="label mb-1">Remind me</div>
                        <div className="flex flex-wrap gap-2">
                          {INTERVAL_PRESETS.map((p) => (
                            <button
                              key={p.v}
                              onClick={() => upsertHabit({ ...h, intervalMinutes: p.v })}
                              className={`rounded-full border px-3 py-1 text-xs transition ${
                                h.intervalMinutes === p.v
                                  ? "border-accent bg-accent text-white"
                                  : "border-edge text-muted hover:text-white"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* custom message */}
                      <label className="block">
                        <span className="label">Your motivation (optional)</span>
                        <input
                          value={h.customMessage ?? ""}
                          onChange={(e) => upsertHabit({ ...h, customMessage: e.target.value })}
                          placeholder="e.g. Remember why you started 💪"
                          className="input mt-1 w-full"
                        />
                      </label>

                      {/* quit-smoking economics */}
                      {meta.type === "quit-smoking" && (
                        <div className="grid grid-cols-3 gap-2">
                          <label>
                            <span className="label">Cigs/day</span>
                            <input
                              inputMode="numeric"
                              value={h.cigarettesPerDay ?? ""}
                              onChange={(e) => upsertHabit({ ...h, cigarettesPerDay: Number(e.target.value) || 0 })}
                              className="input mt-1 w-full"
                            />
                          </label>
                          <label>
                            <span className="label">Price/pack</span>
                            <input
                              inputMode="decimal"
                              value={h.pricePerPack ?? ""}
                              onChange={(e) => upsertHabit({ ...h, pricePerPack: Number(e.target.value) || 0 })}
                              className="input mt-1 w-full"
                            />
                          </label>
                          <label>
                            <span className="label">Cigs/pack</span>
                            <input
                              inputMode="numeric"
                              value={h.cigarettesPerPack ?? ""}
                              onChange={(e) => upsertHabit({ ...h, cigarettesPerPack: Number(e.target.value) || 0 })}
                              className="input mt-1 w-full"
                            />
                          </label>
                        </div>
                      )}

                      <button
                        className="btn w-full text-sm"
                        onClick={() => {
                          if (confirm("Restart this habit's timer/streak from now?"))
                            upsertHabit({ ...h, startedAt: new Date().toISOString() });
                        }}
                      >
                        ↻ Restart timer from now
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!notifyOn && (
        <button className="btn btn-accent mt-3 w-full" onClick={enableNotifications}>
          Enable notifications
        </button>
      )}
    </Card>
  );
}
