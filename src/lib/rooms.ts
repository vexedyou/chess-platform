/**
 * Room store for online multiplayer.
 * Game position is versioned with gameSeq so presence pings cannot rewind the board.
 */

export type Room = {
  code: string;
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  status: string;
  gameOver: boolean;
  /** Increments only on move / reset — never on presence. */
  gameSeq: number;
  hostId: string;
  guestId: string | null;
  hostSeenAt: number;
  guestSeenAt: number;
  /** Bumped on any change (presence or game). */
  updatedAt: number;
};

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type GlobalRooms = typeof globalThis & {
  __ppRooms?: Map<string, Room>;
};

function mem(): Map<string, Room> {
  const g = globalThis as GlobalRooms;
  if (!g.__ppRooms) g.__ppRooms = new Map();
  return g.__ppRooms;
}

function kvEnv(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    "";
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function kvGet(code: string): Promise<Room | null> {
  const key = code.toUpperCase();
  const env = kvEnv();
  if (!env) return mem().get(key) ?? null;
  try {
    const res = await fetch(`${env.url}/get/pp:room:${key}`, {
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
    if (!res.ok) return mem().get(key) ?? null;
    const data = (await res.json()) as { result?: string | null };
    if (!data.result) return mem().get(key) ?? null;
    const room = JSON.parse(data.result) as Room;
    if (typeof room.gameSeq !== "number") room.gameSeq = room.history?.length ?? 0;
    mem().set(room.code, room);
    return room;
  } catch {
    return mem().get(key) ?? null;
  }
}

async function kvSet(room: Room): Promise<void> {
  mem().set(room.code, room);
  const env = kvEnv();
  if (!env) return;
  try {
    await fetch(env.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "SET",
        `pp:room:${room.code}`,
        JSON.stringify(room),
        "EX",
        "7200",
      ]),
    });
  } catch {
    /* memory still holds it on this instance */
  }
}

export function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createRoom(hostId: string): Promise<Room> {
  let code = generateCode();
  for (let i = 0; i < 8; i++) {
    const existing = await kvGet(code);
    if (!existing) break;
    code = generateCode();
  }
  const now = Date.now();
  const room: Room = {
    code,
    fen: START_FEN,
    history: [],
    lastMove: null,
    status: "Waiting for opponent…",
    gameOver: false,
    gameSeq: 0,
    hostId,
    guestId: null,
    hostSeenAt: now,
    guestSeenAt: 0,
    updatedAt: now,
  };
  await kvSet(room);
  return room;
}

export async function getRoom(code: string): Promise<Room | null> {
  return kvGet(code);
}

export async function saveRoom(room: Room): Promise<void> {
  room.updatedAt = Date.now();
  await kvSet(room);
}

/**
 * Update presence only. Does NOT create rooms and never rewinds game state.
 * Returns null if the room does not exist.
 */
export async function touchPresence(
  code: string,
  playerId: string,
  role: "host" | "guest"
): Promise<Room | null> {
  const key = code.toUpperCase();
  const room = await kvGet(key);
  if (!room) return null;

  const now = Date.now();

  if (role === "host") {
    if (room.hostId === "unknown" || room.hostId === playerId) {
      room.hostId = playerId;
    }
    // Only the real host updates hostSeenAt
    if (room.hostId === playerId) room.hostSeenAt = now;
  } else {
    if (room.hostId === playerId) {
      room.hostSeenAt = now;
    } else {
      // Claim / refresh guest seat
      if (!room.guestId || room.guestId === playerId) {
        room.guestId = playerId;
      }
      if (room.guestId === playerId) room.guestSeenAt = now;
    }
  }

  const guestFresh = !!(room.guestId && now - room.guestSeenAt < 12000);
  const hostFresh =
    room.hostId !== "unknown" && now - room.hostSeenAt < 12000;
  if (guestFresh && hostFresh && !room.gameOver) {
    if (
      room.history.length === 0 &&
      (room.status.startsWith("Waiting") || room.status.includes("host"))
    ) {
      room.status = "Both connected. White to move.";
    }
  }

  // Presence only — do not bump gameSeq
  room.updatedAt = now;
  await kvSet(room);
  return room;
}

export function publicRoom(room: Room, playerId: string) {
  const now = Date.now();
  const guestOnline = !!(room.guestId && now - room.guestSeenAt < 12000);
  const hostOnline =
    room.hostId !== "unknown" && now - room.hostSeenAt < 12000;

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
    gameSeq: room.gameSeq ?? 0,
    playerCount: (hostOnline ? 1 : 0) + (guestOnline ? 1 : 0),
    yourColor,
    updatedAt: room.updatedAt,
  };
}
