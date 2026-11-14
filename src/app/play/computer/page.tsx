"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import { getAIMove, Difficulty } from "@/lib/chess-ai";
import { RotateCcw, Flag, Bot } from "lucide-react";

export default function PlayComputerPage() {
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const [status, setStatus] = useState("Your turn");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const chessRef = useRef(new Chess());
  const boardWidth = useBoardWidth();

  const makeAIMove = useCallback(() => {
    const chess = chessRef.current;
    if (chess.isGameOver() || chess.turn() === playerColor) return;

    setThinking(true);
    setStatus("Computer is thinking...");

    setTimeout(() => {
      const move = getAIMove(chess, difficulty);
      if (move) {
        chess.move(move);
        setFen(chess.fen());
        setLastMove({ from: move.from, to: move.to });
        setHistory((h) => [...h, move.san]);
        if (chess.isGameOver()) {
          handleGameOverFromChess(chess);
        } else {
          setStatus("Your turn");
        }
      }
      setThinking(false);
    }, 300 + Math.random() * 400);
  }, [difficulty, playerColor]);

  useEffect(() => {
    const chess = chessRef.current;
    if (!gameOver && chess.turn() !== playerColor && !thinking) {
      makeAIMove();
    }
  }, [fen, gameOver, playerColor, thinking, makeAIMove]);

  function handleMove(move: Move, newFen: string) {
    chessRef.current = new Chess(newFen);
    setFen(newFen);
    setLastMove({ from: move.from, to: move.to });
    setHistory((h) => [...h, move.san]);
  }

  function handleGameOver(result: string) {
    setGameOver(true);
    if (result === "white") {
      setStatus(playerColor === "w" ? "You win by checkmate!" : "Computer wins by checkmate");
    } else if (result === "black") {
      setStatus(playerColor === "b" ? "You win by checkmate!" : "Computer wins by checkmate");
    } else {
      setStatus(`Game drawn (${result})`);
    }
  }

  function handleGameOverFromChess(chess: Chess) {
    if (chess.isCheckmate()) {
      handleGameOver(chess.turn() === "w" ? "black" : "white");
    } else {
      handleGameOver("draw");
    }
  }

  function newGame(asWhite = true) {
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
    setGameOver(true);
    setStatus("You resigned. Computer wins.");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="board-container mx-auto lg:mx-0">
          <ChessBoard
            fen={fen}
            orientation={orientation}
            onMove={handleMove}
            onGameOver={handleGameOver}
            interactive={!gameOver && !thinking && chessRef.current.turn() === playerColor}
            lastMove={lastMove}
            boardWidth={boardWidth}
          />
        </div>

        <div className="w-full lg:w-80 space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="font-semibold text-lg">vs Computer</h2>
            </div>

            <div className="mb-4">
              <p className={`text-sm font-medium ${thinking ? "text-[var(--accent)] animate-pulse-soft" : ""}`}>
                {status}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--muted)] uppercase tracking-wide">Difficulty</label>
                <div className="flex gap-2 mt-1">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      disabled={!gameOver && history.length > 0}
                      className={`flex-1 py-1.5 rounded text-sm capitalize transition-colors ${
                        difficulty === d
                          ? "bg-[var(--accent)] text-black font-medium"
                          : "bg-[var(--card-hover)] text-[var(--muted)] hover:text-white"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => newGame(true)} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
                  <RotateCcw className="w-4 h-4" /> New (White)
                </button>
                <button onClick={() => newGame(false)} className="btn-secondary flex-1 text-sm">
                  New (Black)
                </button>
              </div>

              {!gameOver && history.length > 0 && (
                <button onClick={resign} className="btn-ghost w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:text-red-300">
                  <Flag className="w-4 h-4" /> Resign
                </button>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-medium text-sm text-[var(--muted)] mb-3">Moves</h3>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No moves yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono max-h-64 overflow-y-auto">
                {history.map((san, i) => (
                  <div key={i} className="flex gap-2">
                    {i % 2 === 0 && (
                      <span className="text-[var(--muted)] w-6">{Math.floor(i / 2) + 1}.</span>
                    )}
                    <span>{san}</span>
                  </div>
                ))}
              </div>
            )}
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
      const w = Math.min(window.innerWidth - 32, 520);
      setWidth(Math.max(280, w));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}
