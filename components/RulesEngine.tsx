"use client";
// =============================================================================
// Feature 10: Smart Automation Rules Engine (IFTTT).
// Build "IF <field> <op> <value> THEN <actions>" rules that auto-apply to new
// entries (see lib/store.tsx → addEntry → runRules).
// =============================================================================

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import { describeRule } from "@/lib/rules";
import type { AutomationRule, RuleField, RuleOperator } from "@/lib/types";
import { Card } from "./ui";

export function RulesEngine() {
  const { state, upsertRule, deleteRule } = useStore();
  const [field, setField] = useState<RuleField>("categoryId");
  const [operator, setOperator] = useState<RuleOperator>("eq");
  const [value, setValue] = useState("");
  const [action, setAction] = useState<"tax" | "reimburse" | "tag">("tax");
  const [tagVal, setTagVal] = useState("tax-deductible");

  function create() {
    if (!value.trim()) return;
    const actions: AutomationRule["actions"] =
      action === "tax"
        ? [{ type: "setTaxDeductible", value: true }, { type: "addTag", value: "tax-deductible" }]
        : action === "reimburse"
        ? [{ type: "setReimbursable", value: true }, { type: "addTag", value: "reimbursable" }]
        : [{ type: "addTag", value: tagVal || "tagged" }];

    upsertRule({
      id: uid("rule"),
      name: `Auto rule ${state.rules.length + 1}`,
      enabled: true,
      condition: { field, operator, value },
      actions,
      createdAt: new Date().toISOString(),
    });
    setValue("");
  }

  return (
    <Card title="Automation Rules" icon="🤖">
      <div className="space-y-2">
        {state.rules.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-xl border border-edge bg-panel2/50 px-3 py-2 text-sm"
          >
            <button
              onClick={() => upsertRule({ ...r, enabled: !r.enabled })}
              className={`h-5 w-9 rounded-full transition ${r.enabled ? "bg-good" : "bg-edge"}`}
              aria-label="toggle"
            >
              <span
                className={`block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${
                  r.enabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="flex-1 font-mono text-xs">{describeRule(r)}</span>
            <button className="text-muted hover:text-bad" onClick={() => deleteRule(r.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-edge bg-ink/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase text-muted">If…</div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={field} onChange={(e) => setField(e.target.value as RuleField)} className="input">
            <option value="categoryId">category</option>
            <option value="note">note</option>
            <option value="amount">amount</option>
            <option value="method">method</option>
          </select>
          <select value={operator} onChange={(e) => setOperator(e.target.value as RuleOperator)} className="input">
            <option value="eq">is</option>
            <option value="contains">contains</option>
            <option value="gt">{">"}</option>
            <option value="lt">{"<"}</option>
          </select>
          {field === "categoryId" ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} className="input flex-1">
              <option value="">choose…</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" className="input flex-1" />
          )}
        </div>
        <div className="mb-2 mt-3 text-xs font-semibold uppercase text-muted">Then…</div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={action} onChange={(e) => setAction(e.target.value as any)} className="input">
            <option value="tax">mark tax-deductible</option>
            <option value="reimburse">mark reimbursable</option>
            <option value="tag">add tag</option>
          </select>
          {action === "tag" && (
            <input value={tagVal} onChange={(e) => setTagVal(e.target.value)} className="input flex-1" placeholder="tag name" />
          )}
          <button className="btn btn-accent ml-auto" onClick={create}>
            + Add rule
          </button>
        </div>
      </div>
    </Card>
  );
}
