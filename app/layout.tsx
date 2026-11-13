import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LedgerProvider } from "@/lib/state/ledger-context";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Poker Ledger",
  description: "Track buy-ins, chip counts and settle debts for private poker nights.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5F4F0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ToastProvider>
          <LedgerProvider>
            <AppShell>{children}</AppShell>
          </LedgerProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
