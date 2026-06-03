"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, X } from "lucide-react";

interface ToastMessage {
  id: number;
  text: string;
}

interface ToastContextValue {
  toast: (text: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 3000);
  }, []);

  const dismiss = (id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-3 shadow-lg animate-fade-in"
            )}
          >
            <CheckCircle2 className="h-4 w-4 text-signal-job mt-0.5 flex-shrink-0" />
            <p className="text-sm text-text-primary flex-1">{m.text}</p>
            <button
              onClick={() => dismiss(m.id)}
              className="text-text-muted hover:text-text-primary"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
