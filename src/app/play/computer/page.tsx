"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import MoveHistory, {
  fenAfterMoves,
  lastMoveAt,
} from "@/components/MoveHistory";
import GameBanner, { type BannerKind } from "@/components/GameBanner";
import { getAIMove, getHintMove, Difficulty } from "@/lib/chess-ai";
import { playGameSound } from "@/lib/sounds";
import { useBoardWidth } from "@/lib/useBoardWidth";
import { RotateCcw, Flag, Bot, Undo2, Lightbulb, Handshake } from "lucide-react";

const START =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function PlayComputerPage() {
  const [fen, setFen] = useState(START);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const [status, setStatus] = useState("Your turn");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [viewIndex, setViewIndex] = useState(-1);
  const [hintMove, setHintMove] = useState<{ from: string; to: string } | null>(null);
  const [banner, setBanner] = useState<{
    kind: BannerKind;
    title: string;
    subtitle?: string;
  } | null>(null);

  // Single source of truth — never rebuild from FEN alone (loses history)
  const chessRef = useRef(new Chess());
  const playerColorRef = useRef<"w" | "b">("w");
  const gameOverRef = useRef(false);
  const thinkingRef = useRef(false);
  const aiJobRef = useRef(0);
  const boardWidth = useBoardWidth(720);

  useEffect(() => {
    playerColorRef.current = playerColor;
  }, [playerColor]);
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  const viewingPast = viewIndex >= 0 && viewIndex < history.length - 1;
  const displayFen = viewingPast ? fenAfterMoves(history, viewIndex) : fen;
  const displayLast = viewingPast ? lastMoveAt(history, viewIndex) : lastMove ?? hintMove;

  const syncFromChess = useCallback(() => {
    const chess = chessRef.current;
    setFen(chess.fen());
    setHistory(chess.history());
    const verbose = chess.history({ verbose: true });
    const last = verbose[verbose.length - 1];
    setLastMove(last ? { from: last.from, to: last.to } : null);
    setViewIndex(-1);
  }, []);

  const finishGame = useCallback(
    (kind: "win" | "lose" | "draw", title: string, subtitle?: string) => {
      gameOverRef.current = true;
      setGameOver(true);
      setStatus(title);
      setBanner({ kind, title, subtitle });
      setHintMove(null);
      thinkingRef.current = false;
      setThinking(false);
      playGameSound({
        win: kind === "win",
        lose: kind === "lose",
        draw: kind === "draw",
      });
    },
    []
  );

  const scheduleAIMove = useCallback(() => {
    const chess = chessRef.current;
    if (
      gameOverRef.current ||
      chess.isGameOver() ||
      chess.turn() === playerColorRef.current ||
      thinkingRef.current
    ) {
      return;
    }

    const jobId = ++aiJobRef.current;
    thinkingRef.current = true;
    setThinking(true);
    setStatus("Computer is thinking…");
    setHintMove(null);

    // Tiny delay only for UX — search itself is the main cost
    const delay =
      difficulty === "hard" ? 50 : difficulty === "medium" ? 30 : 10;

    setTimeout(() => {
      if (jobId !== aiJobRef.current) return;

      const move = getAIMove(chess, difficulty);
      if (jobId !== aiJobRef.current) return;

      if (move) {
        const captured = !!chess.get(move.to);
        chess.move(move);
        syncFromChess();

        if (chess.isCheckmate()) {
          finishGame("lose", "Checkmate", "Computer wins. Better luck next game.");
        } else if (chess.isDraw()) {
          finishGame("draw", "Draw", drawReason(chess));
        } else if (chess.isCheck()) {
          setStatus("Check! Your turn");
          playGameSound({ check: true });
        } else {
          setStatus("Your turn");
          playGameSound({ capture: captured });
        }
      }

      if (jobId === aiJobRef.current) {
        thinkingRef.current = false;
        setThinking(false);
      }
    }, delay);
  }, [difficulty, finishGame, syncFromChess]);

  // Trigger AI when it's not the player's turn
  useEffect(() => {
    if (gameOver || thinking) return;
    const chess = chessRef.current;
    if (chess.turn() !== playerColor && !chess.isGameOver()) {
      scheduleAIMove();
    }
  }, [fen, gameOver, thinking, playerColor, scheduleAIMove]);

  function handleMove(move: Move, _newFen: string) {
    const chess = chessRef.current;
    // Apply on the SAME instance (board already validated the move)
    // ChessBoard may have moved on its own copy — re-apply if needed
    if (chess.fen() !== _newFen) {
      try {
        const applied = chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || "q",
        });
        if (!applied) {
          // Recover by loading FEN but then we lose history — rebuild from SAN list
          return;
        }
      } catch {
        return;
      }
    }

    setHintMove(null);
    syncFromChess();

    if (chess.isCheckmate()) {
      finishGame("win", "Checkmate — You win!", "Nice finish.");
    } else if (chess.isDraw()) {
      finishGame("draw", "Draw", drawReason(chess));
    } else if (chess.isCheck()) {
      setStatus("Check! Computer thinking…");
      playGameSound({ check: true });
    } else {
      setStatus("Computer is thinking…");
      playGameSound({ capture: !!move.captured });
    }
  }

  function newGame(asWhite = true) {
    aiJobRef.current += 1;
    thinkingRef.current = false;
    gameOverRef.current = false;
    const chess = new Chess();
    chessRef.current = chess;
    playerColorRef.current = asWhite ? "w" : "b";
    setFen(chess.fen());
    setPlayerColor(asWhite ? "w" : "b");
    setOrientation(asWhite ? "white" : "black");
    setLastMove(null);
    setHistory([]);
    setViewIndex(-1);
    setGameOver(false);
    setThinking(false);
    setBanner(null);
    setHintMove(null);
    setStatus(asWhite ? "Your turn" : "Computer is thinking…");
  }

  function resign() {
    if (gameOverRef.current) return;
    finishGame("lose", "You resigned", "Computer wins.");
  }

  function offerDraw() {
    if (gameOverRef.current || thinkingRef.current) return;
    const accept =
      difficulty === "beginner" ||
      difficulty === "easy" ||
      Math.random() < 0.35;
    if (accept) {
      finishGame("draw", "Draw agreed", "Computer accepted the draw.");
    } else {
      setStatus("Draw declined — your turn");
    }
  }

  function undo() {
    const chess = chessRef.current;
    const verbose = chess.history({ verbose: true });
    if (verbose.length === 0) return;

    const playerHasMoved = verbose.some((m) => m.color === playerColorRef.current);
    if (!playerHasMoved) {
      setStatus("Nothing to undo yet");
      return;
    }

    // Cancel pending AI
    aiJobRef.current += 1;
    thinkingRef.current = false;
    setThinking(false);

    // Pop until we've removed the player's last move and it's player's turn
    // Standard: undo bot reply (if present) + player move
    if (chess.turn() === playerColorRef.current) {
      // Last move was bot's — undo 2
      if (verbose.length >= 2) {
        chess.undo();
        chess.undo();
      }
    } else {
      // Last move was player's (AI cancelled) — undo 1
      chess.undo();
    }

    // Safety: keep undoing until player to move or empty
    while (
      chess.history().length > 0 &&
      chess.turn() !== playerColorRef.current
    ) {
      chess.undo();
    }

    gameOverRef.current = false;
    setGameOver(false);
    setBanner(null);
    setHintMove(null);
    syncFromChess();
    setStatus("Your turn — move taken back");
  }

  function showHint() {
    if (gameOverRef.current || thinkingRef.current) return;
    const chess = chessRef.current;
    if (chess.turn() !== playerColorRef.current) return;
    const move = getHintMove(chess);
    if (move) {
      setHintMove({ from: move.from, to: move.to });
      setStatus(`Hint: ${move.san}`);
    }
  }

  const canMove =
    !gameOver &&
    !thinking &&
    !viewingPast &&
    chessRef.current.turn() === playerColor;

  const canUndo =
    !gameOver &&
    history.some((_, i) => (i % 2 === 0 ? "w" : "b") === playerColor);

  return (
    <div className="page-wrap" style={{ paddingTop: "1.25rem", paddingBottom: "2rem" }}>
      <div
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center" }}
        className="game-layout"
      >
        <style>{`
          @media (min-width: 1100px) {
            .game-layout { flex-direction: row !important; align-items: flex-start !important; justify-content: center; gap: 1.75rem !important; }
            .game-side { width: 20rem !important; }
          }
        `}</style>

        <div className="board-container">
          <ChessBoard
            fen={displayFen}
            orientation={orientation}
            onMove={handleMove}
            interactive={canMove}
            lastMove={displayLast}
            boardWidth={boardWidth}
          />
        </div>

        <div className="game-side" style={{ width: "100%", maxWidth: 340 }}>
          {banner && (
            <GameBanner
              kind={banner.kind}
              title={banner.title}
              subtitle={banner.subtitle}
              actionLabel="New game"
              onAction={() => newGame(playerColor === "w")}
              onDismiss={() => setBanner(null)}
            />
          )}

          <div className="card" style={{ padding: "1.2rem", marginBottom: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.65rem" }}>
              <Bot style={{ width: 20, height: 20, color: "var(--accent)" }} />
              <h2 style={{ fontWeight: 600, fontSize: "1.1rem", margin: 0 }}>vs Computer</h2>
            </div>

            <p
              style={{
                fontSize: "0.9rem",
                fontWeight: 500,
                marginBottom: "0.9rem",
                color: thinking ? "var(--accent)" : undefined,
              }}
              className={thinking ? "animate-pulse-soft" : ""}
            >
              {viewingPast ? "Viewing past move" : status}
            </p>

            <div style={{ marginBottom: "0.7rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
                Difficulty
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {(["beginner", "easy", "medium", "hard"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    disabled={!gameOver && history.length > 0}
                    className="btn-secondary"
                    style={{
                      flex: "1 1 40%",
                      padding: "0.4rem",
                      fontSize: "0.75rem",
                      textTransform: "capitalize",
                      background: difficulty === d ? "var(--accent)" : undefined,
                      color: difficulty === d ? "#0a0a0a" : undefined,
                      borderColor: difficulty === d ? "var(--accent)" : undefined,
                      fontWeight: difficulty === d ? 600 : undefined,
                      opacity: !gameOver && history.length > 0 ? 0.55 : 1,
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.4rem" }}>
              <button type="button" onClick={() => newGame(true)} className="btn-secondary" style={{ flex: 1, fontSize: "0.8rem" }}>
                <RotateCcw className="w-3.5 h-3.5" /> White
              </button>
              <button type="button" onClick={() => newGame(false)} className="btn-secondary" style={{ flex: 1, fontSize: "0.8rem" }}>
                Black
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.35rem" }}>
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="btn-secondary"
                style={{ flex: 1, fontSize: "0.8rem" }}
                title="Take back your last move"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              <button
                type="button"
                onClick={showHint}
                disabled={gameOver || thinking || !canMove}
                className="btn-secondary"
                style={{ flex: 1, fontSize: "0.8rem" }}
              >
                <Lightbulb className="w-3.5 h-3.5" /> Hint
              </button>
            </div>

            {!gameOver && history.length > 0 && (
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <button type="button" onClick={offerDraw} disabled={thinking} className="btn-ghost" style={{ flex: 1, fontSize: "0.8rem" }}>
                  <Handshake className="w-3.5 h-3.5" /> Draw
                </button>
                <button type="button" onClick={resign} className="btn-ghost" style={{ flex: 1, color: "#f87171", fontSize: "0.8rem" }}>
                  <Flag className="w-3.5 h-3.5" /> Resign
                </button>
              </div>
            )}
          </div>

          <MoveHistory history={history} viewIndex={viewIndex} onViewIndex={setViewIndex} />
        </div>
      </div>
    </div>
  );
}

function drawReason(chess: Chess) {
  if (chess.isStalemate()) return "Stalemate";
  if (chess.isThreefoldRepetition()) return "Threefold repetition";
  if (chess.isInsufficientMaterial()) return "Insufficient material";
  return "Agreed by the rules";
}
