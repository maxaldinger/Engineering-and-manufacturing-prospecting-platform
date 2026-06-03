"use client";

import { X, Building2 } from "lucide-react";
import { useCompanyContext } from "@/components/providers/company-context";

export function ActiveCompanyBanner() {
  const { active, clear } = useCompanyContext();
  if (!active) return null;

  const software = active.detectedSoftware.join(", ") || "unknown";

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-2.5 animate-fade-in">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-7 w-7 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-3.5 w-3.5 text-primary-hover" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-text-muted">Working on</p>
          <p className="text-sm font-medium text-text-primary truncate">
            {active.company}
            <span className="text-text-secondary font-normal">
              {" "}
              · {active.city}
              {active.state ? `, ${active.state}` : ""} · Detected: {software}
            </span>
          </p>
        </div>
      </div>
      <button
        onClick={clear}
        className="flex-shrink-0 p-1.5 rounded-md hover:bg-primary/20 text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Clear active company"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
