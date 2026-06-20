# Closed-app push reminders — setup

Reminders (subscription renewals, custom alerts, and habits like quit-smoking)
can now be delivered by the **server** so they fire even when the PWA is fully
closed or the phone is locked. This needs two things on Vercel: a **KV store**
(to remember each device + its schedule) and a **Cron job** (to send on time).

The app still works without these — it just falls back to "app-open only"
reminders. The Reminders tab shows **"Background delivery: Active"** once it's
wired up.

## 1. Add a KV store (Upstash Redis via Vercel)

1. Vercel dashboard → your project → **Storage** → **Create** → **Upstash for
   Redis** (a.k.a. Vercel KV). Free tier is fine.
2. **Connect it to the project.** Vercel injects these env vars automatically:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
3. Redeploy (Vercel does this automatically after connecting).

That's all the store needs — the code reads those two vars and turns itself on.

## 2. The cron job

`vercel.json` already declares it:

```json
{ "crons": [{ "path": "/api/push/cron", "schedule": "* * * * *" }] }
```

- This runs every minute and delivers anything due.
- **Plan note:** sub-daily cron schedules require **Vercel Pro**. On the **Hobby**
  plan, crons run at most **once per day** — change the schedule to e.g.
  `"0 9 * * *"` (9am daily) or the deploy may be rejected. Hourly quit-smoking
  pings therefore need Pro.

## 3. (Recommended) Protect the cron endpoint

Set an env var **`CRON_SECRET`** to any random string. Vercel Cron automatically
sends it as `Authorization: Bearer <CRON_SECRET>`; the route rejects anything
else. If you don't set it, the endpoint is open (fine for a personal app).

## 4. (Optional) Your own VAPID keys

Keys are baked in so it works out of the box. To use your own, set:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g. `mailto:you@example.com`)

Generate a pair with: `node -e "console.log(require('web-push').generateVAPIDKeys())"`

## How it fits together

```
Phone (PWA) ──register──▶ /api/push/register ──▶ KV  { subscription, schedule, tz, fired }
Vercel Cron ──every min─▶ /api/push/cron ──reads KV──▶ computes what's due (in each device's tz,
                                                        honoring quiet hours) ──▶ Web Push ▶ APNs ▶ phone
```

- The phone re-registers its schedule automatically whenever you change habits,
  alerts, subscriptions, or notification settings.
- Dedupe is per-device in KV, so nothing fires twice.
- When background delivery is active, the app stops firing its own
  notifications (the server owns them) to avoid duplicates — it still shows the
  in-app toast while open.

## Verify

After deploying with KV connected:

1. Open the installed PWA → **Manage → Reminders → Turn on**. You should see
   **"Background delivery: Active 📡"**.
2. Create a custom habit set to **every 1 minute**, then **close the app**.
3. Within ~1–2 minutes a notification should arrive. (You can also trigger
   `/api/push/cron` manually in a browser to force a run.)
