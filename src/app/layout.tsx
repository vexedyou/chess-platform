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
  title: "Pushing Pawns — Play Chess Online",
  description:
    "Play chess vs computer, solve tactics puzzles, analyze games, and challenge friends online.",
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
            background: "rgba(22, 22, 22, 0.92)",
            backdropFilter: "blur(10px)",
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
              gap: "1rem",
            }}
          >
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontWeight: 700,
                fontSize: "1.05rem",
                textDecoration: "none",
                color: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              <div
                style={{
                  width: "1.85rem",
                  height: "1.85rem",
                  borderRadius: "0.375rem",
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Crown className="w-4 h-4" style={{ color: "#000" }} />
              </div>
              <span>
                Pushing{" "}
                <span style={{ color: "var(--accent)" }}>Pawns</span>
              </span>
            </Link>
            <nav
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.15rem",
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <Link href="/play/computer" className="btn-ghost">
                Computer
              </Link>
              <Link href="/play/online" className="btn-ghost">
                Online
              </Link>
              <Link href="/puzzles" className="btn-ghost">
                Puzzles
              </Link>
              <Link href="/analysis" className="btn-ghost">
                Analysis
              </Link>
            </nav>
          </div>
        </header>
        <main style={{ flex: 1 }}>{children}</main>
        <footer
          style={{
            borderTop: "1px solid var(--border)",
            padding: "1.25rem",
            textAlign: "center",
            fontSize: "0.8125rem",
            color: "var(--muted)",
          }}
        >
          <p style={{ margin: 0 }}>Pushing Pawns · Chess, focused on the game</p>
        </footer>
      </body>
    </html>
  );
}
