// =============================================================================
// app/api/expenses/route.ts
// The PostgreSQL plug-in point. Right now it uses an in-memory store so the app
// runs with zero configuration. To go live, replace the `db` helpers with a
// Postgres client (Supabase / Neon / node-postgres). The client (lib/storage.ts)
// already speaks GET/PUT to this endpoint and degrades gracefully when offline.
// =============================================================================

import { NextResponse } from "next/server";
import type { AppState } from "@/lib/types";

// ---- Swap this block for a real database ------------------------------------
//
// import { sql } from "@/lib/db"; // e.g. Neon serverless driver
//
// async function read(): Promise<AppState | null> {
//   const rows = await sql`SELECT doc FROM app_state WHERE id = 'default'`;
//   return rows[0]?.doc ?? null;
// }
// async function write(state: AppState): Promise<void> {
//   await sql`
//     INSERT INTO app_state (id, doc, rev) VALUES ('default', ${state}, ${state.rev})
//     ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, rev = EXCLUDED.rev
//     WHERE app_state.rev <= EXCLUDED.rev`; // last-write-wins guard
// }
//
// -----------------------------------------------------------------------------

// In-memory fallback store (per server instance). Persists for the dev session.
let MEMORY: AppState | null = null;

async function read(): Promise<AppState | null> {
  return MEMORY;
}
async function write(state: AppState): Promise<void> {
  if (!MEMORY || state.rev >= MEMORY.rev) MEMORY = state; // last-write-wins
}

export async function GET() {
  const state = await read();
  if (!state) return NextResponse.json({ error: "no-state" }, { status: 404 });
  return NextResponse.json(state);
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as AppState;
    if (!body || !Array.isArray(body.entries)) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await write(body);
    return NextResponse.json({ ok: true, rev: body.rev });
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
}
