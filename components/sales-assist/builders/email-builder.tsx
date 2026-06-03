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
import type { Tone, Methodology, ActiveCompanyContext } from "@/lib/sales-context";

interface Props {
  tone: Tone;
  methodology: Methodology;
  company: ActiveCompanyContext | null;
}

export function EmailBuilder({ tone, methodology, company }: Props) {
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const builder = useBuilder();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void builder.run({
      tab: "Email",
      tone,
      methodology,
      company,
      userMessage: composeContextMessage(
        context,
        "Draft a cold email to this prospect. Lead with a relevant insight from the context, close with one specific ask."
      ),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Cold Email Builder"
        subtitle="Paste meeting notes or a prospect URL. The AI drafts a 4 to 6 sentence cold email anchored on what's actually in the context."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <UniversalContextInput
          context={context}
          onChange={setContext}
          notesPlaceholder="Paste meeting notes, news article, capability brief, or prior touchpoints. Or drop a URL below."
        />
        <div className="flex items-center gap-2">
          <GenerateButton
            label="Generate Email"
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
        emptyHint="Subject line and body appear here once context is provided."
        onRetry={builder.retry}
        onClear={builder.clear}
      />
    </div>
  );
}
