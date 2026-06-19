"use client";
// =============================================================================
// HabitMenu — the "menu of switches" plus custom reminders.
// • Quiet hours (no repeating pings at night).
// • Built-in wellness modules with a full schedule editor.
// • Create your own reminders (title, emoji, schedule, message) — a general
//   daily-task tool: "Take medicine 9am", "Stretch every 90 min", etc.
// =============================================================================

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { HABIT_CATALOG, defaultHabit, newCustomHabit, scheduleLabel } from "@/lib/habits";
import type { Habit, HabitType, ScheduleMode } from "@/lib/types";
import { Card, Switch } from "./ui";
import { requestPermission, registerServiceWorker, subscribeToPush } from "@/lib/notify";

const UNIT_SECONDS = { sec: 1, min: 60, hr: 3600 } as const;
type Unit = keyof typeof UNIT_SECONDS;

function deriveValueUnit(everySeconds: number): { value: number; unit: Unit } {
  if (everySeconds >= 3600 && everySeconds % 3600 === 0) return { value: everySeconds / 3600, unit: "hr" };
  if (everySeconds >= 60 && everySeconds % 60 === 0) return { value: everySeconds / 60, unit: "min" };
  return { value: everySeconds, unit: "sec" };
}

const QUICK = [
  { label: "10s", s: 10 },
  { label: "30s", s: 30 },
  { label: "1m", s: 60 },
  { label: "5m", s: 300 },
  { label: "30m", s: 1800 },
  { label: "1h", s: 3600 },
  { label: "2h", s: 7200 },
];

const EMOJIS = ["⏰", "💊", "🏃", "📞", "🧹", "📚", "🥗", "🧴", "🌿", "💪", "🧘", "💧", "🙏", "💸"];

/** Schedule editor shared by built-in & custom habits. */
function ScheduleEditor({ habit, onChange }: { habit: Habit; onChange: (h: Habit) => void }) {
  const { value, unit } = deriveValueUnit(habit.everySeconds);
  const setMode = (m: ScheduleMode) => onChange({ ...habit, scheduleMode: m });
  const setSeconds = (s: number) => onChange({ ...habit, everySeconds: Math.max(10, Math.round(s)) });

  return (
    <div>
      <div className="mb-2 flex overflow-hidden rounded-xl border border-edge">
        {(["interval", "daily"] as ScheduleMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition ${
              habit.scheduleMode === m ? "bg-accent text-white" : "text-muted hover:text-white"
            }`}
          >
            {m === "interval" ? "Every…" : "Once a day"}
          </button>
        ))}
      </div>

      {habit.scheduleMode === "interval" ? (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Every</span>
            <input
              inputMode="numeric"
              value={value}
              onChange={(e) => setSeconds((Number(e.target.value) || 0) * UNIT_SECONDS[unit])}
              className="input w-20 text-center"
            />
            <select
              value={unit}
              onChange={(e) => setSeconds(value * UNIT_SECONDS[e.target.value as Unit])}
              className="input"
            >
              <option value="sec">seconds</option>
              <option value="min">minutes</option>
              <option value="hr">hours</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q.s}
                onClick={() => setSeconds(q.s)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                  habit.everySeconds === q.s
                    ? "border-accent bg-accent text-white"
                    : "border-edge text-muted hover:text-white"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">At</span>
          <input
            type="time"
            value={habit.atTime}
            onChange={(e) => onChange({ ...habit, atTime: e.target.value })}
            className="input"
          />
          <span className="text-muted">every day</span>
        </label>
      )}
    </div>
  );
}

export function HabitMenu() {
  const { state, upsertHabit, deleteHabit, patchSettings } = useStore();
  const notify = state.settings.notify;
  const get = (t: HabitType) => (state.habits ?? []).find((h) => h.id === t);
  const customHabits = (state.habits ?? []).filter((h) => h.type === "custom");
  const [open, setOpen] = useState<string | null>(null);

  async function enableNotifications() {
    const p = await requestPermission();
    if (p === "granted") {
      await registerServiceWorker();
      await subscribeToPush();
    }
    patchSettings({ notify: { ...notify, enabled: p === "granted" } });
  }

  function toggleBuiltin(t: HabitType, on: boolean) {
    const existing = get(t);
    if (on) {
      upsertHabit(existing ? { ...existing, enabled: true } : defaultHabit(t));
      setOpen(t);
    } else if (existing) {
      upsertHabit({ ...existing, enabled: false });
    }
  }

  return (
    <Card
      title="Habits & wellness"
      icon="🌱"
      info="Toggle life modules on, or create your own reminders. Each can repeat every few seconds/minutes/hours or fire once a day at a set time. Quiet hours mute repeating reminders overnight."
    >
      {!notify?.enabled && (
        <div className="mb-3 rounded-xl border border-warn/30 bg-warn/5 p-2.5">
          <p className="text-xs text-warn">Notifications are off — turn them on to receive reminders.</p>
          <button className="btn btn-accent mt-2 w-full" onClick={enableNotifications}>
            Enable notifications
          </button>
        </div>
      )}

      {/* Quiet hours */}
      <div className="mb-4 rounded-xl border border-edge bg-panel2/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">🌙 Quiet hours</div>
            <div className="text-xs text-muted">Mute repeating reminders overnight.</div>
          </div>
          <Switch
            checked={!!notify?.quietEnabled}
            onChange={(v) => patchSettings({ notify: { ...notify, quietEnabled: v } })}
            label="Quiet hours"
          />
        </div>
        {notify?.quietEnabled && (
          <div className="mt-3 flex animate-rise items-center gap-2 text-sm">
            <span className="text-muted">From</span>
            <input
              type="time"
              value={notify.quietStart}
              onChange={(e) => patchSettings({ notify: { ...notify, quietStart: e.target.value } })}
              className="input"
            />
            <span className="text-muted">to</span>
            <input
              type="time"
              value={notify.quietEnd}
              onChange={(e) => patchSettings({ notify: { ...notify, quietEnd: e.target.value } })}
              className="input"
            />
          </div>
        )}
      </div>

      {/* Built-in modules */}
      <ul className="space-y-3">
        {HABIT_CATALOG.map((meta) => {
          const h = get(meta.type);
          const on = !!h?.enabled;
          const isOpen = open === meta.type;
          return (
            <li
              key={meta.type}
              className="rounded-xl border border-edge bg-panel2/40 p-3"
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
                  <div className="text-xs text-muted">{on && h ? scheduleLabel(h) : meta.blurb}</div>
                </div>
                <Switch checked={on} onChange={(v) => toggleBuiltin(meta.type, v)} label={meta.title} />
              </div>

              {on && h && (
                <div className="mt-3">
                  <button className="text-xs text-accent2" onClick={() => setOpen(isOpen ? null : meta.type)}>
                    {isOpen ? "Hide settings ▲" : "Settings ▾"}
                  </button>
                  {isOpen && (
                    <div className="mt-2 animate-rise space-y-3 border-t border-edge/60 pt-3">
                      <ScheduleEditor habit={h} onChange={upsertHabit} />
                      <label className="block">
                        <span className="label">Your motivation (optional)</span>
                        <input
                          value={h.customMessage ?? ""}
                          onChange={(e) => upsertHabit({ ...h, customMessage: e.target.value })}
                          placeholder="e.g. Remember why you started 💪"
                          className="input mt-1 w-full"
                        />
                      </label>
                      {meta.type === "quit-smoking" && (
                        <div className="grid grid-cols-3 gap-2">
                          <label>
                            <span className="label">Cigs/day</span>
                            <input inputMode="numeric" value={h.cigarettesPerDay ?? ""} onChange={(e) => upsertHabit({ ...h, cigarettesPerDay: Number(e.target.value) || 0 })} className="input mt-1 w-full" />
                          </label>
                          <label>
                            <span className="label">Price/pack</span>
                            <input inputMode="decimal" value={h.pricePerPack ?? ""} onChange={(e) => upsertHabit({ ...h, pricePerPack: Number(e.target.value) || 0 })} className="input mt-1 w-full" />
                          </label>
                          <label>
                            <span className="label">Cigs/pack</span>
                            <input inputMode="numeric" value={h.cigarettesPerPack ?? ""} onChange={(e) => upsertHabit({ ...h, cigarettesPerPack: Number(e.target.value) || 0 })} className="input mt-1 w-full" />
                          </label>
                        </div>
                      )}
                      <button
                        className="btn w-full text-sm"
                        onClick={() => confirm("Restart this habit's timer/streak from now?") && upsertHabit({ ...h, startedAt: new Date().toISOString() })}
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

      {/* Custom reminders */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your reminders</h3>
          <button className="btn" onClick={() => { const h = newCustomHabit(); upsertHabit(h); setOpen(h.id); }}>
            + Create
          </button>
        </div>
        {customHabits.length === 0 ? (
          <p className="text-xs text-muted">
            Create any reminder — “Take medicine 9am”, “Stretch every 90 min”, “Call home daily”.
          </p>
        ) : (
          <ul className="space-y-3">
            {customHabits.map((h) => {
              const isOpen = open === h.id;
              return (
                <li key={h.id} className="rounded-xl border border-edge bg-panel2/40 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent2/15 text-lg">
                      {h.icon || "⏰"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{h.title || "Untitled reminder"}</div>
                      <div className="text-xs text-muted">{scheduleLabel(h)}</div>
                    </div>
                    <Switch checked={h.enabled} onChange={(v) => upsertHabit({ ...h, enabled: v })} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button className="text-xs text-accent2" onClick={() => setOpen(isOpen ? null : h.id)}>
                      {isOpen ? "Hide ▲" : "Edit ▾"}
                    </button>
                    <button className="text-xs text-muted hover:text-bad" onClick={() => deleteHabit(h.id)}>
                      Delete
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-2 animate-rise space-y-3 border-t border-edge/60 pt-3">
                      <label className="block">
                        <span className="label">Name</span>
                        <input
                          value={h.title ?? ""}
                          onChange={(e) => upsertHabit({ ...h, title: e.target.value })}
                          placeholder="What should this remind you to do?"
                          className="input mt-1 w-full"
                          autoFocus
                        />
                      </label>
                      <div>
                        <span className="label">Icon</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {EMOJIS.map((e) => (
                            <button
                              key={e}
                              onClick={() => upsertHabit({ ...h, icon: e })}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-lg transition ${
                                h.icon === e ? "border-accent bg-accent/20" : "border-edge"
                              }`}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                      <ScheduleEditor habit={h} onChange={upsertHabit} />
                      <label className="block">
                        <span className="label">Message shown in the notification</span>
                        <input
                          value={h.customMessage ?? ""}
                          onChange={(e) => upsertHabit({ ...h, customMessage: e.target.value })}
                          placeholder="e.g. Time to take your medicine 💊"
                          className="input mt-1 w-full"
                        />
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
