"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, Move, Square } from "chess.js";
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
  const [game, setGame] = useState(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  });
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<
    Record<string, React.CSSProperties>
  >({});

  useEffect(() => {
    if (!fen) return;
    try {
      if (fen !== game.fen()) {
        setGame(new Chess(fen));
        setMoveFrom(null);
        setOptionSquares({});
      }
    } catch {
      // ignore invalid fen
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  const checkGameOver = useCallback(
    (g: Chess) => {
      if (!g.isGameOver()) return;
      let result = "draw";
      if (g.isCheckmate()) {
        result = g.turn() === "w" ? "black" : "white";
      } else if (g.isStalemate()) {
        result = "stalemate";
      } else if (g.isThreefoldRepetition()) {
        result = "repetition";
      } else if (g.isInsufficientMaterial()) {
        result = "insufficient";
      } else if (g.isDraw()) {
        result = "draw";
      }
      onGameOver?.(result);
    },
    [onGameOver]
  );

  function getMoveOptions(square: Square) {
    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }
    const newSquares: Record<string, React.CSSProperties> = {};
    for (const m of moves) {
      const target = game.get(m.to as Square);
      newSquares[m.to] = {
        background:
          target && target.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.12) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.12) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    }
    newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };
    setOptionSquares(newSquares);
    return true;
  }

  function tryMove(from: Square, to: Square): boolean {
    if (!interactive) return false;
    try {
      const copy = new Chess(game.fen());
      const result = copy.move({ from, to, promotion: "q" });
      if (!result) return false;
      setGame(copy);
      setMoveFrom(null);
      setOptionSquares({});
      onMove?.(result, copy.fen());
      checkGameOver(copy);
      return true;
    } catch {
      return false;
    }
  }

  function onSquareClick(square: Square) {
    if (!interactive) return;

    if (!moveFrom) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        if (getMoveOptions(square)) setMoveFrom(square);
      }
      return;
    }

    if (moveFrom === square) {
      setMoveFrom(null);
      setOptionSquares({});
      return;
    }

    const moved = tryMove(moveFrom, square);
    if (!moved) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        getMoveOptions(square);
        setMoveFrom(square);
      } else {
        setMoveFrom(null);
        setOptionSquares({});
      }
    }
  }

  function onPieceDragBegin(_piece: string, sourceSquare: Square) {
    if (!interactive) return;
    const piece = game.get(sourceSquare);
    if (piece && piece.color === game.turn()) {
      getMoveOptions(sourceSquare);
      setMoveFrom(sourceSquare);
    }
  }

  function onPieceDrop(sourceSquare: Square, targetSquare: Square) {
    if (!interactive) return false;
    const ok = tryMove(sourceSquare, targetSquare);
    if (!ok) {
      setMoveFrom(null);
      setOptionSquares({});
    }
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

  return (
    <div
      className="rounded-lg overflow-hidden shadow-2xl"
      style={{ border: "1px solid var(--border)" }}
    >
      <Chessboard
        position={game.fen()}
        onSquareClick={onSquareClick}
        onPieceDrop={onPieceDrop}
        onPieceDragBegin={onPieceDragBegin}
        customSquareStyles={styles}
        boardOrientation={orientation}
        boardWidth={boardWidth}
        arePiecesDraggable={interactive}
        isDraggablePiece={({ piece }) =>
          interactive && piece[0] === game.turn()
        }
        customDarkSquareStyle={{ backgroundColor: "#779556" }}
        customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
        customBoardStyle={{ borderRadius: "4px" }}
        animationDuration={150}
      />
    </div>
  );
}
