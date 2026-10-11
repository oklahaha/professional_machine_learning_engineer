import cardsRaw from "@/data/cards.json";
import mcqRaw from "@/data/dsai-questions.json";
import pmleRaw from "@/data/questions.json";
import Tile from "@/components/Tile";

// A server component: the bank sizes are read at build time, and none of the three banks is
// shipped to the browser from this page — each source loads its own data on its own route.
const pmleCount = pmleRaw.length;
const cardCount = cardsRaw.length;
const mcqCount = mcqRaw.length;
const courseCount = new Set(cardsRaw.map((c) => c.course)).size;

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-10 pt-8 sm:pt-14">
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-signal">◈</span>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
            Study Console
          </h1>
        </div>
        <p className="mt-1 font-mono text-xs text-mist">choose a question source</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Tile
          href="/pmle"
          glyph="◇"
          kicker="PMLE · google cloud"
          title="Professional ML Engineer"
          blurb="Exam-style multiple choice for the Google Professional Machine Learning Engineer certification, scored by exam-guide section."
          stats={[
            { label: "questions", value: pmleCount },
            { label: "sections", value: 6 },
          ]}
        />
        <Tile
          href="/dsai"
          glyph="◆"
          kicker="DSAI · msc"
          title="Data Science & AI"
          blurb="MSc coursework: spaced-repetition flashcards and multiple-choice questions, filterable by course and lecture."
          stats={[
            { label: "flashcards", value: cardCount },
            { label: "mc questions", value: mcqCount },
            { label: "courses", value: courseCount },
          ]}
        />
      </div>
    </div>
  );
}
