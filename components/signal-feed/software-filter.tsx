"use client";

import { cn } from "@/lib/utils";

interface SoftwareFilterProps {
  options: { name: string; count: number }[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

export function SoftwareFilter({
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: SoftwareFilterProps) {
  const allOn = options.every((o) => selected.has(o.name));

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          Detected Software
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={allOn ? onClear : onSelectAll}
            className="text-primary hover:text-primary-hover transition-colors font-medium"
          >
            {allOn ? "Clear all" : "Select all"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = selected.has(opt.name);
          return (
            <button
              key={opt.name}
              type="button"
              onClick={() => onToggle(opt.name)}
              className={cn(
                "chip-base",
                on
                  ? "bg-primary/15 text-primary-hover border-primary/40 hover:bg-primary/25"
                  : "bg-surface-2 text-text-secondary border-border hover:border-border-strong hover:text-text-primary"
              )}
            >
              <span>{opt.name}</span>
              <span
                className={cn(
                  "px-1.5 rounded text-[10px] font-semibold",
                  on ? "bg-primary/30 text-primary-hover" : "bg-surface text-text-muted"
                )}
              >
                {opt.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
