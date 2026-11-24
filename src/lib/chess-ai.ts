import { Chess, Move, Square } from "chess.js";

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const PAWN_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];
const KNIGHT_TABLE = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];
const BISHOP_TABLE = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
];
const ROOK_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
];
const QUEEN_TABLE = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
];
const KING_TABLE = [
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
];

function getSquareIndex(square: Square, isWhite: boolean): number {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  const idx = rank * 8 + file;
  return isWhite ? idx : 63 - idx;
}

function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) return chess.turn() === "w" ? -99999 : 99999;
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) return 0;

  let score = 0;
  const board = chess.board();

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) continue;
      const isWhite = piece.color === "w";
      const type = piece.type;
      const value = PIECE_VALUES[type] || 0;
      const square = (String.fromCharCode(97 + file) + (8 - rank)) as Square;
      const idx = getSquareIndex(square, isWhite);
      let pst = 0;
      switch (type) {
        case "p": pst = PAWN_TABLE[idx]; break;
        case "n": pst = KNIGHT_TABLE[idx]; break;
        case "b": pst = BISHOP_TABLE[idx]; break;
        case "r": pst = ROOK_TABLE[idx]; break;
        case "q": pst = QUEEN_TABLE[idx]; break;
        case "k": pst = KING_TABLE[idx]; break;
      }
      score += isWhite ? value + pst : -(value + pst);
    }
  }
  return score;
}

/** Captures / checks first so alpha-beta prunes faster. */
function orderedMoves(chess: Chess): Move[] {
  const moves = chess.moves({ verbose: true });
  moves.sort((a, b) => {
    const capA = a.captured ? PIECE_VALUES[a.captured] || 0 : 0;
    const capB = b.captured ? PIECE_VALUES[b.captured] || 0 : 0;
    if (capA !== capB) return capB - capA;
    const promo = (m: Move) => (m.promotion === "q" ? 1 : 0);
    return promo(b) - promo(a);
  });
  return moves;
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean
): number {
  if (depth === 0 || chess.isGameOver()) return evaluateBoard(chess);

  const moves = orderedMoves(chess);
  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const evalScore = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  }
  let minEval = Infinity;
  for (const move of moves) {
    chess.move(move);
    const evalScore = minimax(chess, depth - 1, alpha, beta, true);
    chess.undo();
    minEval = Math.min(minEval, evalScore);
    beta = Math.min(beta, evalScore);
    if (beta <= alpha) break;
  }
  return minEval;
}

export function getBestMove(chess: Chess, depth: number = 2): Move | null {
  if (chess.isGameOver()) return null;
  const moves = orderedMoves(chess);
  if (moves.length === 0) return null;

  let bestMove: Move | null = null;
  let bestScore = chess.turn() === "w" ? -Infinity : Infinity;
  const maximizing = chess.turn() === "w";

  for (const move of moves) {
    chess.move(move);
    const score = minimax(chess, depth - 1, -Infinity, Infinity, !maximizing);
    chess.undo();
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

export function rankMoves(chess: Chess, depth: number = 0): { move: Move; score: number }[] {
  const moves = orderedMoves(chess);
  const maximizing = chess.turn() === "w";
  const ranked: { move: Move; score: number }[] = [];
  for (const move of moves) {
    chess.move(move);
    const score =
      depth <= 0
        ? evaluateBoard(chess)
        : minimax(chess, depth - 1, -Infinity, Infinity, !maximizing);
    chess.undo();
    ranked.push({ move, score });
  }
  ranked.sort((a, b) => (maximizing ? b.score - a.score : a.score - b.score));
  return ranked;
}

export type Difficulty = "beginner" | "easy" | "medium" | "hard";

export function getAIMove(chess: Chess, difficulty: Difficulty): Move | null {
  if (chess.isGameOver()) return null;
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  if (difficulty === "beginner") {
    if (Math.random() < 0.55) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    const ranked = rankMoves(chess, 0);
    const pool = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 2)));
    return pool[Math.floor(Math.random() * pool.length)]?.move ?? moves[0];
  }

  if (difficulty === "easy") {
    if (Math.random() < 0.25) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    return getBestMove(chess, 1);
  }

  // medium = depth 1 (fast), hard = depth 2 (still responsive)
  if (difficulty === "medium") return getBestMove(chess, 1);
  return getBestMove(chess, 2);
}

export function getHintMove(chess: Chess): Move | null {
  return getBestMove(chess, 1);
}
