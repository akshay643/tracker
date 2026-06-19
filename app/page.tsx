"use client";
// =============================================================================
// app/page.tsx — Mobile-first dashboard shell.
// A compact top header, a swappable tab body, a fixed bottom navigation bar,
// and a floating Quick-Add button that opens the logging sheet from anywhere.
// Each tab groups related features so the app reads top-to-bottom on a phone.
// =============================================================================

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { CURRENCIES } from "@/lib/currency";
import type { CurrencyCode } from "@/lib/types";
import { BottomSheet } from "@/components/ui";

import { QuickAddHUD } from "@/components/QuickAddHUD";
import { IncomeWindfall } from "@/components/IncomeWindfall";
import { CategoryManager } from "@/components/CategoryManager";
import { DataTable } from "@/components/DataTable";
import { GroupModule } from "@/components/GroupModule";
import { RulesEngine } from "@/components/RulesEngine";
import { EnvelopeSystem } from "@/components/EnvelopeSystem";
import { ClientInvoice } from "@/components/ClientInvoice";
import { SubscriptionRadar } from "@/components/SubscriptionRadar";
import { CategoryChart } from "@/components/CategoryChart";
import { TrendChart } from "@/components/TrendChart";
import { BurnRate } from "@/components/BurnRate";
import { SafeToSpend } from "@/components/SafeToSpend";
import { ImpulseVault } from "@/components/ImpulseVault";
import { GuiltScatter } from "@/components/GuiltScatter";
import { SubscriptionFatigue } from "@/components/SubscriptionFatigue";
import { TaxPackager } from "@/components/TaxPackager";
import { DataTools } from "@/components/DataTools";
import { Alerts } from "@/components/Alerts";
import { NotificationRuntime } from "@/components/NotificationRuntime";

// --- Tab definitions ----------------------------------------------------------

type TabId = "home" | "insights" | "money" | "manage";

const TABS: { id: TabId; label: string; icon: string; blurb: string }[] = [
  { id: "home", label: "Home", icon: "🏠", blurb: "Where your money stands today" },
  { id: "insights", label: "Insights", icon: "📈", blurb: "Trends, habits & subscriptions" },
  { id: "money", label: "Budget", icon: "💰", blurb: "Envelopes, income, groups & clients" },
  { id: "manage", label: "Manage", icon: "🗂", blurb: "Transactions, rules & tools" },
];

function Header() {
  const { state, patchSettings, source, ready } = useStore();
  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-ink/85 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">
            Fiscal<span className="text-accent">.</span>
          </h1>
          <p className="truncate text-[11px] text-muted">
            <span className={ready ? "text-good" : "text-warn"}>
              {ready ? `synced · ${source}` : "loading…"}
            </span>
          </p>
        </div>
        <select
          value={state.settings.baseCurrency}
          onChange={(e) => patchSettings({ baseCurrency: e.target.value as CurrencyCode })}
          className="input py-1.5"
          title="Base currency"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}

function Skeleton() {
  return (
    <div className="grid animate-pulse gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-40 rounded-2xl border border-edge bg-panel/50" />
      ))}
    </div>
  );
}

/** Light heading shown at the top of each tab so the section reads clearly. */
function TabIntro({ tab }: { tab: TabId }) {
  const meta = TABS.find((t) => t.id === tab)!;
  return (
    <div className="mb-1">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span aria-hidden>{meta.icon}</span>
        {meta.label}
      </h2>
      <p className="text-xs text-muted">{meta.blurb}</p>
    </div>
  );
}

function TabBody({ tab }: { tab: TabId }) {
  switch (tab) {
    case "home":
      return (
        <div className="space-y-4">
          <SafeToSpend />
          <BurnRate />
          <CategoryChart />
        </div>
      );
    case "insights":
      return (
        <div className="space-y-4">
          <TrendChart />
          <div className="grid gap-4 lg:grid-cols-2">
            <SubscriptionRadar />
            <SubscriptionFatigue />
          </div>
          <GuiltScatter />
        </div>
      );
    case "money":
      return (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <EnvelopeSystem />
            <IncomeWindfall />
          </div>
          <GroupModule />
          <ClientInvoice />
        </div>
      );
    case "manage":
      return (
        <div className="space-y-4">
          <Alerts />
          <DataTable />
          <CategoryManager />
          <div className="grid gap-4 lg:grid-cols-2">
            <RulesEngine />
            <ImpulseVault />
          </div>
          <TaxPackager />
          <DataTools />
        </div>
      );
  }
}

function BottomNav({
  active,
  onChange,
  onAdd,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  onAdd: () => void;
}) {
  // Two nav buttons, the central Add action, then two more.
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  const item = (t: (typeof TABS)[number]) => (
    <button
      key={t.id}
      onClick={() => onChange(t.id)}
      className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition ${
        active === t.id ? "text-accent" : "text-muted hover:text-white"
      }`}
      aria-current={active === t.id}
    >
      <span className="text-lg leading-none" aria-hidden>
        {t.icon}
      </span>
      {t.label}
    </button>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
        {left.map(item)}
        <div className="flex w-16 items-center justify-center">
          <button
            onClick={onAdd}
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-hud ring-4 ring-ink transition hover:bg-indigo-500 active:scale-95"
            aria-label="Log an expense"
          >
            +
          </button>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}

export default function Page() {
  const { ready } = useStore();
  const [tab, setTab] = useState<TabId>("home");
  const [adding, setAdding] = useState(false);

  return (
    <div className="min-h-screen">
      <NotificationRuntime />
      <Header />

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-4">
        {!ready ? (
          <Skeleton />
        ) : (
          <div className="space-y-4">
            <TabIntro tab={tab} />
            <TabBody tab={tab} />
            <footer className="pt-2 text-center text-[11px] text-muted">
              Offline-first · saved on this device, synced to <code>/api/expenses</code> when online.
            </footer>
          </div>
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} onAdd={() => setAdding(true)} />

      <BottomSheet open={adding} onClose={() => setAdding(false)} title="Quick add">
        <p className="mb-3 text-xs text-muted">
          Log an expense in seconds. Pick amount, category and date; add <code>#tags</code> in the
          note to group across categories. Switch currency on the right — it converts to your base
          currency automatically.
        </p>
        <QuickAddHUD bare onLogged={() => setAdding(false)} />
      </BottomSheet>
    </div>
  );
}
