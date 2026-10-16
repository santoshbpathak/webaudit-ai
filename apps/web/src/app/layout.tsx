import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { listAudits } from "@webaudit/db";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isDemo, services } from "@/lib/server";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "WebAudit AI — Evidence for every fix", template: "%s · WebAudit AI" },
  applicationName: "WebAudit AI",
  description:
    "Open-source website intelligence for marketers: SEO, accessibility, analytics, ad pixels, UX and consent signals — evidence-backed, local-first.",
};

export const dynamic = "force-dynamic";

// Dark ("Midnight Intelligence") is the product default; a stored choice wins. Set before paint.
const themeScript = `(function(){try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"dark"}catch(e){document.documentElement.dataset.theme="dark"}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const recent = listAudits(services().db, { limit: 8 }).map((a) => ({
    id: a.id,
    host: a.host,
    status: a.status,
    createdAt: a.createdAt,
  }));
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <TooltipProvider>
          <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
            <AppSidebar recent={recent} demo={isDemo()} />
            <main id="main" className="min-w-0">
              {children}
            </main>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
