"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const safeWidth = Math.max(280, Math.floor(boardWidth || 480));

  const chessRef = useRef<Chess>(new Chess(fen || undefined));
  const [position, setPosition] = useState(fen || chessRef.current.fen());
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<
    Record<string, React.CSSProperties>
  >({});
  const [boardKey, setBoardKey] = useState(0);
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  useEffect(() => {
    if (!fen) return;
    try {
      if (fen !== chessRef.current.fen()) {
        chessRef.current = new Chess(fen);
        setPosition(fen);
        setMoveFrom(null);
        setOptionSquares({});
      }
    } catch {
      /* ignore */
    }
  }, [fen]);

  useEffect(() => {
    setBoardKey((k) => k + 1);
    setMoveFrom(null);
    setOptionSquares({});
  }, [interactive]);

  function clearSelection() {
    setMoveFrom(null);
    setOptionSquares({});
  }

  function showMovesFrom(square: Square) {
    const game = chessRef.current;
    const moves = game.moves({ square, verbose: true });
    if (!moves.length) {
      clearSelection();
      return false;
    }
    const styles: Record<string, React.CSSProperties> = {};
    for (const m of moves) {
      const target = game.get(m.to as Square);
      styles[m.to] = {
        background:
          target && target.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.18) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.18) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    }
    styles[square] = { background: "rgba(255, 255, 0, 0.45)" };
    setOptionSquares(styles);
    setMoveFrom(square);
    return true;
  }

  function applyMove(from: Square, to: Square): boolean {
    if (!interactiveRef.current) return false;
    const game = chessRef.current;
    let result: Move | null = null;
    try {
      result = game.move({ from, to, promotion: "q" });
    } catch {
      result = null;
    }
    if (!result) return false;

    const newFen = game.fen();
    setPosition(newFen);
    clearSelection();
    onMove?.(result, newFen);

    if (game.isGameOver()) {
      let outcome = "draw";
      if (game.isCheckmate()) {
        outcome = game.turn() === "w" ? "black" : "white";
      } else if (game.isStalemate()) {
        outcome = "stalemate";
      }
      onGameOver?.(outcome);
    }
    return true;
  }

  function onSquareClick(square: Square) {
    if (!interactiveRef.current) return;
    const game = chessRef.current;

    if (!moveFrom) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        showMovesFrom(square);
      }
      return;
    }

    if (moveFrom === square) {
      clearSelection();
      return;
    }

    const moved = applyMove(moveFrom, square);
    if (!moved) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        showMovesFrom(square);
      } else {
        clearSelection();
      }
    }
  }

  function onPieceDragBegin(_piece: string, sourceSquare: Square) {
    if (!interactiveRef.current) return;
    const game = chessRef.current;
    const piece = game.get(sourceSquare);
    if (piece && piece.color === game.turn()) {
      showMovesFrom(sourceSquare);
    }
  }

  function onPieceDrop(sourceSquare: string, targetSquare: string) {
    if (!interactiveRef.current) return false;
    const ok = applyMove(sourceSquare as Square, targetSquare as Square);
    if (!ok) clearSelection();
    return ok;
  }

  const styles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {
      ...optionSquares,
      ...customSquareStyles,
    };
    if (lastMove) {
      s[lastMove.from] = {
        ...s[lastMove.from],
        backgroundColor: "rgba(155, 199, 0, 0.41)",
      };
      s[lastMove.to] = {
        ...s[lastMove.to],
        backgroundColor: "rgba(155, 199, 0, 0.41)",
      };
    }
    for (const sq of highlightSquares) {
      s[sq] = { ...s[sq], backgroundColor: "rgba(255, 255, 0, 0.5)" };
    }
    return s;
  }, [optionSquares, customSquareStyles, lastMove, highlightSquares]);

  // Recompute turn for isDraggablePiece when position changes
  const turn = position.split(" ")[1] === "b" ? "b" : "w";

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        width: safeWidth,
        maxWidth: "100%",
        pointerEvents: "auto",
        position: "relative",
        zIndex: 1,
        overflow: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
      }}
    >
      <Chessboard
        key={`board-${boardKey}-${safeWidth}`}
        id="pushing-pawns-board"
        position={position}
        onSquareClick={onSquareClick}
        onPieceDrop={onPieceDrop}
        onPieceDragBegin={onPieceDragBegin}
        customSquareStyles={styles}
        boardOrientation={orientation}
        boardWidth={safeWidth}
        arePiecesDraggable={!!interactive}
        isDraggablePiece={({ piece }) => !!interactive && piece[0] === turn}
        customDarkSquareStyle={{ backgroundColor: "#779556" }}
        customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
        customBoardStyle={{ borderRadius: "4px" }}
        animationDuration={120}
      />
    </div>
  );
}
