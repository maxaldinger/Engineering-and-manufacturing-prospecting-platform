"use client";

import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

interface BrandMarkProps {
  className?: string;
}

// Neutral signal mark: concentric waves rising from a point, evoking territory
// signal intelligence. Vendor-agnostic. Drop a custom asset at /public/logo.svg
// and swap this component if you have brand artwork.
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-navy shadow-sm overflow-hidden",
        className
      )}
      aria-label={BRAND.name}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[64%] w-[64%]"
        aria-hidden="true"
      >
        <circle cx="16" cy="22" r="2.4" fill="#1e9bcb" />
        <path
          d="M10.5 19.5 Q16 14.5 21.5 19.5"
          stroke="#1e9bcb"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M7 16 Q16 7.5 25 16"
          stroke="#1e9bcb"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    </span>
  );
}
