"use client";

import { useCallback, useEffect, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import {
  Puzzle,
  getRandomPuzzle,
  movesMatch,
  PUZZLES,
} from "@/lib/puzzles";
import { Lightbulb, SkipForward, Check, X, Puzzle as PuzzleIcon } from "lucide-react";

export default function PuzzlesPage() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [fen, setFen] = useState("");
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [status, setStatus] = useState<"playing" | "solved" | "failed">("playing");
  const [message, setMessage] = useState("Find the best move");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(
    null
  );
  const [showHint, setShowHint] = useState(false);
  const boardWidth = useBoardWidth();

  const loadPuzzle = useCallback((excludeId?: string) => {
    const selected = getRandomPuzzle(excludeId);
    setPuzzle(selected);
    setFen(selected.fen);
    setSolutionIndex(0);
    setStatus("playing");
    setMessage(selected.description);
    setLastMove(null);
    setShowHint(false);
  }, []);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  function playOpponentReply(chess: Chess, nextIndex: number, p: Puzzle) {
    // In our puzzle format, odd indices after a player move can be opponent moves
    // stored in the solution line (player, opp, player, ...)
    if (nextIndex >= p.solution.length) return { chess, index: nextIndex };

    // Auto-play consecutive "opponent" half-moves if FEN side matches expected
    // Simpler approach: solution is only the player's moves; we don't auto-play.
    // For multi-move lines that include opponent moves in solution array:
    let idx = nextIndex;
    let current = chess;

    while (idx < p.solution.length) {
      // Try if the next solution move is legal for the side to move — if so it might be opp reply
      // Convention: solution alternates starting with player (side to move in initial FEN)
      const expected = p.solution[idx];
      const legal = current.moves({ verbose: true });
      const match = legal.find((m) =>
        movesMatch(
          { san: m.san, from: m.from, to: m.to, promotion: m.promotion },
          expected
        )
      );

      // Only auto-play if this is an opponent move (not player's turn to find)
      // Player moves are at even steps from start relative to player color turns.
      // After player just moved, it's opponent's turn — auto play if solution continues.
      if (!match) break;

      // Check if this move is meant to be automatic (opponent):
      // We treat every other move after the player's correct move as auto when present.
      current = new Chess(current.fen());
      current.move(match);
      idx++;

      // Stop after one opponent reply so player faces the next problem move
      break;
    }

    return { chess: current, index: idx };
  }

  function handleMove(move: Move, newFen: string) {
    if (!puzzle || status !== "playing") return;

    const expected = puzzle.solution[solutionIndex];
    const ok = movesMatch(
      {
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
      },
      expected
    );

    if (!ok) {
      setStatus("failed");
      setMessage("Not the best move. Try the next puzzle or review the idea.");
      return;
    }

    let chess = new Chess(newFen);
    let nextIndex = solutionIndex + 1;
    setLastMove({ from: move.from, to: move.to });

    if (nextIndex >= puzzle.solution.length) {
      setFen(newFen);
      setSolutionIndex(nextIndex);
      setStatus("solved");
      setMessage("Correct! Puzzle solved.");
      return;
    }

    // Auto-play opponent reply if present in solution line
    const after = playOpponentReply(chess, nextIndex, puzzle);
    chess = after.chess;
    nextIndex = after.index;

    setFen(chess.fen());
    if (chess.history({ verbose: true }).length) {
      const hist = chess.history({ verbose: true });
      const last = hist[hist.length - 1];
      if (last) setLastMove({ from: last.from, to: last.to });
    }
    setSolutionIndex(nextIndex);

    if (nextIndex >= puzzle.solution.length) {
      setStatus("solved");
      setMessage("Correct! Puzzle solved.");
    } else {
      setMessage("Good! Keep going...");
    }
  }

  if (!puzzle) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
        Loading puzzle...
      </div>
    );
  }

  const orientation = puzzle.fen.includes(" w ") ? "white" : "black";

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
            interactive={status === "playing"}
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
              <PuzzleIcon style={{ width: 20, height: 20, color: "var(--accent)" }} />
              <h2 style={{ fontWeight: 600, fontSize: "1.1rem", margin: 0 }}>
                Tactics
              </h2>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.75rem" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: 999,
                  background: "var(--card-hover)",
                  color: "var(--muted)",
                }}
              >
                {puzzle.rating}
              </span>
              {puzzle.themes.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.15rem 0.5rem",
                    borderRadius: 999,
                    background: "rgba(129,182,76,0.15)",
                    color: "var(--accent)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>

            <p
              style={{
                fontSize: "0.9rem",
                fontWeight: 500,
                marginBottom: "1rem",
                color:
                  status === "solved"
                    ? "#4ade80"
                    : status === "failed"
                    ? "#f87171"
                    : undefined,
                display: "flex",
                alignItems: "flex-start",
                gap: "0.35rem",
              }}
            >
              {status === "solved" && <Check className="w-4 h-4" style={{ marginTop: 2 }} />}
              {status === "failed" && <X className="w-4 h-4" style={{ marginTop: 2 }} />}
              {message}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {status === "playing" && (
                <button onClick={() => setShowHint(true)} className="btn-secondary" style={{ width: "100%" }}>
                  <Lightbulb className="w-4 h-4" /> Hint
                </button>
              )}
              <button
                onClick={() => loadPuzzle(puzzle.id)}
                className="btn-primary"
                style={{ width: "100%" }}
              >
                <SkipForward className="w-4 h-4" /> Next Puzzle
              </button>
            </div>

            {showHint && status === "playing" && (
              <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                Look for {puzzle.themes[0] || "a tactic"}. Checks, captures, and threats first.
              </p>
            )}
          </div>

          <div className="card" style={{ padding: "1rem 1.25rem" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
              {PUZZLES.length} puzzles in the set
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
