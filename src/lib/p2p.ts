/** PeerJS helpers for Pushing Pawns online play */

export type GamePayload = {
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  status: string;
  gameOver: boolean;
};

export type P2PMessage =
  | { type: "hello"; role: "host" | "guest" }
  | { type: "sync"; game: GamePayload }
  | { type: "move"; game: GamePayload }
  | { type: "reset"; game: GamePayload }
  | { type: "ping" };

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function emptyGame(status = "Waiting for opponent..."): GamePayload {
  return {
    fen: START_FEN,
    history: [],
    lastMove: null,
    status,
    gameOver: false,
  };
}

export function roomPeerId(code: string): string {
  return `ppawns-${code.toUpperCase()}`;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
