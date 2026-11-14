import Link from "next/link";
import { Bot, Users, Puzzle, Search, Zap, Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 sm:py-20">
      {/* Hero */}
      <section className="text-center mb-16">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-4">
          Play Chess.{" "}
          <span className="text-[var(--accent)]">Get Better.</span>
        </h1>
        <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto mb-8">
          Challenge the computer, solve tactics puzzles, analyze your games, or
          play friends online. Clean, fast, and focused on the game.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/play/computer" className="btn-primary text-base">
            Play vs Computer
          </Link>
          <Link href="/play/online" className="btn-secondary text-base">
            Play Online
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
        <FeatureCard
          href="/play/computer"
          icon={<Bot className="w-6 h-6" />}
          title="Play vs Computer"
          description="Choose your difficulty and face a solid AI opponent. Great for practice anytime."
        />
        <FeatureCard
          href="/play/online"
          icon={<Users className="w-6 h-6" />}
          title="Play Online"
          description="Create a private room and share the code. Play live games with friends."
        />
        <FeatureCard
          href="/puzzles"
          icon={<Puzzle className="w-6 h-6" />}
          title="Tactics Trainer"
          description="Solve chess puzzles to sharpen your tactical vision and pattern recognition."
        />
        <FeatureCard
          href="/analysis"
          icon={<Search className="w-6 h-6" />}
          title="Game Analysis"
          description="Load any position or game and explore moves freely on an analysis board."
        />
        <FeatureCard
          href="/play/computer"
          icon={<Zap className="w-6 h-6" />}
          title="Instant Games"
          description="No account required. Jump straight into a game in seconds."
        />
        <FeatureCard
          href="/puzzles"
          icon={<Trophy className="w-6 h-6" />}
          title="Improve Daily"
          description="Build habits with puzzles and AI games. Track your progress over time."
        />
      </section>

      {/* CTA */}
      <section className="card p-8 sm:p-12 text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to play?</h2>
        <p className="text-[var(--muted)] mb-6">
          Pick your mode and start a game right now.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/play/computer" className="btn-primary">
            vs Computer
          </Link>
          <Link href="/play/online" className="btn-secondary">
            Create Online Game
          </Link>
          <Link href="/puzzles" className="btn-secondary">
            Solve Puzzles
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="card p-6 hover:bg-[var(--card-hover)] transition-colors group"
    >
      <div className="w-11 h-11 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-[var(--muted)] leading-relaxed">{description}</p>
    </Link>
  );
}
