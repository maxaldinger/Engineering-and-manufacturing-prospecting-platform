import { ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-border bg-surface/40 backdrop-blur-sm">
        <div className="px-6 md:px-10 py-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-text-primary">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
      <div className="flex-1 px-6 md:px-10 py-6">{children}</div>
    </div>
  );
}
