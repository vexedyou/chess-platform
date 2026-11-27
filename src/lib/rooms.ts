/**
 * Durable room store backed by Vercel Blob (shared across all serverless instances).
 * Falls back to in-memory when BLOB_READ_WRITE_TOKEN is missing (local dev).
 */

import { put, head, list } from "@vercel/blob";

export type Room = {
  code: string;
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  status: string;
  gameOver: boolean;
  gameSeq: number;
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
  __ppRoomUrls?: Map<string, string>;
};

function mem(): Map<string, Room> {
  const g = globalThis as GlobalRooms;
  if (!g.__ppRooms) g.__ppRooms = new Map();
  return g.__ppRooms;
}

function urlCache(): Map<string, string> {
  const g = globalThis as GlobalRooms;
  if (!g.__ppRoomUrls) g.__ppRoomUrls = new Map();
  return g.__ppRoomUrls;
}

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function pathFor(code: string): string {
  return `rooms/${code.toUpperCase()}.json`;
}

async function blobGet(code: string): Promise<Room | null> {
  const key = code.toUpperCase();
  if (!hasBlob()) return mem().get(key) ?? null;

  try {
    // Prefer cached URL from last write
    let url = urlCache().get(key);

    if (!url) {
      const listed = await list({
        prefix: pathFor(key),
        limit: 1,
      });
      if (listed.blobs.length === 0) {
        return mem().get(key) ?? null;
      }
      url = listed.blobs[0].url;
      urlCache().set(key, url);
    }

    // Fetch with token so private blobs are readable; bust CDN with query
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      // URL may be stale — re-list
      urlCache().delete(key);
      const listed = await list({ prefix: pathFor(key), limit: 1 });
      if (listed.blobs.length === 0) return mem().get(key) ?? null;
      url = listed.blobs[0].url;
      urlCache().set(key, url);
      const retry = await fetch(
        `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
          },
          cache: "no-store",
        }
      );
      if (!retry.ok) return mem().get(key) ?? null;
      const room = (await retry.json()) as Room;
      if (typeof room.gameSeq !== "number") room.gameSeq = room.history?.length ?? 0;
      mem().set(key, room);
      return room;
    }

    const room = (await res.json()) as Room;
    if (typeof room.gameSeq !== "number") room.gameSeq = room.history?.length ?? 0;
    mem().set(key, room);
    return room;
  } catch {
    return mem().get(key) ?? null;
  }
}

async function blobSet(room: Room): Promise<void> {
  const key = room.code.toUpperCase();
  room.code = key;
  mem().set(key, room);

  if (!hasBlob()) return;

  try {
    const result = await put(pathFor(key), JSON.stringify(room), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    urlCache().set(key, result.url);
  } catch (e) {
    console.error("blobSet failed", e);
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
    const existing = await blobGet(code);
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
  await blobSet(room);
  return room;
}

export async function getRoom(code: string): Promise<Room | null> {
  return blobGet(code);
}

export async function saveRoom(room: Room): Promise<void> {
  room.updatedAt = Date.now();
  await blobSet(room);
}

/** Presence only — never creates rooms, never rewinds game state. */
export async function touchPresence(
  code: string,
  playerId: string,
  role: "host" | "guest"
): Promise<Room | null> {
  const room = await blobGet(code);
  if (!room) return null;

  const now = Date.now();

  if (role === "host") {
    if (room.hostId === "unknown" || room.hostId === playerId) {
      room.hostId = playerId;
    }
    if (room.hostId === playerId) room.hostSeenAt = now;
  } else {
    if (room.hostId === playerId) {
      room.hostSeenAt = now;
    } else {
      if (!room.guestId || room.guestId === playerId) {
        room.guestId = playerId;
      }
      if (room.guestId === playerId) room.guestSeenAt = now;
    }
  }

  const guestFresh = !!(room.guestId && now - room.guestSeenAt < 15000);
  const hostFresh =
    room.hostId !== "unknown" && now - room.hostSeenAt < 15000;
  if (guestFresh && hostFresh && !room.gameOver) {
    if (
      room.history.length === 0 &&
      (room.status.startsWith("Waiting") || room.status.includes("host"))
    ) {
      room.status = "Both connected. White to move.";
    }
  }

  room.updatedAt = now;
  await blobSet(room);
  return room;
}

export function publicRoom(room: Room, playerId: string) {
  const now = Date.now();
  const guestOnline = !!(room.guestId && now - room.guestSeenAt < 15000);
  const hostOnline =
    room.hostId !== "unknown" && now - room.hostSeenAt < 15000;

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

// silence unused import warning if head is tree-shaken differently
void head;
