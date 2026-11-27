/**
 * Durable room store (Vercel Blob, private store).
 * Presence never overwrites a newer gameSeq / longer history.
 */

import { put, list } from "@vercel/blob";

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

function token(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function hasBlob(): boolean {
  return !!token();
}

function pathFor(code: string): string {
  return `rooms/${code.toUpperCase()}.json`;
}

function normalize(room: Room): Room {
  if (typeof room.gameSeq !== "number") {
    room.gameSeq = room.history?.length ?? 0;
  }
  if (!Array.isArray(room.history)) room.history = [];
  return room;
}

function preferNewer(a: Room, b: Room): Room {
  if (b.gameSeq > a.gameSeq) return b;
  if (a.gameSeq > b.gameSeq) return a;
  if ((b.history?.length ?? 0) > (a.history?.length ?? 0)) return b;
  return a;
}

async function fetchRoomUrl(url: string): Promise<Room | null> {
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return normalize((await res.json()) as Room);
}

async function resolveUrl(key: string): Promise<string | null> {
  const cached = urlCache().get(key);
  if (cached) return cached;
  const listed = await list({ prefix: pathFor(key), limit: 5 });
  // Prefer exact path match
  const exact = listed.blobs.find((b) => b.pathname === pathFor(key) || b.pathname.endsWith(`/${pathFor(key)}`));
  const blob = exact || listed.blobs[0];
  if (!blob) return null;
  urlCache().set(key, blob.url);
  return blob.url;
}

async function blobGet(code: string): Promise<Room | null> {
  const key = code.toUpperCase();
  const cached = mem().get(key);

  if (!hasBlob()) return cached ? structuredClone(cached) : null;

  try {
    let url = await resolveUrl(key);
    if (!url) return cached ? structuredClone(cached) : null;

    let room = await fetchRoomUrl(url);
    if (!room) {
      urlCache().delete(key);
      url = await resolveUrl(key);
      if (!url) return cached ? structuredClone(cached) : null;
      room = await fetchRoomUrl(url);
    }
    if (!room) return cached ? structuredClone(cached) : null;

    const best = cached ? preferNewer(cached, room) : room;
    mem().set(key, best);
    return structuredClone(best);
  } catch (e) {
    console.error("[rooms] blobGet", e);
    return cached ? structuredClone(cached) : null;
  }
}

async function blobSet(room: Room): Promise<void> {
  const key = room.code.toUpperCase();
  room.code = key;
  normalize(room);

  const existing = mem().get(key);
  if (existing) {
    const best = preferNewer(existing, room);
    if (best.gameSeq > room.gameSeq) {
      room.fen = best.fen;
      room.history = best.history;
      room.lastMove = best.lastMove;
      room.status = best.status;
      room.gameOver = best.gameOver;
      room.gameSeq = best.gameSeq;
    }
  }

  room.updatedAt = Date.now();
  mem().set(key, structuredClone(room));

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
    console.error("[rooms] blobSet failed", e);
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
  const latest = await blobGet(room.code);
  if (latest && latest.gameSeq > room.gameSeq) {
    latest.hostSeenAt = Math.max(latest.hostSeenAt, room.hostSeenAt);
    latest.guestSeenAt = Math.max(latest.guestSeenAt, room.guestSeenAt);
    if (room.guestId && !latest.guestId) latest.guestId = room.guestId;
    await blobSet(latest);
    Object.assign(room, latest);
    return;
  }
  await blobSet(room);
}

export async function touchPresence(
  code: string,
  playerId: string,
  role: "host" | "guest"
): Promise<Room | null> {
  const base = await blobGet(code);
  if (!base) return null;

  const now = Date.now();
  let hostId = base.hostId;
  let guestId = base.guestId;
  let hostSeenAt = base.hostSeenAt;
  let guestSeenAt = base.guestSeenAt;

  if (role === "host") {
    if (hostId === "unknown" || hostId === playerId) hostId = playerId;
    if (hostId === playerId) hostSeenAt = now;
  } else {
    if (hostId === playerId) {
      hostSeenAt = now;
    } else {
      if (!guestId || guestId === playerId) guestId = playerId;
      if (guestId === playerId) guestSeenAt = now;
    }
  }

  const latest = (await blobGet(code)) ?? base;

  latest.hostId = hostId || latest.hostId;
  if (guestId) latest.guestId = guestId;
  latest.hostSeenAt = Math.max(latest.hostSeenAt, hostSeenAt);
  latest.guestSeenAt = Math.max(latest.guestSeenAt, guestSeenAt);

  const guestFresh = !!(latest.guestId && now - latest.guestSeenAt < 15000);
  const hostFresh =
    latest.hostId !== "unknown" && now - latest.hostSeenAt < 15000;
  if (guestFresh && hostFresh && !latest.gameOver) {
    if (
      latest.history.length === 0 &&
      (latest.status.startsWith("Waiting") || latest.status.includes("host"))
    ) {
      latest.status = "Both connected. White to move.";
    }
  }

  await blobSet(latest);
  return latest;
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
