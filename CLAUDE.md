# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`quiz-app/` (Next.js App Router + TypeScript + Tailwind) serves **two unrelated question sources** that
share a build, a theme and a Docker image — and nothing else. `/` is a home page that picks one:

- **PMLE** — `/pmle`: a responsive multiple-choice quiz for the **Google Professional Machine Learning
  Engineer** exam. The PDFs in `PMLE/` are its source exam dumps — reference material, not code.
- **DSAI** — `/dsai` (a hub) with two modes over the MSc in Data Science and AI material in `DSAI/`:
  `/dsai/flashcards` — **Anki-style spaced repetition** built from `DSAI/*.csv`; and `/dsai/quiz` —
  **multiple choice** built from `DSAI/*.json`. `/flashcards` 308-redirects to `/dsai/flashcards`.

PMLE and DSAI share no data, no localStorage key and no components beyond `ModeSwitch` and `Tile`. A
change to one is not expected to touch the other; if it does, that is a signal the abstraction is
wrong, not a shortcut. Within DSAI the two modes *do* share `lib/dsai.ts` (unit derivation, course
labels), `lib/deck.ts` (the course/unit filter) and `RichText` (inline `code` + KaTeX `$math$`).

## Commands (run inside `quiz-app/`)

```bash
npm install
npm run dev        # dev server at http://localhost:3000
npm run build      # production build (Next.js standalone output)
npm start          # serve the production build
npm run extract    # regenerate the base-285 data/questions.json (guarded; see below)
npm run validate   # structural integrity check of data/questions.json
npm run cards      # rebuild data/cards.json from DSAI/*.csv (safe to re-run)
npm run mcq        # rebuild data/dsai-questions.json from DSAI/*.json (safe to re-run; validates)
npm run validate:cards  # structural integrity check of data/cards.json
npm test           # unit tests (node:test; Node strips the TS, no test deps)
```

Docker: `docker compose up --build` (serves on :3000). In this environment the Docker daemon requires
elevated access — use `sudo docker ...` and disable the Bash sandbox for docker commands.

There is no linter configured yet. Tests are `node --test` over `lib/*.test.ts`.

## Architecture

**The data pipeline is the non-obvious part.** The question bank is *extracted from an obfuscated PDF*,
not authored by hand:

- `quiz-app/scripts/extract-questions.mjs` (reads `PMLE/`) — a **zero-dependency** Node script (uses only built-in
  `zlib`). The source PDF (`Google-...+解密.pdf`) hides text with a **per-font Caesar byte-shift** and
  draws option letters and bodies at *separate coordinates*, so naive text extraction scrambles the
  reading order. The script: inflates each content stream → picks the byte-shift that maximizes English
  word hits → runs a **minimal PDF text-matrix interpreter** (`BT/Tm/Td/TD/T*/Tj/TJ`) to recover real
  reading order → strips repeating page furniture → splits on `Question #:N` → parses stem/options/
  `Answer:`/Explanation. It writes `quiz-app/data/questions.json` and validates structure.
- Of 285 questions, ~259 extract cleanly; ~26 carry source-PDF defects and are tagged
  `needsReview: true` with a `flags` array (e.g. `few_options`, `empty_option`). They are kept, not
  dropped, and surfaced with a warning badge in the UI. (That is the *extractor's* raw output — in the
  committed JSON most of those defects have since been repaired from the 339题 PDF; see below.)
- **`data/questions.json` is the committed union of 417 questions**, not just the extractor's output.
  It is the 285 above, **plus 24** questions unique to the ExamTopics 304-set (recovered by OCR from the
  image-based `试题答案评论` PDF; they carry `source: "ExamTopics #N (community-voted answer)"`), **plus 74**
  from `Professional Machine Learning Engineer 339题 答案修正版.pdf`, **plus 34** from the newest dump,
  `Professional Machine Learning Engineer 375题 答案修正版.pdf` (`quiz-app/REVIEW-375.md`).
  The `Question` type has an optional `source?: string`. Most questions are single-answer; the six
  "choose two" items have two answer letters.
- **The 339题 and 375题 PDFs are the best sources in the repo and need no custom extractor** — unlike the
  解密 dump they have a clean text layer, so plain `pdftotext` recovers every question verbatim. Gotchas,
  identical in both: the vertical watermark `店铺：学习小店66` is laid out one fragment per line, and its
  trailing bare `6` carries no CJK — a CJK-only filter leaves it behind and it bleeds into the text of
  ~92 questions (drop a lone `6` line whose predecessor is `店6`). Question 29's option letters are drawn
  detached from their bodies, so that one question must be reconstructed by hand. `QUESTION n` is not
  always at the start of a line — 13 markers sit behind a page-break form feed, so split on `\f` first.
  And `pdftotext` **drops the soft hyphen when it merges a wrapped line**, welding two words together
  (`cloudbased`, `outof-memory`, and six broken reference URLs in the 375题 block); every such weld makes
  its line abnormally long, which is how they were enumerated.
- **The 375题 PDF revises no answers.** Despite the 答案修正版 label, diffing it against the 339题 PDF
  question-by-question yields **zero** answer changes across all 339 shared questions — it is the same key
  with 36 questions appended. Its real correction arrives disguised as a new question: #373 reprints
  Q375 with a materially revised stem that moves the answer. **When a new dump lands, diff it against the
  previous dump before diffing against the bank** — that is what separates "the dump changed its mind"
  from "the bank was deliberately corrected", and it is the difference between a 1-answer edit and
  wrongly reverting 44 doc-backed corrections.
- Because that source is clean, **33 of the previously defective records were repaired from it**, leaving
  5 unrepairable ones (ids 34, 44, 124, 235, 244 — no counterpart in any PDF).
- **The first 383 questions have been independently re-reviewed against official Google Cloud docs**
  (`quiz-app/REVIEW-FULL.md`). 27 answers were corrected; **20 questions are now `needsReview: true`**
  because they are genuinely doubtful, not merely mis-extracted. `needsReview` therefore now means
  *"do not trust this answer"*, and the `flags` say why: `answer_disputed` (expert reviews conflict),
  `duplicate_conflict` (the bank stores the same question twice with different answers),
  `ambiguous` (two defensible options, or the stem lost a figure/code block), `defective_source`.
- **Every question carries a `domain` (1–6): its section of the official Google exam guide** — 1 low-code,
  2 data & collab, 3 training, 4 serving, 5 pipelines, 6 monitoring. `lib/domains.ts` is the single source
  of truth for the titles, the real exam's weights, and each section's colour. The bank does **not** mirror
  the exam's weighting (§3 is 23% of the bank vs ~21% of the exam; §4 is 15% vs ~20%), which is why the UI
  shows the exam weight next to your per-section accuracy — `npm run validate` prints that comparison.
  Domains were assigned by classifying each question against the guide's own sub-bullets, keyed on **what
  the correct answer turns on, not what the scenario mentions**: a question set on a deployed model whose
  answer is "use tf.Transform" is §5, not §6; metric-selection questions ("which metric for an imbalanced
  classifier?") are §2, not §3. Re-classifying by keyword would get those wrong.
- The `Question` type has an optional **`reference`** — official `cloud.google.com` doc URLs, space
  separated, carried by 10 of the 375题 questions. `QuestionCard.tsx` renders them as a link list under
  the explanation, via `parseReferences` (`lib/format.ts`), which splits, de-duplicates, and **drops
  anything that is not an absolute http(s) URL** — the value reaches an `<a href>` and React does not
  sanitise href, so a hand-edited `javascript:` URL would otherwise execute on click. `npm run validate`
  hard-fails on such a URL (never exempted for `needsReview` records — it is a scripting vector, not a
  text defect) and `npm test` asserts an **exact count** of 10 records / 23 URLs, so adding references
  means updating it in `lib/format.test.ts`. Repair any welded URL before storing it (see above).
- The `Question` type has an optional **`reviewNote`** — a plain-English sentence saying what to verify.
  `QuestionCard.tsx` renders it as an amber panel once the answer is revealed. If you flag a question,
  always set a `reviewNote`, and remember `npm run validate` hard-fails unless
  `needsReview === (flags.length > 0)`.
- **`npm run extract` regenerates only the base 285.** It **refuses to overwrite** a union
  `data/questions.json` (any records with a `source`, or more than it parsed) unless given `--force` —
  running it with `--force` would destroy the other 98 questions and all the answer corrections.
  The merge pipelines are not committed; the JSON is the source of truth and hand-editing it is the
  supported way to fix a question. Run `npm run validate` after any data edit — it hard-fails on
  integrity errors in clean questions and lists known-defect notes for `needsReview` ones.
- **Answer letters are not comparable across dumps.** The same question is often reprinted with its
  options reordered or reworded (AI Platform-era vs Vertex AI-era), so a differing `Correct Answer`
  letter usually means the *options* moved, not that the answer changed. When reconciling a new dump,
  compare the **text of the correct option**, never the letter — 23 questions would have been corrupted
  by copying letters across. Where a dump's answer is provably wrong on the merits (verified against
  Google Cloud docs), the existing answer is kept; 7 such "corrections" in the 339题 PDF were rejected.
- The UI is **multi-answer aware**: a question with two answer letters (a "choose two")
  renders as multi-select and is scored by exact set match. This is driven purely off
  `answers.length > 1` — to make a question "choose 2", edit only its `answers` array; no UI change.
  Selection state persists under `localStorage` key `pmle-practice-v3` (answers are label arrays).
- **Option text carries an implicit formatting contract.** The extractor flattens multi-step options
  onto one line ("1. Do X 2. Do Y"); `lib/format.ts` re-splits them so each step renders on its own
  line (107 options today). It is deliberately conservative — anything ambiguous (a skipped number, a
  quantity like "with 2 n1-highcpu-64 machines") renders verbatim rather than risk a wrong split. If a
  hand-edited option should render as a list, number it contiguously from 1; `npm test` guards this —
  and the guard asserts an **exact count**, so adding questions means updating it in `lib/format.test.ts`.
- **A stem may carry a code listing in ``` fences.** The extractor drops the source PDF's code blocks,
  so stems like q39's ("...with Keras APIs using this code:") were left dangling; the listing is restored
  by hand into the `question` string inside a fence, and `splitCodeBlocks` (`lib/format.ts`) splits the
  stem into prose and code runs that `QuestionCard` renders as a scrollable `<pre>` — the only way
  indentation survives, since the prose is `whitespace-pre-line`. An unfenced stem is a single text run
  and renders exactly as before; an unterminated fence renders verbatim rather than swallowing the
  question. `npm test` asserts an **exact count** of fenced stems, so restoring another listing means
  updating it in `lib/format.test.ts`.
- `data/questions.json` is **baked into the client bundle at build time** (imported by
  `lib/questions.ts`) — there is no backend, database, or runtime PDF/OCR parsing.

**The app** is fully client-side interactive:

- `components/PracticeApp.tsx` (`"use client"`) owns all state: current position, per-question answers,
  sequential/shuffle order, and progress. It persists to `localStorage` key `pmle-practice-v3`.
- `components/QuestionCard.tsx` is presentational: renders the stem/options, handles select →
  check/reveal → correct-highlight + explanation.
- `app/pmle/page.tsx` just renders `<PracticeApp />`. `app/page.tsx` is the source picker (a server
  component — it reads the banks' sizes at build time and ships none of them to the browser).

## DSAI (`/dsai`)

Self-contained from PMLE. Nothing here is shared with the PMLE quiz except the Tailwind theme, `Tile`
and the `ModeSwitch` pill.

- **Source layout.** `DSAI/` holds one deck per file stem, `COURSE_Unit` (`COM6001_Lecture_1`), as a
  pair: `.csv` = flashcards, `.json` = multiple choice. `scripts/dsai-common.mjs` maps a stem to
  course/unit — **leading zeros are dropped** (`Lecture_05` → `Lecture_5`, the folder spells both) —
  and holds the content hash. Both builders sort files naturally and take course/unit from the
  **file name**, so a deck's cards and questions always filter together.

## DSAI flashcards (`/dsai/flashcards`)

- **Data.** `scripts/build-cards.mjs` (zero-dep) reads every `*.csv` in `DSAI/` — two columns,
  Front,Back, **no header and no tags** (both still accepted if present; a `COURSE::UNIT::topic` tag
  overrides the file name) — and writes `quiz-app/data/cards.json` — **407 cards**, 4 courses,
  19 units. `topic` is `""` and `tag` is `COURSE::UNIT` for tagless rows. Unlike `npm run extract`, it is **safe to re-run**: the CSVs are the source of truth and
  nothing in `cards.json` is hand-edited. Courses and units in `lib/cards.ts` are derived from the data,
  never hardcoded, which is the whole reason a new CSV needs no code change.
- **Card ids are content hashes, not row numbers** — this is the load-bearing decision. SRS state lives
  in `localStorage` keyed by id, so positional ids would renumber the deck the moment a new CSV landed
  and silently wipe the review history. `id = fnv1a48(course::unit::front)`. Verified: adding a deck and
  reversing a file's row order preserved all 299 existing ids. The trade-off is that editing a card's
  *Front* resets that card's schedule, so `npm run cards` prints an id diff against the committed bank
  and `npm run validate:cards` hard-fails on a card whose stored id no longer hashes from its own text.
  **Never renumber cards, and never hand-edit `front`/`course`/`unit` in cards.json** — edit the CSV and
  rebuild.
- **The scheduler is `lib/srs.ts`: pure functions, no storage, no React, `now` always passed in.** That
  is what makes it testable against a fixed clock and keeps SSR from disagreeing with the client about
  what is due. SM-2 as Anki implements it: learning steps 1m/10m, graduating 1d, Easy 4d, ease ±0.15
  (floor 1.3), lapse → relearning at the 1-day floor. Reviews are day-granular (due at local midnight);
  learning steps are minute-precise.
- **Graduating intervals are never fuzzed; review intervals are.** The Easy button promises 4 days and
  must deliver exactly 4, or the preview on the button lies. Fuzz is seeded off the card id (the LCG
  from `lib/present.ts`), so it is deterministic across reloads and reproducible in tests.
- `previewIntervals` is literally `schedule()` run four times, so a grade button can never drift from
  what clicking it does. Keep it that way rather than computing labels separately.
- **The deck filter is two selections, not one** (`lib/deck.ts`, pure and data-free like `srs.ts`;
  `filterCards` is generic, so the DSAI quiz uses it too):
  whole courses, plus `COURSE::UNIT` keys that *narrow* their course to those units. So picking a
  unit of an already-whole course replaces the whole-course selection rather than nesting inside
  it — the two lists can never contradict each other. `DeckPanel` opens each course onto its units
  (Lecture 1, Module 2A…) so a session can be cut to one lecture. Unit **labels are derived, never
  hardcoded** (`lib/dsai.ts`): a file-name unit just has `_` spaced out; a tag code (`Lab1`) falls
  back to the source stem minus the course prefix. Both selections persist under the same `msc-cards-srs-v1` key (added
  fields, still `version: 1` — bumping it would throw away real review history) and are pruned on
  load against what the bank actually has.
- **The controller is queue-based, not positional.** `PracticeApp` walks a fixed `order` with a `pos`
  cursor; `FlashcardApp` holds a due queue and rebuilds it when it empties. A card still in learning is
  re-inserted a few cards later (`requeue`), never immediately. Do not copy the `order`/`pos` mechanic
  here.
- **Shuffle** (`⤨ shuffle`) is `QueueOptions.shuffleSeed` in `buildQueue`: new cards are drawn in
  an order keyed by `seedFrom(id, seed)` (so the same seed introduces the same cards day to day),
  today's reviews are dealt in seeded order *after* the cap takes the most overdue, and learning
  steps are never shuffled. 0 = deck order; the seed persists in `msc-cards-srs-v1`.
- **Storage key `msc-cards-srs-v1`** (the quiz's `pmle-practice-v3` is untouched). `load()` prunes
  orphaned ids and coerces every numeric field into range — stored state can be months old or
  hand-edited, and a NaN interval would wedge the queue.
- **Colour.** Again/Good take the app's red/green because they genuinely mean wrong/right. Everything
  else avoids them: Hard is amber, Easy is iris, course identity is a neutral chip, and the maturity bar
  in `DeckPanel` is iris — maturity is progress, not a verdict. See the rule in `lib/domains.ts`.
- `lib/srs.test.ts` is deliberately free of deck-size assertions, unlike the exact-count tests in
  `lib/format.test.ts` — adding cards must not break the scheduler tests.
- The sources carry no course titles, so none were invented. `COURSE_TITLES` in `lib/dsai.ts` is empty
  and the UI falls back to the code; fill it in and both DSAI modes pick it up.

## DSAI quiz (`/dsai/quiz`)

- **Data.** `scripts/build-mcq.mjs` reads `DSAI/*.json` (arrays of `{question, options:[{label, text,
  Explanation}], answers, hints, course, week}`) and writes `data/dsai-questions.json` — **211
  questions**, all single-answer. It renames `Explanation`→`explanation` and `hints`→`hint`, ignores
  the record's `course`/`week` in favour of the file name, and **hard-fails without writing** on an
  answer letter that matches no option, a duplicate question, or < 2 options. Ids are the same content
  hash as the cards (`course::unit::question`), so stored answers survive a rebuild.
- `components/DsaiQuizApp.tsx` mirrors `PracticeApp`'s order/pos model (persisted full-bank `order`
  of **ids**, filter as a presentation cut, restart at 0 on filter change) under storage key
  `dsai-mcq-v1`. `load()` keeps stored order for ids that still exist, appends new ones, drops orphans.
- **Option shuffle** (`⤨ options` toggle) is `lib/mcq-present.ts` — DSAI's own copy of the PMLE
  presenter, not a shared one. Answers/pending stay in original-label space; only `McqCard` sees
  display labels. Each option's explanation travels with it, and no DSAI text cites an option by
  letter, so nothing in the prose is remapped. `shuffleOpts`/`optSeed` persist in `dsai-mcq-v1`.
- `McqCard` shows a hint before answering and **each option's own explanation under it** after
  checking — that per-option feedback is the reason it is not a reuse of the PMLE `QuestionCard`.
- **Text markup.** DSAI text uses inline `` `code` `` and `$LaTeX$` heavily (~1,050 formulas;
  `\frac`, `\bar`, `\sqrt`…). `lib/rich.ts` splits runs (unclosed delimiter → literal text, `\$` →
  dollar); `components/RichText.tsx` renders math with KaTeX (`throwOnError: false`, `trust` off).
  Used by both McqCard and Flashcard. All current formulas render without error — re-check after
  adding decks by looping `splitInline` + `katex.renderToString(…, {throwOnError: true})`.

## Working notes

- **If you change the `Question` shape**, update all three of: the extractor's output object, the
  `Question` type in `lib/questions.ts`, and `QuestionCard.tsx`.
- **`npm run extract` cannot produce a shippable bank on its own any more**: `domain` is a judgment call
  that is not recoverable from the PDF, so the extractor emits `domain: 0` and `npm run validate`
  hard-fails on it. A regenerated bank must be re-classified against the exam guide before it will pass.
- The **domain filter is a presentation-layer cut**, like the option shuffle: `PracticeApp` persists the
  full 417-item `order` and derives the active run from it via `filterByDomain`, so a filter never
  reshuffles the bank — but it *does* restart you at the first question of the new cut. An empty filter
  means "all sections", which is why deselecting the last chip clears the filter rather than leaving an
  empty run; `filterByDomain` also refuses to return an empty array, because `order[pos]` must always
  resolve to a real question.
- **Sections are deliberately not colour-coded.** Green and red are load-bearing here — they mean
  right/wrong on the options, the verdict chip and the minimap — so spending them on section identity
  made a §4 badge read as a wrong answer. Colour tracks *score* (`PASS_MARK` in `lib/domains.ts`); the
  §N badge is neutral.
- **The 答案评论 (comments) PDF has no text layer** — it is image-rendered, so community comments cannot
  be extracted without OCR (not available here). Only the 解密 PDF is used as the data source.
- Answers/explanations are community exam-dump content and may be wrong; treat the official Google Cloud
  docs as ground truth when correcting.
- If regenerating data, `npm run extract` expects the source PDF in `PMLE/` (`../PMLE/` from
  `quiz-app/`). It fails loudly if it parses fewer than 250 questions.
- **Visual theme (space/cyberpunk) lives in `app/globals.css` + the tokens in `tailwind.config.ts`.**
  The space backdrop is one fixed `.cosmos` div in `app/layout.tsx`, pure CSS, animating only
  `transform`/`opacity`. Components use a small class vocabulary instead of repeating utility
  strings: `holo` (glass panel), `holo-card` (main card, HUD corners), `holo-solid` (required on
  flip-card faces — `backdrop-filter` breaks `preserve-3d`), `hud-strip`, `seg`/`seg-item` and
  `chip-toggle` (active state is driven by `aria-current`/`aria-pressed`, so keep those attributes),
  `btn-cyber` + `btn-primary`/`btn-neon`/`btn-ghost`, `neon-title`, `readout`, `field`, `lift`.
  `plasma` (magenta) is decorative only — never a verdict colour, same rule as sections.
