export interface Puzzle {
  id: string;
  fen: string;
  /** Full solution line: player move, optional opponent reply, player, ... */
  solution: string[];
  rating: number;
  themes: string[];
  description: string;
}

export const PUZZLES: Puzzle[] = [
  // —— Mates (easy) ——
  {
    id: "m1",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    solution: ["Qxf7#"],
    rating: 500,
    themes: ["mate", "opening"],
    description: "Scholar's mate — deliver checkmate.",
  },
  {
    id: "m2",
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    solution: ["Re8#"],
    rating: 400,
    themes: ["mate", "backrank"],
    description: "Classic back-rank mate.",
  },
  {
    id: "m3",
    fen: "5k2/8/8/8/8/8/4R3/4K3 w - - 0 1",
    solution: ["Re8#"],
    rating: 350,
    themes: ["mate", "endgame"],
    description: "King and rook mate on the back rank.",
  },
  {
    id: "m4",
    fen: "6k1/5ppp/8/8/8/8/4QPPP/6K1 w - - 0 1",
    solution: ["Qe8#"],
    rating: 450,
    themes: ["mate", "backrank"],
    description: "Queen delivers mate on the back rank.",
  },
  {
    id: "m5",
    fen: "2r3k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1",
    solution: ["Rb8", "Rxb8", "Rxb8#"],
    rating: 750,
    themes: ["mate", "deflection", "backrank"],
    description: "Deflect the rook, then mate on the back rank.",
  },
  {
    id: "m6",
    fen: "r5k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    solution: ["Ra8#"],
    rating: 400,
    themes: ["mate", "backrank"],
    description: "Rook mate on a8.",
  },
  {
    id: "m7",
    fen: "6k1/6pp/8/8/8/8/5PPP/2R3K1 w - - 0 1",
    solution: ["Rc8#"],
    rating: 420,
    themes: ["mate", "backrank"],
    description: "Back-rank mate with the rook.",
  },
  {
    id: "m8",
    fen: "5rk1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1",
    solution: ["Qe8#"],
    rating: 500,
    themes: ["mate", "backrank"],
    description: "Queen mates on the eighth rank.",
  },
  {
    id: "m9",
    fen: "7k/5Qpp/8/8/8/8/5PPP/6K1 w - - 0 1",
    solution: ["Qf8#"],
    rating: 380,
    themes: ["mate"],
    description: "Queen checkmate on f8.",
  },
  {
    id: "m10",
    fen: "6k1/5ppp/5P2/8/8/8/6PP/6K1 w - - 0 1",
    solution: ["f7", "Kh8", "f8=Q#"],
    rating: 900,
    themes: ["mate", "promotion", "endgame"],
    description: "Push the pawn and promote with mate.",
  },

  // —— Forks ——
  {
    id: "f1",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    solution: ["Ng5"],
    rating: 850,
    themes: ["attack", "opening"],
    description: "Fried Liver idea — knight to g5.",
  },
  {
    id: "f2",
    fen: "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    solution: ["Nxe4"],
    rating: 950,
    themes: ["fork", "tactic"],
    description: "Take the undefended center pawn.",
  },
  {
    id: "f3",
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
    solution: ["Nxe5"],
    rating: 1000,
    themes: ["fork", "tactic"],
    description: "Knight captures on e5 — fork ideas loom.",
  },
  {
    id: "f4",
    fen: "2r3k1/5ppp/8/3n4/8/8/5PPP/2R2NK1 b - - 0 1",
    solution: ["Ne3"],
    rating: 1100,
    themes: ["fork", "knight"],
    description: "Knight fork on king and rook.",
  },
  {
    id: "f5",
    fen: "6k1/5ppp/8/8/3N4/8/5PPP/6K1 w - - 0 1",
    solution: ["Ne6"],
    rating: 700,
    themes: ["fork", "knight"],
    description: "Knight jumps in with a fork threat on the king-side.",
  },
  {
    id: "f6",
    fen: "r2qkb1r/ppp2ppp/2n1bn2/3pp3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 6",
    solution: ["Nxe5"],
    rating: 1150,
    themes: ["fork", "tactic"],
    description: "Central capture creating double threats.",
  },
  {
    id: "f7",
    fen: "4k3/8/8/3n4/8/8/8/R3K3 b Q - 0 1",
    solution: ["Nc3"],
    rating: 800,
    themes: ["fork", "knight", "endgame"],
    description: "Fork king and rook.",
  },

  // —— Pins & skewers ——
  {
    id: "p1",
    fen: "r3k2r/ppp2ppp/2n5/3pP3/2BP4/2P2N2/P1P2PPP/R3K2R w KQkq - 0 1",
    solution: ["Bxd5"],
    rating: 1050,
    themes: ["pin", "tactic"],
    description: "Win material by exploiting the pin.",
  },
  {
    id: "p2",
    fen: "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 0 7",
    solution: ["Bg5"],
    rating: 900,
    themes: ["pin", "opening"],
    description: "Pin the knight to the queen.",
  },
  {
    id: "p3",
    fen: "4k3/8/8/8/4b3/8/8/R3K3 w Q - 0 1",
    solution: ["Ra4"],
    rating: 850,
    themes: ["skewer", "endgame"],
    description: "Skewer the king and bishop.",
  },
  {
    id: "p4",
    fen: "4k3/8/8/8/8/4q3/8/R3K3 w Q - 0 1",
    solution: ["Ra3"],
    rating: 900,
    themes: ["skewer", "endgame"],
    description: "Rook skewer wins the queen.",
  },
  {
    id: "p5",
    fen: "r2qk2r/ppp2ppp/2n1b3/3np3/2B5/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 7",
    solution: ["Nxe5"],
    rating: 1200,
    themes: ["pin", "tactic"],
    description: "Exploit the pinned piece in the center.",
  },

  // —— Discovered attacks / removals ——
  {
    id: "d1",
    fen: "2kr3r/ppp2ppp/2n5/3q4/3P4/2P2N2/PP3PPP/R2QK2R w KQ - 0 1",
    solution: ["c4"],
    rating: 1000,
    themes: ["discovered", "tactic"],
    description: "Gain a tempo on the queen.",
  },
  {
    id: "d2",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5",
    solution: ["c3"],
    rating: 800,
    themes: ["opening"],
    description: "Italian Game — prepare the d4 break.",
  },
  {
    id: "d3",
    fen: "r1bq1rk1/ppp2ppp/2np1n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w - - 0 7",
    solution: ["Nd5"],
    rating: 1100,
    themes: ["discovered", "attack"],
    description: "Centralize with tempo against the bishop.",
  },

  // —— Intermediate / hanging pieces ——
  {
    id: "h1",
    fen: "rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3",
    solution: ["exd5"],
    rating: 600,
    themes: ["tactic", "opening"],
    description: "Take the hanging center pawn.",
  },
  {
    id: "h2",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3",
    solution: ["exd4"],
    rating: 650,
    themes: ["tactic", "opening"],
    description: "Capture the undefended d-pawn.",
  },
  {
    id: "h3",
    fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    solution: ["Nxe5"],
    rating: 700,
    themes: ["tactic"],
    description: "Grab the e5 pawn.",
  },
  {
    id: "h4",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4",
    solution: ["Nxe5"],
    rating: 750,
    themes: ["tactic"],
    description: "Win the center pawn.",
  },

  // —— Endgame techniques ——
  {
    id: "e1",
    fen: "8/8/8/4k3/8/4P3/4K3/8 w - - 0 1",
    solution: ["Ke3"],
    rating: 900,
    themes: ["endgame", "opposition"],
    description: "Take the opposition and escort the pawn.",
  },
  {
    id: "e2",
    fen: "8/8/8/8/4k3/8/4P3/4K3 w - - 0 1",
    solution: ["Ke2"],
    rating: 850,
    themes: ["endgame", "opposition"],
    description: "King in front of the pawn — hold the opposition.",
  },
  {
    id: "e3",
    fen: "8/4k3/8/4P3/4K3/8/8/8 w - - 0 1",
    solution: ["Kd5"],
    rating: 950,
    themes: ["endgame"],
    description: "Outflank and promote the pawn.",
  },
  {
    id: "e4",
    fen: "4k3/8/4P3/4K3/8/8/8/8 w - - 0 1",
    solution: ["Kd6"],
    rating: 800,
    themes: ["endgame", "opposition"],
    description: "Support the pawn to the seventh.",
  },
  {
    id: "e5",
    fen: "8/8/8/8/8/3k4/3P4/3K4 w - - 0 1",
    solution: ["Kc1"],
    rating: 1000,
    themes: ["endgame", "opposition"],
    description: "Correct king path to promote.",
  },

  // —— Intermediate mates / combos ——
  {
    id: "c1",
    fen: "r1bq1rk1/pppp1ppp/2n2n2/2b1p1N1/2B1P3/3P4/PPP2PPP/RNBQK2R w KQ - 0 6",
    solution: ["Nxf7"],
    rating: 1200,
    themes: ["sacrifice", "attack"],
    description: "Greek gift-style idea on f7.",
  },
  {
    id: "c2",
    fen: "rnbq1rk1/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w - - 0 5",
    solution: ["Nxe5"],
    rating: 1100,
    themes: ["tactic", "fork"],
    description: "Central capture with tactics.",
  },
  {
    id: "c3",
    fen: "2rq1rk1/pp3ppp/2n1bn2/3p4/3P4/2NB1N2/PP3PPP/R1BQ1RK1 w - - 0 11",
    solution: ["Nb5"],
    rating: 1250,
    themes: ["attack", "tactic"],
    description: "Jump to b5 with multiple threats.",
  },
  {
    id: "c4",
    fen: "r2q1rk1/ppp2ppp/2n1bn2/3p4/3P4/2NB1N2/PPP2PPP/R1BQ1RK1 w - - 0 9",
    solution: ["Ng5"],
    rating: 1150,
    themes: ["attack"],
    description: "Knight to g5 pressures e6 and h7.",
  },
  {
    id: "c5",
    fen: "6k1/5ppp/8/2q5/8/8/5PPP/3Q2K1 w - - 0 1",
    solution: ["Qd8#"],
    rating: 600,
    themes: ["mate", "backrank"],
    description: "Queen mate — the back rank is weak.",
  },
  {
    id: "c6",
    fen: "5rk1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1",
    solution: ["Qd8"],
    rating: 700,
    themes: ["mate", "backrank"],
    description: "Invade the back rank.",
  },
  {
    id: "c7",
    fen: "r4rk1/5ppp/8/8/8/8/5PPP/R4RK1 w - - 0 1",
    solution: ["Ra8"],
    rating: 650,
    themes: ["mate", "backrank"],
    description: "Double rooks — seize the eighth rank.",
  },
  {
    id: "c8",
    fen: "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    solution: ["Rd8#"],
    rating: 450,
    themes: ["mate", "backrank"],
    description: "Trade or mate on the open file.",
  },
];

export type PuzzleFilter = {
  theme?: string | null;
  maxRating?: number | null;
  minRating?: number | null;
};

export function filterPuzzles(filter: PuzzleFilter = {}): Puzzle[] {
  return PUZZLES.filter((p) => {
    if (filter.theme && filter.theme !== "all" && !p.themes.includes(filter.theme)) {
      return false;
    }
    if (filter.minRating != null && p.rating < filter.minRating) return false;
    if (filter.maxRating != null && p.rating > filter.maxRating) return false;
    return true;
  });
}

export function getRandomPuzzle(
  excludeId?: string,
  filter: PuzzleFilter = {}
): Puzzle {
  let pool = filterPuzzles(filter);
  if (excludeId) pool = pool.filter((p) => p.id !== excludeId);
  if (pool.length === 0) pool = PUZZLES.filter((p) => p.id !== excludeId);
  if (pool.length === 0) return PUZZLES[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getPuzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

export function allThemes(): string[] {
  const s = new Set<string>();
  for (const p of PUZZLES) for (const t of p.themes) s.add(t);
  return Array.from(s).sort();
}

export function movesMatch(
  played: { san: string; from: string; to: string; promotion?: string },
  expected: string
): boolean {
  const exp = expected.replace(/[+#!?]/g, "").toLowerCase();
  const san = played.san.replace(/[+#!?]/g, "").toLowerCase();
  if (san === exp) return true;

  const uci = `${played.from}${played.to}${(played.promotion || "").toLowerCase()}`;
  if (uci === exp) return true;

  if (san.replace("x", "") === exp.replace("x", "")) return true;

  // Promotion SAN variants: e8=Q vs e8Q
  if (san.replace("=", "") === exp.replace("=", "")) return true;

  return false;
}
