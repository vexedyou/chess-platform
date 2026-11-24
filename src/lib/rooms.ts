/** Shared room store for online multiplayer (server-side). */

export type Room = {
  code: string;
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  status: string;
  gameOver: boolean;
  hostId: string;
  guestId: string | null;
  pendingGuestMove: { from: string; to: string; promotion?: string; playerId: string } | null;
  updatedAt: number;
};

const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type GlobalRooms = typeof globalThis & {
  __ppRooms?: Map<string, Room>;
};

function store(): Map<string, Room> {
  const g = globalThis as GlobalRooms;
  if (!g.__ppRooms) g.__ppRooms = new Map();
  return g.__ppRooms;
}

export function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function createRoom(hostId: string): Room {
  const rooms = store();
  let code = generateCode();
  for (let i = 0; i < 8 && rooms.has(code); i++) code = generateCode();
  const room: Room = {
    code,
    fen: START_FEN,
    history: [],
    lastMove: null,
    status: "Waiting for opponent…",
    gameOver: false,
    hostId,
    guestId: null,
    pendingGuestMove: null,
    updatedAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | null {
  return store().get(code.toUpperCase()) ?? null;
}

export function saveRoom(room: Room): void {
  room.updatedAt = Date.now();
  store().set(room.code, room);
}

/** Upsert full state from host heartbeat — keeps room alive across instances better. */
export function upsertRoom(code: string, patch: Partial<Room> & { hostId: string }): Room {
  const existing = getRoom(code);
  if (existing) {
    Object.assign(existing, patch, { code: existing.code, updatedAt: Date.now() });
    store().set(existing.code, existing);
    return existing;
  }
  const room: Room = {
    code: code.toUpperCase(),
    fen: patch.fen || START_FEN,
    history: patch.history || [],
    lastMove: patch.lastMove ?? null,
    status: patch.status || "Waiting for opponent…",
    gameOver: !!patch.gameOver,
    hostId: patch.hostId,
    guestId: patch.guestId ?? null,
    pendingGuestMove: patch.pendingGuestMove ?? null,
    updatedAt: Date.now(),
  };
  store().set(room.code, room);
  return room;
}

export function publicRoom(room: Room, playerId: string) {
  let yourColor: "w" | "b" | null = null;
  if (playerId === room.hostId) yourColor = "w";
  else if (playerId === room.guestId) yourColor = "b";
  return {
    code: room.code,
    fen: room.fen,
    history: room.history,
    lastMove: room.lastMove,
    status: room.status,
    gameOver: room.gameOver,
    playerCount: room.guestId ? 2 : 1,
    yourColor,
    updatedAt: room.updatedAt,
    pendingGuestMove:
      playerId === room.hostId ? room.pendingGuestMove : null,
  };
}

export { START_FEN };
