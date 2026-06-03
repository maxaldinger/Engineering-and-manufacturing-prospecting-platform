"use client";

import * as React from "react";
import type { ActiveCompanyContext } from "@/lib/sales-context";

interface ContextValue {
  active: ActiveCompanyContext | null;
  setActive: (c: ActiveCompanyContext | null) => void;
  clear: () => void;
}

const Ctx = React.createContext<ContextValue | undefined>(undefined);

const STORAGE_KEY = "pp-active-company";

export function CompanyContextProvider({ children }: { children: React.ReactNode }) {
  const [active, setActiveState] = React.useState<ActiveCompanyContext | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setActiveState(JSON.parse(raw));
    } catch (err) {
      console.warn(
        "active-company: could not restore the saved prospect from localStorage (corrupt or unavailable); starting with none.",
        err
      );
    }
  }, []);

  const setActive = React.useCallback((c: ActiveCompanyContext | null) => {
    setActiveState(c);
    try {
      if (c) localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn(
        "active-company: could not persist the active prospect to localStorage; it will not survive a reload.",
        err
      );
    }
  }, []);

  const clear = React.useCallback(() => setActive(null), [setActive]);

  return (
    <Ctx.Provider value={{ active, setActive, clear }}>{children}</Ctx.Provider>
  );
}

export function useCompanyContext() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useCompanyContext must be used inside CompanyContextProvider");
  return ctx;
}
