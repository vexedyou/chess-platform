"use client";

import { Trophy, Swords, Handshake } from "lucide-react";

export type BannerKind = "win" | "lose" | "draw" | "check" | null;

type Props = {
  kind: BannerKind;
  title: string;
  subtitle?: string;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

export default function GameBanner({
  kind,
  title,
  subtitle,
  onDismiss,
  actionLabel,
  onAction,
}: Props) {
  if (!kind) return null;

  const colors = {
    win: { border: "#81b64c", bg: "rgba(129,182,76,0.12)", icon: "#81b64c" },
    lose: { border: "#f87171", bg: "rgba(248,113,113,0.1)", icon: "#f87171" },
    draw: { border: "#a3a3a3", bg: "rgba(163,163,163,0.1)", icon: "#a3a3a3" },
    check: { border: "#fbbf24", bg: "rgba(251,191,36,0.1)", icon: "#fbbf24" },
  }[kind];

  const Icon =
    kind === "win" ? Trophy : kind === "draw" ? Handshake : Swords;

  return (
    <div
      role="status"
      style={{
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: "0.75rem",
        padding: "1rem 1.15rem",
        marginBottom: "1rem",
        display: "flex",
        gap: "0.85rem",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon style={{ width: 22, height: 22, color: colors.icon }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 2 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            {subtitle}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.65rem" }}>
          {onAction && actionLabel && (
            <button onClick={onAction} className="btn-primary" style={{ fontSize: "0.8rem", padding: "0.45rem 0.9rem" }}>
              {actionLabel}
            </button>
          )}
          {onDismiss && kind !== "check" && (
            <button onClick={onDismiss} className="btn-ghost" style={{ fontSize: "0.8rem" }}>
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
