import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Cerebro",
  description: "Security posture, findings, controls, and evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-[var(--app-bg)] text-[var(--text-primary)] antialiased`}>
        <ApiKeyProvider>
          <ThemeProvider>
            <CommandPaletteProvider>
              <SidebarProvider>
                <div className="flex h-screen overflow-hidden bg-[var(--app-bg)]">
                  <Sidebar />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Topbar />
                    <main className="flex-1 overflow-y-auto bg-[var(--app-bg)] px-8 py-6">{children}</main>
                  </div>
                </div>
                <CommandPalette />
              </SidebarProvider>
            </CommandPaletteProvider>
          </ThemeProvider>
        </ApiKeyProvider>
      </body>
    </html>
  );
}
