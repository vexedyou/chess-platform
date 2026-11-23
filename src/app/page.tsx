import Link from "next/link";
import { Bot, Users, Puzzle, Search } from "lucide-react";

export default function HomePage() {
  return (
    <div className="page-wrap" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
      <section className="hero">
        <h1>
          Pushing{" "}
          <span style={{ color: "var(--accent)" }}>Pawns</span>
        </h1>
        <p>
          Play vs computer, challenge a friend online, train tactics, or explore
          any position. Built for clean, focused chess.
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

      <section className="features-grid">
        <FeatureCard
          href="/play/computer"
          icon={<Bot className="w-6 h-6" />}
          title="vs Computer"
          description="Four difficulty levels, undo, hints, draw offers — solid solo practice."
        />
        <FeatureCard
          href="/play/online"
          icon={<Users className="w-6 h-6" />}
          title="Play Online"
          description="Create a private room, share the code or link, and play live with a friend."
        />
        <FeatureCard
          href="/puzzles"
          icon={<Puzzle className="w-6 h-6" />}
          title="Tactics"
          description="40+ puzzles with theme & difficulty filters, streaks, hints, and solutions."
        />
        <FeatureCard
          href="/analysis"
          icon={<Search className="w-6 h-6" />}
          title="Analysis"
          description="Load any FEN, play moves freely, and review positions without a clock."
        />
      </section>

      <section className="cta-block">
        <h2>Ready to play?</h2>
        <p>Jump into a game — no account needed.</p>
        <div className="cta-actions">
          <Link href="/play/computer" className="btn-primary">
            vs Computer
          </Link>
          <Link href="/play/online" className="btn-secondary">
            Online Room
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
