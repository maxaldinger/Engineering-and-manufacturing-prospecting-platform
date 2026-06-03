"use client";

import { cn } from "@/lib/utils";
import { Briefcase, Newspaper, Landmark, BookMarked } from "lucide-react";

interface SignalTypeFilterProps {
  counts: Record<string, number>;
  selected: Set<string>;
  onToggle: (type: string) => void;
}

const TYPES = [
  { name: "Job Posting", icon: Briefcase, color: "signal-job" },
  { name: "News", icon: Newspaper, color: "signal-news" },
  { name: "Gov Contract", icon: Landmark, color: "signal-gov" },
  { name: "Tech Adoption", icon: BookMarked, color: "signal-tech" },
];

export function SignalTypeFilter({ counts, selected, onToggle }: SignalTypeFilterProps) {
  return (
    <div className="glass-panel p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-3">
        Signal Type
      </h3>
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const on = selected.has(t.name);
          const count = counts[t.name] ?? 0;
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => onToggle(t.name)}
              className={cn(
                "chip-base",
                on
                  ? `bg-${t.color}/15 text-${t.color} border-${t.color}/40`
                  : "bg-surface-2 text-text-secondary border-border hover:border-border-strong hover:text-text-primary"
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{t.name}</span>
              <span
                className={cn(
                  "px-1.5 rounded text-[10px] font-semibold",
                  on ? "bg-current/20 text-current" : "bg-surface text-text-muted"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
