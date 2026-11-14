import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Chess } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChessArena — Play Chess Online",
  description:
    "A modern chess platform. Play vs computer, solve puzzles, analyze games, and challenge friends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <header className="border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
              <div className="w-8 h-8 rounded-md bg-[var(--accent)] flex items-center justify-center">
                <Chess className="w-5 h-5 text-black" />
              </div>
              <span>
                Chess<span className="text-[var(--accent)]">Arena</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link href="/play/computer" className="btn-ghost text-sm">
                vs Computer
              </Link>
              <Link href="/play/online" className="btn-ghost text-sm">
                Play Online
              </Link>
              <Link href="/puzzles" className="btn-ghost text-sm">
                Puzzles
              </Link>
              <Link href="/analysis" className="btn-ghost text-sm hidden sm:inline">
                Analysis
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--border)] py-6 text-center text-sm text-[var(--muted)]">
          <p>ChessArena · Built for players who love the game</p>
        </footer>
      </body>
    </html>
  );
}
