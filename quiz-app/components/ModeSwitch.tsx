"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Mode = { href: string; label: string; title: string };

// The study modes inside each source. PMLE has one, so it gets no switch — just the way home.
const MODES: Record<"pmle" | "dsai", Mode[]> = {
  pmle: [],
  dsai: [
    { href: "/dsai/flashcards", label: "cards", title: "DSAI flashcards with spaced repetition" },
    { href: "/dsai/quiz", label: "quiz", title: "DSAI multiple-choice questions" },
  ],
};

/**
 * Back to the source picker, plus the switch between a source's study modes. Same
 * segmented-pill vocabulary as the seq/shuffle toggle, so it reads as a control rather than
 * navigation chrome.
 */
export default function ModeSwitch({ source }: { source: "pmle" | "dsai" }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Study modes" className="seg">
      <Link
        href="/"
        title="Choose a question source"
        aria-label="Home"
        className="seg-item"
      >
        ⌂
      </Link>
      {MODES[source].map((m) => {
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
