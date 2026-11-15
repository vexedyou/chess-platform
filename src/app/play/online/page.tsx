"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import MoveHistory, { fenAfterMoves, lastMoveAt } from "@/components/MoveHistory";
import GameBanner, { type BannerKind } from "@/components/GameBanner";
import { playGameSound } from "@/lib/sounds";
import { useBoardWidth } from "@/lib/useBoardWidth";
import {
  Users, Copy, Check, Link2, RotateCcw, Loader2, Wifi, WifiOff,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

type Phase = "lobby" | "connecting" | "playing";

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

function playerId(): string {
  try {
    const key = "pp-player-id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "p_" + Math.random().toString(36).slice(2);
  }
}

function OnlinePlayInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomFromUrl = searchParams.get("room");

  const [phase, setPhase] = useState<Phase>("lobby");
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewIndex, setViewIndex] = useState(-1);
  const [banner, setBanner] = useState<{
    kind: BannerKind;
    title: string;
    subtitle?: string;
  } | null>(null);

  const pidRef = useRef("");
  const lastUpdatedRef = useRef(0);
  const prevHistoryLen = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bootstrapped = useRef(false);
  const boardWidth = useBoardWidth(720);

  useEffect(() => {
    pidRef.current = playerId();
  }, []);

  const stopPoll = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const applyRoom = useCallback((data: PublicRoom) => {
    // Accept equal timestamps so we don't drop legitimate refreshes
    if (data.updatedAt < lastUpdatedRef.current) return;
    lastUpdatedRef.current = data.updatedAt;
    setRoom(data);
    setPhase("playing");
    setError("");
  }, []);

  const fetchRoom = useCallback(
    async (code: string) => {
      const pid = pidRef.current || playerId();
      const res = await fetch(
        `/api/rooms/${code.toUpperCase()}?playerId=${encodeURIComponent(pid)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        if (res.status === 404) {
          setError("Room not found. Check the code or create a new room.");
          stopPoll();
          setPhase("lobby");
          setRoom(null);
        }
        return;
      }
      const data = (await res.json()) as PublicRoom;
      applyRoom(data);
    },
    [applyRoom, stopPoll]
  );

  const startPoll = useCallback(
    (code: string) => {
      stopPoll();
      pollingRef.current = setInterval(() => {
        void fetchRoom(code);
      }, 700);
    },
    [fetchRoom, stopPoll]
  );

  useEffect(() => () => stopPoll(), [stopPoll]);

  // Sounds + banners
  useEffect(() => {
    if (!room) return;
    const len = room.history.length;
    if (len > prevHistoryLen.current && len > 0) {
      const san = room.history[len - 1] || "";
      if (!room.gameOver) {
        if (room.status.toLowerCase().includes("check")) playGameSound({ check: true });
        else playGameSound({ capture: san.includes("x") });
      }
    }
    prevHistoryLen.current = len;

    if (!room.gameOver || !room.yourColor) return;
    const status = room.status.toLowerCase();
    if (status.includes("checkmate")) {
      try {
        const chess = new Chess(room.fen);
        const youWon = chess.turn() !== room.yourColor;
        setBanner({
          kind: youWon ? "win" : "lose",
          title: youWon ? "Checkmate — You win!" : "Checkmate",
          subtitle: youWon ? "Great game." : "Opponent wins.",
        });
        playGameSound({ win: youWon, lose: !youWon });
      } catch {
        setBanner({ kind: "draw", title: room.status });
      }
    } else if (status.includes("draw")) {
      setBanner({ kind: "draw", title: "Draw", subtitle: room.status });
      playGameSound({ draw: true });
    }
  }, [room]);

  async function createRoom() {
    setPhase("connecting");
    setError("");
    setBanner(null);
    setViewIndex(-1);
    lastUpdatedRef.current = 0;
    prevHistoryLen.current = 0;
    const pid = pidRef.current || playerId();
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: pid }),
      });
      if (!res.ok) throw new Error("create failed");
      const data = (await res.json()) as PublicRoom;
      applyRoom(data);
      router.replace("/play/online?room=" + data.code);
      startPoll(data.code);
    } catch {
      setError("Could not create room. Try again.");
      setPhase("lobby");
    }
  }

  async function joinRoom(codeRaw: string) {
    const code = codeRaw.trim().toUpperCase();
    if (code.length < 4) {
      setError("Enter a valid room code.");
      return;
    }
    setPhase("connecting");
    setError("");
    setBanner(null);
    setViewIndex(-1);
    lastUpdatedRef.current = 0;
    prevHistoryLen.current = 0;
    const pid = pidRef.current || playerId();
    try {
      const res = await fetch(`/api/rooms/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", playerId: pid }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "join failed");
      }
      const data = (await res.json()) as PublicRoom;
      applyRoom(data);
      router.replace("/play/online?room=" + data.code);
      startPoll(data.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join room.");
      setPhase("lobby");
    }
  }

  // Auto-join from URL
  useEffect(() => {
    if (!roomFromUrl || bootstrapped.current) return;
    bootstrapped.current = true;
    void joinRoom(roomFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFromUrl]);

  async function handleMove(move: Move, _newFen: string) {
    if (!room || room.gameOver) return;
    const pid = pidRef.current || playerId();

    // Optimistic update
    const chess = new Chess(room.fen);
    try {
      chess.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
    } catch {
      return;
    }
    const optimistic: PublicRoom = {
      ...room,
      fen: chess.fen(),
      history: [...room.history, move.san],
      lastMove: { from: move.from, to: move.to },
      status: chess.isCheckmate()
        ? "Checkmate!"
        : chess.isCheck()
          ? "Check!"
          : "Opponent's turn",
      gameOver: chess.isGameOver(),
      updatedAt: Date.now(),
    };
    setRoom(optimistic);
    lastUpdatedRef.current = optimistic.updatedAt;
    setViewIndex(-1);

    try {
      const res = await fetch(`/api/rooms/${room.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          playerId: pid,
          from: move.from,
          to: move.to,
          promotion: move.promotion || "q",
        }),
      });
      if (!res.ok) {
        // Re-sync from server
        void fetchRoom(room.code);
        return;
      }
      const data = (await res.json()) as PublicRoom;
      applyRoom(data);
    } catch {
      void fetchRoom(room.code);
    }
  }

  async function newGame() {
    if (!room) return;
    const pid = pidRef.current || playerId();
    setBanner(null);
    setViewIndex(-1);
    try {
      const res = await fetch(`/api/rooms/${room.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", playerId: pid }),
      });
      if (res.ok) {
        const data = (await res.json()) as PublicRoom;
        applyRoom(data);
        prevHistoryLen.current = 0;
      }
    } catch {
      /* poll will recover */
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
    navigator.clipboard.writeText(
      window.location.origin + "/play/online?room=" + room.code
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function leave() {
    stopPoll();
    bootstrapped.current = false;
    setRoom(null);
    setPhase("lobby");
    setError("");
    setBanner(null);
    setViewIndex(-1);
    lastUpdatedRef.current = 0;
    router.replace("/play/online");
  }

  if (phase === "lobby") {
    return (
      <div className="page-wrap" style={{ maxWidth: 420, paddingTop: "3.5rem", paddingBottom: "3rem" }}>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(129,182,76,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <Users style={{ width: 28, height: 28, color: "var(--accent)" }} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Play Online</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.75rem", lineHeight: 1.5 }}>
            Create a room and share the <strong>6-letter code</strong> with a friend.
          </p>
          {error && (
            <p style={{ color: "#f87171", fontSize: "0.875rem", marginBottom: "1rem" }}>{error}</p>
          )}
          <button onClick={() => void createRoom()} className="btn-primary" style={{ width: "100%", marginBottom: "1.5rem" }}>
            Create Room
          </button>
          <div style={{ position: "relative", marginBottom: "1.25rem" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}>
              <div style={{ width: "100%", borderTop: "1px solid var(--border)" }} />
            </div>
            <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
              <span style={{ background: "var(--card)", padding: "0 0.75rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                or join with code
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && joinInput.trim().length >= 4) {
                  void joinRoom(joinInput);
                }
              }}
            />
            <button
              onClick={() => void joinRoom(joinInput)}
              className="btn-secondary"
              disabled={joinInput.trim().length < 4}
            >
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "connecting" || !room) {
    return (
      <div style={{ padding: "4rem", textAlign: "center", color: "var(--muted)" }}>
        <Loader2 className="animate-spin" style={{ width: 28, height: 28, margin: "0 auto 1rem" }} />
        <p>Connecting…</p>
        {error && <p style={{ color: "#f87171", marginTop: "0.75rem" }}>{error}</p>}
        <button onClick={leave} className="btn-ghost" style={{ marginTop: "1.25rem" }}>Cancel</button>
      </div>
    );
  }

  let turn: "w" | "b" = "w";
  try { turn = new Chess(room.fen).turn(); } catch { /* */ }

  const viewingPast = viewIndex >= 0 && viewIndex < room.history.length - 1;
  const displayFen = viewingPast ? fenAfterMoves(room.history, viewIndex) : room.fen;
  const displayLast = viewingPast ? lastMoveAt(room.history, viewIndex) : room.lastMove;
  const connected = room.playerCount >= 2;
  const canMove =
    connected &&
    !room.gameOver &&
    !viewingPast &&
    room.yourColor !== null &&
    turn === room.yourColor;

  return (
    <div className="page-wrap" style={{ paddingTop: "1.25rem", paddingBottom: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center" }} className="game-layout">
        <style>{`@media (min-width: 1100px) { .game-layout { flex-direction: row !important; align-items: flex-start !important; justify-content: center; gap: 1.75rem !important; } .game-side { width: 20rem !important; } }`}</style>
        <div className="board-container">
          <ChessBoard
            fen={displayFen}
            orientation={room.yourColor === "b" ? "black" : "white"}
            onMove={handleMove}
            interactive={canMove}
            lastMove={displayLast}
            boardWidth={boardWidth}
          />
        </div>
        <div className="game-side" style={{ width: "100%", maxWidth: 340 }}>
          {banner && (
            <GameBanner
              kind={banner.kind}
              title={banner.title}
              subtitle={banner.subtitle}
              actionLabel="New game"
              onAction={() => void newGame()}
              onDismiss={() => setBanner(null)}
            />
          )}
          <div className="card" style={{ padding: "1.2rem", marginBottom: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.65rem" }}>
              <Users style={{ width: 20, height: 20, color: "var(--accent)" }} />
              <h2 style={{ fontWeight: 600, fontSize: "1.1rem", margin: 0 }}>Room {room.code}</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: connected ? "var(--accent)" : "var(--muted)", marginBottom: "0.55rem" }}>
              {connected ? <Wifi style={{ width: 14, height: 14 }} /> : <WifiOff style={{ width: 14, height: 14 }} />}
              {connected ? "Opponent connected" : "Waiting for opponent…"}
            </div>
            <p style={{ fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.65rem" }}>
              {viewingPast ? "Viewing past move" : room.status}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.65rem", fontSize: "0.875rem" }}>
              <span style={{ color: "var(--muted)" }}>You are</span>
              <strong>
                {room.yourColor === "w" ? "White" : room.yourColor === "b" ? "Black" : "…"}
              </strong>
              {connected && !room.gameOver && !viewingPast && (
                <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
                  {turn === room.yourColor ? "Your turn" : "Their turn"}
                </span>
              )}
            </div>
            {error && (
              <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: "0.65rem" }}>{error}</p>
            )}
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
              <button onClick={copyCode} className="btn-secondary" style={{ flex: 1 }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Code
              </button>
              <button onClick={copyLink} className="btn-secondary" style={{ flex: 1 }}>
                <Link2 className="w-4 h-4" /> Link
              </button>
            </div>
            <button onClick={() => void newGame()} className="btn-ghost" style={{ width: "100%" }} disabled={!connected}>
              <RotateCcw className="w-4 h-4" /> New Game
            </button>
            <button onClick={leave} className="btn-ghost" style={{ width: "100%", marginTop: "0.15rem" }}>
              Leave room
            </button>
          </div>
          <MoveHistory history={room.history} viewIndex={viewIndex} onViewIndex={setViewIndex} />
        </div>
      </div>
    </div>
  );
}

export default function OnlinePlayPage() {
  return (
    <Suspense fallback={<div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>Loading…</div>}>
      <OnlinePlayInner />
    </Suspense>
  );
}
