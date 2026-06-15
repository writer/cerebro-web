import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

import CerebroAgentPanel from "@/components/agent/CerebroAgentPanel";
import { CerebroAgentProvider } from "@/components/agent/CerebroAgentProvider";
import CommandPalette from "@/components/CommandPalette";
import { ApiKeyProvider, CommandPaletteProvider, SidebarProvider, ThemeProvider } from "@/components/providers";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const agentMono = IBM_Plex_Mono({
  variable: "--font-agent-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Cerebro",
  description: "Security posture, findings, controls, and evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${agentMono.variable} bg-[var(--app-bg)] text-[var(--text-primary)] antialiased`}>
        <ApiKeyProvider>
          <ThemeProvider>
            <CerebroAgentProvider>
              <CommandPaletteProvider>
                <SidebarProvider>
                  <div className="flex h-screen max-w-full overflow-hidden bg-[var(--app-bg)]">
                    <Sidebar />
                    <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
                      <Topbar />
                      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--app-bg)] px-8 py-6 max-md:px-4">{children}</main>
                    </div>
                  </div>
                  <CommandPalette />
                  <CerebroAgentPanel />
                </SidebarProvider>
              </CommandPaletteProvider>
            </CerebroAgentProvider>
          </ThemeProvider>
        </ApiKeyProvider>
      </body>
    </html>
  );
}
