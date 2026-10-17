import type { Metadata } from "next";
import cardsRaw from "@/data/cards.json";
import mcqRaw from "@/data/dsai-questions.json";
import ModeSwitch, { HomeLink } from "@/components/ModeSwitch";
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
    <main id="main" className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="flex items-center justify-between gap-4">
        <HomeLink />
        <div className="seg">
          <ModeSwitch source="dsai" />
        </div>
      </div>
      <header className="mb-10 mt-8 sm:mb-14 sm:mt-12">
        <h1 className="neon-title text-balance font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
          Data Science &amp; AI
        </h1>
        <p className="mt-4 max-w-xl font-sans text-lg leading-relaxed text-paperdim">
          MSc revision across {courses.length} courses: <span translate="no">{courses.join(", ")}</span>.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Tile
          href="/dsai/flashcards"
          glyph="▣"
          title="Flashcards"
          subtitle="Spaced repetition, Anki-style"
          blurb="Recall the answer, then grade yourself Again, Hard, Good or Easy. Cards come back on an SM-2 schedule."
          stats={[
            { label: "cards", value: cardsRaw.length },
            { label: "decks", value: cardDecks },
          ]}
          action="Review cards"
        />
        <Tile
          href="/dsai/quiz"
          glyph="◉"
          title="Quiz"
          subtitle="Multiple choice with per-option feedback"
          blurb="Pick an answer, ask for a hint if you need one, and see why every option is right or wrong."
          stats={[
            { label: "questions", value: mcqRaw.length },
            { label: "decks", value: mcqDecks },
          ]}
          action="Take the quiz"
        />
      </div>
    </main>
  );
}
