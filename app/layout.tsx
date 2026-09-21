import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AnalysisProvider } from "@/components/providers/analysis-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Investment Pitch Copilot",
  description: "Build structured, evidence-led investment pitches."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={inter.className}><AnalysisProvider><AppShell>{children}</AppShell></AnalysisProvider></body></html>;
}
