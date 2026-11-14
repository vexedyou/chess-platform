import { NextRequest, NextResponse } from "next/server";
import {
  applyMove,
  getRoom,
  joinRoom,
  publicRoom,
  resetRoom,
} from "@/lib/rooms";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const playerId = req.nextUrl.searchParams.get("playerId") || "";
  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(publicRoom(room, playerId));
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  try {
    const body = await req.json();
    const playerId = body.playerId as string;
    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }

    const action = body.action as string;

    if (action === "join") {
      const result = joinRoom(code, playerId);
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(publicRoom(result, playerId));
    }

    if (action === "move") {
      const result = applyMove(code, playerId, {
        fen: body.fen,
        san: body.san,
        from: body.from,
        to: body.to,
        gameOver: body.gameOver,
        status: body.status,
      });
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(publicRoom(result, playerId));
    }

    if (action === "reset") {
      const result = resetRoom(code, playerId);
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(publicRoom(result, playerId));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
