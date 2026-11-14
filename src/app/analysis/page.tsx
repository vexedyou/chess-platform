"use client";

import { useEffect, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import { Search, RotateCcw, ClipboardPaste } from "lucide-react";

export default function AnalysisPage() {
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const [inputFen, setInputFen] = useState("");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const boardWidth = useBoardWidth();

  function handleMove(move: Move, newFen: string) {
    setFen(newFen);
    setLastMove({ from: move.from, to: move.to });
    setHistory((h) => [...h, move.san]);
  }

  function loadFen() {
    try {
      const chess = new Chess(inputFen.trim() || undefined);
      setFen(chess.fen());
      setLastMove(null);
      setHistory([]);
      setInputFen(chess.fen());
    } catch {
      alert("Invalid FEN");
    }
  }

  function reset() {
    const chess = new Chess();
    setFen(chess.fen());
    setLastMove(null);
    setHistory([]);
    setInputFen("");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="board-container mx-auto lg:mx-0">
          <ChessBoard
            fen={fen}
            orientation={orientation}
            onMove={handleMove}
            interactive={true}
            lastMove={lastMove}
            boardWidth={boardWidth}
          />
        </div>

        <div className="w-full lg:w-80 space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="font-semibold text-lg">Analysis Board</h2>
            </div>

            <p className="text-sm text-[var(--muted)] mb-4 leading-relaxed">
              Explore any position. Make moves freely or load a FEN.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--muted)] uppercase tracking-wide">
                  Load FEN
                </label>
                <textarea
                  value={inputFen}
                  onChange={(e) => setInputFen(e.target.value)}
                  placeholder="Paste FEN here..."
                  className="w-full mt-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg p-2.5 text-sm font-mono h-20 resize-none focus:outline-none focus:border-[var(--accent)]"
                />
                <button onClick={loadFen} className="btn-secondary w-full mt-2">
                  <ClipboardPaste className="w-4 h-4" /> Load Position
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={reset} className="btn-secondary flex-1">
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
                <button
                  onClick={() =>
                    setOrientation((o) => (o === "white" ? "black" : "white"))
                  }
                  className="btn-secondary flex-1"
                >
                  Flip Board
                </button>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-medium text-sm text-[var(--muted)] mb-3">Move history</h3>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No moves yet</p>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-mono max-h-48 overflow-y-auto">
                {history.map((san, i) => (
                  <span key={i}>
                    {i % 2 === 0 && (
                      <span className="text-[var(--muted)] mr-1">
                        {Math.floor(i / 2) + 1}.
                      </span>
                    )}
                    {san}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-medium text-sm text-[var(--muted)] mb-2">Current FEN</h3>
            <p className="text-xs font-mono break-all text-[var(--muted)] select-all leading-relaxed">
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
      setWidth(Math.max(280, Math.min(window.innerWidth - 32, 520)));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}
