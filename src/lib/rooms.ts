/**
 * Shared room store for multiplayer chess.
 * Uses globalThis so state survives across hot requests on the same instance.
 * Rooms expire after 2 hours of inactivity.
 */

export type PlayerSlot = {
  id: string;
  color: "w" | "b";
  lastSeen: number;
};

export type Room = {
  code: string;
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  status: string;
  players: PlayerSlot[];
  gameOver: boolean;
  createdAt: number;
  updatedAt: number;
};

const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

type Store = Map<string, Room>;

function getStore(): Store {
  const g = globalThis as unknown as { __chessRooms?: Store };
  if (!g.__chessRooms) {
    g.__chessRooms = new Map();
  }
  return g.__chessRooms;
}

function purgeExpired(store: Store) {
  const now = Date.now();
  for (const [code, room] of store) {
    if (now - room.updatedAt > ROOM_TTL_MS) {
      store.delete(code);
    }
  }
}

export function createRoom(hostId: string): Room {
  const store = getStore();
  purgeExpired(store);

  let code = "";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (store.has(code));

  const now = Date.now();
  const room: Room = {
    code,
    fen: START_FEN,
    history: [],
    lastMove: null,
    status: "Waiting for opponent...",
    players: [{ id: hostId, color: "w", lastSeen: now }],
    gameOver: false,
    createdAt: now,
    updatedAt: now,
  };
  store.set(code, room);
  return room;
}

export function getRoom(code: string): Room | null {
  const store = getStore();
  purgeExpired(store);
  return store.get(code.toUpperCase()) || null;
}

export function joinRoom(
  code: string,
  playerId: string
): Room | { error: string } {
  const room = getRoom(code);
  if (!room) return { error: "Room not found" };

  const existing = room.players.find((p) => p.id === playerId);
  if (existing) {
    existing.lastSeen = Date.now();
    room.updatedAt = Date.now();
    return room;
  }

  if (room.players.length >= 2) {
    return { error: "Room is full" };
  }

  const color: "w" | "b" = room.players.some((p) => p.color === "w")
    ? "b"
    : "w";
  room.players.push({ id: playerId, color, lastSeen: Date.now() });
  room.status =
    room.players.length === 2
      ? "Both players connected. White to move."
      : "Waiting for opponent...";
  room.updatedAt = Date.now();
  return room;
}

export function applyMove(
  code: string,
  playerId: string,
  payload: {
    fen: string;
    san: string;
    from: string;
    to: string;
    gameOver?: boolean;
    status?: string;
  }
): Room | { error: string } {
  const room = getRoom(code);
  if (!room) return { error: "Room not found" };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: "You are not in this room" };

  room.fen = payload.fen;
  room.history = [...room.history, payload.san];
  room.lastMove = { from: payload.from, to: payload.to };
  room.gameOver = !!payload.gameOver;
  room.status =
    payload.status || (room.gameOver ? "Game over" : "Opponent's turn");
  room.updatedAt = Date.now();
  player.lastSeen = Date.now();

  return room;
}

export function resetRoom(
  code: string,
  playerId: string
): Room | { error: string } {
  const room = getRoom(code);
  if (!room) return { error: "Room not found" };
  if (!room.players.some((p) => p.id === playerId)) {
    return { error: "You are not in this room" };
  }

  room.fen = START_FEN;
  room.history = [];
  room.lastMove = null;
  room.gameOver = false;
  room.status =
    room.players.length === 2
      ? "New game. White to move."
      : "Waiting for opponent...";
  room.updatedAt = Date.now();
  return room;
}

export function publicRoom(room: Room, playerId: string) {
  const me = room.players.find((p) => p.id === playerId);
  return {
    code: room.code,
    fen: room.fen,
    history: room.history,
    lastMove: room.lastMove,
    status: room.status,
    gameOver: room.gameOver,
    playerCount: room.players.length,
    yourColor: me?.color ?? null,
    updatedAt: room.updatedAt,
  };
}
