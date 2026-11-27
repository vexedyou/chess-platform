import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import {
  getRoom,
  publicRoom,
  saveRoom,
  touchPresence,
  START_FEN,
} from "@/lib/rooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const playerId = req.nextUrl.searchParams.get("playerId") || "";
  const roleParam = req.nextUrl.searchParams.get("role");
  const role =
    roleParam === "host" || roleParam === "guest" ? roleParam : null;

  let room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (playerId && role) {
    const touched = await touchPresence(code, playerId, role);
    if (touched) room = touched;
  }

  return NextResponse.json(publicRoom(room, playerId));
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const playerId = String(body.playerId || "").slice(0, 64);
  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  if (action === "join") {
    // Never soft-create — guest must join a room the host already created
    const room = await touchPresence(code, playerId, "guest");
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    return NextResponse.json(publicRoom(room, playerId));
  }

  if (action === "presence") {
    const role = body.role === "guest" ? "guest" : "host";
    const room = await touchPresence(code, playerId, role);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    return NextResponse.json(publicRoom(room, playerId));
  }

  // Host re-attach after refresh (same code, claim host seat without new room)
  if (action === "rejoin") {
    const role = body.role === "guest" ? "guest" : "host";
    const room = await touchPresence(code, playerId, role);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    return NextResponse.json(publicRoom(room, playerId));
  }

  let room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (action === "move") {
    const from = String(body.from || "");
    const to = String(body.to || "");
    const promotion = body.promotion || "q";
    if (!from || !to) {
      return NextResponse.json({ error: "from/to required" }, { status: 400 });
    }

    let isHost = playerId === room.hostId;
    let isGuest = playerId === room.guestId;
    if (!isHost && !isGuest) {
      if (!room.guestId && room.hostId !== playerId) {
        room.guestId = playerId;
        room.guestSeenAt = Date.now();
        isGuest = true;
      } else {
        return NextResponse.json({ error: "Not in room" }, { status: 403 });
      }
    }

    if (room.gameOver) {
      return NextResponse.json({ error: "Game over" }, { status: 400 });
    }

    let chess: Chess;
    try {
      chess = new Chess(room.fen);
    } catch {
      return NextResponse.json({ error: "Invalid position" }, { status: 500 });
    }

    const turn = chess.turn();
    if ((turn === "w" && !isHost) || (turn === "b" && !isGuest)) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    let move;
    try {
      move = chess.move({ from, to, promotion });
    } catch {
      move = null;
    }
    if (!move) {
      return NextResponse.json({ error: "Illegal move" }, { status: 400 });
    }

    room.fen = chess.fen();
    room.history = [...room.history, move.san];
    room.lastMove = { from: move.from, to: move.to };
    room.gameSeq = (room.gameSeq ?? 0) + 1;

    if (chess.isCheckmate()) {
      room.status = "Checkmate!";
      room.gameOver = true;
    } else if (chess.isDraw()) {
      room.status = chess.isStalemate()
        ? "Draw by stalemate"
        : chess.isThreefoldRepetition()
          ? "Draw by repetition"
          : chess.isInsufficientMaterial()
            ? "Draw by insufficient material"
            : "Draw";
      room.gameOver = true;
    } else if (chess.isCheck()) {
      room.status = "Check!";
    } else {
      room.status = turn === "w" ? "Black to move" : "White to move";
    }

    if (isHost) room.hostSeenAt = Date.now();
    if (isGuest) room.guestSeenAt = Date.now();

    await saveRoom(room);
    return NextResponse.json(publicRoom(room, playerId));
  }

  if (action === "reset") {
    if (playerId !== room.hostId && playerId !== room.guestId) {
      return NextResponse.json({ error: "Not in room" }, { status: 403 });
    }
    room.fen = START_FEN;
    room.history = [];
    room.lastMove = null;
    room.gameOver = false;
    room.gameSeq = (room.gameSeq ?? 0) + 1;
    room.status = room.guestId
      ? "New game. White to move."
      : "Waiting for opponent…";
    await saveRoom(room);
    return NextResponse.json(publicRoom(room, playerId));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
