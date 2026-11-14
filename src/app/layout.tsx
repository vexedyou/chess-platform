import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Crown } from "lucide-react";

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
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{ height: "100%" }}
    >
      <body
        style={{
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--background)",
          color: "var(--foreground)",
          margin: 0,
        }}
      >
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            background: "rgba(22, 22, 22, 0.9)",
            backdropFilter: "blur(8px)",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div
            className="page-wrap"
            style={{
              height: "3.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontWeight: 700,
                fontSize: "1.125rem",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "0.375rem",
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Crown className="w-5 h-5" style={{ color: "#000" }} />
              </div>
              <span>
                Chess<span style={{ color: "var(--accent)" }}>Arena</span>
              </span>
            </Link>
            <nav style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Link href="/play/computer" className="btn-ghost">
                vs Computer
              </Link>
              <Link href="/play/online" className="btn-ghost">
                Play Online
              </Link>
              <Link href="/puzzles" className="btn-ghost">
                Puzzles
              </Link>
              <Link href="/analysis" className="btn-ghost" style={{ display: "none" }}>
                Analysis
              </Link>
            </nav>
          </div>
        </header>
        <main style={{ flex: 1 }}>{children}</main>
        <footer
          style={{
            borderTop: "1px solid var(--border)",
            padding: "1.5rem",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "var(--muted)",
          }}
        >
          <p style={{ margin: 0 }}>ChessArena · Built for players who love the game</p>
        </footer>
      </body>
    </html>
  );
}
