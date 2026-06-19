// =============================================================================
// lib/featureInfo.ts — plain-language explanations for every module, keyed by
// the Card title. The <Card> component looks these up automatically and shows
// an ⓘ button, so each feature documents itself with zero per-component wiring.
// =============================================================================

export const FEATURE_INFO: Record<string, string> = {
  "Safe-to-Spend & Runway":
    "Your real spendable money after expected bills and savings goals — not just your raw balance. Runway estimates how many months your reserves last at the current burn rate.",
  "Budget Burn-Rate":
    "How fast you're spending against each category's monthly cap. Bars turn yellow as you approach the limit and red once you exceed it, so overspending is visible early.",
  "Category Breakdown":
    "Where your money actually goes this period, split by category. Use it to spot the few categories that dominate your spending.",
  "Income vs. Spend Trend":
    "Month-by-month income compared with spending. A healthy gap means you're saving; a shrinking or negative gap is an early warning.",
  "Subscription Radar":
    "Every recurring charge (weekly/monthly/yearly) with a live countdown to the next renewal. Toggle the dot to pause a subscription. Turn on reminders to get notified before you're billed.",
  "Subscription Fatigue Auditor":
    "Flags subscriptions you may be overpaying for or no longer using, normalized to a monthly cost so yearly and weekly plans are comparable.",
  "Envelope Allocation":
    "The envelope method: assign a share of your income to each category up front, then spend from what's left in that envelope. Helps you plan before you spend.",
  "Income & Windfalls":
    "Log salary, one-off income, and windfalls (bonuses, refunds, gifts). These feed your safe-to-spend, runway and trend calculations.",
  "Allocate your windfall ✨":
    "Got an unexpected lump sum? Split it intentionally across saving, spending and goals instead of letting it disappear into everyday spending.",
  "Group Splitting & Debt Matrix":
    "Track shared expenses for a trip or household, split bills evenly/by percent/by exact amounts, and see the simplest set of payments that settles everyone up.",
  "Group Splitting":
    "Track shared expenses and split bills between members, then settle who owes whom with the fewest transfers.",
  "Clients & Invoicing":
    "Tag expenses to a client and auto-assemble reimbursable/billable items into an invoice-ready summary per client.",
  "Automation Rules":
    "If-this-then-that rules that run automatically when you log an expense — e.g. “if category is Software, mark tax-deductible and add #saas”. Saves repetitive tagging.",
  "Cooling-Off Vault":
    "Park a tempting purchase here for a set cooling-off period. When the timer ends you decide to buy or skip — a simple guard against impulse spending.",
  "Value-to-Cost (Guilt Map)":
    "Plots each purchase by what you paid against how satisfied it left you (1–5). Cheap-but-regretted and expensive-but-loved buys become obvious.",
  "Tax Season Packager":
    "Groups tax-deductible expenses into standard buckets and totals them, so export at tax time is a copy-paste instead of an archaeology dig.",
  "Categories":
    "Create and customize your own spending categories — name, color, monthly cap, envelope share, and tax bucket. Fully yours to organize however you think about money.",
  "Transactions":
    "Every entry in one searchable, filterable, sortable table. Filter by text, category, tag, payment method, or date range; tap ✕ to delete a row.",
  "Reminders & notifications":
    "Turn on device notifications, get reminded before subscriptions renew, and create your own custom reminders (one-off or daily/weekly/monthly). On iPhone, install to the Home Screen first.",
  "Data & backup":
    "Export every transaction to a month-by-month Excel workbook, or clear all data to start fresh (your categories are kept).",
};
