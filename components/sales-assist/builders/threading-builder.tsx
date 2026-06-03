"use client";

import * as React from "react";
import { BuilderHeader, GenerateButton } from "./common";
import { BuilderOutput } from "./builder-output";
import { useBuilder } from "./use-builder";
import {
  UniversalContextInput,
  emptyContext,
  composeContextMessage,
  hasContext,
  type UniversalContext,
} from "./universal-input";
import type { Tone, Methodology, ActiveCompanyContext } from "@/lib/hrs-context";

interface Props {
  tone: Tone;
  methodology: Methodology;
  company: ActiveCompanyContext | null;
}

export function ThreadingBuilder({ tone, methodology, company }: Props) {
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const builder = useBuilder();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void builder.run({
      tab: "Threading",
      tone,
      methodology,
      company,
      userMessage: composeContextMessage(
        context,
        "Analyze the multi-thread coverage on this account based on the notes and website. List existing contacts, gaps, and recommended outreach for each missing role."
      ),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Multi-Threading Analysis"
        subtitle="Paste meeting notes that mention contacts, or a careers / leadership page URL. The AI returns coverage gaps and outreach plan."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <UniversalContextInput
          context={context}
          onChange={setContext}
          notesPlaceholder="Paste notes that mention current contacts, org structure, or who has engaged. Or drop a leadership / about page URL below."
        />
        <div className="flex items-center gap-2">
          <GenerateButton
            label="Analyze Threading"
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
        emptyHint="Coverage gaps and outreach plan appear here."
        onRetry={builder.retry}
        onClear={builder.clear}
      />
    </div>
  );
}
