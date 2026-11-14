"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, Move } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import { generateRoomCode } from "@/lib/utils";
import { Users, Copy, Check, Link2, RotateCcw } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

type GameState = {
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  status: string;
  playerColor: "w" | "b" | null;
};

export default function OnlinePlayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomFromUrl = searchParams.get("room");

  const [roomCode, setRoomCode] = useState(roomFromUrl || "");
  const [joined, setJoined] = useState(!!roomFromUrl);
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState("Waiting for opponent...");
  const [playerColor, setPlayerColor] = useState<"w" | "b" | null>(null);
  const [copied, setCopied] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const chessRef = useRef(new Chess());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const boardWidth = useBoardWidth();

  const storageKey = roomCode ? `chess-room-${roomCode}` : null;

  const syncFromStorage = useCallback(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const data: GameState = JSON.parse(raw);
      if (data.fen !== fen) {
        chessRef.current = new Chess(data.fen);
        setFen(data.fen);
        setHistory(data.history || []);
        setLastMove(data.lastMove);
        setStatus(data.status || "Playing");
      }
    } catch {
      // ignore
    }
  }, [storageKey, fen]);

  useEffect(() => {
    if (!joined || !storageKey) return;

    const existing = localStorage.getItem(storageKey);
    if (!existing) {
      setPlayerColor("w");
      const initial: GameState = {
        fen: chessRef.current.fen(),
        history: [],
        lastMove: null,
        status: "Waiting for opponent to join...",
        playerColor: "w",
      };
      localStorage.setItem(storageKey, JSON.stringify(initial));
      setStatus("Share the room code. You are White.");
    } else {
      const data: GameState = JSON.parse(existing);
      if (playerColor === null) {
        setPlayerColor("b");
        setStatus("You are Black. Waiting for White to move...");
        data.status = "Both players connected. White to move.";
        localStorage.setItem(storageKey, JSON.stringify(data));
      }
      syncFromStorage();
    }

    pollRef.current = setInterval(syncFromStorage, 800);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [joined, storageKey, playerColor, syncFromStorage]);

  function createRoom() {
    const code = generateRoomCode();
    setRoomCode(code);
    setJoined(true);
    setPlayerColor("w");
    router.replace(`/play/online?room=${code}`);
  }

  function joinRoom() {
    if (!roomCode.trim()) return;
    setJoined(true);
    router.replace(`/play/online?room=${roomCode.trim().toUpperCase()}`);
  }

  function handleMove(move: Move, newFen: string) {
    if (!storageKey || !playerColor) return;
    if (chessRef.current.turn() !== playerColor) return;

    chessRef.current = new Chess(newFen);
    setFen(newFen);
    setLastMove({ from: move.from, to: move.to });
    const newHistory = [...history, move.san];
    setHistory(newHistory);

    let newStatus = "Opponent's turn";
    if (chessRef.current.isCheckmate()) {
      newStatus = "Checkmate! You win!";
      setGameOver(true);
    } else if (chessRef.current.isDraw()) {
      newStatus = "Draw";
      setGameOver(true);
    }

    const state: GameState = {
      fen: newFen,
      history: newHistory,
      lastMove: { from: move.from, to: move.to },
      status: newStatus,
      playerColor,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
    setStatus(newStatus);
  }

  function handleGameOver(result: string) {
    setGameOver(true);
    if (result === "white" || result === "black") {
      setStatus(
        (result === "white" && playerColor === "w") ||
          (result === "black" && playerColor === "b")
          ? "You win by checkmate!"
          : "You lost by checkmate"
      );
    } else {
      setStatus(`Draw (${result})`);
    }
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

  function newGame() {
    if (!storageKey) return;
    const chess = new Chess();
    chessRef.current = chess;
    setFen(chess.fen());
    setHistory([]);
    setLastMove(null);
    setGameOver(false);
    const state: GameState = {
      fen: chess.fen(),
      history: [],
      lastMove: null,
      status: "New game started. White to move.",
      playerColor,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
    setStatus(state.status);
  }

  if (!joined) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--accent)]/15 flex items-center justify-center mx-auto mb-5">
            <Users className="w-7 h-7 text-[var(--accent)]" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Play Online</h1>
          <p className="text-[var(--muted)] text-sm mb-8 leading-relaxed">
            Create a private room and share the code with a friend.
          </p>

          <button onClick={createRoom} className="btn-primary w-full mb-6">
            Create New Room
          </button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--card)] px-3 text-[var(--muted)]">
                or join existing
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-center font-mono tracking-widest uppercase focus:outline-none focus:border-[var(--accent)]"
            />
            <button onClick={joinRoom} className="btn-secondary px-5">
              Join
            </button>
          </div>

          <p className="text-xs text-[var(--muted)] mt-6 leading-relaxed">
            Demo uses browser storage. Best for same-device testing. Real-time multiplayer needs a backend.
          </p>
        </div>
      </div>
    );
  }

  const canMove =
    !gameOver && playerColor !== null && chessRef.current.turn() === playerColor;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="board-container mx-auto lg:mx-0">
          <ChessBoard
            fen={fen}
            orientation={playerColor === "b" ? "black" : "white"}
            onMove={handleMove}
            onGameOver={handleGameOver}
            interactive={canMove}
            lastMove={lastMove}
            boardWidth={boardWidth}
          />
        </div>

        <div className="w-full lg:w-80 space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="font-semibold text-lg">Room {roomCode}</h2>
            </div>

            <p className="text-sm font-medium mb-4">{status}</p>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-[var(--muted)]">You are</span>
              <span className="text-sm font-semibold capitalize">
                {playerColor === "w"
                  ? "White"
                  : playerColor === "b"
                  ? "Black"
                  : "..."}
              </span>
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={copyCode} className="btn-secondary flex-1">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Code
              </button>
              <button onClick={copyLink} className="btn-secondary flex-1">
                <Link2 className="w-4 h-4" /> Link
              </button>
            </div>

            <button onClick={newGame} className="btn-ghost w-full">
              <RotateCcw className="w-4 h-4" /> New Game
            </button>
          </div>

          <div className="card p-5">
            <h3 className="font-medium text-sm text-[var(--muted)] mb-3">Moves</h3>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No moves yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono max-h-64 overflow-y-auto">
                {history.map((san, i) => (
                  <div key={i} className="flex gap-2">
                    {i % 2 === 0 && (
                      <span className="text-[var(--muted)] w-6">
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
