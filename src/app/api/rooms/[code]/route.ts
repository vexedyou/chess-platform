import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import {
  getRoom,
  publicRoom,
  saveRoom,
  upsertRoom,
  START_FEN,
} from "@/lib/rooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const playerId = req.nextUrl.searchParams.get("playerId") || "";
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
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

  // Host heartbeat: re-publish full state so other instances can see the room
  if (action === "heartbeat") {
    const room = upsertRoom(code.toUpperCase(), {
      hostId: playerId,
      fen: body.fen,
      history: body.history,
      lastMove: body.lastMove,
      status: body.status,
      gameOver: body.gameOver,
      guestId: body.guestId,
    });
    // Clear pending move once host acknowledges
    if (body.clearPending) room.pendingGuestMove = null;
    saveRoom(room);
    return NextResponse.json(publicRoom(room, playerId));
  }

  let room = getRoom(code);

  if (action === "join") {
    if (!room) {
      // Soft create as guest wait — host heartbeat will fill state
      room = upsertRoom(code.toUpperCase(), {
        hostId: "unknown",
        guestId: playerId,
        status: "Waiting for host…",
      });
    }
    if (playerId === room.hostId) {
      return NextResponse.json(publicRoom(room, playerId));
    }
    if (room.guestId && room.guestId !== playerId && room.hostId !== "unknown") {
      return NextResponse.json({ error: "Room is full" }, { status: 403 });
    }
    room.guestId = playerId;
    if (!room.gameOver && room.hostId !== "unknown") {
      room.status =
        room.history.length === 0
          ? "Both connected. White to move."
          : room.status;
    }
    saveRoom(room);
    return NextResponse.json(publicRoom(room, playerId));
  }

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (action === "move") {
    const from = String(body.from || "");
    const to = String(body.to || "");
    const promotion = body.promotion || "q";
    const isHost = playerId === room.hostId;
    const isGuest = playerId === room.guestId;
    if (!isHost && !isGuest) {
      return NextResponse.json({ error: "Not in room" }, { status: 403 });
    }
    if (room.gameOver) {
      return NextResponse.json({ error: "Game over" }, { status: 400 });
    }

    // Guest moves are queued for host to apply via heartbeat/poll
    if (isGuest) {
      room.pendingGuestMove = { from, to, promotion, playerId };
      saveRoom(room);
      return NextResponse.json(publicRoom(room, playerId));
    }

    // Host applies move authoritatively
    let chess: Chess;
    try {
      chess = new Chess(room.fen);
    } catch {
      return NextResponse.json({ error: "Invalid position" }, { status: 500 });
    }
    if (chess.turn() !== "w" && isHost) {
      // Host is always white; if not white's turn reject
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
    if (!move) return NextResponse.json({ error: "Illegal move" }, { status: 400 });

    room.fen = chess.fen();
    room.history = [...room.history, move.san];
    room.lastMove = { from: move.from, to: move.to };
    room.pendingGuestMove = null;

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
    saveRoom(room);
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
    room.pendingGuestMove = null;
    room.status = room.guestId
      ? "New game. White to move."
      : "Waiting for opponent…";
    saveRoom(room);
    return NextResponse.json(publicRoom(room, playerId));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
