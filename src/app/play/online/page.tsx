"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import { Users, Copy, Check, Link2, RotateCcw, Loader2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

type PublicRoom = {
  code: string;
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  status: string;
  gameOver: boolean;
  playerCount: number;
  yourColor: "w" | "b" | null;
  updatedAt: number;
};

function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "";
  const key = "chess-player-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `p_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

function OnlinePlayInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomFromUrl = searchParams.get("room");

  const [playerId, setPlayerId] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const chessRef = useRef(new Chess());
  const lastUpdatedRef = useRef(0);
  const boardWidth = useBoardWidth();

  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
  }, []);

  const applyRoom = useCallback((data: PublicRoom) => {
    if (data.updatedAt < lastUpdatedRef.current) return;
    lastUpdatedRef.current = data.updatedAt;
    try {
      chessRef.current = new Chess(data.fen);
    } catch {
      // keep previous
    }
    setRoom(data);
    setError("");
  }, []);

  // Join from URL
  useEffect(() => {
    if (!playerId || !roomFromUrl || room) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/rooms/${roomFromUrl}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, action: "join" }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Failed to join");
          return;
        }
        applyRoom(data);
      } catch {
        if (!cancelled) setError("Network error joining room");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId, roomFromUrl, room, applyRoom]);

  // Poll room state
  useEffect(() => {
    if (!room || !playerId) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/rooms/${room.code}?playerId=${encodeURIComponent(playerId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        applyRoom(data);
      } catch {
        // ignore transient errors
      }
    }, 700);
    return () => clearInterval(id);
  }, [room?.code, playerId, applyRoom]);

  async function createRoom() {
    if (!playerId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create room");
        return;
      }
      applyRoom(data);
      router.replace(`/play/online?room=${data.code}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    const code = joinInput.trim().toUpperCase();
    if (!code || !playerId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, action: "join" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to join");
        return;
      }
      applyRoom(data);
      router.replace(`/play/online?room=${data.code}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleMove(move: Move, newFen: string) {
    if (!room || !playerId || !room.yourColor) return;
    if (chessRef.current.turn() !== room.yourColor) return;

    const game = new Chess(newFen);
    let status = "Opponent's turn";
    let gameOver = false;
    if (game.isCheckmate()) {
      status = "Checkmate!";
      gameOver = true;
    } else if (game.isDraw()) {
      status = game.isStalemate()
        ? "Draw by stalemate"
        : game.isThreefoldRepetition()
        ? "Draw by repetition"
        : game.isInsufficientMaterial()
        ? "Draw by insufficient material"
        : "Draw";
      gameOver = true;
    } else if (game.isCheck()) {
      status = "Check!";
    }

    // Optimistic update
    chessRef.current = game;
    setRoom((r) =>
      r
        ? {
            ...r,
            fen: newFen,
            history: [...r.history, move.san],
            lastMove: { from: move.from, to: move.to },
            status,
            gameOver,
            updatedAt: Date.now(),
          }
        : r
    );

    try {
      const res = await fetch(`/api/rooms/${room.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          action: "move",
          fen: newFen,
          san: move.san,
          from: move.from,
          to: move.to,
          gameOver,
          status,
        }),
      });
      const data = await res.json();
      if (res.ok) applyRoom(data);
    } catch {
      // polling will recover
    }
  }

  async function newGame() {
    if (!room || !playerId) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, action: "reset" }),
      });
      const data = await res.json();
      if (res.ok) applyRoom(data);
    } catch {
      setError("Failed to reset");
    }
  }

  function copyCode() {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyLink() {
    if (!room) return;
    const url = `${window.location.origin}/play/online?room=${room.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Lobby
  if (!room) {
    return (
      <div
        className="page-wrap"
        style={{ maxWidth: 28 * 16, paddingTop: "4rem", paddingBottom: "4rem" }}
      >
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(129,182,76,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.25rem",
            }}
          >
            <Users style={{ width: 28, height: 28, color: "var(--accent)" }} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            Play Online
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "2rem" }}>
            Create a room and share the code or link with a friend.
          </p>

          {error && (
            <p style={{ color: "#f87171", fontSize: "0.875rem", marginBottom: "1rem" }}>
              {error}
            </p>
          )}

          <button
            onClick={createRoom}
            className="btn-primary"
            style={{ width: "100%", marginBottom: "1.5rem" }}
            disabled={loading || !playerId}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Creating...
              </>
            ) : (
              "Create New Room"
            )}
          </button>

          <div style={{ position: "relative", marginBottom: "1.25rem" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
              }}
            >
              <div style={{ width: "100%", borderTop: "1px solid var(--border)" }} />
            </div>
            <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
              <span
                style={{
                  background: "var(--card)",
                  padding: "0 0.75rem",
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                }}
              >
                or join existing
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              style={{
                flex: 1,
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                padding: "0.625rem 1rem",
                textAlign: "center",
                fontFamily: "monospace",
                letterSpacing: "0.15em",
                color: "var(--foreground)",
                fontSize: "1rem",
              }}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            />
            <button onClick={joinRoom} className="btn-secondary" disabled={loading}>
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  const turn = (() => {
    try {
      return new Chess(room.fen).turn();
    } catch {
      return "w";
    }
  })();

  const canMove =
    !room.gameOver &&
    room.yourColor !== null &&
    turn === room.yourColor &&
    room.playerCount >= 2;

  return (
    <div className="page-wrap" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
          alignItems: "center",
        }}
        className="lg-row"
      >
        <style>{`
          @media (min-width: 1024px) {
            .lg-row { flex-direction: row !important; align-items: flex-start !important; }
            .side-panel { width: 20rem !important; }
          }
        `}</style>

        <div className="board-container">
          <ChessBoard
            fen={room.fen}
            orientation={room.yourColor === "b" ? "black" : "white"}
            onMove={handleMove}
            interactive={canMove}
            lastMove={room.lastMove}
            boardWidth={boardWidth}
          />
        </div>

        <div className="side-panel" style={{ width: "100%", maxWidth: 320 }}>
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <Users style={{ width: 20, height: 20, color: "var(--accent)" }} />
              <h2 style={{ fontWeight: 600, fontSize: "1.125rem", margin: 0 }}>
                Room {room.code}
              </h2>
            </div>

            <p style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.75rem" }}>
              {room.playerCount < 2
                ? "Waiting for opponent to join..."
                : room.status}
            </p>

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", fontSize: "0.875rem" }}>
              <span style={{ color: "var(--muted)" }}>You are</span>
              <strong>
                {room.yourColor === "w"
                  ? "White"
                  : room.yourColor === "b"
                  ? "Black"
                  : "..."}
              </strong>
              <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
                {room.playerCount}/2 players
              </span>
            </div>

            {room.playerCount >= 2 && !room.gameOver && (
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                {turn === room.yourColor ? "Your turn" : "Opponent's turn"}
              </p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <button onClick={copyCode} className="btn-secondary" style={{ flex: 1 }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Code
              </button>
              <button onClick={copyLink} className="btn-secondary" style={{ flex: 1 }}>
                <Link2 className="w-4 h-4" /> Link
              </button>
            </div>

            <button onClick={newGame} className="btn-ghost" style={{ width: "100%" }}>
              <RotateCcw className="w-4 h-4" /> New Game
            </button>
          </div>

          <div className="card" style={{ padding: "1.25rem" }}>
            <h3
              style={{
                fontWeight: 500,
                fontSize: "0.875rem",
                color: "var(--muted)",
                margin: "0 0 0.75rem",
              }}
            >
              Moves
            </h3>
            {room.history.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
                No moves yet
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.25rem 1rem",
                  fontFamily: "monospace",
                  fontSize: "0.875rem",
                  maxHeight: 256,
                  overflowY: "auto",
                }}
              >
                {room.history.map((san, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.35rem" }}>
                    {i % 2 === 0 && (
                      <span style={{ color: "var(--muted)", width: 24 }}>
                        {Math.floor(i / 2) + 1}.
                      </span>
                    )}
                    <span>{san}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function useBoardWidth() {
  const [width, setWidth] = useState(480);
  useEffect(() => {
    function update() {
      setWidth(Math.max(280, Math.min(window.innerWidth - 32, 520)));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}

export default function OnlinePlayPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
          Loading...
        </div>
      }
    >
      <OnlinePlayInner />
    </Suspense>
  );
}
