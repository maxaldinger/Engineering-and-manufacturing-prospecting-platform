"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { BRAND } from "@/lib/brand";

const NAV = [
  { href: "/", label: "Signal Feed", icon: Radio },
  { href: "/sales-assist", label: "Sales Assist", icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-border bg-surface h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 group">
          <BrandMark className="h-9 w-9 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-navy group-hover:text-primary transition-colors">
              {BRAND.name}
            </span>
            <span className="text-[10px] text-text-muted uppercase tracking-wider">
              {BRAND.tagline}
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all",
                active
                  ? "bg-primary/15 text-primary-hover border border-primary/25"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-2 border border-transparent"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{item.label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
