// =============================================================================
// lib/rules.ts — Feature 10: Smart Automation Rules Engine (IFTTT)
// Pure functions that evaluate a rule against an entry and apply its actions.
// =============================================================================

import type { AutomationRule, Entry } from "./types";

function matches(rule: AutomationRule, entry: Entry): boolean {
  const { field, operator, value } = rule.condition;
  const left =
    field === "amount" ? entry.amount : (entry[field] as string | undefined) ?? "";

  switch (operator) {
    case "eq":
      return String(left).toLowerCase() === value.toLowerCase();
    case "contains":
      return String(left).toLowerCase().includes(value.toLowerCase());
    case "gt":
      return Number(left) > Number(value);
    case "lt":
      return Number(left) < Number(value);
    default:
      return false;
  }
}

/** Apply a single rule's actions, returning a new entry (immutable). */
function applyActions(rule: AutomationRule, entry: Entry): Entry {
  let next: Entry = { ...entry, tags: [...entry.tags] };
  for (const action of rule.actions) {
    switch (action.type) {
      case "addTag":
        if (!next.tags.includes(action.value)) next.tags.push(action.value);
        break;
      case "setReimbursable":
        next.reimbursable = action.value;
        break;
      case "setTaxDeductible":
        next.taxDeductible = action.value;
        break;
      case "setCategory":
        next.categoryId = action.value;
        break;
    }
  }
  return next;
}

/** Run every enabled rule, in order, against a freshly-created entry. */
export function runRules(rules: AutomationRule[], entry: Entry): Entry {
  return rules
    .filter((r) => r.enabled)
    .reduce((acc, rule) => (matches(rule, acc) ? applyActions(rule, acc) : acc), entry);
}

export function describeRule(rule: AutomationRule): string {
  const op = { eq: "is", contains: "contains", gt: ">", lt: "<" }[rule.condition.operator];
  const acts = rule.actions
    .map((a) => {
      switch (a.type) {
        case "addTag":
          return `tag #${a.value}`;
        case "setReimbursable":
          return a.value ? "mark reimbursable" : "unmark reimbursable";
        case "setTaxDeductible":
          return a.value ? "mark tax-deductible" : "unmark tax-deductible";
        case "setCategory":
          return "recategorize";
      }
    })
    .join(" + ");
  return `IF ${rule.condition.field} ${op} "${rule.condition.value}" → ${acts}`;
}
