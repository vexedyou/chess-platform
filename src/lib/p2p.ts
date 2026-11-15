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
  | { type: "ping" }
  | { type: "pong" };

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

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** STUN + free TURN for NAT traversal (main timeout cause without TURN). */
export const PEER_OPTIONS = {
  debug: 0 as const,
  // Explicit public broker
  host: "0.peerjs.com",
  port: 443,
  path: "/",
  secure: true,
  pingInterval: 4000,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      // Free openrelay TURN — critical behind strict NATs / mobile networks
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
    iceCandidatePoolSize: 4,
  },
};

const HOST_KEY = (code: string) => `pp-host-${code.toUpperCase()}`;
const HOST_PEER_KEY = (code: string) => `pp-hid-${code.toUpperCase()}`;

export function markHost(code: string, peerId?: string) {
  try {
    sessionStorage.setItem(HOST_KEY(code), "1");
    if (peerId) sessionStorage.setItem(HOST_PEER_KEY(code), peerId);
  } catch {
    /* ignore */
  }
}

export function clearHost(code: string) {
  try {
    sessionStorage.removeItem(HOST_KEY(code));
    sessionStorage.removeItem(HOST_PEER_KEY(code));
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

export function getStoredHostPeerId(code: string): string | null {
  try {
    return sessionStorage.getItem(HOST_PEER_KEY(code));
  } catch {
    return null;
  }
}
