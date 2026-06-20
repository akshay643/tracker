// =============================================================================
// lib/push-store.ts — SERVER ONLY. Persists push registrations in Vercel KV so
// the cron can deliver reminders while the app is closed. Degrades gracefully
// when KV isn't configured (returns empty / false), so the app still builds and
// the client-side (app-open) reminders keep working.
// =============================================================================

import "server-only";
import type { Schedule } from "./due";

export interface PushRegistration {
  /** Stable id derived from the subscription endpoint. */
  id: string;
  subscription: any; // PushSubscriptionJSON
  schedule: Schedule;
  /** IANA timezone, e.g. "Asia/Kolkata". */
  tz: string;
  /** Dedupe ledger: occurrence key -> ISO timestamp. */
  fired: Record<string, string>;
  updatedAt: string;
}

const INDEX = "fiscal:push:index"; // set of registration ids

export function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kv() {
  // Imported lazily so a missing dependency/config never breaks the build.
  const mod = await import("@vercel/kv");
  return mod.kv;
}

/** Short, filesystem-safe id from the subscription endpoint. */
export function endpointId(endpoint: string): string {
  let h = 0;
  for (let i = 0; i < endpoint.length; i++) h = (h * 31 + endpoint.charCodeAt(i)) | 0;
  return `reg_${(h >>> 0).toString(36)}`;
}

export async function saveRegistration(reg: PushRegistration): Promise<boolean> {
  if (!kvConfigured()) return false;
  const client = await kv();
  await client.set(`fiscal:push:${reg.id}`, reg);
  await client.sadd(INDEX, reg.id);
  return true;
}

export async function getRegistration(id: string): Promise<PushRegistration | null> {
  if (!kvConfigured()) return null;
  const client = await kv();
  return (await client.get<PushRegistration>(`fiscal:push:${id}`)) ?? null;
}

export async function listRegistrations(): Promise<PushRegistration[]> {
  if (!kvConfigured()) return [];
  const client = await kv();
  const ids = await client.smembers(INDEX);
  if (!ids?.length) return [];
  const regs = await Promise.all(ids.map((id) => client.get<PushRegistration>(`fiscal:push:${id}`)));
  return regs.filter((r): r is PushRegistration => !!r);
}

export async function removeRegistration(id: string): Promise<void> {
  if (!kvConfigured()) return;
  const client = await kv();
  await client.del(`fiscal:push:${id}`);
  await client.srem(INDEX, id);
}

/** Merge newly-fired keys, capping the ledger so it can't grow unbounded. */
export async function markRegistrationFired(
  reg: PushRegistration,
  keys: string[],
  nowIso: string
): Promise<void> {
  if (!kvConfigured() || keys.length === 0) return;
  const fired = { ...reg.fired };
  for (const k of keys) fired[k] = nowIso;
  const entries = Object.entries(fired);
  const capped = entries.length > 300 ? Object.fromEntries(entries.slice(-300)) : fired;
  const client = await kv();
  await client.set(`fiscal:push:${reg.id}`, { ...reg, fired: capped, updatedAt: nowIso });
}
