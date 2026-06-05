"use client";

import * as React from "react";
import { TabBar } from "./tab-bar";
import { ToneMethodologySelector } from "./tone-methodology-selector";
import { ActiveCompanyBanner } from "./active-company-banner";
import { useCompanyContext } from "@/components/providers/company-context";
import type { Tab, Tone, Methodology } from "@/lib/sales-context";

import { AskAnythingBuilder } from "./builders/ask-anything-builder";
import { EmailBuilder } from "./builders/email-builder";
import { LouBuilder } from "./builders/lou-builder";
import { ProductFitBuilder } from "./builders/product-fit-builder";
import { ThreadingBuilder } from "./builders/threading-builder";
import { MeddpiccBuilder } from "./builders/meddpicc-builder";

export function SalesAssistShell() {
  const [tab, setTab] = React.useState<Tab>("Ask Anything");
  const [tone, setTone] = React.useState<Tone>("Direct");
  const [methodology, setMethodology] = React.useState<Methodology>("MEDDPICC");
  const { active } = useCompanyContext();

  const builderProps = { tone, methodology, company: active };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <TabBar active={tab} onChange={setTab} />
        <div className="grid md:grid-cols-2 gap-3">
          <ToneMethodologySelector
            tone={tone}
            methodology={methodology}
            onToneChange={setTone}
            onMethodologyChange={setMethodology}
          />
        </div>
        <ActiveCompanyBanner />
      </div>

      <div className="animate-fade-in">
        {tab === "Ask Anything" && <AskAnythingBuilder {...builderProps} />}
        {tab === "Email" && <EmailBuilder {...builderProps} />}
        {tab === "LOU" && <LouBuilder {...builderProps} />}
        {tab === "Product Fit" && <ProductFitBuilder {...builderProps} />}
        {tab === "Threading" && <ThreadingBuilder {...builderProps} />}
        {tab === "MEDDPICC" && <MeddpiccBuilder {...builderProps} />}
      </div>

      <div className="border-t border-border pt-4">
        <TabBar active={tab} onChange={setTab} size="sm" />
      </div>
    </div>
  );
}
