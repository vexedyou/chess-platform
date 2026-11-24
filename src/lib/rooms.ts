/**
 * Room store for online multiplayer.
 * Uses Vercel KV / Upstash Redis REST when env is set; otherwise in-memory.
 */

export type Room = {
  code: string;
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  status: string;
  gameOver: boolean;
  hostId: string;
  guestId: string | null;
  hostSeenAt: number;
  guestSeenAt: number;
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

/** Merge presence without wiping the other player. */
export async function touchPresence(
  code: string,
  playerId: string,
  role: "host" | "guest",
  gamePatch?: Partial<Pick<Room, "fen" | "history" | "lastMove" | "status" | "gameOver">>
): Promise<Room> {
  const key = code.toUpperCase();
  let room = await kvGet(key);
  const now = Date.now();

  if (!room) {
    room = {
      code: key,
      fen: gamePatch?.fen || START_FEN,
      history: gamePatch?.history || [],
      lastMove: gamePatch?.lastMove ?? null,
      status: gamePatch?.status || "Waiting for opponent…",
      gameOver: !!gamePatch?.gameOver,
      hostId: role === "host" ? playerId : "unknown",
      guestId: role === "guest" ? playerId : null,
      hostSeenAt: role === "host" ? now : 0,
      guestSeenAt: role === "guest" ? now : 0,
      updatedAt: now,
    };
  } else {
    if (role === "host") {
      if (room.hostId === "unknown" || room.hostId === playerId) {
        room.hostId = playerId;
      }
      room.hostSeenAt = now;
    } else {
      if (room.hostId === playerId) {
        room.hostSeenAt = now;
      } else {
        room.guestId = playerId;
        room.guestSeenAt = now;
      }
    }

    if (gamePatch) {
      if (gamePatch.fen != null) room.fen = gamePatch.fen;
      if (gamePatch.history != null) room.history = gamePatch.history;
      if (gamePatch.lastMove !== undefined) room.lastMove = gamePatch.lastMove;
      if (gamePatch.status != null) room.status = gamePatch.status;
      if (gamePatch.gameOver != null) room.gameOver = gamePatch.gameOver;
    }

    const guestFresh = !!(room.guestId && now - room.guestSeenAt < 10000);
    const hostFresh =
      room.hostId !== "unknown" && now - room.hostSeenAt < 10000;
    if (guestFresh && hostFresh && !room.gameOver) {
      if (
        room.history.length === 0 &&
        (room.status.startsWith("Waiting") || room.status.includes("host"))
      ) {
        room.status = "Both connected. White to move.";
      }
    }
  }

  room.updatedAt = now;
  await kvSet(room);
  return room;
}

export function publicRoom(room: Room, playerId: string) {
  const now = Date.now();
  const guestOnline = !!(room.guestId && now - room.guestSeenAt < 10000);
  const hostOnline =
    room.hostId !== "unknown" && now - room.hostSeenAt < 10000;

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
    playerCount: (hostOnline ? 1 : 0) + (guestOnline ? 1 : 0),
    yourColor,
    updatedAt: room.updatedAt,
  };
}
