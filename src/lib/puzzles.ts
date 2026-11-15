export interface Puzzle {
  id: string;
  fen: string;
  /** Player moves (side to move in FEN). Opponent replies are automatic. */
  solution: string[];
  rating: number;
  themes: string[];
  description: string;
}

export const PUZZLES: Puzzle[] = [
  {
    id: "1",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    solution: ["Qxf7#"],
    rating: 600,
    themes: ["mate", "opening"],
    description: "Scholar's mate — deliver checkmate.",
  },
  {
    id: "2",
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    solution: ["Re8#"],
    rating: 500,
    themes: ["mate", "backrank"],
    description: "Classic back-rank mate.",
  },
  {
    id: "3",
    fen: "2r3k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1",
    solution: ["Rb8", "Rxb8", "Rxb8#"],
    rating: 800,
    themes: ["mate", "deflection"],
    description: "Deflect the rook, then mate on the back rank.",
  },
  {
    id: "4",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    solution: ["Ng5"],
    rating: 900,
    themes: ["attack", "opening"],
    description: "Start the Fried Liver idea — knight to g5.",
  },
  {
    id: "5",
    fen: "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    solution: ["Nxe4"],
    rating: 1000,
    themes: ["tactic", "fork"],
    description: "Punish the early bishop — take the center pawn.",
  },
  {
    id: "6",
    fen: "5k2/8/8/8/8/8/4R3/4K3 w - - 0 1",
    solution: ["Re8#"],
    rating: 400,
    themes: ["mate", "endgame"],
    description: "King and rook mate on the back rank.",
  },
  {
    id: "7",
    fen: "6k1/5ppp/8/8/8/8/4QPPP/6K1 w - - 0 1",
    solution: ["Qe8#"],
    rating: 550,
    themes: ["mate"],
    description: "Queen delivers mate on the back rank.",
  },
  {
    id: "8",
    fen: "r3k2r/ppp2ppp/2n5/3pP3/2BP4/2P2N2/P1P2PPP/R3K2R w KQkq - 0 1",
    solution: ["Bxd5"],
    rating: 1100,
    themes: ["tactic", "pin"],
    description: "Win material by exploiting the pin.",
  },
  {
    id: "9",
    fen: "2kr3r/ppp2ppp/2n5/3q4/3P4/2P2N2/PP3PPP/R2QK2R w KQ - 0 1",
    solution: ["c4"],
    rating: 1050,
    themes: ["tactic", "discovered"],
    description: "Gain a tempo on the queen and open lines.",
  },
  {
    id: "10",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5",
    solution: ["c3"],
    rating: 850,
    themes: ["opening"],
    description: "Italian Game — prepare the d4 break.",
  },
];

export function getRandomPuzzle(excludeId?: string): Puzzle {
  const pool = excludeId
    ? PUZZLES.filter((p) => p.id !== excludeId)
    : PUZZLES;
  return pool[Math.floor(Math.random() * pool.length)] || PUZZLES[0];
}

export function getPuzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

/** Normalize a move string for comparison (SAN / UCI / from-to). */
export function movesMatch(
  played: { san: string; from: string; to: string; promotion?: string },
  expected: string
): boolean {
  const exp = expected.replace(/[+#!?]/g, "").toLowerCase();
  const san = played.san.replace(/[+#!?]/g, "").toLowerCase();
  if (san === exp) return true;

  const uci = `${played.from}${played.to}${(played.promotion || "").toLowerCase()}`;
  if (uci === exp) return true;

  // SAN without capture marker variations
  if (san.replace("x", "") === exp.replace("x", "")) return true;

  return false;
}
