"use client";

import { Chess } from "chess.js";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

type Props = {
  history: string[];
  /** -1 = live (latest). 0..n-1 = position after that move */
  viewIndex: number;
  onViewIndex: (index: number) => void;
};

export function fenAfterMoves(sans: string[], upTo: number): string {
  const chess = new Chess();
  const end = Math.min(upTo + 1, sans.length);
  for (let i = 0; i < end; i++) {
    try {
      chess.move(sans[i]);
    } catch {
      break;
    }
  }
  return chess.fen();
}

export function lastMoveAt(sans: string[], index: number) {
  if (index < 0 || index >= sans.length) return null;
  const chess = new Chess();
  let last: { from: string; to: string } | null = null;
  for (let i = 0; i <= index; i++) {
    try {
      const m = chess.move(sans[i]);
      if (m) last = { from: m.from, to: m.to };
    } catch {
      break;
    }
  }
  return last;
}

export default function MoveHistory({ history, viewIndex, onViewIndex }: Props) {
  const live = history.length - 1;
  const at = viewIndex < 0 ? live : viewIndex;

  function go(i: number) {
    if (history.length === 0) return;
    onViewIndex(Math.max(-1, Math.min(live, i)));
  }

  return (
    <div className="card" style={{ padding: "1.1rem 1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.65rem",
        }}
      >
        <h3
          style={{
            fontWeight: 500,
            fontSize: "0.8rem",
            color: "var(--muted)",
            margin: 0,
          }}
        >
          Moves
        </h3>
        {history.length > 0 && (
          <div style={{ display: "flex", gap: "0.15rem" }}>
            <NavBtn onClick={() => go(-1)} disabled={at <= 0} title="Start">
              <ChevronsLeft className="w-3.5 h-3.5" />
            </NavBtn>
            <NavBtn onClick={() => go(at - 1)} disabled={at <= 0} title="Back">
              <ChevronLeft className="w-3.5 h-3.5" />
            </NavBtn>
            <NavBtn
              onClick={() => go(at + 1)}
              disabled={at >= live}
              title="Forward"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </NavBtn>
            <NavBtn onClick={() => go(-1)} disabled={viewIndex < 0} title="Live">
              <ChevronsRight className="w-3.5 h-3.5" />
            </NavBtn>
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
          No moves yet
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr 1fr",
            gap: "0.15rem 0.35rem",
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "0.85rem",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {Array.from({ length: Math.ceil(history.length / 2) }).map((_, row) => {
            const whiteIdx = row * 2;
            const blackIdx = row * 2 + 1;
            return (
              <div key={row} style={{ display: "contents" }}>
                <span style={{ color: "var(--muted)", padding: "0.15rem 0.25rem" }}>
                  {row + 1}.
                </span>
                <MoveCell
                  san={history[whiteIdx]}
                  active={at === whiteIdx}
                  onClick={() => onViewIndex(whiteIdx === live ? -1 : whiteIdx)}
                />
                {history[blackIdx] ? (
                  <MoveCell
                    san={history[blackIdx]}
                    active={at === blackIdx}
                    onClick={() =>
                      onViewIndex(blackIdx === live ? -1 : blackIdx)
                    }
                  />
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewIndex >= 0 && viewIndex < live && (
        <button
          onClick={() => onViewIndex(-1)}
          className="btn-ghost"
          style={{ width: "100%", marginTop: "0.6rem", fontSize: "0.8rem" }}
        >
          Back to live position
        </button>
      )}
    </div>
  );
}

function MoveCell({
  san,
  active,
  onClick,
}: {
  san: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        background: active ? "rgba(129,182,76,0.25)" : "transparent",
        border: "none",
        borderRadius: 4,
        color: active ? "var(--accent)" : "var(--foreground)",
        cursor: "pointer",
        padding: "0.15rem 0.35rem",
        font: "inherit",
      }}
    >
      {san}
    </button>
  );
}

function NavBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="btn-ghost"
      style={{
        padding: "0.25rem",
        opacity: disabled ? 0.35 : 1,
        minWidth: 28,
      }}
    >
      {children}
    </button>
  );
}
