"use client";

import { cn } from "@/lib/utils";
import type { ProductTypeId } from "@/types/product";

interface ProductTypeOption {
  id: ProductTypeId;
  label: string;
  count: number;
}

interface ProductTypeFilterProps {
  options: ProductTypeOption[];
  selected: Set<ProductTypeId>;
  onToggle: (id: ProductTypeId) => void;
  onSelectAll: () => void;
  onClear: () => void;
  // Unclassified (productTypes: []) is its own bucket, toggled independently of
  // the product-type chips, so narrowing the chips never hides it.
  unclassifiedCount: number;
  showUnclassified: boolean;
  onToggleUnclassified: () => void;
}

export function ProductTypeFilter({
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  unclassifiedCount,
  showUnclassified,
  onToggleUnclassified,
}: ProductTypeFilterProps) {
  const allOn = options.every((o) => selected.has(o.id));

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          Product Type
        </h3>
        <button
          onClick={allOn ? onClear : onSelectAll}
          className="text-primary hover:text-primary-hover transition-colors font-medium text-xs"
        >
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onToggle(opt.id)}
              className={cn(
                "chip-base",
                on
                  ? "bg-primary/15 text-primary-hover border-primary/40 hover:bg-primary/25"
                  : "bg-surface-2 text-text-secondary border-border hover:border-border-strong hover:text-text-primary"
              )}
            >
              <span>{opt.label}</span>
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

        {/* Unclassified — independent bucket. Dashed + amber to read as
            "no product type detected", and it stays toggleable regardless of
            which product-type chips are selected. */}
        <button
          type="button"
          onClick={onToggleUnclassified}
          title="Signals with no detected product type. Toggled independently of the chips above."
          className={cn(
            "chip-base border-dashed",
            showUnclassified
              ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
              : "bg-surface-2 text-text-muted border-border hover:border-border-strong hover:text-text-primary"
          )}
        >
          <span>Unclassified</span>
          <span
            className={cn(
              "px-1.5 rounded text-[10px] font-semibold",
              showUnclassified ? "bg-amber-200/60 text-amber-900" : "bg-surface text-text-muted"
            )}
          >
            {unclassifiedCount}
          </span>
        </button>
      </div>
    </div>
  );
}
