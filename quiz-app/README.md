# Study Console

Two question sources in one app. The home page (`/`) lets you pick one:

- **PMLE** (`/pmle`) — a multiple-choice quiz for the Google Professional Machine Learning Engineer
  exam. Source PDFs live in `../PMLE/`.
- **DSAI** (`/dsai`) — an MSc in Data Science and Artificial Intelligence, from `../DSAI/`, with two
  modes: **spaced-repetition flashcards** (`/dsai/flashcards`, from the `*.csv` files) and a
  **multiple-choice quiz** (`/dsai/quiz`, from the `*.json` files).

The two sources share a build, a theme and a Docker image, and nothing else — separate data,
separate save files. (The old `/flashcards` URL redirects to `/dsai/flashcards`.)

## PMLE quiz (`/pmle`)

A responsive (web + mobile) multiple-choice quiz app for preparing for the **Google Professional
Machine Learning Engineer** certification exam. It reframes studying as *evaluating a model (you)*:
practice one question at a time with instant correct/incorrect feedback and an explanation, a live
**accuracy** readout, and a **coverage minimap** of the whole question bank that fills in as you go.

Every question is tagged with its section of the official exam guide, so the **exam sections** panel
doubles as a scorecard and a filter: it shows your accuracy per section next to how much that section
is actually worth on the real exam (~13–21%), and clicking a section narrows practice to just it. The
readout that tells you where you're weak is the control that lets you drill it.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS**. The question bank is static and baked
into the app at build time, so there is no backend or database.

## Question data

`data/questions.json` holds **417 questions** — the union of the source dumps:

- **285** from the `解密` PDF (its own numbering), each with an answer **and a written explanation**,
  extracted by a zero-dependency Node script (`scripts/extract-questions.mjs`). That PDF obfuscates its
  text with a per-font byte-shift and scrambled draw order; the script inflates each content stream,
  detects the shift, reconstructs reading order from the PDF text matrix, strips page furniture, and
  parses each question. ~259 extract cleanly; ~26 carry source defects and are tagged
  `needsReview: true` (shown with a **"⚠ review"** badge).
- **24** additional questions unique to the newer ExamTopics set (304 questions, numbered 1–304). Those
  live only in the image-based `试题答案评论` PDF, so they were recovered by OCR (poppler `pdftoppm`
  at 200 DPI → `tesseract`), which yields the **community-voted** correct answer per question. Each
  carries `source: "ExamTopics #N (community-voted answer)"` and a written explanation.
- **74** more from the newest dump, `Professional Machine Learning Engineer 339题 答案修正版.pdf`. That
  PDF has a clean text layer (plain `pdftotext` reads it), and being the best source in the repo it was
  also used to repair 33 of the defective records above.

Each record is
`{ id, question, options, answers, domain, explanation, needsReview, flags, source?, reviewNote? }`.

`domain` is the question's section of the official exam guide (1–6; see `lib/domains.ts`). It is a
judgment call that cannot be derived from the PDFs, so it is assigned per question and stored in the
JSON — `npm run validate` rejects any question without one, and prints how the bank's coverage of each
section compares to the section's real weight on the exam.

> **Regenerating:** `npm run extract` rebuilds **only the base 285** from the `解密` PDF, emits them with
> `domain: 0` (unclassified), and refuses to overwrite the committed union unless forced. Don't run it
> unless you intend to rebuild the union and re-classify (the OCR + merge pipeline is not committed — the
> JSON is the source of truth, and hand-editing it is the supported way to fix a question).

> **Accuracy note:** answers/explanations are community-sourced (exam-dump answers, community votes, and
> generated explanations for the 24 OCR questions). They can contain errors — always confirm against the
> official Google Cloud documentation.

## DSAI flashcards (`/dsai/flashcards`)

Anki-style spaced repetition over **407 cards** covering four MSc courses (COM6001, COM6002, COM6004,
COM6005). Show the front, reveal the back, then grade yourself **Again / Hard / Good / Easy** — each
button carries the interval it will actually schedule, because the label is the scheduler run four
times rather than a separate estimate.

The scheduler (`lib/srs.ts`) is SM-2 as Anki implements it: 1-minute and 10-minute learning steps, a
1-day graduating interval (4 days straight from Easy), an ease factor that moves ±0.15 per answer and
floors at 1.3, and lapses that drop a card back to relearning. Reviews are day-granular; learning
steps are minute-precise. Interval fuzz is seeded off the card id, so it is deterministic — the same
card always fuzzes the same way, and the button never disagrees with the click. Daily limits (20 new,
200 reviews) are counted against what you have already done today, so re-opening mid-day resumes.

Keyboard: **space** reveals, **1–4** grade.

### Card data

`data/cards.json` is generated by `npm run cards` from the CSVs in `../DSAI/`. Each file is one deck
named `COURSE_Unit.csv` (e.g. `COM6001_Lecture_1.csv`) with two columns, front and back; a header
row and a third Anki `Tags` column are optional. Course and unit come from the file name
(`Lecture_05` is normalised to `Lecture_5`). Drop another CSV into the folder and re-run — courses
and units are derived from the data, so no code changes. Inline `` `code` `` and `$LaTeX$` render
(KaTeX) on both cards and quiz questions.

Each card's `id` is a **content hash, not a row number**. Review state lives in `localStorage` keyed by
that id, so a positional id would renumber the whole deck the moment a new CSV landed and silently
wipe months of scheduling. The hash means adding, removing or reordering files leaves every other
card's history intact. The trade-off: editing a card's *Front* changes its id and resets that one
card's schedule — so `npm run cards` prints an id diff against the committed bank, and
`npm run validate:cards` fails on a card whose stored id no longer matches its own text.

## DSAI quiz (`/dsai/quiz`)

Multiple choice built from the `*.json` files in `../DSAI/` by `npm run mcq` →
`data/dsai-questions.json` (211 questions). Each source file is an array of
`{ question, options: [{ label, text, Explanation }], answers, hints, course, week }`; course and unit
are taken from the **file name**, so a question files under the same course/unit as its deck's
flashcards. Every option carries its own explanation, shown under the option once you check; the
hint can be revealed before answering. Filter by course or individual lecture, sequential or
shuffled order. Ids are content hashes, like the cards. Keyboard: **A–D / 1–4** pick, **Enter**
checks, **h** hint, **← →** move.

## Develop

```bash
npm install
npm run dev             # http://localhost:3000
npm run build           # production build (Next.js standalone output)
npm start               # serve the production build
npm test                # unit tests (node:test, no test dependencies)
npm run validate        # integrity check of data/questions.json
npm run cards           # rebuild data/cards.json from ../DSAI/*.csv
npm run validate:cards  # integrity check of data/cards.json
npm run mcq             # rebuild data/dsai-questions.json from ../DSAI/*.json (validates as it goes)
```

## Run with Docker

```bash
docker compose up --build       # http://localhost:3000
# or
docker build -t pmle-quiz .
docker run -p 3000:3000 pmle-quiz
```

The multi-stage `Dockerfile` produces a ~300 MB image using Next.js `output: "standalone"`; the data
JSON is already compiled into the bundle, so the PDF is not needed at runtime.

## Project layout

```
scripts/extract-questions.mjs   PDF -> data/questions.json (zero-dep, built-in zlib)
scripts/build-cards.mjs         DSAI CSVs -> data/cards.json (zero-dep)
scripts/build-mcq.mjs           DSAI JSON -> data/dsai-questions.json (zero-dep)
scripts/dsai-common.mjs         shared: DSAI dir, file name -> course/unit, content-hash ids
data/questions.json             PMLE question bank       (baked into the bundle)
data/cards.json                 DSAI flashcard deck      (baked into the bundle)
data/dsai-questions.json        DSAI multiple choice     (baked into the bundle)
lib/questions.ts                typed loader + Question type
lib/cards.ts                    typed loader + Card type, courses/units derived from the data
lib/mcq.ts                      typed loader + Mcq type for the DSAI quiz
lib/dsai.ts                     what the DSAI modes share: unit derivation, course labels
lib/deck.ts                     course/unit filter — pure, used by both DSAI modes
lib/rich.ts                     splits `code` and $math$ runs out of DSAI text
lib/srs.ts                      SM-2 scheduler — pure functions, no storage, no React
components/PracticeApp.tsx      quiz controller (nav, shuffle, localStorage)
components/QuestionCard.tsx     one question: options, check/reveal, explanation
components/FlashcardApp.tsx     flashcard controller (due queue, grading, localStorage)
components/Flashcard.tsx        one card: front, reveal, grade buttons
components/DsaiQuizApp.tsx      DSAI quiz controller (filter, order, localStorage)
components/McqCard.tsx          one DSAI question: hint, options, per-option explanations
components/RichText.tsx         renders `code` and KaTeX math inline
components/Tile.tsx             the big pickable cards on / and /dsai
components/ModeSwitch.tsx       home link, plus the cards <-> quiz switch inside DSAI
app/                            / (source picker), /pmle, /dsai, /dsai/flashcards, /dsai/quiz
```

Nothing leaves the browser and there are no accounts. Each mode has its own save file in
`localStorage`: the quiz stores position, answers and mode under `pmle-practice-v3`; the flashcards
store per-card scheduling, daily counts and limits under `msc-cards-srs-v1`; the DSAI quiz stores
answers, order and filter under `dsai-mcq-v1`.
