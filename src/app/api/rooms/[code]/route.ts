import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getRoom, publicRoom, saveRoom, START_FEN } from "@/lib/rooms";

export const dynamic = "force-dynamic";

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
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const playerId = String(body.playerId || "").slice(0, 64);
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  if (action === "join") {
    if (playerId === room.hostId) return NextResponse.json(publicRoom(room, playerId));
    if (room.guestId && room.guestId !== playerId) {
      return NextResponse.json({ error: "Room is full" }, { status: 403 });
    }
    room.guestId = playerId;
    if (!room.gameOver) {
      room.status =
        room.history.length === 0 ? "Both connected. White to move." : room.status;
    }
    saveRoom(room);
    return NextResponse.json(publicRoom(room, playerId));
  }

  if (action === "move") {
    const from = String(body.from || "");
    const to = String(body.to || "");
    const promotion = body.promotion || "q";
    const isHost = playerId === room.hostId;
    const isGuest = playerId === room.guestId;
    if (!isHost && !isGuest) return NextResponse.json({ error: "Not in room" }, { status: 403 });
    if (room.gameOver) return NextResponse.json({ error: "Game over" }, { status: 400 });
    if (!room.guestId) return NextResponse.json({ error: "Waiting for opponent" }, { status: 400 });

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
    if (!move) return NextResponse.json({ error: "Illegal move" }, { status: 400 });

    room.fen = chess.fen();
    room.history = [...room.history, move.san];
    room.lastMove = { from: move.from, to: move.to };

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
    room.status = room.guestId ? "New game. White to move." : "Waiting for opponent…";
    saveRoom(room);
    return NextResponse.json(publicRoom(room, playerId));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
