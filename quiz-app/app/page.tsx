import cardsRaw from "@/data/cards.json";
import mcqRaw from "@/data/dsai-questions.json";
import pmleRaw from "@/data/questions.json";
import StyleToggle from "@/components/StyleToggle";
import Tile from "@/components/Tile";

// A server component: the bank sizes are read at build time, and none of the three banks is
// shipped to the browser from this page — each source loads its own data on its own route.
const pmleCount = pmleRaw.length;
const cardCount = cardsRaw.length;
const mcqCount = mcqRaw.length;
const courseCount = new Set(cardsRaw.map((c) => c.course)).size;

export default function Home() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-16 pt-10 sm:px-6 sm:pt-20">
      <div className="-mt-4 mb-6 flex justify-end sm:-mt-10 sm:mb-8">
        <StyleToggle />
      </div>
      <header className="mb-10 sm:mb-14">
        <h1 className="neon-title text-balance font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
          Study Console
        </h1>
        <p className="mt-4 max-w-xl font-sans text-lg leading-relaxed text-paperdim">
          Two question banks, one console. Pick what you are revising today.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Tile
          href="/pmle"
          glyph="◇"
          title="Professional ML Engineer"
          subtitle="Google Cloud certification"
          blurb="Exam-style multiple choice for the Google Professional Machine Learning Engineer certification, scored by exam-guide section."
          stats={[
            { label: "questions", value: pmleCount },
            { label: "exam sections", value: 6 },
          ]}
          action="Start the Exam Bank"
        />
        <Tile
          href="/dsai"
          glyph="◆"
          title="Data Science & AI"
          subtitle="MSc coursework"
          blurb="Spaced-repetition flashcards, multiple-choice questions and a revision page for every lecture, filterable by course."
          stats={[
            { label: "flashcards", value: cardCount },
            { label: "questions", value: mcqCount },
            { label: "courses", value: courseCount },
          ]}
          action="Open the MSc Decks"
        />
      </div>
    </main>
  );
}
