import Link from "next/link";
import { Bot, Users, Puzzle, Search, Zap, Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <div className="page-wrap" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
      {/* Hero */}
      <section className="hero">
        <h1>
          Play Chess.{" "}
          <span style={{ color: "var(--accent)" }}>Get Better.</span>
        </h1>
        <p>
          Challenge the computer, solve tactics puzzles, analyze your games, or
          play friends online. Clean, fast, and focused on the game.
        </p>
        <div className="hero-actions">
          <Link href="/play/computer" className="btn-primary">
            Play vs Computer
          </Link>
          <Link href="/play/online" className="btn-secondary">
            Play Online
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section className="features-grid">
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
      <section className="cta-block">
        <h2>Ready to play?</h2>
        <p>Pick your mode and start a game right now.</p>
        <div className="cta-actions">
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
    <Link href={href} className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </Link>
  );
}
