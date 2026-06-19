"use client";
// =============================================================================
// Feature 4: Dynamic Category Management — full CRUD for color-coded categories,
// including monthly caps (burn-rate), envelope %, and tax bucket mapping.
// =============================================================================

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import type { Category } from "@/lib/types";
import { Card } from "./ui";

const PALETTE = ["#6366f1", "#22d3ee", "#22c55e", "#f59e0b", "#ec4899", "#ef4444", "#a855f7", "#14b8a6"];

export function CategoryManager() {
  const { state, upsertCategory, deleteCategory } = useStore();
  const [draft, setDraft] = useState<Category | null>(null);

  function blank(): Category {
    return { id: uid("cat"), name: "", color: PALETTE[state.categories.length % PALETTE.length], cap: undefined, envelopePct: undefined, taxBucket: "" };
  }

  function save() {
    if (!draft || !draft.name.trim()) return;
    upsertCategory(draft);
    setDraft(null);
  }

  return (
    <Card
      title="Categories"
      icon="🎨"
      right={
        <button className="btn" onClick={() => setDraft(blank())}>
          + New
        </button>
      }
    >
      <ul className="space-y-2">
        {state.categories.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-edge bg-panel2/50 px-3 py-2"
          >
            <span className="h-4 w-4 rounded-full" style={{ background: c.color }} />
            <span className="flex-1 font-medium">{c.name}</span>
            <span className="hidden gap-1 text-xs text-muted sm:flex">
              {c.cap ? <span className="chip">cap {c.cap}</span> : null}
              {c.envelopePct ? <span className="chip">{c.envelopePct}% env</span> : null}
              {c.taxBucket ? <span className="chip">{c.taxBucket}</span> : null}
            </span>
            <button className="btn px-2 py-1 text-xs" onClick={() => setDraft({ ...c })}>
              Edit
            </button>
            <button
              className="btn px-2 py-1 text-xs hover:border-bad hover:text-bad"
              onClick={() => deleteCategory(c.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {draft && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-ink/40 p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2">
              <span className="label">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="input mt-1 w-full"
                placeholder="e.g. Subscriptions"
              />
            </label>
            <label>
              <span className="label">Monthly cap</span>
              <input
                inputMode="decimal"
                value={draft.cap ?? ""}
                onChange={(e) => setDraft({ ...draft, cap: e.target.value ? Number(e.target.value) : undefined })}
                className="input mt-1 w-full"
              />
            </label>
            <label>
              <span className="label">Envelope %</span>
              <input
                inputMode="decimal"
                value={draft.envelopePct ?? ""}
                onChange={(e) => setDraft({ ...draft, envelopePct: e.target.value ? Number(e.target.value) : undefined })}
                className="input mt-1 w-full"
              />
            </label>
            <label className="col-span-2">
              <span className="label">Tax bucket</span>
              <input
                value={draft.taxBucket ?? ""}
                onChange={(e) => setDraft({ ...draft, taxBucket: e.target.value })}
                className="input mt-1 w-full"
                placeholder="e.g. Business Tools"
              />
            </label>
            <div className="col-span-2">
              <span className="label">Color</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {PALETTE.map((p) => (
                  <button
                    key={p}
                    onClick={() => setDraft({ ...draft, color: p })}
                    className={`h-7 w-7 rounded-full ring-2 transition ${
                      draft.color === p ? "ring-white" : "ring-transparent"
                    }`}
                    style={{ background: p }}
                    aria-label={`color ${p}`}
                  />
                ))}
                {/* Free choice — any custom color, not just the presets. */}
                <label
                  className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full ring-2 ring-edge"
                  style={{ background: draft.color }}
                  title="Custom color"
                >
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white mix-blend-difference">
                    +
                  </span>
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Pick a custom color"
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="btn btn-accent" onClick={save}>
              Save category
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
