/** MQTT helpers for room-code multiplayer (no server state). */

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type GameState = {
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  status: string;
  gameOver: boolean;
};

export type RoomMessage =
  | { type: "hello"; role: "host" | "guest"; playerId: string }
  | { type: "sync"; game: GameState; from: string }
  | { type: "move"; game: GameState; from: string }
  | { type: "reset"; game: GameState; from: string }
  | { type: "ping"; from: string }
  | { type: "pong"; from: string };

export function emptyGame(status = "Waiting for opponent…"): GameState {
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

export function topicFor(code: string): string {
  return `pushingpawns/v1/${code.toUpperCase()}`;
}

/** Public EMQX broker over WebSocket (no account needed). */
export const MQTT_URL = "wss://broker.emqx.io:8084/mqtt";

export function makePlayerId(): string {
  try {
    const key = "pp-player-id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "p_" + Math.random().toString(36).slice(2);
  }
}
