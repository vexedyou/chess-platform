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
  // PeerJS ids: alphanumeric plus - _
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

export const PEER_OPTIONS = {
  debug: 0 as const,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
    ],
  },
};

const HOST_KEY = (code: string) => `pp-host-${code.toUpperCase()}`;

export function markHost(code: string) {
  try {
    sessionStorage.setItem(HOST_KEY(code), "1");
  } catch {
    /* ignore */
  }
}

export function clearHost(code: string) {
  try {
    sessionStorage.removeItem(HOST_KEY(code));
  } catch {
    /* ignore */
  }
}

export function wasHost(code: string): boolean {
  try {
    return sessionStorage.getItem(HOST_KEY(code)) === "1";
  } catch {
    return false;
  }
}
