"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import { getAIMove, Difficulty } from "@/lib/chess-ai";
import { RotateCcw, Flag, Bot } from "lucide-react";

const START =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function PlayComputerPage() {
  const [fen, setFen] = useState(START);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const [status, setStatus] = useState("Your turn");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(
    null
  );
  const [gameOver, setGameOver] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const chessRef = useRef(new Chess());
  const thinkingRef = useRef(false);
  const boardWidth = useBoardWidth();

  const describePosition = useCallback(
    (chess: Chess, forPlayer: boolean) => {
      if (chess.isCheckmate()) {
        const winner = chess.turn() === "w" ? "b" : "w";
        return winner === playerColor
          ? "You win by checkmate!"
          : "Computer wins by checkmate";
      }
      if (chess.isStalemate()) return "Draw by stalemate";
      if (chess.isThreefoldRepetition()) return "Draw by repetition";
      if (chess.isInsufficientMaterial()) return "Draw by insufficient material";
      if (chess.isDraw()) return "Draw";
      if (chess.isCheck()) {
        return forPlayer ? "Check! Your turn" : "Check! Computer thinking...";
      }
      return forPlayer ? "Your turn" : "Computer is thinking...";
    },
    [playerColor]
  );

  const makeAIMove = useCallback(() => {
    const chess = chessRef.current;
    if (
      chess.isGameOver() ||
      chess.turn() === playerColor ||
      thinkingRef.current
    ) {
      return;
    }

    thinkingRef.current = true;
    setThinking(true);
    setStatus("Computer is thinking...");

    const delay = difficulty === "hard" ? 450 : difficulty === "medium" ? 280 : 150;

    setTimeout(() => {
      const move = getAIMove(chess, difficulty);
      if (move) {
        chess.move(move);
        setFen(chess.fen());
        setLastMove({ from: move.from, to: move.to });
        setHistory((h) => [...h, move.san]);

        if (chess.isGameOver()) {
          setGameOver(true);
          setStatus(describePosition(chess, false));
        } else {
          setStatus(describePosition(chess, true));
        }
      }
      thinkingRef.current = false;
      setThinking(false);
    }, delay + Math.random() * 200);
  }, [difficulty, playerColor, describePosition]);

  useEffect(() => {
    const chess = chessRef.current;
    if (!gameOver && chess.turn() !== playerColor && !thinkingRef.current) {
      makeAIMove();
    }
  }, [fen, gameOver, playerColor, makeAIMove]);

  function handleMove(move: Move, newFen: string) {
    const chess = new Chess(newFen);
    chessRef.current = chess;
    setFen(newFen);
    setLastMove({ from: move.from, to: move.to });
    setHistory((h) => [...h, move.san]);

    if (chess.isGameOver()) {
      setGameOver(true);
      setStatus(describePosition(chess, true));
    } else {
      setStatus(describePosition(chess, false));
    }
  }

  function handleGameOver(result: string) {
    if (gameOver) return;
    setGameOver(true);
    if (result === "white" || result === "black") {
      const won =
        (result === "white" && playerColor === "w") ||
        (result === "black" && playerColor === "b");
      setStatus(won ? "You win by checkmate!" : "Computer wins by checkmate");
    } else {
      setStatus(`Draw (${result})`);
    }
  }

  function newGame(asWhite = true) {
    thinkingRef.current = false;
    const chess = new Chess();
    chessRef.current = chess;
    setFen(chess.fen());
    setPlayerColor(asWhite ? "w" : "b");
    setOrientation(asWhite ? "white" : "black");
    setLastMove(null);
    setHistory([]);
    setGameOver(false);
    setThinking(false);
    setStatus(asWhite ? "Your turn" : "Computer is thinking...");
  }

  function resign() {
    if (gameOver) return;
    setGameOver(true);
    setStatus("You resigned. Computer wins.");
  }

  const canMove =
    !gameOver && !thinking && chessRef.current.turn() === playerColor;

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
            onGameOver={handleGameOver}
            interactive={canMove}
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
              <Bot style={{ width: 20, height: 20, color: "var(--accent)" }} />
              <h2 style={{ fontWeight: 600, fontSize: "1.1rem", margin: 0 }}>
                vs Computer
              </h2>
            </div>

            <p
              style={{
                fontSize: "0.9rem",
                fontWeight: 500,
                marginBottom: "1rem",
                color: thinking ? "var(--accent)" : undefined,
              }}
              className={thinking ? "animate-pulse-soft" : ""}
            >
              {status}
            </p>

            <div style={{ marginBottom: "0.75rem" }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "0.35rem",
                }}
              >
                Difficulty
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    disabled={!gameOver && history.length > 0}
                    className="btn-secondary"
                    style={{
                      flex: 1,
                      padding: "0.4rem",
                      fontSize: "0.8rem",
                      textTransform: "capitalize",
                      background:
                        difficulty === d ? "var(--accent)" : undefined,
                      color: difficulty === d ? "#0a0a0a" : undefined,
                      borderColor: difficulty === d ? "var(--accent)" : undefined,
                      fontWeight: difficulty === d ? 600 : undefined,
                      opacity: !gameOver && history.length > 0 ? 0.6 : 1,
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
              <button
                onClick={() => newGame(true)}
                className="btn-secondary"
                style={{ flex: 1, fontSize: "0.8rem" }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> White
              </button>
              <button
                onClick={() => newGame(false)}
                className="btn-secondary"
                style={{ flex: 1, fontSize: "0.8rem" }}
              >
                Black
              </button>
            </div>

            {!gameOver && history.length > 0 && (
              <button
                onClick={resign}
                className="btn-ghost"
                style={{ width: "100%", color: "#f87171", fontSize: "0.8rem" }}
              >
                <Flag className="w-3.5 h-3.5" /> Resign
              </button>
            )}
          </div>

          <MoveList history={history} />
        </div>
      </div>
    </div>
  );
}

function MoveList({ history }: { history: string[] }) {
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
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
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.2rem 0.75rem",
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "0.85rem",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {history.map((san, i) => (
            <div key={i} style={{ display: "flex", gap: "0.3rem" }}>
              {i % 2 === 0 && (
                <span style={{ color: "var(--muted)", minWidth: 20 }}>
                  {Math.floor(i / 2) + 1}.
                </span>
              )}
              <span>{san}</span>
            </div>
          ))}
        </div>
      )}
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
