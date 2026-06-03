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

export function AskAnythingBuilder({ tone, methodology, company }: Props) {
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const builder = useBuilder();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void builder.run({
      tab: "Ask Anything",
      tone,
      methodology,
      company,
      userMessage: composeContextMessage(context),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Ask Anything"
        subtitle="Paste meeting notes or a company URL. Ask the AI a question grounded in that context."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <UniversalContextInput
          context={context}
          onChange={setContext}
          notesLabel="Your question or context"
          notesPlaceholder="Ask anything. Paste discovery notes, an objection, a deal situation, or just type a question."
        />
        <div className="flex items-center gap-2">
          <GenerateButton
            label="Send"
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
        emptyHint="Type a question or paste context, then hit Send."
        onRetry={builder.retry}
        onClear={builder.clear}
      />
    </div>
  );
}
