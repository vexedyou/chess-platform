# ChessArena

A modern Chess.com-inspired chess platform built with Next.js.

## Features

- **Play vs Computer** — Three difficulty levels with a minimax AI
- **Play Online** — Create private rooms and share codes with friends
- **Tactics Puzzles** — Solve curated chess puzzles
- **Analysis Board** — Load any FEN and explore positions freely
- Clean dark UI inspired by Chess.com

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- chess.js
- react-chessboard
- Lucide icons

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

Push to GitHub and connect the repo to Vercel. It builds automatically.

## Notes

The online multiplayer currently uses browser `localStorage` for simplicity (great for same-device / same-browser testing). For production cross-device realtime play, add a backend such as Supabase Realtime, PartyKit, or Ably.
