"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import MoveHistory, { fenAfterMoves, lastMoveAt } from "@/components/MoveHistory";
import GameBanner, { type BannerKind } from "@/components/GameBanner";
import { playGameSound } from "@/lib/sounds";
import { useBoardWidth } from "@/lib/useBoardWidth";
import {
  Users, Copy, Check, Link2, RotateCcw, Loader2, Wifi, WifiOff, RefreshCw,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import type { DataConnection, Peer } from "peerjs";
import {
  clearHost, emptyGame, generateRoomCode, markHost, PEER_OPTIONS,
  wasHost, type GamePayload, type P2PMessage,
} from "@/lib/p2p";

type Phase = "lobby" | "connecting" | "playing";

function OnlinePlayInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomFromUrl = searchParams.get("room");
  const hostIdFromUrl = searchParams.get("h");

  const [phase, setPhase] = useState<Phase>("lobby");
  const [roomCode, setRoomCode] = useState(roomFromUrl?.toUpperCase() || "");
  const [hostPeerId, setHostPeerId] = useState(hostIdFromUrl || "");
  const [joinInput, setJoinInput] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [yourColor, setYourColor] = useState<"w" | "b" | null>(null);
  const [connected, setConnected] = useState(false);
  const [game, setGame] = useState<GamePayload>(emptyGame());
  const [error, setError] = useState("");
  const [statusLine, setStatusLine] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewIndex, setViewIndex] = useState(-1);
  const [banner, setBanner] = useState<{ kind: BannerKind; title: string; subtitle?: string } | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const gameRef = useRef(game);
  const roleRef = useRef<"host" | "guest" | null>(null);
  const connectingRef = useRef(false);
  const prevHistoryLen = useRef(0);
  const guestRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bootstrappedUrl = useRef(false);
  const hostPeerIdRef = useRef(hostIdFromUrl || "");
  const boardWidth = useBoardWidth(720);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { hostPeerIdRef.current = hostPeerId; }, [hostPeerId]);

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
  }, [game.fen, game.gameOver, game.history, game.status, yourColor]);

  const stopPing = useCallback(() => {
    if (pingRef.current) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
  }, []);

  const startPing = useCallback(() => {
    stopPing();
    pingRef.current = setInterval(() => {
      const conn = connRef.current;
      if (conn?.open) {
        try { conn.send({ type: "ping" } satisfies P2PMessage); } catch { /* */ }
      }
    }, 3000);
  }, [stopPing]);

  const cleanup = useCallback((keepHostMark = false) => {
    stopPing();
    if (guestRetryRef.current) {
      clearTimeout(guestRetryRef.current);
      guestRetryRef.current = null;
    }
    try { connRef.current?.close(); } catch { /* */ }
    try { peerRef.current?.destroy(); } catch { /* */ }
    connRef.current = null;
    peerRef.current = null;
    connectingRef.current = false;
    if (!keepHostMark && roomCode) clearHost(roomCode);
  }, [roomCode, stopPing]);

  useEffect(() => () => cleanup(), [cleanup]);

  const send = useCallback((msg: P2PMessage) => {
    const conn = connRef.current;
    if (conn?.open) {
      try { conn.send(msg); } catch { /* */ }
    }
  }, []);

  const applyRemoteGame = useCallback((g: GamePayload) => {
    setGame(g);
    setViewIndex(-1);
  }, []);

  const onConnOpen = useCallback((conn: DataConnection, asRole: "host" | "guest") => {
    setConnected(true);
    setPhase("playing");
    setError("");
    setStatusLine("");
    connectingRef.current = false;
    startPing();

    if (asRole === "host") {
      const payload: GamePayload = {
        ...gameRef.current,
        status:
          gameRef.current.history.length === 0
            ? "Both connected. White to move."
            : gameRef.current.status,
      };
      setGame(payload);
      try { conn.send({ type: "sync", game: payload } satisfies P2PMessage); } catch { /* */ }
    } else {
      try { conn.send({ type: "hello", role: "guest" } satisfies P2PMessage); } catch { /* */ }
    }
  }, [startPing]);

  const wireConnection = useCallback((conn: DataConnection, asRole: "host" | "guest") => {
    if (connRef.current && connRef.current !== conn) {
      try { connRef.current.close(); } catch { /* */ }
    }
    connRef.current = conn;

    conn.on("data", (raw) => {
      const msg = raw as P2PMessage;
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "ping") {
        try { conn.send({ type: "pong" } satisfies P2PMessage); } catch { /* */ }
        return;
      }
      if (msg.type === "pong") return;

      if (msg.type === "hello" && asRole === "host") {
        const payload: GamePayload = {
          ...gameRef.current,
          status:
            gameRef.current.history.length === 0
              ? "Both connected. White to move."
              : gameRef.current.status,
        };
        setGame(payload);
        setConnected(true);
        try { conn.send({ type: "sync", game: payload } satisfies P2PMessage); } catch { /* */ }
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
      if (connRef.current === conn) {
        setConnected(false);
        stopPing();
        setGame((g) => ({
          ...g,
          status: "Connection lost. Guest can rejoin with the same link.",
        }));
      }
    });

    conn.on("error", () => {
      setError("Connection issue. Try Retry connect or share a fresh link.");
    });

    if (conn.open) onConnOpen(conn, asRole);
    else conn.on("open", () => onConnOpen(conn, asRole));
  }, [applyRemoteGame, onConnOpen, stopPing]);

  const startHost = useCallback(async (code: string) => {
    const normalized = code.toUpperCase();
    cleanup(true);
    connectingRef.current = true;
    roleRef.current = "host";
    markHost(normalized);

    setPhase("connecting");
    setError("");
    setStatusLine("Starting host…");
    setRole("host");
    setYourColor("w");
    setRoomCode(normalized);
    setConnected(false);
    setBanner(null);
    setViewIndex(-1);
    setGame(emptyGame("Share the link. Waiting for opponent…"));

    const { default: Peer } = await import("peerjs");
    const peer = new Peer(PEER_OPTIONS);
    peerRef.current = peer;

    peer.on("open", (id) => {
      setHostPeerId(id);
      hostPeerIdRef.current = id;
      markHost(normalized, id);
      setPhase("playing");
      setStatusLine("");
      setGame(emptyGame("Share the link. Waiting for opponent…"));
      router.replace("/play/online?room=" + normalized + "&h=" + encodeURIComponent(id));
    });

    peer.on("connection", (conn) => {
      if (connRef.current?.open) {
        try { conn.close(); } catch { /* */ }
        return;
      }
      setStatusLine("Opponent joining…");
      wireConnection(conn, "host");
    });

    peer.on("disconnected", () => {
      setStatusLine("Reconnecting to network…");
      try { peer.reconnect(); } catch { /* */ }
    });

    peer.on("error", (err) => {
      const message = String((err as { type?: string })?.type || (err as Error)?.message || err);
      if (message.includes("network") || message.includes("disconnected") || message.includes("socket")) {
        setError("Network glitch. Click Create Room again.");
      } else {
        setError("Could not create room. Check connection and try again.");
      }
      setPhase("lobby");
      roleRef.current = null;
      connectingRef.current = false;
    });
  }, [cleanup, router, wireConnection]);

  const startGuest = useCallback(async (code: string, hostId: string) => {
    const normalized = code.toUpperCase();
    const targetHost = hostId.trim();
    if (!targetHost) {
      setError("This link is missing the host id. Ask for a fresh share link.");
      setPhase("lobby");
      return;
    }

    cleanup(false);
    connectingRef.current = true;
    roleRef.current = "guest";

    setPhase("connecting");
    setError("");
    setStatusLine("Connecting to host…");
    setRole("guest");
    setYourColor("b");
    setRoomCode(normalized);
    setHostPeerId(targetHost);
    setConnected(false);
    setBanner(null);
    setViewIndex(-1);
    setGame(emptyGame("Connecting to host…"));

    const { default: Peer } = await import("peerjs");
    const peer = new Peer(PEER_OPTIONS);
    peerRef.current = peer;

    const tryConnect = (attempt: number) => {
      if (!peerRef.current || peerRef.current.destroyed) return;
      if (connRef.current?.open) return;

      setStatusLine(
        attempt <= 1
          ? "Connecting to host…"
          : "Retrying connection (" + attempt + "/10)…"
      );

      try {
        if (connRef.current) {
          try { connRef.current.close(); } catch { /* */ }
          connRef.current = null;
        }
        const conn = peer.connect(targetHost, {
          reliable: true,
          serialization: "json",
        });
        wireConnection(conn, "guest");
      } catch { /* retry */ }

      if (attempt < 10) {
        guestRetryRef.current = setTimeout(() => {
          if (!connRef.current?.open) tryConnect(attempt + 1);
        }, 2000);
      } else {
        guestRetryRef.current = setTimeout(() => {
          if (!connRef.current?.open) {
            setError("Could not reach the host. They may need to create a new room and resend the link.");
            setStatusLine("");
            setPhase("lobby");
            roleRef.current = null;
            connectingRef.current = false;
            cleanup(false);
          }
        }, 2000);
      }
    };

    peer.on("open", () => tryConnect(1));

    peer.on("disconnected", () => {
      try { peer.reconnect(); } catch { /* */ }
    });

    peer.on("error", (err) => {
      if (connRef.current?.open) return;
      const message = String((err as { type?: string })?.type || (err as Error)?.message || err);
      if (message.includes("peer-unavailable")) {
        setError("Host is not online. Ask them to keep the room open and send a fresh link.");
      } else {
        setError("Could not join. Check the link and that the host is online.");
      }
      setPhase("lobby");
      roleRef.current = null;
      connectingRef.current = false;
    });

    router.replace(
      "/play/online?room=" + normalized + "&h=" + encodeURIComponent(targetHost)
    );
  }, [cleanup, router, wireConnection]);

  useEffect(() => {
    if (!roomFromUrl || bootstrappedUrl.current) return;
    if (roleRef.current || connectingRef.current) return;
    if (phase !== "lobby") return;
    bootstrappedUrl.current = true;
    const code = roomFromUrl.toUpperCase();

    if (wasHost(code) && !hostIdFromUrl) {
      void startHost(code);
      return;
    }

    if (hostIdFromUrl && !wasHost(code)) {
      void startGuest(code, hostIdFromUrl);
      return;
    }

    if (wasHost(code)) {
      void startHost(code);
      return;
    }

    if (!hostIdFromUrl) {
      setError("This link is incomplete. Ask the host to share the full link (Copy Link).");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFromUrl, hostIdFromUrl]);

  function handleMove(move: Move, newFen: string) {
    if (!yourColor || game.gameOver || !connected) return;
    let chess: Chess;
    try { chess = new Chess(newFen); } catch { return; }
    const mover = chess.turn() === "w" ? "b" : "w";
    if (mover !== yourColor) return;

    let status = "Opponent's turn";
    let gameOver = false;
    if (chess.isCheckmate()) { status = "Checkmate!"; gameOver = true; }
    else if (chess.isDraw()) {
      status = chess.isStalemate() ? "Draw by stalemate"
        : chess.isThreefoldRepetition() ? "Draw by repetition"
        : chess.isInsufficientMaterial() ? "Draw by insufficient material" : "Draw";
      gameOver = true;
    } else if (chess.isCheck()) status = "Check!";

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
    const next = emptyGame(connected ? "New game. White to move." : "Waiting for opponent…");
    setGame(next);
    setViewIndex(-1);
    setBanner(null);
    send({ type: "reset", game: next });
  }

  function shareUrl() {
    const h = hostPeerId || hostPeerIdRef.current;
    if (!roomCode || !h) return window.location.href;
    return window.location.origin + "/play/online?room=" + roomCode + "&h=" + encodeURIComponent(h);
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function backToLobby() {
    cleanup(false);
    roleRef.current = null;
    bootstrappedUrl.current = false;
    setPhase("lobby");
    setRole(null);
    setYourColor(null);
    setConnected(false);
    setRoomCode("");
    setHostPeerId("");
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
            Create a room, then share the <strong>full link</strong> (use Copy Link). Keep the host tab open.
          </p>
          {error && <p style={{ color: "#f87171", fontSize: "0.875rem", marginBottom: "1rem" }}>{error}</p>}
          <button onClick={() => void startHost(generateRoomCode())} className="btn-primary" style={{ width: "100%", marginBottom: "1rem" }}>
            Create Room
          </button>
          {!showPaste ? (
            <button className="btn-ghost" onClick={() => setShowPaste(true)}>Paste invite link instead</button>
          ) : (
            <div>
              <input
                type="text" value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="Paste full invite link"
                style={{ width: "100%", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.625rem 1rem", color: "var(--foreground)", fontSize: "0.85rem" }}
              />
              <button
                className="btn-secondary"
                style={{ width: "100%", marginTop: "0.5rem" }}
                onClick={() => {
                  try {
                    const u = new URL(joinInput.trim());
                    const room = u.searchParams.get("room");
                    const h = u.searchParams.get("h");
                    if (room && h) void startGuest(room, h);
                    else setError("Link must include room and host id. Use Copy Link from the host.");
                  } catch {
                    setError("Invalid link.");
                  }
                }}
              >
                Join from link
              </button>
            </div>
          )}
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
        <button onClick={backToLobby} className="btn-ghost" style={{ marginTop: "1.25rem" }}>Cancel</button>
      </div>
    );
  }

  let turn: "w" | "b" = "w";
  try { turn = new Chess(game.fen).turn(); } catch { /* */ }

  const viewingPast = viewIndex >= 0 && viewIndex < game.history.length - 1;
  const displayFen = viewingPast ? fenAfterMoves(game.history, viewIndex) : game.fen;
  const displayLast = viewingPast ? lastMoveAt(game.history, viewIndex) : game.lastMove;
  const canMove = connected && !game.gameOver && !viewingPast && yourColor !== null && turn === yourColor;

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
            <GameBanner kind={banner.kind} title={banner.title} subtitle={banner.subtitle} actionLabel="New game" onAction={newGame} onDismiss={() => setBanner(null)} />
          )}
          <div className="card" style={{ padding: "1.2rem", marginBottom: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.65rem" }}>
              <Users style={{ width: 20, height: 20, color: "var(--accent)" }} />
              <h2 style={{ fontWeight: 600, fontSize: "1.1rem", margin: 0 }}>Room {roomCode}</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: connected ? "var(--accent)" : "var(--muted)", marginBottom: "0.55rem" }}>
              {connected ? <Wifi style={{ width: 14, height: 14 }} /> : <WifiOff style={{ width: 14, height: 14 }} />}
              {connected ? "Connected" : statusLine || "Waiting for opponent…"}
            </div>
            <p style={{ fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.65rem" }}>
              {viewingPast ? "Viewing past move" : game.status}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.65rem", fontSize: "0.875rem" }}>
              <span style={{ color: "var(--muted)" }}>You are</span>
              <strong>{yourColor === "w" ? "White" : yourColor === "b" ? "Black" : "…"}</strong>
              {connected && !game.gameOver && !viewingPast && (
                <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
                  {turn === yourColor ? "Your turn" : "Their turn"}
                </span>
              )}
            </div>
            {error && <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: "0.65rem" }}>{error}</p>}
            {!connected && role === "guest" && hostPeerId && (
              <button onClick={() => void startGuest(roomCode, hostPeerId)} className="btn-secondary" style={{ width: "100%", marginBottom: "0.5rem" }}>
                <RefreshCw className="w-4 h-4" /> Retry connect
              </button>
            )}
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
              <button onClick={copyCode} className="btn-secondary" style={{ flex: 1 }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Code
              </button>
              <button onClick={copyLink} className="btn-secondary" style={{ flex: 1 }}>
                <Link2 className="w-4 h-4" /> Link
              </button>
            </div>
            <p style={{ fontSize: "0.7rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>
              Share the <strong>Link</strong> button (not just the code).
            </p>
            <button onClick={newGame} className="btn-ghost" style={{ width: "100%" }} disabled={!connected}>
              <RotateCcw className="w-4 h-4" /> New Game
            </button>
            <button onClick={backToLobby} className="btn-ghost" style={{ width: "100%", marginTop: "0.15rem" }}>
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
