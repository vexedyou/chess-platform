/** Server-side room store (HTTP fallback multiplayer). */

export type Room = {
  code: string;
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  status: string;
  gameOver: boolean;
  hostId: string;
  guestId: string | null;
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
  };
}

export { START_FEN };
