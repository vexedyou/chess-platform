"use client";

import { useCallback, useEffect, useState } from "react";
import { Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import { PUZZLES, Puzzle, getRandomPuzzle } from "@/lib/puzzles";
import { Lightbulb, SkipForward, Check, X, Puzzle as PuzzleIcon } from "lucide-react";

export default function PuzzlesPage() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [fen, setFen] = useState("");
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [status, setStatus] = useState<"playing" | "solved" | "failed">("playing");
  const [message, setMessage] = useState("Find the best move!");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const boardWidth = useBoardWidth();

  const loadPuzzle = useCallback((p?: Puzzle) => {
    const selected = p || getRandomPuzzle();
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

  function handleMove(move: Move, newFen: string) {
    if (!puzzle || status !== "playing") return;

    const expected = puzzle.solution[solutionIndex];
    const isCorrect =
      move.san === expected ||
      move.lan === expected ||
      `${move.from}${move.to}` === expected ||
      `${move.from}${move.to}${move.promotion || ""}` === expected;

    if (isCorrect) {
      setFen(newFen);
      setLastMove({ from: move.from, to: move.to });
      const nextIndex = solutionIndex + 1;

      if (nextIndex >= puzzle.solution.length) {
        setStatus("solved");
        setMessage("Correct! Puzzle solved.");
      } else {
        setSolutionIndex(nextIndex);
        setMessage("Good! Keep going...");
      }
    } else {
      setStatus("failed");
      setMessage(`Wrong move. Expected something like ${expected}`);
    }
  }

  if (!puzzle) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-[var(--muted)]">Loading puzzle...</p>
      </div>
    );
  }

  const orientation = puzzle.fen.includes(" w ") ? "white" : "black";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="board-container mx-auto lg:mx-0">
          <ChessBoard
            fen={fen}
            orientation={orientation}
            onMove={handleMove}
            interactive={status === "playing"}
            lastMove={lastMove}
            boardWidth={boardWidth}
          />
        </div>

        <div className="w-full lg:w-80 space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <PuzzleIcon className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="font-semibold text-lg">Tactics Puzzle</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-hover)] text-[var(--muted)]">
                {puzzle.rating}
              </span>
              {puzzle.themes.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]"
                >
                  {t}
                </span>
              ))}
            </div>

            <p
              className={`text-sm font-medium mb-4 flex items-start gap-1.5 ${
                status === "solved"
                  ? "text-green-400"
                  : status === "failed"
                  ? "text-red-400"
                  : "text-white"
              }`}
            >
              {status === "solved" && <Check className="w-4 h-4 mt-0.5 shrink-0" />}
              {status === "failed" && <X className="w-4 h-4 mt-0.5 shrink-0" />}
              {message}
            </p>

            <div className="flex flex-col gap-2">
              {status === "playing" && (
                <button
                  onClick={() => setShowHint(true)}
                  className="btn-secondary w-full"
                >
                  <Lightbulb className="w-4 h-4" /> Hint
                </button>
              )}
              <button onClick={() => loadPuzzle()} className="btn-primary w-full">
                <SkipForward className="w-4 h-4" /> Next Puzzle
              </button>
            </div>

            {showHint && status === "playing" && (
              <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
                Hint: Look for a {puzzle.themes[0] || "tactical idea"}. Focus on checks, captures, and threats.
              </p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-medium text-sm text-[var(--muted)] mb-1">Puzzle set</h3>
            <p className="text-sm text-[var(--muted)]">{PUZZLES.length} puzzles available</p>
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
