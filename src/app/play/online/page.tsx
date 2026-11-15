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
  generateRoomCode,
  hostKey,
  makePlayerId,
  topicFor,
  type GameState,
  type RoomMessage,
} from "@/lib/mqtt-room";
import { MiniMqtt, MQTT_URLS } from "@/lib/mini-mqtt";

type Phase = "lobby" | "connecting" | "playing";
type Mode = "http" | "mqtt";

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
  const [mode, setMode] = useState<Mode>("http");
  const [roomCode, setRoomCode] = useState(roomFromUrl?.toUpperCase() || "");
  const [joinInput, setJoinInput] = useState("");
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

  const mqttRef = useRef<MiniMqtt | null>(null);
  const gameRef = useRef(game);
  const roleRef = useRef<"host" | "guest" | null>(null);
  const playerIdRef = useRef("");
  const prevHistoryLen = useRef(0);
  const bootstrapped = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdatedRef = useRef(0);
  const boardWidth = useBoardWidth(720);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

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

  const cleanup = useCallback(() => {
    stopPoll();
    try {
      mqttRef.current?.end();
    } catch {
      /* */
    }
    mqttRef.current = null;
  }, [stopPoll]);

  useEffect(() => () => cleanup(), [cleanup]);

  const applyHttpRoom = useCallback((data: PublicRoom) => {
    if (data.updatedAt < lastUpdatedRef.current) return;
    lastUpdatedRef.current = data.updatedAt;
    setGame({
      fen: data.fen,
      history: data.history,
      lastMove: data.lastMove,
      status: data.status,
      gameOver: data.gameOver,
    });
    setYourColor(data.yourColor);
    setConnected(data.playerCount >= 2);
    setRoomCode(data.code);
    setPhase("playing");
    setError("");
  }, []);

  // —— HTTP mode (primary, always works for create) ——
  const startHttpHost = useCallback(async () => {
    cleanup();
    setMode("http");
    setPhase("connecting");
    setStatusLine("Creating room…");
    setError("");
    setBanner(null);
    setViewIndex(-1);
    lastUpdatedRef.current = 0;
    prevHistoryLen.current = 0;
    roleRef.current = "host";

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
      applyHttpRoom(data);
      bootstrapped.current = true;
      router.replace("/play/online?room=" + data.code);
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(
            `/api/rooms/${data.code}?playerId=${encodeURIComponent(pid)}`,
            { cache: "no-store" }
          );
          if (r.ok) applyHttpRoom((await r.json()) as PublicRoom);
        } catch {
          /* */
        }
      }, 800);
    } catch {
      setError("Could not create room. Please try again.");
      setPhase("lobby");
    }
  }, [applyHttpRoom, cleanup, router, stopPoll]);

  const startHttpGuest = useCallback(
    async (codeRaw: string) => {
      const code = codeRaw.trim().toUpperCase();
      if (code.length < 4) {
        setError("Enter a valid room code.");
        return;
      }
      cleanup();
      setMode("http");
      setPhase("connecting");
      setStatusLine("Joining room…");
      setError("");
      setBanner(null);
      setViewIndex(-1);
      lastUpdatedRef.current = 0;
      prevHistoryLen.current = 0;
      roleRef.current = "guest";

      const pid = playerIdRef.current || makePlayerId();
      try {
        // Retry join a few times (serverless instance lag)
        let data: PublicRoom | null = null;
        let lastErr = "Room not found";
        for (let i = 0; i < 6; i++) {
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

        applyHttpRoom(data);
        bootstrapped.current = true;
        router.replace("/play/online?room=" + data.code);
        stopPoll();
        pollRef.current = setInterval(async () => {
          try {
            const r = await fetch(
              `/api/rooms/${data!.code}?playerId=${encodeURIComponent(pid)}`,
              { cache: "no-store" }
            );
            if (r.ok) applyHttpRoom((await r.json()) as PublicRoom);
          } catch {
            /* */
          }
        }, 800);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not join room.");
        setPhase("lobby");
      }
    },
    [applyHttpRoom, cleanup, router, stopPoll]
  );

  // —— MQTT mode (optional realtime) ——
  const startMqtt = useCallback(
    async (code: string, asRole: "host" | "guest") => {
      const normalized = code.toUpperCase();
      cleanup();
      setMode("mqtt");
      setPhase("connecting");
      setStatusLine("Connecting…");
      setError("");
      roleRef.current = asRole;
      setYourColor(asRole === "host" ? "w" : "b");
      setRoomCode(normalized);
      setConnected(false);
      setGame(
        emptyGame(
          asRole === "host"
            ? "Share the code. Waiting for opponent…"
            : "Joining room…"
        )
      );
      prevHistoryLen.current = 0;
      bootstrapped.current = true;
      router.replace("/play/online?room=" + normalized);

      const myId = playerIdRef.current || makePlayerId();

      for (const url of MQTT_URLS) {
        const client = new MiniMqtt(
          url,
          "pp" + asRole[0] + Math.random().toString(16).slice(2, 8)
        );
        try {
          setStatusLine("Connecting…");
          await client.connect(7000);
          mqttRef.current = client;
          client.subscribe(topicFor(normalized));
          client.on((_topic, payload) => {
            let msg: RoomMessage;
            try {
              msg = JSON.parse(payload) as RoomMessage;
            } catch {
              return;
            }
            if (!msg || typeof msg !== "object") return;

            if (msg.type === "ping") {
              if (msg.from !== myId) {
                client.publish(
                  topicFor(normalized),
                  JSON.stringify({ type: "pong", from: myId })
                );
              }
              return;
            }
            if (msg.type === "pong" && msg.from !== myId) {
              setConnected(true);
              return;
            }
            if (msg.type === "hello" && msg.playerId !== myId) {
              setConnected(true);
              if (roleRef.current === "host") {
                const payloadGame: GameState = {
                  ...gameRef.current,
                  status:
                    gameRef.current.history.length === 0
                      ? "Both connected. White to move."
                      : gameRef.current.status,
                };
                setGame(payloadGame);
                client.publish(
                  topicFor(normalized),
                  JSON.stringify({
                    type: "sync",
                    game: payloadGame,
                    from: myId,
                  })
                );
              }
              return;
            }
            if (
              (msg.type === "sync" ||
                msg.type === "move" ||
                msg.type === "reset") &&
              msg.from !== myId
            ) {
              setConnected(true);
              setGame(msg.game);
              setViewIndex(-1);
              if (msg.type === "reset") setBanner(null);
            }
          });

          client.publish(
            topicFor(normalized),
            JSON.stringify({
              type: "hello",
              role: asRole,
              playerId: myId,
            } satisfies RoomMessage)
          );

          setPhase("playing");
          setStatusLine("");
          if (asRole === "host") {
            setGame(emptyGame("Share the code. Waiting for opponent…"));
          }
          return;
        } catch {
          try {
            client.end();
          } catch {
            /* */
          }
        }
      }

      // MQTT failed — fall back to HTTP
      setStatusLine("Using server relay…");
      if (asRole === "host") await startHttpHost();
      else await startHttpGuest(normalized);
    },
    [cleanup, router, startHttpGuest, startHttpHost]
  );

  // URL bootstrap
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
    // Prefer HTTP for reliability
    if (isHost) void startHttpHost();
    else void startHttpGuest(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFromUrl]);

  function startHost() {
    // HTTP first so Create Room never fails
    void startHttpHost();
  }

  function startGuest(code: string) {
    void startHttpGuest(code);
  }

  async function handleMove(move: Move, newFen: string) {
    if (!yourColor || game.gameOver) return;
    if (mode === "mqtt" && !connected) return;
    if (mode === "http" && !connected) return;

    let chess: Chess;
    try {
      chess = new Chess(newFen);
    } catch {
      return;
    }
    const mover = chess.turn() === "w" ? "b" : "w";
    if (mover !== yourColor) return;

    let status = "Opponent's turn";
    let gameOver = false;
    if (chess.isCheckmate()) {
      status = "Checkmate!";
      gameOver = true;
    } else if (chess.isDraw()) {
      status = chess.isStalemate()
        ? "Draw by stalemate"
        : chess.isThreefoldRepetition()
          ? "Draw by repetition"
          : chess.isInsufficientMaterial()
            ? "Draw by insufficient material"
            : "Draw";
      gameOver = true;
    } else if (chess.isCheck()) {
      status = "Check!";
    }

    const next: GameState = {
      fen: newFen,
      history: [...game.history, move.san],
      lastMove: { from: move.from, to: move.to },
      status,
      gameOver,
    };
    setGame(next);
    setViewIndex(-1);

    const pid = playerIdRef.current || makePlayerId();

    if (mode === "mqtt" && mqttRef.current?.connected) {
      mqttRef.current.publish(
        topicFor(roomCode),
        JSON.stringify({ type: "move", game: next, from: pid })
      );
      return;
    }

    // HTTP
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
      if (res.ok) applyHttpRoom((await res.json()) as PublicRoom);
    } catch {
      /* poll recovers */
    }
  }

  async function newGame() {
    const next = emptyGame(
      connected ? "New game. White to move." : "Waiting for opponent…"
    );
    setGame(next);
    setViewIndex(-1);
    setBanner(null);
    prevHistoryLen.current = 0;
    const pid = playerIdRef.current || makePlayerId();

    if (mode === "mqtt" && mqttRef.current?.connected) {
      mqttRef.current.publish(
        topicFor(roomCode),
        JSON.stringify({ type: "reset", game: next, from: pid })
      );
      return;
    }

    try {
      const res = await fetch(`/api/rooms/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", playerId: pid }),
      });
      if (res.ok) applyHttpRoom((await res.json()) as PublicRoom);
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
    cleanup();
    roleRef.current = null;
    bootstrapped.current = false;
    setPhase("lobby");
    setYourColor(null);
    setRoomCode("");
    setGame(emptyGame());
    setError("");
    setStatusLine("");
    setBanner(null);
    setViewIndex(-1);
    setConnected(false);
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
            Create a room and share the <strong>6-letter code</strong>. Your friend types it to join.
          </p>
          {error && (
            <p style={{ color: "#f87171", fontSize: "0.875rem", marginBottom: "1rem" }}>{error}</p>
          )}
          <button onClick={startHost} className="btn-primary" style={{ width: "100%", marginBottom: "1.5rem" }}>
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
                if (e.key === "Enter" && joinInput.trim().length >= 4) startGuest(joinInput);
              }}
            />
            <button
              onClick={() => startGuest(joinInput)}
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
                {yourColor === "w" ? "White" : yourColor === "b" ? "Black" : "…"}
              </strong>
              {connected && !game.gameOver && !viewingPast && (
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
