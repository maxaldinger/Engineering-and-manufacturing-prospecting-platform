import { PageShell } from "@/components/layout/page-shell";
import { SalesAssistShell } from "@/components/sales-assist/sales-assist-shell";

export default function SalesAssistPage() {
  return (
    <PageShell
      title="Sales Assist"
      subtitle="AI sales engineer for cold emails, LOUs, objections, MEDDPICC, threading, proposals, and decks."
    >
      <SalesAssistShell />
    </PageShell>
  );
}
