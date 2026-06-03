"use client";

import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BuilderHeaderProps {
  title: string;
  subtitle?: string;
}

export function BuilderHeader({ title, subtitle }: BuilderHeaderProps) {
  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-navy">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-text-secondary mt-1.5">{subtitle}</p>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, optional, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-semibold text-text-primary"
      >
        {label}
        {optional && (
          <span className="ml-1.5 text-xs font-normal text-text-muted">
            (optional)
          </span>
        )}
      </label>
      {hint && <p className="text-xs text-text-muted leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

interface GenerateButtonProps {
  label: string;
  streaming: boolean;
  onStop?: () => void;
  disabled?: boolean;
}

export function GenerateButton({
  label,
  streaming,
  onStop,
  disabled,
}: GenerateButtonProps) {
  if (streaming && onStop) {
    return (
      <Button type="button" variant="secondary" onClick={onStop}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Stop generating
      </Button>
    );
  }
  return (
    <Button type="submit" disabled={disabled || streaming}>
      <Sparkles className="h-4 w-4" />
      {label}
    </Button>
  );
}
