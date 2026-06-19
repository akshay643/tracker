# Fiscal — Expense & Financial Intelligence

A client-facing, offline-first expense intelligence app built on **Next.js (App Router) + TypeScript + Tailwind CSS**, architected to plug into **PostgreSQL** (Supabase / Neon) via a single API route while remaining 100% functional out of the box with a `localStorage` fallback.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

It runs immediately with seeded demo data — no database required.

## Architecture

```
app/
  layout.tsx            # wraps the tree in <StoreProvider>
  page.tsx              # dashboard orchestrator + Macro/Micro canvas (Feature 18)
  api/expenses/route.ts # GET/PUT endpoint — swap the in-memory store for Postgres
lib/
  types.ts        # all TypeScript interfaces (1:1 with future SQL tables)
  storage.ts      # offline-first adapter: remote → local → seed, last-write-wins (25)
  store.tsx       # React Context + useReducer single source of truth (25)
  seed.ts         # uid() + out-of-the-box demo dataset
  currency.ts     # multi-currency + simulated FX (3)
  hashtags.ts     # inline #tag extraction (5)
  rules.ts        # IFTTT automation evaluation (10)
  algorithms.ts   # debt minimizer (9), envelopes (11), trends (16), burn-rate (17),
                  # safe-to-spend (19), runway (20), subscription fatigue (23)
components/       # one focused component per feature
```

### Data flow
`UI → useStore() actions → reducer (bumps rev) → debounced persist() → localStorage + PUT /api/expenses`

On load, `bootstrap()` reads remote + local and keeps the newest by `rev` (last-write-wins).

### Going live with PostgreSQL
Open [`app/api/expenses/route.ts`](app/api/expenses/route.ts) and replace the `read()`/`write()` in-memory helpers with a Neon/Supabase client. The commented `sql` block shows the upsert with a `rev`-guarded last-write-wins clause. No client code changes needed.

## Feature → file map

| # | Feature | Location |
|---|---------|----------|
| 1 | Quick-Add HUD | `components/QuickAddHUD.tsx` |
| 2 | Income & Windfall logging | `components/IncomeWindfall.tsx` |
| 3 | Multi-currency | `lib/currency.ts` |
| 4 | Category CRUD | `components/CategoryManager.tsx` |
| 5 | Smart hashtagging | `lib/hashtags.ts` |
| 6 | Search & multi-filter table | `components/DataTable.tsx` |
| 7–9 | Ledgers, splitting, debt minimizer | `components/GroupModule.tsx`, `lib/algorithms.ts` |
| 10 | Automation rules engine | `components/RulesEngine.tsx`, `lib/rules.ts` |
| 11 | Envelope allocation | `components/EnvelopeSystem.tsx` |
| 12–13 | Client linker + auto-invoice | `components/ClientInvoice.tsx` |
| 14 | Subscription radar | `components/SubscriptionRadar.tsx` |
| 15 | Category breakdown chart | `components/CategoryChart.tsx` |
| 16 | Monthly trend | `components/TrendChart.tsx` |
| 17 | Burn-rate indicators | `components/BurnRate.tsx` |
| 18 | Macro/Micro canvas | `app/page.tsx` |
| 19–20 | Safe-to-spend + runway | `components/SafeToSpend.tsx` |
| 21 | Cooling-off vault | `components/ImpulseVault.tsx` |
| 22 | Guilt scatter plot | `components/GuiltScatter.tsx` |
| 23 | Subscription fatigue auditor | `components/SubscriptionFatigue.tsx` |
| 24 | Tax season packager | `components/TaxPackager.tsx` |
| 25 | Offline-first sync | `lib/storage.ts`, `lib/store.tsx` |

Charts are hand-rolled SVG (no chart dependency); the data shapes in `lib/algorithms.ts` map directly onto Recharts `<Pie>`/`<BarChart>` if you later add the library.
# tracker
# tracker
