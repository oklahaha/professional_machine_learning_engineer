"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Mode = { href: string; label: string; title: string };

// The study modes inside each source. PMLE has one, so it gets no switch — just the way home.
const MODES: Record<"pmle" | "dsai", Mode[]> = {
  pmle: [],
  dsai: [
    { href: "/dsai/flashcards", label: "Cards", title: "DSAI flashcards with spaced repetition" },
    { href: "/dsai/quiz", label: "Quiz", title: "DSAI multiple-choice questions" },
    { href: "/dsai/notes", label: "Notes", title: "DSAI revision notes, one page per lecture" },
  ],
};

/**
 * The switch between a source's study modes, as `seg-item`s with no container of its own: each
 * page wraps it in a `.seg` of its own, apart from its toggles — it says where you are, which is
 * not a setting. A source with a single mode renders nothing.
 */
export default function ModeSwitch({ source }: { source: "pmle" | "dsai" }) {
  const pathname = usePathname();
  const modes = MODES[source];
  if (modes.length === 0) return null;

  return (
    <nav aria-label="Study modes" className="flex items-center gap-0.5">
      {modes.map((m) => {
        const active = pathname.startsWith(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            title={m.title}
            aria-current={active ? "page" : undefined}
            className="seg-item"
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The way back to the source picker: a plain text link above each page title. */
export function HomeLink() {
  return (
    <Link href="/" className="hud-label inline-flex items-center gap-1.5 transition hover:text-paper">
      <span aria-hidden>←</span> Study Console
    </Link>
  );
}
