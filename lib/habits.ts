// =============================================================================
// lib/habits.ts — wellness/life "modules" the user can toggle on. Each enabled
// habit can fire motivational reminders at a chosen interval and (for some)
// shows a live tracker card.
//
// Quit-smoking content is based on widely-published cessation timelines (CDC /
// NHS "what happens when you quit" milestones) and craving guidance (urges
// typically pass within 3–5 minutes). It's general motivation, not medical
// advice.
// =============================================================================

import type { Habit, HabitType } from "./types";

export interface HabitMeta {
  type: HabitType;
  title: string;
  icon: string;
  blurb: string;
  defaultIntervalMinutes: number;
  /** Accent color (hex) for the card. */
  color: string;
  /** Rotating motivational lines shown in reminders. */
  motivations: string[];
  /** Whether this habit shows the rich "since" timer + savings (quit-smoking). */
  tracker: "quit" | "streak" | "checkin";
}

export const HABIT_CATALOG: HabitMeta[] = [
  {
    type: "quit-smoking",
    title: "Quit smoking",
    icon: "🚭",
    blurb: "Track smoke-free time, money saved & health milestones, with hourly motivation.",
    defaultIntervalMinutes: 60,
    color: "#22c55e",
    tracker: "quit",
    motivations: [
      "Cravings peak and pass in 3–5 minutes. Drink water, breathe, and ride the wave. 🌊",
      "Every cigarette you skip is a win your lungs feel immediately.",
      "20 minutes smoke-free already lowers your heart rate. Keep going.",
      "You're not giving something up — you're getting your health back.",
      "Crave hits? Step outside, walk, and call it out loud: ‘this passes’.",
      "Money you didn't burn today is money toward something you love.",
      "Future-you is cheering right now. Don't break the streak.",
      "Urges are like waves — they rise, crest, and fall. You can outlast this one.",
      "Your sense of taste and smell are already recovering. 👃",
      "One craving at a time. You've beaten every one so far.",
    ],
  },
  {
    type: "hydrate",
    title: "Drink water",
    icon: "💧",
    blurb: "Gentle reminders to stay hydrated through the day.",
    defaultIntervalMinutes: 120,
    color: "#22d3ee",
    tracker: "checkin",
    motivations: [
      "Time for a glass of water. 💧",
      "Hydrate — your brain and focus will thank you.",
      "A little water now beats an afternoon slump later.",
      "Sip break! Even mild dehydration dents your mood and energy.",
    ],
  },
  {
    type: "daily-log",
    title: "Daily expense check-in",
    icon: "📝",
    blurb: "A nudge to log today's spends so your tracker stays accurate.",
    defaultIntervalMinutes: 1440,
    color: "#6366f1",
    tracker: "checkin",
    motivations: [
      "Quick check-in: log today's spends while they're fresh. 📝",
      "30 seconds now keeps your numbers honest. Add today's expenses.",
      "What did you spend today? Capture it before it slips.",
    ],
  },
  {
    type: "no-spend",
    title: "No-spend day",
    icon: "🛡️",
    blurb: "Build a streak of days with no non-essential spending.",
    defaultIntervalMinutes: 1440,
    color: "#f59e0b",
    tracker: "streak",
    motivations: [
      "Make today a no-spend day. Small wins compound. 🛡️",
      "Pause before any non-essential buy today — protect the streak.",
      "A no-spend day is a quiet flex. You've got this.",
    ],
  },
];

export function habitMeta(type: HabitType): HabitMeta {
  return HABIT_CATALOG.find((h) => h.type === type) ?? HABIT_CATALOG[0];
}

export function defaultHabit(type: HabitType, now = new Date()): Habit {
  const meta = habitMeta(type);
  const base: Habit = {
    type,
    enabled: true,
    intervalMinutes: meta.defaultIntervalMinutes,
    startedAt: now.toISOString(),
  };
  if (type === "quit-smoking") {
    return { ...base, cigarettesPerDay: 10, pricePerPack: 350, cigarettesPerPack: 20 };
  }
  return base;
}

// --- Quit-smoking computations -----------------------------------------------

export interface QuitMilestone {
  atHours: number;
  label: string;
}

/** Health recovery timeline (hours since last cigarette). */
export const QUIT_MILESTONES: QuitMilestone[] = [
  { atHours: 0, label: "You started. The hardest step is behind you." },
  { atHours: 0.33, label: "20 min: heart rate & blood pressure drop." },
  { atHours: 12, label: "12 hrs: blood carbon-monoxide returns to normal." },
  { atHours: 24, label: "1 day: heart-attack risk already begins to fall." },
  { atHours: 48, label: "2 days: nerve endings regrow — taste & smell sharpen." },
  { atHours: 72, label: "3 days: breathing eases as bronchial tubes relax." },
  { atHours: 336, label: "2 weeks: circulation & lung function improve." },
  { atHours: 2160, label: "3 months: lung function up to ~30% better." },
  { atHours: 6480, label: "9 months: coughing & shortness of breath decline." },
  { atHours: 8760, label: "1 year: heart-disease risk is about half a smoker's." },
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
  progressToNext: number; // 0..1
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

/** Whole-day streak count for streak/check-in habits. */
export function streakDays(habit: Habit, now = new Date()): number {
  const start = new Date(habit.startedAt).getTime();
  return Math.max(0, Math.floor((now.getTime() - start) / 86_400_000));
}

/** Pick the reminder text: custom message wins, else rotate through defaults. */
export function habitMessage(habit: Habit, now = new Date()): string {
  if (habit.customMessage && habit.customMessage.trim()) return habit.customMessage.trim();
  const meta = habitMeta(habit.type);
  const interval = Math.max(1, habit.intervalMinutes);
  const bucket = Math.floor(now.getTime() / 60000 / interval);
  return meta.motivations[bucket % meta.motivations.length];
}
