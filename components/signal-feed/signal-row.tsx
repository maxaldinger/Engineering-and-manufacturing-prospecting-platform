"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompanyContext } from "@/components/providers/company-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRODUCT_TYPE_BY_ID } from "@/lib/catalog";
import type { ProductTypeId } from "@/types/product";
import type { CompanyGroup, Urgency } from "@/lib/signal-grouping";

interface SignalRowProps {
  group: CompanyGroup;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

const URGENCY_DOT: Record<Urgency, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

const URGENCY_BADGE: Record<Urgency, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const MAX_TYPE_CHIPS = 3;

// Product-type chips for the row. A suite/multi-detect tool can put several
// types on a group, so visible chips are capped and the rest collapse into a
// +N overflow (hover lists them) rather than blowing out the row. Unclassified
// (no product type) renders an explicit chip, never a blank gap.
function ProductTypeChips({ ids }: { ids: ProductTypeId[] }) {
  if (ids.length === 0) {
    return (
      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-dashed border-amber-300 bg-amber-50 text-amber-700">
        Unclassified
      </span>
    );
  }
  const shown = ids.slice(0, MAX_TYPE_CHIPS);
  const overflow = ids.slice(MAX_TYPE_CHIPS);
  return (
    <>
      {shown.map((id) => (
        <span
          key={id}
          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-primary/30 bg-primary-subtle text-primary whitespace-nowrap"
        >
          {PRODUCT_TYPE_BY_ID[id]?.label ?? id}
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          title={overflow
            .map((id) => PRODUCT_TYPE_BY_ID[id]?.label ?? id)
            .join(", ")}
          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-surface-2 text-text-muted"
        >
          +{overflow.length}
        </span>
      )}
    </>
  );
}

export function SignalRow({ group, expanded, onToggle, children }: SignalRowProps) {
  const { setActive } = useCompanyContext();
  const router = useRouter();

  const sendToAssist = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActive({
      company: group.company,
      city: group.city,
      state: group.state,
      detectedSoftware: group.detectedSoftware,
    });
    router.push("/sales-assist");
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  const signalCount = group.signals.length;

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface shadow-sm overflow-hidden transition-all",
        expanded ? "border-primary/40" : "border-border hover:border-border-strong"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2/40 transition-colors"
      >
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full flex-shrink-0",
            URGENCY_DOT[group.urgency]
          )}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-text-primary text-sm md:text-base truncate">
              {group.company}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-text-muted whitespace-nowrap">
              {signalCount} signal{signalCount === 1 ? "" : "s"}
            </span>
            <ProductTypeChips ids={group.productTypes} />
            {group.productTypes.length === 0 && group.manufacturingRelevant && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700">
                Manufacturing
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-0.5 truncate">
            {group.oneLiner}
          </p>
        </div>

        <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-primary/30 bg-primary-subtle text-primary whitespace-nowrap flex-shrink-0">
          {group.industry}
        </span>

        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border flex-shrink-0",
            URGENCY_BADGE[group.urgency]
          )}
        >
          {group.urgency.toUpperCase()}
        </span>

        <span className="hidden sm:inline-block text-[10px] text-text-muted tabular-nums whitespace-nowrap flex-shrink-0">
          {group.maxStrength}/100
        </span>

        <Button
          size="sm"
          variant="secondary"
          onClick={sendToAssist}
          className="flex-shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sales Assist</span>
        </Button>

        <span
          onClick={handleToggle}
          className="flex-shrink-0 p-1 rounded hover:bg-surface-2 text-text-muted"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border bg-surface-2/20 px-5 py-5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}
