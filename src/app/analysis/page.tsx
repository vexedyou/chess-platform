"use client";

import { useEffect, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import { Search, RotateCcw, ClipboardPaste } from "lucide-react";

const START =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function AnalysisPage() {
  const [fen, setFen] = useState(START);
  const [inputFen, setInputFen] = useState("");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(
    null
  );
  const [history, setHistory] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [error, setError] = useState("");
  const boardWidth = useBoardWidth();

  function handleMove(move: Move, newFen: string) {
    setFen(newFen);
    setLastMove({ from: move.from, to: move.to });
    setHistory((h) => [...h, move.san]);
    setError("");
  }

  function loadFen() {
    try {
      const chess = new Chess(inputFen.trim() || undefined);
      setFen(chess.fen());
      setLastMove(null);
      setHistory([]);
      setInputFen(chess.fen());
      setError("");
    } catch {
      setError("Invalid FEN");
    }
  }

  function reset() {
    setFen(START);
    setLastMove(null);
    setHistory([]);
    setInputFen("");
    setError("");
  }

  return (
    <div className="page-wrap" style={{ paddingTop: "1.5rem", paddingBottom: "2.5rem" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          alignItems: "center",
        }}
        className="game-layout"
      >
        <style>{`
          @media (min-width: 1024px) {
            .game-layout { flex-direction: row !important; align-items: flex-start !important; justify-content: center; }
            .game-side { width: 18rem !important; }
          }
        `}</style>

        <div className="board-container">
          <ChessBoard
            fen={fen}
            orientation={orientation}
            onMove={handleMove}
            interactive={true}
            lastMove={lastMove}
            boardWidth={boardWidth}
          />
        </div>

        <div className="game-side" style={{ width: "100%", maxWidth: 320 }}>
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              <Search style={{ width: 20, height: 20, color: "var(--accent)" }} />
              <h2 style={{ fontWeight: 600, fontSize: "1.1rem", margin: 0 }}>
                Analysis
              </h2>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
              Move freely or load any position by FEN.
            </p>

            <label
              style={{
                fontSize: "0.7rem",
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Load FEN
            </label>
            <textarea
              value={inputFen}
              onChange={(e) => setInputFen(e.target.value)}
              placeholder="Paste FEN here..."
              style={{
                width: "100%",
                marginTop: "0.35rem",
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                padding: "0.6rem",
                fontSize: "0.8rem",
                fontFamily: "monospace",
                height: 72,
                resize: "none",
                color: "var(--foreground)",
                boxSizing: "border-box",
              }}
            />
            {error && (
              <p style={{ color: "#f87171", fontSize: "0.8rem", margin: "0.35rem 0 0" }}>
                {error}
              </p>
            )}
            <button
              onClick={loadFen}
              className="btn-secondary"
              style={{ width: "100%", marginTop: "0.5rem" }}
            >
              <ClipboardPaste className="w-4 h-4" /> Load Position
            </button>

            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
              <button onClick={reset} className="btn-secondary" style={{ flex: 1 }}>
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
              <button
                onClick={() =>
                  setOrientation((o) => (o === "white" ? "black" : "white"))
                }
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Flip
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
            <h3
              style={{
                fontWeight: 500,
                fontSize: "0.8rem",
                color: "var(--muted)",
                margin: "0 0 0.75rem",
              }}
            >
              Moves
            </h3>
            {history.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
                No moves yet
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.35rem 0.75rem",
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {history.map((san, i) => (
                  <span key={i}>
                    {i % 2 === 0 && (
                      <span style={{ color: "var(--muted)", marginRight: 4 }}>
                        {Math.floor(i / 2) + 1}.
                      </span>
                    )}
                    {san}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: "1rem 1.25rem" }}>
            <h3
              style={{
                fontWeight: 500,
                fontSize: "0.8rem",
                color: "var(--muted)",
                margin: "0 0 0.5rem",
              }}
            >
              FEN
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "0.7rem",
                fontFamily: "monospace",
                color: "var(--muted)",
                wordBreak: "break-all",
                lineHeight: 1.45,
                userSelect: "all",
              }}
            >
              {fen}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function useBoardWidth() {
  const [width, setWidth] = useState(480);
  useEffect(() => {
    function update() {
      setWidth(Math.max(280, Math.min(window.innerWidth - 32, 540)));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}
