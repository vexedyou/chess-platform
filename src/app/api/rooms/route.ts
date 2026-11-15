import { NextRequest, NextResponse } from "next/server";
import { createRoom, publicRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const playerId = String(body.playerId || "").slice(0, 64);
    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }
    const room = createRoom(playerId);
    return NextResponse.json(publicRoom(room, playerId));
  } catch {
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
