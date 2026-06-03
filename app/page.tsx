import { PageShell } from "@/components/layout/page-shell";
import { SignalFeed } from "@/components/signal-feed/signal-feed";

export default function HomePage() {
  return (
    <PageShell
      title="Territory Signal Feed"
      subtitle="Surfaces manufacturers running competitor CAM in your territory once a real data source is connected."
    >
      <SignalFeed />
    </PageShell>
  );
}
