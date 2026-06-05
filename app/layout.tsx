import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ToastProvider } from "@/components/ui/toast";
import { CompanyContextProvider } from "@/components/providers/company-context";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND.name} · ${BRAND.tagline}`,
  description: BRAND.description,
};

// Light is the default. Dark applies only when the rep has explicitly chosen it
// (saved preference), never from the OS setting. Runs before first paint so the
// chosen theme never flashes; suppressHydrationWarning covers the class on <html>.
const THEME_INIT = `(function(){try{if(localStorage.getItem('pp-theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-text-primary antialiased min-h-screen">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        <ThemeProvider>
          <ToastProvider>
            <CompanyContextProvider>
              <div className="flex min-h-screen">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                  <Header />
                  <main className="flex-1 min-w-0">{children}</main>
                </div>
              </div>
            </CompanyContextProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
