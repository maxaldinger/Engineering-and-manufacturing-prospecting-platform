"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { BRAND } from "@/lib/brand";

const NAV = [
  { href: "/", label: "Signal Feed" },
  { href: "/sales-assist", label: "Sales Assist" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="md:hidden sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="font-semibold text-sm text-navy">{BRAND.name}</span>
        </Link>
        <details className="relative">
          <summary className="list-none cursor-pointer p-1.5 rounded-md hover:bg-surface-2">
            <Menu className="h-5 w-5 text-text-secondary" />
          </summary>
          <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-surface shadow-lg overflow-hidden">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block px-4 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-primary/15 text-primary-hover"
                      : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </details>
      </div>
    </header>
  );
}
