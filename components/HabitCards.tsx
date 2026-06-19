"use client";
// =============================================================================
// HabitCards — live trackers for enabled habits, shown on Home.
// • Quit smoking: ticking smoke-free timer, money saved, cigarettes avoided,
//   and the current/next health milestone with a progress bar.
// • Streak / check-in habits: day counter + "done today" / restart.
// =============================================================================

import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/currency";
import { habitMeta, quitStats, streakDays, habitMessage } from "@/lib/habits";
import type { Habit } from "@/lib/types";
import { Card } from "./ui";

/** Re-render every `ms` so timers tick. */
function useNow(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return new Date();
}

function QuitSmokingCard({ habit }: { habit: Habit }) {
  const { state, upsertHabit } = useStore();
  const now = useNow(1000);
  const s = quitStats(habit, now);
  const meta = habitMeta("quit-smoking");
  const base = state.settings.baseCurrency;

  return (
    <Card title="Quit smoking" icon="🚭" info="Time since your last cigarette, money saved, and the health your body is recovering. Restart any time from the Habits menu.">
      <div className="flex items-center gap-4">
        {/* breathing ring + days */}
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
          <span
            className="absolute inset-0 animate-breathe rounded-full"
            style={{ background: meta.color + "33" }}
          />
          <div className="relative text-center">
            <div className="text-2xl font-bold leading-none tabular-nums">{s.days}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">days</div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-mono text-lg tabular-nums">
            {s.days}d {String(s.hours).padStart(2, "0")}h {String(s.minutes).padStart(2, "0")}m
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
            <span>
              <b className="text-good">{formatMoney(s.moneySaved, base)}</b> saved
            </span>
            <span>
              <b className="text-white/90">{s.cigarettesAvoided.toLocaleString()}</b> not smoked
            </span>
          </div>
        </div>
      </div>

      {/* milestone */}
      <div className="mt-3 rounded-xl border border-edge bg-panel2/40 p-3">
        <div className="text-xs text-white/90">{s.current.label}</div>
        {s.next && (
          <>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/70">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.round(s.progressToNext * 100)}%`, background: meta.color }}
              />
            </div>
            <div className="mt-1 text-[11px] text-muted">Next: {s.next.label}</div>
          </>
        )}
      </div>

      <p className="mt-3 text-xs italic text-accent2">“{habitMessage(habit, now)}”</p>

      <button
        className="btn mt-3 w-full text-sm hover:border-bad hover:text-bad"
        onClick={() => {
          if (confirm("Had a slip? Restart your smoke-free timer from now."))
            upsertHabit({ ...habit, startedAt: new Date().toISOString() });
        }}
      >
        I slipped — restart timer
      </button>
    </Card>
  );
}

function SimpleHabitCard({ habit }: { habit: Habit }) {
  const { upsertHabit } = useStore();
  const now = useNow(30_000);
  const meta = habitMeta(habit.type);
  const streak = streakDays(habit, now);
  const isStreak = meta.tracker === "streak";

  return (
    <Card title={meta.title} icon={meta.icon} info={meta.blurb}>
      <div className="flex items-center gap-4">
        <div
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl"
          style={{ background: meta.color + "22" }}
        >
          <span className="text-xl font-bold leading-none tabular-nums">{streak}</span>
          <span className="text-[9px] uppercase tracking-wide text-muted">days</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/90">{habitMessage(habit, now)}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Reminder every {habit.intervalMinutes >= 1440 ? "day" : `${habit.intervalMinutes} min`}.
          </p>
        </div>
      </div>
      {isStreak && (
        <button
          className="btn mt-3 w-full text-sm hover:border-bad hover:text-bad"
          onClick={() => {
            if (confirm("Reset this streak to zero?"))
              upsertHabit({ ...habit, startedAt: new Date().toISOString() });
          }}
        >
          Reset streak
        </button>
      )}
    </Card>
  );
}

/** Renders all enabled habit trackers (used on Home). */
export function HabitCards() {
  const { state } = useStore();
  const enabled = (state.habits ?? []).filter((h) => h.enabled);
  if (enabled.length === 0) return null;
  return (
    <div className="space-y-5">
      {enabled.map((h) =>
        h.type === "quit-smoking" ? (
          <QuitSmokingCard key={h.type} habit={h} />
        ) : (
          <SimpleHabitCard key={h.type} habit={h} />
        )
      )}
    </div>
  );
}
