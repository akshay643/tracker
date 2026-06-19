// =============================================================================
// app/api/push/send/route.ts — sends a real Web Push via VAPID/APNs.
// The browser POSTs its PushSubscription plus a title/body (and optional delay).
// The server signs and delivers the push, which iOS shows even when the PWA is
// closed or the phone is locked.
//
// `delaySeconds` lets the timer test fire after you've closed the app: the
// server holds the request open, then sends. Capped to stay within the
// serverless function budget (see maxDuration below).
// =============================================================================

import { NextResponse } from "next/server";
import webpush from "web-push";
import { VAPID_PUBLIC_KEY } from "@/lib/push-config";

export const runtime = "nodejs";
// Allow the delayed test to wait server-side. Vercel Hobby caps at 60s.
export const maxDuration = 60;

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || "4B_UYfR5O3o26jE52mlg96FonuOZ0v2rKAQaXBh1WBY";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:alerts@fiscal.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  try {
    const { subscription, title, body, tag, delaySeconds } = await req.json();
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "missing-subscription" }, { status: 400 });
    }

    // Cap the held delay so we never blow past the function timeout.
    const delay = Math.min(55, Math.max(0, Number(delaySeconds) || 0));
    if (delay > 0) await sleep(delay * 1000);

    const payload = JSON.stringify({
      title: title || "Fiscal",
      body: body || "You have a reminder.",
      tag: tag || "fiscal",
    });

    await webpush.sendNotification(subscription, payload);
    return NextResponse.json({ ok: true, delayed: delay });
  } catch (err: any) {
    // 404/410 means the subscription is dead (uninstalled / unsubscribed).
    const status = err?.statusCode === 410 || err?.statusCode === 404 ? 410 : 500;
    return NextResponse.json({ error: "send-failed", detail: String(err?.message ?? err) }, { status });
  }
}
