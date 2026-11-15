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
import type { MqttClient } from "mqtt";
import {
  emptyGame,
  generateRoomCode,
  hostKey,
  makePlayerId,
  MQTT_URLS,
  topicFor,
  type GameState,
  type RoomMessage,
} from "@/lib/mqtt-room";

type Phase = "lobby" | "connecting" | "playing";

async function loadMqttConnect() {
  // Prefer the prebuilt browser bundle — avoids Node polyfill issues in Next/Turbopack
  try {
    const mod = await import("mqtt/dist/mqtt.min");
    const connect = (mod as { connect?: typeof import("mqtt").connect }).connect
      || (mod as { default?: { connect: typeof import("mqtt").connect } }).default?.connect
      || (mod as unknown as typeof import("mqtt").connect);
    if (typeof connect === "function") return connect;
  } catch {
    /* fall through */
  }
  const mod = await import("mqtt");
  return mod.connect;
}

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
  const [mqttReady, setMqttReady] = useState(false);
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

  const clientRef = useRef<MqttClient | null>(null);
  const gameRef = useRef(game);
  const roleRef = useRef<"host" | "guest" | null>(null);
  const codeRef = useRef("");
  const playerIdRef = useRef("");
  const prevHistoryLen = useRef(0);
  const bootstrapped = useRef(false);
  const intentionalClose = useRef(false);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const cleanup = useCallback(() => {
    intentionalClose.current = true;
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
    const c = clientRef.current;
    clientRef.current = null;
    if (c) {
      try {
        c.end(true);
      } catch {
        /* */
      }
    }
    setMqttReady(false);
    setConnected(false);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const publish = useCallback((msg: RoomMessage, code: string) => {
    const c = clientRef.current;
    if (!c || !c.connected) return;
    try {
      c.publish(topicFor(code), JSON.stringify(msg), { qos: 0 });
    } catch {
      /* */
    }
  }, []);

  const wireClient = useCallback(
    (client: MqttClient, normalized: string, asRole: "host" | "guest") => {
      clientRef.current = client;
      intentionalClose.current = false;

      const myId = () => playerIdRef.current || makePlayerId();

      const onReady = () => {
        setMqttReady(true);
        setStatusLine("");
        setPhase("playing");
        setError("");

        client.subscribe(topicFor(normalized), { qos: 0 }, (err) => {
          if (err) {
            setError("Could not join room channel. Try again.");
            return;
          }
          publish(
            { type: "hello", role: asRole, playerId: myId() },
            normalized
          );
          if (asRole === "host") {
            setGame(emptyGame("Share the code. Waiting for opponent…"));
          }

          if (pingTimer.current) clearInterval(pingTimer.current);
          pingTimer.current = setInterval(() => {
            publish({ type: "ping", from: myId() }, normalized);
          }, 5000);
        });
      };

      if (client.connected) onReady();
      else client.on("connect", onReady);

      client.on("message", (_topic, buf) => {
        let msg: RoomMessage;
        try {
          msg = JSON.parse(buf.toString()) as RoomMessage;
        } catch {
          return;
        }
        if (!msg || typeof msg !== "object") return;
        const id = myId();

        if (msg.type === "ping") {
          if (msg.from !== id) publish({ type: "pong", from: id }, normalized);
          return;
        }
        if (msg.type === "pong") {
          if (msg.from !== id) setConnected(true);
          return;
        }
        if (msg.type === "hello") {
          if (msg.playerId === id) return;
          setConnected(true);
          if (roleRef.current === "host") {
            const payload: GameState = {
              ...gameRef.current,
              status:
                gameRef.current.history.length === 0
                  ? "Both connected. White to move."
                  : gameRef.current.status,
            };
            setGame(payload);
            publish({ type: "sync", game: payload, from: id }, normalized);
          }
          return;
        }
        if (msg.type === "sync" || msg.type === "move" || msg.type === "reset") {
          if (msg.from === id) return;
          setConnected(true);
          setGame(msg.game);
          setViewIndex(-1);
          if (msg.type === "reset") setBanner(null);
        }
      });

      client.on("error", () => {
        if (!intentionalClose.current) {
          setError("Connection error. You can still wait — it may recover.");
        }
      });

      client.on("reconnect", () => {
        if (!intentionalClose.current) setStatusLine("Reconnecting…");
      });

      client.on("close", () => {
        if (!intentionalClose.current) {
          setMqttReady(false);
          setConnected(false);
        }
      });
    },
    [publish]
  );

  const connectRoom = useCallback(
    async (code: string, asRole: "host" | "guest") => {
      const normalized = code.toUpperCase();

      // Already connected to this room as this role — don't tear down
      if (
        clientRef.current?.connected &&
        codeRef.current === normalized &&
        roleRef.current === asRole
      ) {
        setPhase("playing");
        return;
      }

      cleanup();
      intentionalClose.current = false;

      codeRef.current = normalized;
      roleRef.current = asRole;
      setRole(asRole);
      setYourColor(asRole === "host" ? "w" : "b");
      setRoomCode(normalized);
      setPhase("connecting");
      setError("");
      setStatusLine("Connecting…");
      setConnected(false);
      setBanner(null);
      setViewIndex(-1);
      setGame(
        emptyGame(
          asRole === "host"
            ? "Share the code. Waiting for opponent…"
            : "Joining room…"
        )
      );
      prevHistoryLen.current = 0;

      // Update URL without retriggering a second connect
      bootstrapped.current = true;
      router.replace("/play/online?room=" + normalized);

      let connectFn: typeof import("mqtt").connect;
      try {
        connectFn = await loadMqttConnect();
      } catch {
        setError("Failed to load multiplayer module. Refresh and try again.");
        setPhase("lobby");
        return;
      }

      let lastError: unknown = null;
      for (let i = 0; i < MQTT_URLS.length; i++) {
        const url = MQTT_URLS[i];
        setStatusLine(
          i === 0 ? "Connecting…" : "Trying backup server (" + (i + 1) + ")…"
        );

        try {
          const client = connectFn(url, {
            clientId:
              "pp" +
              asRole[0] +
              Math.random().toString(16).slice(2, 10),
            clean: true,
            connectTimeout: 8000,
            reconnectPeriod: 3000,
            keepalive: 30,
            protocolVersion: 4,
          });

          const ok = await new Promise<boolean>((resolve) => {
            const t = setTimeout(() => {
              try {
                client.end(true);
              } catch {
                /* */
              }
              resolve(false);
            }, 9000);

            client.once("connect", () => {
              clearTimeout(t);
              resolve(true);
            });
            client.once("error", () => {
              /* wait for timeout or connect */
            });
          });

          if (!ok) {
            lastError = new Error("timeout " + url);
            continue;
          }

          wireClient(client, normalized, asRole);
          return;
        } catch (e) {
          lastError = e;
        }
      }

      console.error("MQTT connect failed", lastError);
      setError("Could not connect. Check your network and try again.");
      setPhase("lobby");
      roleRef.current = null;
      codeRef.current = "";
    },
    [cleanup, router, wireClient]
  );

  // Join from URL only once (guest or returning host tab)
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
    void connectRoom(code, isHost ? "host" : "guest");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFromUrl]);

  function startHost() {
    const code = generateRoomCode();
    try {
      sessionStorage.setItem(hostKey(code), "1");
    } catch {
      /* */
    }
    bootstrapped.current = true;
    void connectRoom(code, "host");
  }

  function startGuest(code: string) {
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 4) {
      setError("Enter a valid room code.");
      return;
    }
    try {
      sessionStorage.removeItem(hostKey(normalized));
    } catch {
      /* */
    }
    bootstrapped.current = true;
    void connectRoom(normalized, "guest");
  }

  function handleMove(move: Move, newFen: string) {
    if (!yourColor || game.gameOver || !connected) return;

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
    publish(
      {
        type: "move",
        game: next,
        from: playerIdRef.current || makePlayerId(),
      },
      roomCode
    );
  }

  function newGame() {
    const next = emptyGame(
      connected ? "New game. White to move." : "Waiting for opponent…"
    );
    setGame(next);
    setViewIndex(-1);
    setBanner(null);
    prevHistoryLen.current = 0;
    publish(
      {
        type: "reset",
        game: next,
        from: playerIdRef.current || makePlayerId(),
      },
      roomCode
    );
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
    codeRef.current = "";
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
                if (e.key === "Enter" && joinInput.trim().length >= 4) {
                  startGuest(joinInput);
                }
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
              onAction={newGame}
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
              {connected
                ? "Opponent connected"
                : mqttReady
                  ? "Waiting for opponent…"
                  : statusLine || "Connecting…"}
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
            <button onClick={newGame} className="btn-ghost" style={{ width: "100%" }} disabled={!connected}>
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
