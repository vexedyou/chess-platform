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
  allowPremoves?: boolean;
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
  allowPremoves = false,
}: ChessBoardProps) {
  const [game, setGame] = useState(() => new Chess(fen));
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, React.CSSProperties>>({});

  useEffect(() => {
    if (fen && fen !== game.fen()) {
      try {
        const newGame = new Chess(fen);
        setGame(newGame);
        setMoveFrom(null);
        setOptionSquares({});
      } catch {
        // invalid fen
      }
    }
  }, [fen]);

  const checkGameOver = useCallback(
    (g: Chess) => {
      if (g.isGameOver()) {
        let result = "draw";
        if (g.isCheckmate()) {
          result = g.turn() === "w" ? "black" : "white";
        } else if (g.isStalemate()) {
          result = "stalemate";
        } else if (g.isThreefoldRepetition()) {
          result = "repetition";
        } else if (g.isInsufficientMaterial()) {
          result = "insufficient";
        }
        onGameOver?.(result);
      }
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
    moves.forEach((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to) && game.get(move.to)?.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    });
    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.4)",
    };
    setOptionSquares(newSquares);
    return true;
  }

  function onSquareClick(square: Square) {
    if (!interactive) return;
    setRightClickedSquares({});

    if (!moveFrom) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        const hasOptions = getMoveOptions(square);
        if (hasOptions) setMoveFrom(square);
      }
      return;
    }

    const moves = game.moves({ square: moveFrom, verbose: true });
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    if (!foundMove) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        getMoveOptions(square);
        setMoveFrom(square);
      } else {
        setMoveFrom(null);
        setOptionSquares({});
      }
      return;
    }

    try {
      const gameCopy = new Chess(game.fen());
      const result = gameCopy.move({
        from: moveFrom,
        to: square,
        promotion: "q",
      });

      if (result) {
        setGame(gameCopy);
        setMoveFrom(null);
        setOptionSquares({});
        onMove?.(result, gameCopy.fen());
        checkGameOver(gameCopy);
      }
    } catch {
      setMoveFrom(null);
      setOptionSquares({});
    }
  }

  function onSquareRightClick(square: Square) {
    const colour = "rgba(0, 0, 255, 0.4)";
    setRightClickedSquares({
      ...rightClickedSquares,
      [square]:
        rightClickedSquares[square] && rightClickedSquares[square].backgroundColor === colour
          ? {}
          : { backgroundColor: colour },
    });
  }

  const styles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {
      ...optionSquares,
      ...rightClickedSquares,
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

    highlightSquares.forEach((sq) => {
      s[sq] = {
        ...s[sq],
        backgroundColor: "rgba(255, 255, 0, 0.5)",
      };
    });

    return s;
  }, [optionSquares, rightClickedSquares, customSquareStyles, lastMove, highlightSquares]);

  return (
    <div className="rounded-lg overflow-hidden shadow-2xl border border-zinc-700">
      <Chessboard
        position={game.fen()}
        onSquareClick={onSquareClick}
        onSquareRightClick={onSquareRightClick}
        customSquareStyles={styles}
        boardOrientation={orientation}
        boardWidth={boardWidth}
        arePiecesDraggable={false}
        customDarkSquareStyle={{ backgroundColor: "#779556" }}
        customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
        customBoardStyle={{
          borderRadius: "4px",
        }}
      />
    </div>
  );
}
