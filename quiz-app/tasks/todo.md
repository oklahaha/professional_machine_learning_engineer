# TODO — Google PMLE Quiz App

## Phase 0 — Scaffold
- [x] T0. Next.js (TS, App Router, Tailwind) in quiz-app/; dev + build work (Next 16.2.10)

## Phase 1 — Data extraction
- [x] T1. scripts/extract-questions.mjs (zero-dep) + lib type
- [x] T2. Generate data/questions.json + validation (285 questions: 259 clean, 26 needsReview)
- [x] Checkpoint A — user chose: keep all 285, badge the flagged ones

## Phase 2 — Practice mode
- [x] T3. QuestionCard: select option, Check/Reveal, correct highlight + explanation (verified headless)

## Phase 3 — Navigation + polish
- [x] T4. Prev/Next, progress bar, jump, reset, sequential/shuffle toggle
- [x] T5. Mobile-first responsive (sticky bottom nav) + localStorage persistence

## Phase 4 — Docker + docs
- [x] T6. Dockerfile (Next standalone) + .dockerignore + docker-compose.yml
- [x] T7. README.md + updated root CLAUDE.md
- [x] Checkpoint B — container built (305MB) and serves the quiz; full interactive flow passes

## Phase 5 — Study by exam domain
- [x] T8. Classify all 383 questions into the 6 official exam-guide sections (`domain: 1..6`)
- [x] T9. `lib/domains.ts` (titles, real-exam weights, colours) + type/extractor/validator enforce it
- [x] T10. Per-section scorecard that doubles as the filter; §N badge on the card; filter persisted
- [x] Verified in headless Chromium: filter cuts the run to 57 §4 items, survives reload, no overflow
