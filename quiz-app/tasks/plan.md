# Plan: Google PMLE Exam-Prep Quiz App

## Context

The user wants a responsive (web + mobile) multiple-choice quiz app to prepare for the **Google
Professional Machine Learning Engineer** exam, deployable as a Docker image. The repo currently holds
only three source PDFs and no code.

**Key exploration finding — the data is fully extractable.** The PDFs use a font-subset obfuscation
(per-stream Caesar byte-shift), but the text decodes cleanly:

- **`Google-...+解密.pdf`** is the gold source. Decoding each content stream with a per-stream
  best-shift (score by English-word frequency) yields the complete bank: **~285 questions**
  (Version 10.0, 317 pages) each with a stem, `A. B. C. D.` options, an `Answer: X` line (sometimes
  multi-letter, e.g. `Answer: DE`), an **Explanation**, and a **Reference**. A page footer
  (`Google - Professional-Machine-Learning-Engineer Exams Prep N of 317 Top IT Certification Prep
  Material`) repeats on every page and is trivially stripped.
- `google-...+试题.pdf` (questions only, +28 shift) is a secondary/cross-check source.
- `google-...+试题答案评论.pdf` (answers+comments) has **no text layer** — it is image-rendered, so
  community comments cannot be auto-extracted here (no OCR available). Out of scope.

**Chosen approach (from user):** Next.js (App Router) + TypeScript + Tailwind CSS; **Practice mode**
only (one question at a time, instant correct/incorrect feedback + explanation). Questions are static,
so no backend/DB is needed — the extracted `questions.json` is baked into the app at build time.

## Architecture

```
quiz-app/
  scripts/extract-questions.mjs   # Node, zero external deps (built-in zlib) — PDF -> questions.json
  data/questions.json             # generated + committed; source of truth at runtime
  app/
    layout.tsx  page.tsx          # practice page (client component)
    globals.css                   # Tailwind
  components/
    QuestionCard.tsx  OptionButton.tsx  ProgressBar.tsx  ExplanationPanel.tsx
  lib/
    questions.ts                  # typed loader + Question type
  Dockerfile                      # multi-stage: build -> Next standalone runtime
  docker-compose.yml
  next.config.mjs  tsconfig.json  tailwind.config.ts  package.json
  README.md
```

**Data model** (`lib/questions.ts`):
```ts
type Question = {
  id: number;                 // sequential 1..N
  question: string;           // stem
  options: { label: string; text: string }[];  // A..E
  answers: string[];          // e.g. ["B"] or ["D","E"] — supports multi-select
  explanation: string;
  reference?: string;
};
```

**Extraction pipeline** (`scripts/extract-questions.mjs`, run via `npm run extract`):
1. Read the 解密 PDF as a buffer; regex out `stream…endstream` blocks; `zlib.inflateSync` each.
2. Keep streams containing `Tj`/`TJ`; unescape PDF strings (octal `\ddd` → byte); for each stream pick
   the byte-shift (0–255) maximizing English-word hits; concatenate in file order.
3. Strip the repeating page footer/header; split the continuous text into per-question blocks; parse
   stem, `A./B./C./D./E.` options, `Answer:` letters, `Explanation`, `Reference`.
4. **Validate**: assert ≈285 questions; every question has ≥2 options and ≥1 answer letter that maps to
   an existing option; log any malformed question. Write pretty `data/questions.json`.

Node's built-in `zlib` handles FlateDecode, so the extractor needs **no external dependency** and
does not run inside the Docker image (JSON is pre-generated and committed).

## Task breakdown (vertical slices)

### Phase 0 — Scaffold
- **T0.** `create-next-app` (TS, App Router, Tailwind, ESLint) into `quiz-app/`. Strip boilerplate to a
  minimal placeholder page.
- *Acceptance:* `npm run dev` serves a page at `localhost:3000`; `npm run build` succeeds.

### Phase 1 — Data extraction (**Checkpoint A** after)
- **T1.** Write `scripts/extract-questions.mjs` + `lib/questions.ts` type; add `npm run extract`.
- **T2.** Run it; produce `data/questions.json`; validation passes.
- *Acceptance:* `data/questions.json` has ~285 entries; each has stem, options, ≥1 valid answer,
  explanation. Extractor prints a summary (count, # multi-answer, # flagged).
- *Verification:* spot-check 5 questions (incl. one multi-answer like `Answer: DE`) against the decoded
  PDF text for correctness and clean option boundaries.
- **Checkpoint A:** pause for the user to eyeball a few extracted questions before building UI on top.

### Phase 2 — Practice mode end-to-end (thin vertical slice)
- **T3.** `lib/questions.ts` loads JSON; render ONE real question in `QuestionCard` with selectable
  options, a Submit/Reveal action, correct/incorrect coloring, and the explanation + reference on reveal.
  Support both single- and multi-answer questions.
- *Acceptance:* Selecting option(s) + Submit shows correct answer highlighting and the explanation for a
  real question from the bank.
- *Verification:* `npm run dev`, answer a single-answer and a multi-answer question, confirm feedback +
  explanation render correctly.

### Phase 3 — Full bank + navigation + polish
- **T4.** Prev/Next navigation, "Question X of N" progress bar, jump/reset, and an order toggle
  (sequential ⇄ shuffled). Reset selection state per question.
- **T5.** Responsive mobile-first styling (Tailwind): readable long stems/explanations, tappable
  option targets, sticky progress/nav on mobile. Light localStorage to remember current index
  (nice-to-have, no accounts).
- *Acceptance:* Smooth navigation through all questions on desktop and a mobile viewport (DevTools
  responsive mode); no layout overflow on ~360px width.

### Phase 4 — Docker + docs (**Checkpoint B**)
- **T6.** Multi-stage `Dockerfile` using Next.js `output: "standalone"`; `.dockerignore`;
  `docker-compose.yml` exposing port 3000.
- **T7.** `README.md`: how to extract data, dev, build, and `docker compose up`; note the data source
  and that dump answers are community-sourced (verify against official docs). Update root `CLAUDE.md`
  with real commands + architecture.
- *Acceptance / Verification:* `docker build` succeeds; `docker compose up` serves the working quiz at
  `localhost:3000`; `curl` returns HTML.
- **Checkpoint B:** confirm the container runs before wrap-up.

## Risks / notes
- **Answer accuracy:** these are community exam-dump answers and can contain errors; the README will say
  so. The extractor validates structure, not factual correctness.
- **Glyph noise:** occasional stray characters may survive decoding; the parser will normalize
  whitespace and I'll spot-check. If a handful of questions parse badly, they'll be logged and can be
  hand-fixed in `questions.json`.
- The comments PDF (image-only) is excluded; revisit later with OCR only if the user wants community
  discussion threads.

## End-to-end verification
1. `npm run extract` → `data/questions.json` (~285 valid questions, summary printed).
2. `npm run dev` → answer a single- and a multi-answer question in Practice mode; feedback +
   explanation correct; navigate across the bank on desktop + mobile viewport.
3. `docker compose up --build` → quiz reachable at `localhost:3000`.

*(During execution I'll also mirror this plan into `quiz-app/tasks/plan.md` and a checkbox
`quiz-app/tasks/todo.md` for tracking, as requested.)*
