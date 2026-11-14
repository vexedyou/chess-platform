export interface Puzzle {
  id: string;
  fen: string;
  solution: string[]; // array of moves in SAN or UCI
  rating: number;
  themes: string[];
  description: string;
}

export const PUZZLES: Puzzle[] = [
  {
    id: "1",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    solution: ["Qxf7#"],
    rating: 800,
    themes: ["mate", "opening"],
    description: "Scholar's Mate - Find the checkmate!",
  },
  {
    id: "2",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
    solution: ["Qf6", "Qxf7#"],
    rating: 900,
    themes: ["mate", "defense"],
    description: "Defend against Scholar's Mate or punish the blunder.",
  },
  {
    id: "3",
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    solution: ["Re8#"],
    rating: 600,
    themes: ["mate", "backrank"],
    description: "Classic back-rank mate.",
  },
  {
    id: "4",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    solution: ["Ng5", "d5", "exd5", "Nxd5", "Nxf7"],
    rating: 1200,
    themes: ["fork", "opening"],
    description: "The famous Fried Liver Attack idea.",
  },
  {
    id: "5",
    fen: "2r3k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1",
    solution: ["Rc8+", "Rxc8", "Rxc8#"],
    rating: 700,
    themes: ["mate", "deflection"],
    description: "Deflect the defender for back-rank mate.",
  },
  {
    id: "6",
    fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    solution: ["Nxe5"],
    rating: 1000,
    themes: ["tactic", "fork"],
    description: "Win a pawn with a classic knight fork idea (after development).",
  },
  {
    id: "7",
    fen: "6k1/pp3ppp/4p3/2P5/1P6/P3P3/5PPP/6K1 w - - 0 1",
    solution: ["c6", "bxc6", "b5"],
    rating: 1100,
    themes: ["endgame", "passed-pawn"],
    description: "Create a powerful passed pawn.",
  },
  {
    id: "8",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5",
    solution: ["c3"],
    rating: 950,
    themes: ["opening", "development"],
    description: "Solid Italian Game continuation preparing d4.",
  },
];

export function getRandomPuzzle(): Puzzle {
  return PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
}

export function getPuzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}
