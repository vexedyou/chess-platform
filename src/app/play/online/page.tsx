"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import MoveHistory, {
  fenAfterMoves,
  lastMoveAt,
} from "@/components/MoveHistory";
import GameBanner, { type BannerKind } from "@/components/GameBanner";
import { playGameSound } from "@/lib/sounds";
import { useBoardWidth } from "@/lib/useBoardWidth";
import {
  Users,
  Copy,
  Check,
  Link2,
  RotateCcw,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import type { DataConnection, Peer } from "peerjs";
import {
  emptyGame,
  generateRoomCode,
  roomPeerId,
  type GamePayload,
  type P2PMessage,
} from "@/lib/p2p";

type Phase = "lobby" | "connecting" | "playing";

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
  const [game, setGame] = useState<GamePayload>(emptyGame());
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewIndex, setViewIndex] = useState(-1);
  const [banner, setBanner] = useState<{
    kind: BannerKind;
    title: string;
    subtitle?: string;
  } | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const gameRef = useRef(game);
  const prevHistoryLen = useRef(0);
  const boardWidth = useBoardWidth(720);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Sounds + banners when game state changes (local or remote)
  useEffect(() => {
    const len = game.history.length;
    if (len > prevHistoryLen.current && len > 0) {
      const san = game.history[len - 1] || "";
      const capture = san.includes("x");
      if (game.gameOver) {
        // handled below
      } else if (game.status.toLowerCase().includes("check")) {
        playGameSound({ check: true });
      } else {
        playGameSound({ capture });
      }
    }
    prevHistoryLen.current = len;

    if (!game.gameOver) return;
    if (!yourColor) return;

    const status = game.status.toLowerCase();
    if (status.includes("checkmate")) {
      try {
        const chess = new Chess(game.fen);
        // side to move is the loser
        const loser = chess.turn();
        const youWon = loser !== yourColor;
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
      setBanner({
        kind: "draw",
        title: "Draw",
        subtitle: game.status,
      });
      playGameSound({ draw: true });
    }
  }, [game.fen, game.gameOver, game.history, game.status, yourColor]);

  const cleanup = useCallback(() => {
    try {
      connRef.current?.close();
    } catch {
      /* ignore */
    }
    try {
      peerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    connRef.current = null;
    peerRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const send = useCallback((msg: P2PMessage) => {
    const conn = connRef.current;
    if (conn?.open) conn.send(msg);
  }, []);

  const applyRemoteGame = useCallback((g: GamePayload) => {
    setGame(g);
    setViewIndex(-1);
  }, []);

  const wireConnection = useCallback(
    (conn: DataConnection, asRole: "host" | "guest") => {
      connRef.current = conn;

      conn.on("open", () => {
        setConnected(true);
        setPhase("playing");
        setError("");

        if (asRole === "host") {
          const payload = {
            ...gameRef.current,
            status:
              gameRef.current.history.length === 0
                ? "Both connected. White to move."
                : gameRef.current.status,
          };
          setGame(payload);
          conn.send({ type: "sync", game: payload } satisfies P2PMessage);
        } else {
          conn.send({ type: "hello", role: "guest" } satisfies P2PMessage);
        }
      });

      conn.on("data", (raw) => {
        const msg = raw as P2PMessage;
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "hello" && asRole === "host") {
          const payload = {
            ...gameRef.current,
            status: "Both connected. White to move.",
          };
          setGame(payload);
          setConnected(true);
          conn.send({ type: "sync", game: payload } satisfies P2PMessage);
          return;
        }

        if (msg.type === "sync" || msg.type === "move" || msg.type === "reset") {
          applyRemoteGame(msg.game);
          setConnected(true);
          setPhase("playing");
          if (msg.type === "reset") setBanner(null);
        }
      });

      conn.on("close", () => {
        setConnected(false);
        setGame((g) => ({
          ...g,
          status: "Opponent disconnected. Waiting...",
        }));
      });

      conn.on("error", () => {
        setError("Connection error. Try recreating the room.");
      });
    },
    [applyRemoteGame]
  );

  const startHost = useCallback(
    async (code: string) => {
      cleanup();
      setPhase("connecting");
      setError("");
      setRole("host");
      setYourColor("w");
      setRoomCode(code);
      setConnected(false);
      setBanner(null);
      setViewIndex(-1);
      setGame(emptyGame("Share the code. Waiting for opponent..."));

      const { default: Peer } = await import("peerjs");
      const peer = new Peer(roomPeerId(code), { debug: 0 });
      peerRef.current = peer;

      peer.on("open", () => {
        setPhase("playing");
        router.replace(`/play/online?room=${code}`);
      });

      peer.on("connection", (conn) => {
        if (connRef.current?.open) {
          conn.close();
          return;
        }
        wireConnection(conn, "host");
      });

      peer.on("error", (err) => {
        const message = String(err?.type || err?.message || err);
        if (message.includes("unavailable-id") || message.includes("taken")) {
          setError("Room code in use. Creating a new one...");
          void startHost(generateRoomCode());
          return;
        }
        setError("Could not create room. Check your connection and retry.");
        setPhase("lobby");
      });
    },
    [cleanup, router, wireConnection]
  );

  const startGuest = useCallback(
    async (code: string) => {
      cleanup();
      setPhase("connecting");
      setError("");
      setRole("guest");
      setYourColor("b");
      setRoomCode(code);
      setConnected(false);
      setBanner(null);
      setViewIndex(-1);
      setGame(emptyGame("Connecting to host..."));

      const { default: Peer } = await import("peerjs");
      const peer = new Peer({ debug: 0 });
      peerRef.current = peer;

      peer.on("open", () => {
        const conn = peer.connect(roomPeerId(code), { reliable: true });
        wireConnection(conn, "guest");

        setTimeout(() => {
          if (!connRef.current?.open) {
            setError(
              "Could not reach host. Ask them to keep the room open, then try again."
            );
            setPhase("lobby");
            cleanup();
          }
        }, 12000);
      });

      peer.on("error", () => {
        setError("Could not join room. Check the code and try again.");
        setPhase("lobby");
      });

      router.replace(`/play/online?room=${code}`);
    },
    [cleanup, router, wireConnection]
  );

  useEffect(() => {
    if (!roomFromUrl) return;
    if (role) return;
    if (phase !== "lobby") return;
    void startGuest(roomFromUrl.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFromUrl]);

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

    const next: GamePayload = {
      fen: newFen,
      history: [...game.history, move.san],
      lastMove: { from: move.from, to: move.to },
      status,
      gameOver,
    };

    setGame(next);
    setViewIndex(-1);
    send({ type: "move", game: next });
  }

  function newGame() {
    const next = emptyGame(
      connected ? "New game. White to move." : "Waiting for opponent..."
    );
    setGame(next);
    setViewIndex(-1);
    setBanner(null);
    send({ type: "reset", game: next });
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyLink() {
    const url = `${window.location.origin}/play/online?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function backToLobby() {
    cleanup();
    setPhase("lobby");
    setRole(null);
    setYourColor(null);
    setConnected(false);
    setRoomCode("");
    setGame(emptyGame());
    setError("");
    setBanner(null);
    setViewIndex(-1);
    router.replace("/play/online");
  }

  if (phase === "lobby") {
    return (
      <div
        className="page-wrap"
        style={{ maxWidth: 420, paddingTop: "3.5rem", paddingBottom: "3rem" }}
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
          <p
            style={{
              color: "var(--muted)",
              fontSize: "0.875rem",
              marginBottom: "1.75rem",
              lineHeight: 1.5,
            }}
          >
            Create a room and share the link — moves sync live between browsers.
          </p>

          {error && (
            <p style={{ color: "#f87171", fontSize: "0.875rem", marginBottom: "1rem" }}>
              {error}
            </p>
          )}

          <button
            onClick={() => void startHost(generateRoomCode())}
            className="btn-primary"
            style={{ width: "100%", marginBottom: "1.5rem" }}
          >
            Create Room
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
            <div
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  background: "var(--card)",
                  padding: "0 0.75rem",
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                }}
              >
                or join
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
                  void startGuest(joinInput.trim().toUpperCase());
                }
              }}
            />
            <button
              onClick={() => void startGuest(joinInput.trim().toUpperCase())}
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
        <Loader2
          className="animate-spin"
          style={{ width: 28, height: 28, margin: "0 auto 1rem" }}
        />
        <p>Connecting…</p>
        {error && (
          <p style={{ color: "#f87171", marginTop: "0.75rem" }}>{error}</p>
        )}
      </div>
    );
  }

  let turn: "w" | "b" = "w";
  try {
    turn = new Chess(game.fen).turn();
  } catch {
    /* keep w */
  }

  const viewingPast =
    viewIndex >= 0 && viewIndex < game.history.length - 1;
  const displayFen = viewingPast
    ? fenAfterMoves(game.history, viewIndex)
    : game.fen;
  const displayLast = viewingPast
    ? lastMoveAt(game.history, viewIndex)
    : game.lastMove;

  const canMove =
    connected &&
    !game.gameOver &&
    !viewingPast &&
    yourColor !== null &&
    turn === yourColor;

  return (
    <div
      className="page-wrap"
      style={{ paddingTop: "1.25rem", paddingBottom: "2rem" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          alignItems: "center",
        }}
        className="game-layout"
      >
        <style>{`
          @media (min-width: 1100px) {
            .game-layout { flex-direction: row !important; align-items: flex-start !important; justify-content: center; gap: 1.75rem !important; }
            .game-side { width: 20rem !important; }
          }
        `}</style>

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

          <div
            className="card"
            style={{ padding: "1.2rem", marginBottom: "0.85rem" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.65rem",
              }}
            >
              <Users style={{ width: 20, height: 20, color: "var(--accent)" }} />
              <h2 style={{ fontWeight: 600, fontSize: "1.1rem", margin: 0 }}>
                Room {roomCode}
              </h2>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.8rem",
                color: connected ? "var(--accent)" : "var(--muted)",
                marginBottom: "0.55rem",
              }}
            >
              {connected ? (
                <Wifi style={{ width: 14, height: 14 }} />
              ) : (
                <WifiOff style={{ width: 14, height: 14 }} />
              )}
              {connected ? "Connected" : "Waiting for opponent…"}
            </div>

            <p style={{ fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.65rem" }}>
              {viewingPast ? "Viewing past move" : game.status}
            </p>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "0.65rem",
                fontSize: "0.875rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>You are</span>
              <strong>
                {yourColor === "w"
                  ? "White"
                  : yourColor === "b"
                    ? "Black"
                    : "…"}
              </strong>
              {connected && !game.gameOver && !viewingPast && (
                <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
                  {turn === yourColor ? "Your turn" : "Their turn"}
                </span>
              )}
            </div>

            {error && (
              <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: "0.65rem" }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
              <button onClick={copyCode} className="btn-secondary" style={{ flex: 1 }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Code
              </button>
              <button onClick={copyLink} className="btn-secondary" style={{ flex: 1 }}>
                <Link2 className="w-4 h-4" /> Link
              </button>
            </div>

            <button
              onClick={newGame}
              className="btn-ghost"
              style={{ width: "100%" }}
              disabled={!connected}
            >
              <RotateCcw className="w-4 h-4" /> New Game
            </button>
            <button
              onClick={backToLobby}
              className="btn-ghost"
              style={{ width: "100%", marginTop: "0.15rem" }}
            >
              Leave room
            </button>
          </div>

          <MoveHistory
            history={game.history}
            viewIndex={viewIndex}
            onViewIndex={setViewIndex}
          />
        </div>
      </div>
    </div>
  );
}

export default function OnlinePlayPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
          Loading…
        </div>
      }
    >
      <OnlinePlayInner />
    </Suspense>
  );
}
