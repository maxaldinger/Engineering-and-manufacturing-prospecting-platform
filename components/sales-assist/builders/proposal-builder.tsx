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

export function ProposalBuilder({ tone, methodology, company }: Props) {
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const builder = useBuilder();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void builder.run({
      tab: "Proposal",
      tone,
      methodology,
      company,
      userMessage: composeContextMessage(
        context,
        "Generate a structured proposal outline from the notes and website. Pull scope, success metrics, timeline, and product recommendation directly from what's there."
      ),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Proposal Builder"
        subtitle="Paste meeting notes plus any context, or a prospect URL. The AI returns a structured proposal outline anchored on the real input."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <UniversalContextInput
          context={context}
          onChange={setContext}
          notesPlaceholder="Paste meeting notes, key requirements discussed, pain points, suggested products. Or drop a URL below."
        />
        <div className="flex items-center gap-2">
          <GenerateButton
            label="Generate Proposal"
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
        emptyHint="Executive summary, scope, timeline, investment, and next steps appear here."
        onRetry={builder.retry}
        onClear={builder.clear}
      />
    </div>
  );
}
