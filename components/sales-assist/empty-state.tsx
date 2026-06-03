"use client";

import {
  Sparkles,
  Mail,
  Shield,
  MessageSquare,
  ClipboardList,
  Wrench,
} from "lucide-react";
import type { Tab } from "@/lib/sales-context";

interface EmptyStateProps {
  onQuick: (tab: Tab, seed: string) => void;
}

const QUICK_ACTIONS: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tab: Tab;
  prompt: string;
}[] = [
  {
    label: "Draft a cold email",
    icon: Mail,
    tab: "Email",
    prompt:
      "Draft a cold email to the prospect's manufacturing leader. Lead with a relevant insight about their software stack, close with one specific ask.",
  },
  {
    label: "Handle an objection",
    icon: Shield,
    tab: "Objections",
    prompt: "We are getting the 'we already use Mastercam, why switch' objection. Help me handle it.",
  },
  {
    label: "Score MEDDPICC",
    icon: ClipboardList,
    tab: "MEDDPICC",
    prompt: "Score this deal across MEDDPICC. Flag the gaps and tell me the highest-leverage next action.",
  },
  {
    label: "Recommend product fit",
    icon: Wrench,
    tab: "Product Fit",
    prompt: "Recommend the HRS replacement for the prospect's current software with three differentiation points.",
  },
  {
    label: "Ask anything",
    icon: MessageSquare,
    tab: "Ask Anything",
    prompt: "",
  },
];

export function EmptyState({ onQuick }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 animate-fade-in">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center mb-5 shadow-lg shadow-primary/30">
        <Sparkles className="h-6 w-6 text-white" />
      </div>
      <h2 className="text-2xl md:text-3xl font-semibold text-text-primary tracking-tight">
        What do you need?
      </h2>
      <p className="text-sm text-text-secondary mt-2 max-w-md">
        Your AI sales engineer for territory prospecting.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-8 max-w-2xl">
        {QUICK_ACTIONS.map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => onQuick(q.tab, q.prompt)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-border bg-surface text-sm text-text-secondary hover:text-text-primary hover:border-primary/50 hover:bg-primary-subtle transition-all"
            >
              <Icon className="h-3.5 w-3.5" />
              {q.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
