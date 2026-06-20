// =============================================================================
// app/api/push/register/route.ts — store a device's push subscription + its
// reminder schedule + timezone so the cron can deliver reminders while the app
// is closed. Upserts by subscription endpoint; preserves the dedupe ledger.
// =============================================================================

import { NextResponse } from "next/server";
import {
  endpointId,
  getRegistration,
  kvConfigured,
  saveRegistration,
} from "@/lib/push-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ stored: false, error: "bad-json" }, { status: 400 });
  }
  const { subscription, schedule, tz, fired } = body ?? {};
  if (!subscription?.endpoint) {
    return NextResponse.json({ stored: false, error: "missing-subscription" }, { status: 400 });
  }
  if (!kvConfigured()) {
    // No store available — the app still works with app-open reminders.
    return NextResponse.json({ stored: false, reason: "kv-not-configured" });
  }

  const id = endpointId(subscription.endpoint);
  const existing = await getRegistration(id);

  // Union the client's and server's fired ledgers so neither side repeats an
  // occurrence the other already delivered. Cap to keep it bounded.
  const mergedFired: Record<string, string> = {
    ...(existing?.fired ?? {}),
    ...(fired && typeof fired === "object" ? fired : {}),
  };
  const entries = Object.entries(mergedFired);
  const cappedFired = entries.length > 300 ? Object.fromEntries(entries.slice(-300)) : mergedFired;

  await saveRegistration({
    id,
    subscription,
    schedule: schedule ?? existing?.schedule,
    tz: typeof tz === "string" ? tz : existing?.tz ?? "UTC",
    fired: cappedFired,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ stored: true, id, fired: cappedFired });
}
