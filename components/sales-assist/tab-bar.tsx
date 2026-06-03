"use client";

import { cn } from "@/lib/utils";
import type { Tab } from "@/lib/sales-context";

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  size?: "default" | "sm";
}

interface TabConfig {
  name: Tab;
  dot: string;
  active: string;
}

const TABS: TabConfig[] = [
  {
    name: "Ask Anything",
    dot: "bg-slate-400",
    active: "bg-slate-100 text-slate-900 border-slate-400 ring-1 ring-slate-300",
  },
  {
    name: "Email",
    dot: "bg-blue-500",
    active: "bg-blue-50 text-blue-900 border-blue-400 ring-1 ring-blue-300",
  },
  {
    name: "LOU",
    dot: "bg-emerald-500",
    active: "bg-emerald-50 text-emerald-900 border-emerald-400 ring-1 ring-emerald-300",
  },
  {
    name: "Product Fit",
    dot: "bg-primary",
    active: "bg-primary-subtle text-primary border-primary ring-1 ring-primary/40",
  },
  {
    name: "Objections",
    dot: "bg-amber-500",
    active: "bg-amber-50 text-amber-900 border-amber-400 ring-1 ring-amber-300",
  },
  {
    name: "Threading",
    dot: "bg-pink-500",
    active: "bg-pink-50 text-pink-900 border-pink-400 ring-1 ring-pink-300",
  },
  {
    name: "Proposal",
    dot: "bg-cyan-500",
    active: "bg-cyan-50 text-cyan-900 border-cyan-400 ring-1 ring-cyan-300",
  },
  {
    name: "Deck",
    dot: "bg-orange-500",
    active: "bg-orange-50 text-orange-900 border-orange-400 ring-1 ring-orange-300",
  },
  {
    name: "MEDDPICC",
    dot: "bg-emerald-600",
    active: "bg-emerald-50 text-emerald-900 border-emerald-500 ring-1 ring-emerald-400",
  },
];

export function TabBar({ active, onChange, size = "default" }: TabBarProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Sales Assist workflows">
      {TABS.map((t) => {
        const on = active === t.name;
        return (
          <button
            key={t.name}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.name)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border transition-all font-medium",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
              on
                ? t.active
                : "bg-transparent border-border text-text-secondary hover:bg-surface-2 hover:border-border-strong hover:text-text-primary"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
            <span>{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}
