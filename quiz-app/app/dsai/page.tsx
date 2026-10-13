import type { Metadata } from "next";
import cardsRaw from "@/data/cards.json";
import mcqRaw from "@/data/dsai-questions.json";
import ModeSwitch from "@/components/ModeSwitch";
import Tile from "@/components/Tile";

export const metadata: Metadata = {
  title: "DSAI Study",
  description: "MSc in Data Science and Artificial Intelligence — flashcards and multiple choice.",
};

// Read at build time on the server; neither bank ships to the browser from this page.
const courses = [...new Set(cardsRaw.map((c) => c.course))].sort();
const cardDecks = new Set(cardsRaw.map((c) => c.deck)).size;
const mcqDecks = new Set(mcqRaw.map((q) => q.deck)).size;

export default function Page() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-10 pt-8 sm:pt-14">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden className="neon-glyph animate-float">◆</span>
            <h1 className="neon-title font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Data Science &amp; AI
            </h1>
          </div>
          <p className="mt-1.5 font-mono text-xs uppercase tracking-[0.2em] text-mist">{courses.join(" · ")}</p>
        </div>
        <ModeSwitch source="dsai" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Tile
          href="/dsai/flashcards"
          glyph="▣"
          kicker="anki-style · spaced repetition"
          title="Flashcards"
          blurb="Recall the answer, then grade yourself Again / Hard / Good / Easy. Cards come back on an SM-2 schedule."
          stats={[
            { label: "cards", value: cardsRaw.length },
            { label: "decks", value: cardDecks },
          ]}
        />
        <Tile
          href="/dsai/quiz"
          glyph="◉"
          kicker="multiple choice · per-option feedback"
          title="Quiz"
          blurb="Pick an answer, ask for a hint if you need one, and see why every option is right or wrong."
          stats={[
            { label: "questions", value: mcqRaw.length },
            { label: "decks", value: mcqDecks },
          ]}
        />
      </div>
    </div>
  );
}
