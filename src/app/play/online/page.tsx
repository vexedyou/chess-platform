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
import {
  emptyGame,
  hostKey,
  makePlayerId,
  type GameState,
} from "@/lib/mqtt-room";

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

function OnlinePlayInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomFromUrl = searchParams.get("room");

  const [phase, setPhase] = useState<Phase>("lobby");
  const [roomCode, setRoomCode] = useState(roomFromUrl?.toUpperCase() || "");
  const [joinInput, setJoinInput] = useState("");
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [yourColor, setYourColor] = useState<"w" | "b" | null>(null);
  const [connected, setConnected] = useState(false);
  const [game, setGame] = useState<GameState>(emptyGame());
  const [error, setError] = useState("");
  const [statusLine, setStatusLine] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewIndex, setViewIndex] = useState(-1);
  const [banner, setBanner] = useState<{
    kind: BannerKind;
    title: string;
    subtitle?: string;
  } | null>(null);

  const playerIdRef = useRef("");
  const roleRef = useRef<"host" | "guest" | null>(null);
  const prevHistoryLen = useRef(0);
  const bootstrapped = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdatedRef = useRef(0);
  const boardWidth = useBoardWidth(720);

  useEffect(() => {
    playerIdRef.current = makePlayerId();
  }, []);

  useEffect(() => {
    const len = game.history.length;
    if (len > prevHistoryLen.current && len > 0) {
      const san = game.history[len - 1] || "";
      if (!game.gameOver) {
        if (game.status.toLowerCase().includes("check")) playGameSound({ check: true });
        else playGameSound({ capture: san.includes("x") });
      }
    }
    prevHistoryLen.current = len;

    if (!game.gameOver || !yourColor) return;
    const status = game.status.toLowerCase();
    if (status.includes("checkmate")) {
      try {
        const chess = new Chess(game.fen);
        const youWon = chess.turn() !== yourColor;
        setBanner({
          kind: youWon ? "win" : "lose",
          title: youWon ? "Checkmate — You win!" : "Checkmate",
          subtitle: youWon ? "Great game." : "Opponent wins.",
        });
        playGameSound({ win: youWon, lose: !youWon });
      } catch {
        setBanner({ kind: "draw", title: game.status });
      }
    } else if (status.includes("draw")) {
      setBanner({ kind: "draw", title: "Draw", subtitle: game.status });
      playGameSound({ draw: true });
    }
  }, [game, yourColor]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const applyRoom = useCallback((data: PublicRoom) => {
    // Accept equal timestamps so presence refreshes still update playerCount
    if (data.updatedAt < lastUpdatedRef.current) return;
    lastUpdatedRef.current = data.updatedAt;
    setGame({
      fen: data.fen,
      history: data.history,
      lastMove: data.lastMove,
      status: data.status,
      gameOver: data.gameOver,
    });
    if (data.yourColor) setYourColor(data.yourColor);
    setConnected(data.playerCount >= 2);
    setRoomCode(data.code);
    setPhase("playing");
    setError("");
  }, []);

  const pollOnce = useCallback(
    async (code: string, r: "host" | "guest") => {
      const pid = playerIdRef.current || makePlayerId();
      try {
        // Presence + state
        const res = await fetch(`/api/rooms/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "presence", playerId: pid, role: r }),
        });
        if (res.ok) {
          applyRoom((await res.json()) as PublicRoom);
          return;
        }
        // Fallback GET
        const g = await fetch(
          `/api/rooms/${code}?playerId=${encodeURIComponent(pid)}&role=${r}`,
          { cache: "no-store" }
        );
        if (g.ok) applyRoom((await g.json()) as PublicRoom);
      } catch {
        /* */
      }
    },
    [applyRoom]
  );

  function startPolling(code: string, r: "host" | "guest") {
    stopPoll();
    void pollOnce(code, r);
    pollRef.current = setInterval(() => {
      void pollOnce(code, r);
    }, 700);
  }

  const startHost = useCallback(async () => {
    stopPoll();
    setPhase("connecting");
    setStatusLine("Creating room…");
    setError("");
    setBanner(null);
    setViewIndex(-1);
    lastUpdatedRef.current = 0;
    prevHistoryLen.current = 0;
    roleRef.current = "host";
    setRole("host");

    const pid = playerIdRef.current || makePlayerId();
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: pid }),
      });
      if (!res.ok) throw new Error("create failed");
      const data = (await res.json()) as PublicRoom;
      try {
        sessionStorage.setItem(hostKey(data.code), "1");
      } catch {
        /* */
      }
      applyRoom(data);
      setYourColor("w");
      bootstrapped.current = true;
      router.replace("/play/online?room=" + data.code);
      startPolling(data.code, "host");
    } catch {
      setError("Could not create room. Please try again.");
      setPhase("lobby");
    }
  }, [applyRoom, router, stopPoll]);

  const startGuest = useCallback(
    async (codeRaw: string) => {
      const code = codeRaw.trim().toUpperCase();
      if (code.length < 4) {
        setError("Enter a valid room code.");
        return;
      }
      stopPoll();
      setPhase("connecting");
      setStatusLine("Joining room…");
      setError("");
      setBanner(null);
      setViewIndex(-1);
      lastUpdatedRef.current = 0;
      prevHistoryLen.current = 0;
      roleRef.current = "guest";
      setRole("guest");

      const pid = playerIdRef.current || makePlayerId();
      try {
        let data: PublicRoom | null = null;
        let lastErr = "Room not found — ask the host to create it again";
        for (let i = 0; i < 15; i++) {
          setStatusLine(`Joining… (${i + 1}/15)`);
          const res = await fetch(`/api/rooms/${code}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "join", playerId: pid }),
          });
          if (res.ok) {
            data = (await res.json()) as PublicRoom;
            break;
          }
          const err = await res.json().catch(() => ({}));
          lastErr = err.error || lastErr;
          await new Promise((r) => setTimeout(r, 400));
        }
        if (!data) throw new Error(lastErr);

        applyRoom(data);
        setYourColor(data.yourColor || "b");
        bootstrapped.current = true;
        router.replace("/play/online?room=" + data.code);
        startPolling(data.code, "guest");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not join room.");
        setPhase("lobby");
      }
    },
    [applyRoom, router, stopPoll]
  );

  useEffect(() => {
    if (!roomFromUrl || bootstrapped.current) return;
    bootstrapped.current = true;
    const code = roomFromUrl.toUpperCase();
    let isHost = false;
    try {
      isHost = sessionStorage.getItem(hostKey(code)) === "1";
    } catch {
      /* */
    }
    if (isHost) void startHost();
    else void startGuest(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFromUrl]);

  async function handleMove(move: Move, newFen: string) {
    if (!yourColor || game.gameOver || !roomCode) return;

    let chess: Chess;
    try {
      chess = new Chess(newFen);
    } catch {
      return;
    }
    const mover = chess.turn() === "w" ? "b" : "w";
    if (mover !== yourColor) return;

    // Optimistic UI
    const optimistic: GameState = {
      fen: newFen,
      history: [...game.history, move.san],
      lastMove: { from: move.from, to: move.to },
      status: chess.isCheckmate()
        ? "Checkmate!"
        : chess.isDraw()
          ? "Draw"
          : chess.isCheck()
            ? "Check!"
            : "Opponent's turn",
      gameOver: chess.isGameOver(),
    };
    setGame(optimistic);
    setViewIndex(-1);

    const pid = playerIdRef.current || makePlayerId();
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, {
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
      if (res.ok) {
        const data = (await res.json()) as PublicRoom;
        applyRoom(data);
      } else {
        // Re-sync
        const r = roleRef.current;
        if (r) void pollOnce(roomCode, r);
      }
    } catch {
      const r = roleRef.current;
      if (r) void pollOnce(roomCode, r);
    }
  }

  async function newGame() {
    if (!roomCode) return;
    setBanner(null);
    setViewIndex(-1);
    prevHistoryLen.current = 0;
    const pid = playerIdRef.current || makePlayerId();
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", playerId: pid }),
      });
      if (res.ok) applyRoom((await res.json()) as PublicRoom);
    } catch {
      /* */
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(
      window.location.origin + "/play/online?room=" + roomCode
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function leave() {
    stopPoll();
    roleRef.current = null;
    bootstrapped.current = false;
    setPhase("lobby");
    setRole(null);
    setYourColor(null);
    setRoomCode("");
    setGame(emptyGame());
    setError("");
    setStatusLine("");
    setBanner(null);
    setViewIndex(-1);
    setConnected(false);
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
            Create a room, share the <strong>6-letter code</strong>, and keep this tab open.
          </p>
          {error && (
            <p style={{ color: "#f87171", fontSize: "0.875rem", marginBottom: "1rem" }}>{error}</p>
          )}
          <button onClick={() => void startHost()} className="btn-primary" style={{ width: "100%", marginBottom: "1.5rem" }}>
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
              autoComplete="off"
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
                if (e.key === "Enter" && joinInput.trim().length >= 4) void startGuest(joinInput);
              }}
            />
            <button
              onClick={() => void startGuest(joinInput)}
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

  if (phase === "connecting") {
    return (
      <div style={{ padding: "4rem", textAlign: "center", color: "var(--muted)" }}>
        <Loader2 className="animate-spin" style={{ width: 28, height: 28, margin: "0 auto 1rem" }} />
        <p>{statusLine || "Connecting…"}</p>
        {error && <p style={{ color: "#f87171", marginTop: "0.75rem" }}>{error}</p>}
        <button onClick={leave} className="btn-ghost" style={{ marginTop: "1.25rem" }}>Cancel</button>
      </div>
    );
  }

  let turn: "w" | "b" = "w";
  try {
    turn = new Chess(game.fen).turn();
  } catch {
    /* */
  }

  const viewingPast = viewIndex >= 0 && viewIndex < game.history.length - 1;
  const displayFen = viewingPast ? fenAfterMoves(game.history, viewIndex) : game.fen;
  const displayLast = viewingPast ? lastMoveAt(game.history, viewIndex) : game.lastMove;
  const canMove =
    connected &&
    !game.gameOver &&
    !viewingPast &&
    yourColor !== null &&
    turn === yourColor;

  return (
    <div className="page-wrap" style={{ paddingTop: "1.25rem", paddingBottom: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center" }} className="game-layout">
        <style>{`@media (min-width: 1100px) { .game-layout { flex-direction: row !important; align-items: flex-start !important; justify-content: center; gap: 1.75rem !important; } .game-side { width: 20rem !important; } }`}</style>
        <div className="board-container">
          <ChessBoard
            fen={displayFen}
            orientation={yourColor === "b" ? "black" : "white"}
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
              <h2 style={{ fontWeight: 600, fontSize: "1.1rem", margin: 0 }}>Room {roomCode}</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: connected ? "var(--accent)" : "var(--muted)", marginBottom: "0.55rem" }}>
              {connected ? <Wifi style={{ width: 14, height: 14 }} /> : <WifiOff style={{ width: 14, height: 14 }} />}
              {connected ? "Opponent connected" : "Waiting for opponent…"}
            </div>
            <p style={{ fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.65rem" }}>
              {viewingPast ? "Viewing past move" : game.status}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.65rem", fontSize: "0.875rem" }}>
              <span style={{ color: "var(--muted)" }}>You are</span>
              <strong>
                {yourColor === "w" ? "White" : yourColor === "b" ? "Black" : role === "host" ? "White" : "…"}
              </strong>
              {connected && !game.gameOver && !viewingPast && yourColor && (
                <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
                  {turn === yourColor ? "Your turn" : "Their turn"}
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
          <MoveHistory history={game.history} viewIndex={viewIndex} onViewIndex={setViewIndex} />
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
