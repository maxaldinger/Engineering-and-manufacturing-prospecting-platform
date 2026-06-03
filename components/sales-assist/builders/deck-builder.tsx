"use client";

import * as React from "react";
import { BuilderHeader, GenerateButton } from "./common";
import { BuilderOutput } from "./builder-output";
import { useBuilder } from "./use-builder";
import { cn } from "@/lib/utils";
import {
  UniversalContextInput,
  emptyContext,
  composeContextMessage,
  hasContext,
  type UniversalContext,
} from "./universal-input";
import type { Tone, Methodology, ActiveCompanyContext } from "@/lib/sales-context";

interface Props {
  tone: Tone;
  methodology: Methodology;
  company: ActiveCompanyContext | null;
}

const DECK_TYPES = [
  {
    name: "Prospect Deck",
    desc: "First meeting, company overview, value proposition",
  },
  {
    name: "Discovery Deck",
    desc: "Discovery call framework, qualifying questions",
  },
  {
    name: "Proposal Deck",
    desc: "Solution proposal, pricing, implementation plan",
  },
  {
    name: "QBR Deck",
    desc: "Quarterly business review, usage metrics, roadmap",
  },
  {
    name: "Competitive Deck",
    desc: "Competitive positioning, differentiation, win themes",
  },
] as const;

export function DeckBuilder({ tone, methodology, company }: Props) {
  const [deckType, setDeckType] = React.useState<string>(DECK_TYPES[0].name);
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const builder = useBuilder();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void builder.run({
      tab: "Deck",
      tone,
      methodology,
      company,
      userMessage: composeContextMessage(
        context,
        `Build a ${deckType} outline grounded in the notes and website. Slide-by-slide titles, three bullets per slide, and the question each slide answers for the buyer.`
      ),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Deck Builder"
        subtitle="Pick a deck type, paste meeting notes or a URL, and the AI returns a slide-by-slide outline anchored on the input."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text-primary">Deck type</span>
          <div className="grid md:grid-cols-3 gap-3">
            {DECK_TYPES.map((d) => {
              const on = deckType === d.name;
              return (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => setDeckType(d.name)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-all",
                    on
                      ? "border-primary bg-primary-subtle ring-2 ring-primary/30"
                      : "border-border bg-surface hover:border-border-strong hover:bg-surface-2"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      on ? "text-primary" : "text-text-primary"
                    )}
                  >
                    {d.name}
                  </p>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    {d.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
        <UniversalContextInput
          context={context}
          onChange={setContext}
          notesLabel="Meeting context"
          notesPlaceholder="Add any context: company details, pain points discussed, key stakeholders, industry. Or drop a prospect URL below."
        />
        <div className="flex items-center gap-2">
          <GenerateButton
            label="Generate Deck"
            streaming={builder.streaming}
            onStop={builder.stop}
            disabled={!hasContext(context)}
          />
        </div>
      </form>
      <BuilderOutput
        content={builder.content}
        streaming={builder.streaming}
        error={builder.error}
        emptyHint="Slide-by-slide outline appears here."
        onRetry={builder.retry}
        onClear={builder.clear}
      />
    </div>
  );
}
