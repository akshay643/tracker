// =============================================================================
// app/api/push/cron/route.ts — invoked by Vercel Cron (see vercel.json).
// For every registered device it evaluates the stored schedule in that device's
// timezone and sends any due reminders via Web Push (APNs) — so reminders fire
// even when the app is closed. Dedupe ledger lives per-registration in KV.
//
// Auth: if CRON_SECRET is set, requires `Authorization: Bearer <CRON_SECRET>`
// (Vercel Cron sends this automatically). If unset, the endpoint is open.
// =============================================================================

import { NextResponse } from "next/server";
import webpush from "web-push";
import { VAPID_PUBLIC_KEY } from "@/lib/push-config";
import { computeDue } from "@/lib/due";
import {
  kvConfigured,
  listRegistrations,
  markRegistrationFired,
  removeRegistration,
} from "@/lib/push-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || "4B_UYfR5O3o26jE52mlg96FonuOZ0v2rKAQaXBh1WBY";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:alerts@fiscal.app";
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

/** A Date whose local fields (getHours/getDay/…) match `tz`'s wall clock. */
function inTimezone(now: Date, tz: string): Date {
  try {
    return new Date(now.toLocaleString("en-US", { timeZone: tz }));
  } catch {
    return now;
  }
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, reason: "kv-not-configured" });
  }

  const regs = await listRegistrations();
  const now = new Date();
  const nowIso = now.toISOString();
  let sent = 0;

  for (const reg of regs) {
    const localNow = inTimezone(now, reg.tz || "UTC");
    let due;
    try {
      due = computeDue(reg.schedule, localNow, reg.fired ?? {});
    } catch {
      continue; // skip a malformed registration rather than failing the run
    }
    const firedKeys: string[] = [];
    for (const n of due) {
      try {
        await webpush.sendNotification(
          reg.subscription,
          JSON.stringify({ title: n.title, body: n.body, tag: n.key })
        );
        firedKeys.push(n.key);
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await removeRegistration(reg.id); // subscription is dead
        }
      }
    }
    await markRegistrationFired(reg, firedKeys, nowIso);
  }

  return NextResponse.json({ ok: true, registrations: regs.length, sent });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
