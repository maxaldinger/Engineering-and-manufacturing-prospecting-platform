"use client";

import * as React from "react";

export type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const Ctx = React.createContext<ThemeCtx | undefined>(undefined);

export const THEME_STORAGE_KEY = "pp-theme";

// The actual class flip happens before hydration via the inline script in the
// root layout (no flash). This provider just mirrors that state into React and
// persists the rep's choice, so the sidebar toggle has something to drive.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");

  React.useEffect(() => {
    setThemeState(
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  }, []);

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch (err) {
      console.warn("theme: could not persist the theme preference to localStorage.", err);
    }
  }, []);

  const toggle = React.useCallback(() => {
    setTheme(
      document.documentElement.classList.contains("dark") ? "light" : "dark"
    );
  }, [setTheme]);

  return <Ctx.Provider value={{ theme, toggle, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
