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

export function ProductFitBuilder({ tone, methodology, company }: Props) {
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const builder = useBuilder();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prefix = company?.detectedSoftware?.length
      ? `Active prospect detected software: ${company.detectedSoftware.join(", ")}.\n\nRecommend the portfolio replacement and three differentiation reasons grounded in what's in the notes or website.`
      : "Recommend the portfolio replacement for the prospect's current software with three differentiation reasons grounded in what's in the notes or website.";
    void builder.run({
      tab: "Product Fit",
      tone,
      methodology,
      company,
      userMessage: composeContextMessage(context, prefix),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Product Fit Recommendation"
        subtitle="Paste meeting notes or a prospect URL. The AI infers the current software stack and returns the portfolio replacement plus three reasons."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <UniversalContextInput
          context={context}
          onChange={setContext}
          notesPlaceholder="Paste discovery notes, capability brief, careers page, or anything that hints at their CAD/CAM stack and key requirements."
        />
        <div className="flex items-center gap-2">
          <GenerateButton
            label="Recommend Product Fit"
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
        emptyHint="Recommendation and three differentiation reasons appear here."
        onRetry={builder.retry}
        onClear={builder.clear}
      />
    </div>
  );
}
