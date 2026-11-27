"use client";

import { useEffect, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";

interface ChessBoardProps {
  fen?: string;
  orientation?: "white" | "black";
  onMove?: (move: Move, fen: string) => void;
  onGameOver?: (result: string) => void;
  interactive?: boolean;
  highlightSquares?: string[];
  lastMove?: { from: string; to: string } | null;
  boardWidth?: number;
  customSquareStyles?: Record<string, React.CSSProperties>;
}

export default function ChessBoard({
  fen,
  orientation = "white",
  onMove,
  onGameOver,
  interactive = true,
  highlightSquares = [],
  lastMove = null,
  boardWidth = 480,
  customSquareStyles = {},
}: ChessBoardProps) {
  const width = Math.max(280, Math.floor(boardWidth || 480));

  const [game, setGame] = useState(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  });
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [showPromotion, setShowPromotion] = useState(false);
  const [rightClicked, setRightClicked] = useState<
    Record<string, React.CSSProperties>
  >({});
  const [optionSquares, setOptionSquares] = useState<
    Record<string, React.CSSProperties>
  >({});

  // Keep board in sync with parent fen
  useEffect(() => {
    if (!fen) return;
    try {
      const next = new Chess(fen);
      setGame(next);
      setMoveFrom(null);
      setMoveTo(null);
      setOptionSquares({});
      setShowPromotion(false);
    } catch {
      /* ignore */
    }
  }, [fen]);

  function getMoveOptions(square: Square) {
    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }
    const newSquares: Record<string, React.CSSProperties> = {};
    for (const m of moves) {
      newSquares[m.to] = {
        background:
          game.get(m.to as Square) &&
          game.get(m.to as Square)?.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.2) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    }
    newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };
    setOptionSquares(newSquares);
    return true;
  }

  function onSquareClick(square: Square) {
    setRightClicked({});
    if (!interactive) return;

    // No piece selected yet
    if (!moveFrom) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        const hasMoves = getMoveOptions(square);
        if (hasMoves) setMoveFrom(square);
      }
      return;
    }

    // Clicking the same square deselects
    if (moveFrom === square) {
      setMoveFrom(null);
      setOptionSquares({});
      return;
    }

    // Attempt the move
    const moves = game.moves({
      square: moveFrom as Square,
      verbose: true,
    });
    const found = moves.find((m) => m.from === moveFrom && m.to === square);

    if (!found) {
      // Select another piece
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setMoveFrom(square);
        getMoveOptions(square);
      } else {
        setMoveFrom(null);
        setOptionSquares({});
      }
      return;
    }

    // Promotion?
    if (
      (found.color === "w" && found.piece === "p" && square[1] === "8") ||
      (found.color === "b" && found.piece === "p" && square[1] === "1")
    ) {
      setMoveTo(square);
      setShowPromotion(true);
      return;
    }

    makeMove(moveFrom, square, "q");
  }

  function makeMove(from: string, to: string, promotion: string) {
    const copy = new Chess(game.fen());
    let result: Move | null = null;
    try {
      result = copy.move({ from, to, promotion });
    } catch {
      result = null;
    }
    if (!result) {
      setMoveFrom(null);
      setMoveTo(null);
      setOptionSquares({});
      setShowPromotion(false);
      return false;
    }

    setGame(copy);
    setMoveFrom(null);
    setMoveTo(null);
    setOptionSquares({});
    setShowPromotion(false);
    onMove?.(result, copy.fen());

    if (copy.isGameOver()) {
      let outcome = "draw";
      if (copy.isCheckmate()) {
        outcome = copy.turn() === "w" ? "black" : "white";
      } else if (copy.isStalemate()) {
        outcome = "stalemate";
      }
      onGameOver?.(outcome);
    }
    return true;
  }

  function onPieceDrop(sourceSquare: string, targetSquare: string) {
    if (!interactive) return false;
    return makeMove(sourceSquare, targetSquare, "q");
  }

  // Build square styles
  const styles: Record<string, React.CSSProperties> = {
    ...optionSquares,
    ...rightClicked,
    ...customSquareStyles,
  };
  if (lastMove) {
    styles[lastMove.from] = {
      ...styles[lastMove.from],
      backgroundColor: "rgba(155, 199, 0, 0.41)",
    };
    styles[lastMove.to] = {
      ...styles[lastMove.to],
      backgroundColor: "rgba(155, 199, 0, 0.41)",
    };
  }
  for (const sq of highlightSquares) {
    styles[sq] = {
      ...styles[sq],
      backgroundColor: "rgba(255, 255, 0, 0.5)",
    };
  }

  return (
    <div
      style={{
        width,
        maxWidth: "100%",
        position: "relative",
        zIndex: 2,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--border)",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.45)",
      }}
    >
      <Chessboard
        id="PushingPawnsBoard"
        position={game.fen()}
        onSquareClick={onSquareClick}
        onPieceDrop={onPieceDrop}
        onSquareRightClick={(square) => {
          const colour = "rgba(0, 0, 255, 0.4)";
          setRightClicked((prev) => {
            const next = { ...prev };
            if (prev[square]?.backgroundColor === colour) {
              delete next[square];
            } else {
              next[square] = { backgroundColor: colour };
            }
            return next;
          });
        }}
        customSquareStyles={styles}
        boardOrientation={orientation}
        boardWidth={width}
        arePiecesDraggable={interactive}
        isDraggablePiece={({ piece }) =>
          interactive && piece[0] === game.turn()
        }
        customDarkSquareStyle={{ backgroundColor: "#779556" }}
        customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
        customBoardStyle={{ borderRadius: 4 }}
        animationDuration={150}
      />
      {showPromotion && moveFrom && moveTo && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            gap: 8,
          }}
        >
          {(["q", "r", "b", "n"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => makeMove(moveFrom, moveTo, p)}
              style={{
                fontSize: 28,
                width: 52,
                height: 52,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: "#ebecd0",
              }}
            >
              {p === "q" ? "♕" : p === "r" ? "♖" : p === "b" ? "♗" : "♘"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
