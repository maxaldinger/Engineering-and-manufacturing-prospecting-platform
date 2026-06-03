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

export function ObjectionsBuilder({ tone, methodology, company }: Props) {
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const builder = useBuilder();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void builder.run({
      tab: "Objections",
      tone,
      methodology,
      company,
      userMessage: composeContextMessage(
        context,
        "Handle the objection in the notes using the selected methodology. Acknowledge, reframe, evidence, advance."
      ),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Objection Handler"
        subtitle="Paste the objection plus any deal context, or paste a URL. The AI returns acknowledge / reframe / evidence / advance using the selected methodology."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <UniversalContextInput
          context={context}
          onChange={setContext}
          notesLabel="Objection plus deal context"
          notesPlaceholder="Paste the objection in their words plus any context about the deal stage, current software, decision criteria. The AI handles it grounded in what you wrote."
        />
        <div className="flex items-center gap-2">
          <GenerateButton
            label="Handle Objection"
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
        emptyHint="Acknowledge, reframe, evidence, advance steps appear here."
        onRetry={builder.retry}
        onClear={builder.clear}
      />
    </div>
  );
}
