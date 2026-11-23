"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import {
  Puzzle,
  getRandomPuzzle,
  movesMatch,
  PUZZLES,
  allThemes,
  filterPuzzles,
} from "@/lib/puzzles";
import {
  Lightbulb,
  SkipForward,
  Check,
  X,
  Puzzle as PuzzleIcon,
  RotateCcw,
  Eye,
  Flame,
} from "lucide-react";
import { playGameSound } from "@/lib/sounds";

type DiffBucket = "all" | "easy" | "medium" | "hard";

function ratingRange(d: DiffBucket): { min?: number; max?: number } {
  if (d === "easy") return { max: 799 };
  if (d === "medium") return { min: 800, max: 1099 };
  if (d === "hard") return { min: 1100 };
  return {};
}

export default function PuzzlesPage() {
  const [theme, setTheme] = useState("all");
  const [diff, setDiff] = useState<DiffBucket>("all");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [fen, setFen] = useState("");
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [status, setStatus] = useState<"playing" | "solved" | "failed">("playing");
  const [message, setMessage] = useState("Find the best move");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [streak, setStreak] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const boardWidth = useBoardWidth();

  const themes = useMemo(() => allThemes(), []);
  const poolSize = useMemo(() => {
    const range = ratingRange(diff);
    return filterPuzzles({
      theme: theme === "all" ? null : theme,
      minRating: range.min,
      maxRating: range.max,
    }).length;
  }, [theme, diff]);

  const loadPuzzle = useCallback(
    (excludeId?: string) => {
      const range = ratingRange(diff);
      const selected = getRandomPuzzle(excludeId, {
        theme: theme === "all" ? null : theme,
        minRating: range.min,
        maxRating: range.max,
      });
      setPuzzle(selected);
      setFen(selected.fen);
      setSolutionIndex(0);
      setStatus("playing");
      setMessage(selected.description);
      setLastMove(null);
      setHintLevel(0);
      setShowSolution(false);
    },
    [theme, diff]
  );

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  function resetCurrent() {
    if (!puzzle) return;
    setFen(puzzle.fen);
    setSolutionIndex(0);
    setStatus("playing");
    setMessage(puzzle.description);
    setLastMove(null);
    setHintLevel(0);
    setShowSolution(false);
  }

  function playOpponentReply(chess: Chess, nextIndex: number, p: Puzzle) {
    let idx = nextIndex;
    let current = chess;

    if (idx >= p.solution.length) return { chess: current, index: idx };

    const expected = p.solution[idx];
    const legal = current.moves({ verbose: true });
    const match = legal.find((m) =>
      movesMatch(
        { san: m.san, from: m.from, to: m.to, promotion: m.promotion },
        expected
      )
    );
    if (!match) return { chess: current, index: idx };

    current = new Chess(current.fen());
    current.move(match);
    idx++;
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
      setMessage("Not the best move. Retry, show the solution, or try another.");
      setStreak(0);
      setAttempted((a) => a + 1);
      playGameSound({ lose: true });
      return;
    }

    let chess = new Chess(newFen);
    let nextIndex = solutionIndex + 1;
    setLastMove({ from: move.from, to: move.to });
    playGameSound({ capture: move.san.includes("x"), check: move.san.includes("+") || move.san.includes("#") });

    if (nextIndex >= puzzle.solution.length) {
      setFen(newFen);
      setSolutionIndex(nextIndex);
      setStatus("solved");
      setMessage("Correct! Puzzle solved.");
      setStreak((s) => s + 1);
      setSolvedCount((c) => c + 1);
      setAttempted((a) => a + 1);
      playGameSound({ win: true });
      return;
    }

    const after = playOpponentReply(chess, nextIndex, puzzle);
    chess = after.chess;
    nextIndex = after.index;

    setFen(chess.fen());
    const hist = chess.history({ verbose: true });
    const last = hist[hist.length - 1];
    if (last) setLastMove({ from: last.from, to: last.to });
    setSolutionIndex(nextIndex);

    if (nextIndex >= puzzle.solution.length) {
      setStatus("solved");
      setMessage("Correct! Puzzle solved.");
      setStreak((s) => s + 1);
      setSolvedCount((c) => c + 1);
      setAttempted((a) => a + 1);
      playGameSound({ win: true });
    } else {
      setMessage("Good! Keep going…");
    }
  }

  function revealSolution() {
    if (!puzzle) return;
    setShowSolution(true);
    setStatus("failed");
    setStreak(0);

    // Play through the full line on the board
    try {
      const chess = new Chess(puzzle.fen);
      let last: { from: string; to: string } | null = null;
      for (const san of puzzle.solution) {
        const m = chess.move(san);
        if (m) last = { from: m.from, to: m.to };
      }
      setFen(chess.fen());
      setLastMove(last);
      setSolutionIndex(puzzle.solution.length);
      setMessage("Solution: " + puzzle.solution.join(" "));
    } catch {
      setMessage("Solution: " + puzzle.solution.join(" "));
    }
  }

  function requestHint() {
    if (!puzzle || status !== "playing") return;
    const next = hintLevel + 1;
    setHintLevel(next);
    if (next === 1) {
      setMessage(`Theme focus: ${puzzle.themes.join(", ")}`);
    } else if (next === 2) {
      const exp = puzzle.solution[solutionIndex] || "?";
      const pieceHint = exp[0];
      const isPawn = pieceHint === pieceHint.toLowerCase();
      setMessage(
        isPawn
          ? "Hint: a pawn move is key."
          : `Hint: move your ${
              pieceHint === "N"
                ? "knight"
                : pieceHint === "B"
                  ? "bishop"
                  : pieceHint === "R"
                    ? "rook"
                    : pieceHint === "Q"
                      ? "queen"
                      : pieceHint === "K"
                        ? "king"
                        : "piece"
            }.`
      );
    } else {
      setMessage(`Strong move starts with: ${puzzle.solution[solutionIndex]}`);
    }
  }

  if (!puzzle) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
        Loading puzzle…
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
            .game-side { width: 20rem !important; }
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

        <div className="game-side" style={{ width: "100%", maxWidth: 340 }}>
          <div className="card" style={{ padding: "1.25rem", marginBottom: "0.85rem" }}>
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
                Tactics Trainer
              </h2>
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginBottom: "0.85rem",
                fontSize: "0.8rem",
                color: "var(--muted)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Flame style={{ width: 14, height: 14, color: streak > 0 ? "#fbbf24" : undefined }} />
                Streak {streak}
              </span>
              <span>
                Solved {solvedCount}
                {attempted > 0 ? ` / ${attempted}` : ""}
              </span>
            </div>

            <div style={{ marginBottom: "0.65rem" }}>
              <div style={labelStyle}>Difficulty</div>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                {(["all", "easy", "medium", "hard"] as DiffBucket[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDiff(d)}
                    className="btn-secondary"
                    style={chipStyle(diff === d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "0.85rem" }}>
              <div style={labelStyle}>Theme</div>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  padding: "0.45rem 0.6rem",
                  color: "var(--foreground)",
                  fontSize: "0.85rem",
                }}
              >
                <option value="all">All themes ({PUZZLES.length})</option>
                {themes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                {poolSize} puzzle{poolSize === 1 ? "" : "s"} in this filter
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.75rem" }}>
              <span style={badgeMuted}>{puzzle.rating}</span>
              {puzzle.themes.map((t) => (
                <span key={t} style={badgeAccent}>
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
                <button type="button" onClick={requestHint} className="btn-secondary" style={{ width: "100%" }}>
                  <Lightbulb className="w-4 h-4" /> Hint{hintLevel > 0 ? ` (${hintLevel})` : ""}
                </button>
              )}
              {(status === "failed" || status === "solved") && (
                <button type="button" onClick={resetCurrent} className="btn-secondary" style={{ width: "100%" }}>
                  <RotateCcw className="w-4 h-4" /> Retry puzzle
                </button>
              )}
              {status === "failed" && !showSolution && (
                <button type="button" onClick={revealSolution} className="btn-secondary" style={{ width: "100%" }}>
                  <Eye className="w-4 h-4" /> Show solution
                </button>
              )}
              <button
                type="button"
                onClick={() => loadPuzzle(puzzle.id)}
                className="btn-primary"
                style={{ width: "100%" }}
              >
                <SkipForward className="w-4 h-4" /> Next Puzzle
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: "1rem 1.25rem" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
              {PUZZLES.length} puzzles · filter by theme & difficulty · build a streak
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "0.35rem",
};

const badgeMuted: React.CSSProperties = {
  fontSize: "0.7rem",
  padding: "0.15rem 0.5rem",
  borderRadius: 999,
  background: "var(--card-hover)",
  color: "var(--muted)",
};

const badgeAccent: React.CSSProperties = {
  fontSize: "0.7rem",
  padding: "0.15rem 0.5rem",
  borderRadius: 999,
  background: "rgba(129,182,76,0.15)",
  color: "var(--accent)",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "0.35rem",
    fontSize: "0.72rem",
    textTransform: "capitalize",
    background: active ? "var(--accent)" : undefined,
    color: active ? "#0a0a0a" : undefined,
    borderColor: active ? "var(--accent)" : undefined,
    fontWeight: active ? 600 : undefined,
  };
}

function useBoardWidth() {
  const [width, setWidth] = useState(480);
  useEffect(() => {
    function update() {
      setWidth(Math.max(280, Math.min(window.innerWidth - 32, 560)));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}
