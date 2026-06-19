// =============================================================================
// lib/habits.ts — wellness/life "modules" the user can toggle on, plus
// fully-custom reminders the user creates. Each habit fires motivational
// reminders on a schedule (every N seconds/min/hr, or once a day at a time) and
// some show a live tracker on Home.
//
// Quit-smoking content is based on widely-published cessation timelines (CDC /
// NHS "what happens when you quit") and craving guidance (urges pass in ~3–5
// min). General motivation, not medical advice.
// =============================================================================

import type { Habit, HabitType, ScheduleMode } from "./types";
import { uid } from "./seed";

export interface HabitMeta {
  type: HabitType;
  title: string;
  icon: string;
  blurb: string;
  defaultEverySeconds: number;
  defaultMode: ScheduleMode;
  defaultAtTime?: string;
  color: string;
  motivations: string[];
  /** Rich quit tracker, day-streak, or simple check-in. */
  tracker: "quit" | "streak" | "checkin";
}

export const HABIT_CATALOG: HabitMeta[] = [
  {
    type: "quit-smoking",
    title: "Quit smoking",
    icon: "🚭",
    blurb: "Smoke-free timer, money saved & health milestones, with motivation.",
    defaultEverySeconds: 3600,
    defaultMode: "interval",
    color: "#22c55e",
    tracker: "quit",
    motivations: [
      "Cravings peak and pass in 3–5 minutes. Drink water, breathe, ride the wave. 🌊",
      "Every cigarette you skip is a win your lungs feel immediately.",
      "20 minutes smoke-free already lowers your heart rate. Keep going.",
      "You're not giving something up — you're getting your health back.",
      "Crave hits? Step outside, walk, say out loud: ‘this passes’.",
      "Money you didn't burn today is money toward something you love.",
      "Future-you is cheering right now. Don't break the streak.",
      "Urges are waves — they rise, crest, and fall. Outlast this one.",
      "Your taste and smell are already recovering. 👃",
      "One craving at a time. You've beaten every one so far.",
    ],
  },
  {
    type: "hydrate",
    title: "Drink water",
    icon: "💧",
    blurb: "Gentle reminders to stay hydrated through the day.",
    defaultEverySeconds: 7200,
    defaultMode: "interval",
    color: "#22d3ee",
    tracker: "checkin",
    motivations: [
      "Time for a glass of water. 💧",
      "Hydrate — your focus will thank you.",
      "A little water now beats an afternoon slump later.",
      "Sip break! Even mild dehydration dents mood and energy.",
    ],
  },
  {
    type: "move",
    title: "Move & stretch",
    icon: "🧘",
    blurb: "Stand up, stretch, and unstick yourself from the chair.",
    defaultEverySeconds: 3600,
    defaultMode: "interval",
    color: "#a855f7",
    tracker: "checkin",
    motivations: [
      "Stand up and stretch for 30 seconds. 🧘",
      "Roll your shoulders, look away from the screen, breathe.",
      "A 2-minute walk resets your posture and your mind.",
      "Your back will thank you — quick stretch time.",
    ],
  },
  {
    type: "daily-log",
    title: "Daily expense check-in",
    icon: "📝",
    blurb: "A nudge to log today's spends so your tracker stays accurate.",
    defaultEverySeconds: 86400,
    defaultMode: "daily",
    defaultAtTime: "21:00",
    color: "#6366f1",
    tracker: "checkin",
    motivations: [
      "Quick check-in: log today's spends while they're fresh. 📝",
      "30 seconds now keeps your numbers honest.",
      "What did you spend today? Capture it before it slips.",
    ],
  },
  {
    type: "no-spend",
    title: "No-spend day",
    icon: "🛡️",
    blurb: "Build a streak of days with no non-essential spending.",
    defaultEverySeconds: 86400,
    defaultMode: "daily",
    defaultAtTime: "10:00",
    color: "#f59e0b",
    tracker: "streak",
    motivations: [
      "Make today a no-spend day. Small wins compound. 🛡️",
      "Pause before any non-essential buy today — protect the streak.",
      "A no-spend day is a quiet flex. You've got this.",
    ],
  },
  {
    type: "wind-down",
    title: "Wind down for sleep",
    icon: "🌙",
    blurb: "An evening cue to put screens away and rest well.",
    defaultEverySeconds: 86400,
    defaultMode: "daily",
    defaultAtTime: "22:30",
    color: "#818cf8",
    tracker: "checkin",
    motivations: [
      "Time to wind down. Dim the lights and put the phone away. 🌙",
      "Better sleep starts now — screens off, slow breaths.",
      "Tomorrow-you wants you to rest. Start winding down.",
    ],
  },
];

/** Catalog entries shown as toggles (everything except the custom builder). */
export const BUILTIN_HABITS = HABIT_CATALOG;

export function habitMeta(type: HabitType): HabitMeta | undefined {
  return HABIT_CATALOG.find((h) => h.type === type);
}

/** Presentation for any habit, including user-created custom ones. */
export function habitDisplay(h: Habit): {
  title: string;
  icon: string;
  color: string;
  tracker: "quit" | "streak" | "checkin";
  motivations: string[];
} {
  const meta = habitMeta(h.type);
  if (meta && h.type !== "custom") {
    return { title: meta.title, icon: meta.icon, color: meta.color, tracker: meta.tracker, motivations: meta.motivations };
  }
  return {
    title: h.title || "Reminder",
    icon: h.icon || "⏰",
    color: "#22d3ee",
    tracker: "checkin",
    motivations: [h.customMessage || "Here's your reminder. ⏰"],
  };
}

export function defaultHabit(type: HabitType, now = new Date()): Habit {
  const meta = habitMeta(type);
  const base: Habit = {
    id: type === "custom" ? uid("habit") : type,
    type,
    enabled: true,
    scheduleMode: meta?.defaultMode ?? "interval",
    everySeconds: meta?.defaultEverySeconds ?? 3600,
    atTime: meta?.defaultAtTime ?? "09:00",
    startedAt: now.toISOString(),
  };
  if (type === "quit-smoking") {
    return { ...base, cigarettesPerDay: 10, pricePerPack: 350, cigarettesPerPack: 20 };
  }
  return base;
}

export function newCustomHabit(now = new Date()): Habit {
  return {
    id: uid("habit"),
    type: "custom",
    enabled: true,
    title: "",
    icon: "⏰",
    scheduleMode: "interval",
    everySeconds: 3600,
    atTime: "09:00",
    startedAt: now.toISOString(),
  };
}

// --- Quit-smoking computations -----------------------------------------------

export interface QuitMilestone {
  atHours: number;
  label: string;
}

export const QUIT_MILESTONES: QuitMilestone[] = [
  { atHours: 0, label: "You started. The hardest step is behind you." },
  { atHours: 0.33, label: "20 min: heart rate & blood pressure drop." },
  { atHours: 12, label: "12 hrs: blood carbon-monoxide returns to normal." },
  { atHours: 24, label: "1 day: heart-attack risk begins to fall." },
  { atHours: 48, label: "2 days: nerve endings regrow — taste & smell sharpen." },
  { atHours: 72, label: "3 days: breathing eases as bronchial tubes relax." },
  { atHours: 336, label: "2 weeks: circulation & lung function improve." },
  { atHours: 2160, label: "3 months: lung function up to ~30% better." },
  { atHours: 6480, label: "9 months: coughing & breathlessness decline." },
  { atHours: 8760, label: "1 year: heart-disease risk about half a smoker's." },
];

export interface QuitStats {
  ms: number;
  days: number;
  hours: number;
  minutes: number;
  cigarettesAvoided: number;
  moneySaved: number;
  current: QuitMilestone;
  next?: QuitMilestone;
  progressToNext: number;
}

export function quitStats(habit: Habit, now = new Date()): QuitStats {
  const start = new Date(habit.startedAt).getTime();
  const ms = Math.max(0, now.getTime() - start);
  const hoursElapsed = ms / 3_600_000;
  const days = Math.floor(hoursElapsed / 24);
  const hours = Math.floor(hoursElapsed % 24);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  const perDay = habit.cigarettesPerDay ?? 10;
  const perPack = habit.cigarettesPerPack ?? 20;
  const pricePack = habit.pricePerPack ?? 0;
  const cigarettesAvoided = Math.floor((hoursElapsed / 24) * perDay);
  const moneySaved = (cigarettesAvoided / perPack) * pricePack;

  let current = QUIT_MILESTONES[0];
  let next: QuitMilestone | undefined;
  for (let i = 0; i < QUIT_MILESTONES.length; i++) {
    if (hoursElapsed >= QUIT_MILESTONES[i].atHours) {
      current = QUIT_MILESTONES[i];
      next = QUIT_MILESTONES[i + 1];
    } else break;
  }
  const span = next ? next.atHours - current.atHours : 1;
  const progressToNext = next ? Math.min(1, (hoursElapsed - current.atHours) / span) : 1;

  return { ms, days, hours, minutes, cigarettesAvoided, moneySaved, current, next, progressToNext };
}

export function streakDays(habit: Habit, now = new Date()): number {
  const start = new Date(habit.startedAt).getTime();
  return Math.max(0, Math.floor((now.getTime() - start) / 86_400_000));
}

/** Reminder text: custom message wins, else rotate the built-in motivations. */
export function habitMessage(habit: Habit, now = new Date()): string {
  if (habit.customMessage && habit.customMessage.trim()) return habit.customMessage.trim();
  const opts = habitDisplay(habit).motivations;
  const step = habit.scheduleMode === "interval" ? Math.max(10, habit.everySeconds) : 86400;
  const bucket = Math.floor(now.getTime() / 1000 / step);
  return opts[bucket % opts.length];
}

/** Human label for a habit's schedule, e.g. "every 90 sec" or "daily at 21:00". */
export function scheduleLabel(habit: Habit): string {
  if (habit.scheduleMode === "daily") return `daily at ${habit.atTime}`;
  return `every ${formatEvery(habit.everySeconds)}`;
}

export function formatEvery(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) {
    const m = seconds / 60;
    return `${Number.isInteger(m) ? m : m.toFixed(1)} min`;
  }
  const h = seconds / 3600;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
}
