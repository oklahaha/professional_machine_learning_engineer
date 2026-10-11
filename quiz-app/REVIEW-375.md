# Review of `375题 答案修正版` against the question bank

Bank went from **383 → 417 questions**. Like the 339题 dump, this PDF has a clean text layer, so all
375 questions were recovered with `pdftotext` (no OCR, no custom extractor). Same two gotchas as
before: the vertical `店铺：学习小店66` watermark is laid out one fragment per line, and question 29's
option letters are drawn detached from their bodies.

| | count |
|---|---|
| Questions in the PDF | 375 |
| Parsed cleanly | 374 (only #29 defective, as in the 339题 dump) |
| Already in the bank | 341 |
| **Questions added** | **34** |
| **Answers changed** | **1** |
| Existing answers *confirmed* by the new dump | 292 |
| Stale `needsReview` flags cleared | 2 |

## 1. The headline: this dump revises no answers for questions 1–339

The filename says 答案修正版 ("corrected-answers edition"), and the natural reading is that it carries
a newer answer key. It does not. Parsing both PDFs with the same parser and diffing question by
question:

```
ANSWER changes 339 -> 375: 0
```

**Every one of the 339 shared questions has a byte-identical answer letter in both dumps.** The only
differences in that range are cosmetic — the watermark bleeds into fewer option strings than it did in
the 339题 PDF. So for the overlapping questions this dump is not new evidence; it is the same answer
key reprinted. The genuinely new content is the 36 questions appended at the end (#340–#375).

This matters because the bank deliberately disagrees with that key in 44 places, and those
disagreements are *not* the new dump correcting the bank. They are the bank's own doc-backed
corrections, recorded in `REVIEW-FULL.md` (27 answers changed after two independent reviews cited
Google Cloud docs) and `REVIEW-339.md` §2 (7 PDF "corrections" explicitly rejected on the merits —
all 7 reappear unchanged here). Adopting the dump wholesale would revert all of that work.

Per the standing rule in `CLAUDE.md` — official Google Cloud docs are ground truth, community dumps
are not — **none of those 44 were changed.** They are listed in §4 below so the calls stay auditable.

## 2. The one real answer change (Q375)

Buried in the new block, dump #373 is a **reprint of bank Q375 with a materially revised stem**. This
is the actual 答案修正 in the file, and it is invisible to a letter-by-letter diff because it arrives as
a "new" question.

| | old (339題 #329 → bank Q375) | new (375題 #373) |
|---|---|---|
| feedback | "The application has 1,000 users. You collect user feedback" | "You recently collected **thousands of rows** of user feedback" |
| constraint | "you want to use a scalable solution" | "scalable solution **and minimize application maintenance**" |
| answer | ask users to enumerate scenarios, put them in the prompt | **collect Q&A pairs and run supervised fine-tuning** |

Both edits push the answer the same way: you already hold an SFT-sized dataset, and enumerating every
verbosity scenario in the prompt is exactly the ongoing maintenance the new stem rules out. The answer
follows from the stem change rather than contradicting the old one, so the record was **replaced
wholesale** (stem, options, answer, explanation) instead of keeping a near-duplicate pair with
conflicting answers. Q375 is now answer **D** ("…perform supervised fine-tuning (SFT)…").

## 3. A doc-backed correction the new dump independently confirms (Q373)

Dump #351 reprints bank Q373 (identical stem) with the options reordered and re-branded. The 339題
dump answered this question **"Use the Gemini 1.5 Flash foundational model"**; `REVIEW-FULL.md`
rejected that, because the stem requires hosting the model on a custom VM and Gemini Flash is a
managed API-only model, and changed the answer to *fine-tune Llama from Model Garden*.

The new reprint answers **A — "Fine-tune the latest Llama model from Model Garden on Agent Platform
Serverless Training."** Different letter, same option text as the bank's C. The dump has come around
to the reviewed answer, which is a useful independent check on that call. No change needed.

> This is the case `CLAUDE.md` warns about: comparing letters would have read as a disagreement
> (bank C vs dump A) when the two agree. Comparing the **text of the correct option** is what
> surfaces it. Both reconciliation passes here matched on option text, never letters.

## 4. The 44 disagreements left standing

Bank answer ≠ dump answer, in every case because the bank was deliberately moved off the dump's key.
Nothing here was changed; the last column says which review made the call.

"unattributed" means the change predates the two review docs or is not recorded in them by bank id —
`REVIEW-339.md` numbers its tables by the *PDF's* question numbers, which do not line up with bank ids
after the merges. Those 23 were not re-derived here; they were left alone on the same reasoning as the
rest, namely that this dump reprints the 339題 key verbatim and so is not evidence against them.

| bank Q | dump # | bank | dump | source of the bank's answer |
|---|---|---|---|---|
| 3 | 185 | C | D | unattributed |
| 12 | 31 | B | A | REVIEW-339 §2 (rejected: optimizer change does not fix OOM) |
| 24 | 10 | C | D | unattributed |
| 26 | 130 | B | C | REVIEW-339 §2 (rejected: endpoint adds an RPC hop, stem wants min latency) |
| 41 | 140 | C | A | REVIEW-339 §2 (rejected: quasi-identifiers need generalization, not tokenization) |
| 46 | 208 | A | C | REVIEW-FULL |
| 50 | 167 | C | B | REVIEW-FULL (disputed — see below) |
| 55 | 264 | D | A | unattributed |
| 56 | 268 | D | A | unattributed |
| 63 | 116 | B | D | REVIEW-FULL (disputed) |
| 72 | 229 | C | D | unattributed |
| 97 | 189 | D | B | REVIEW-FULL (disputed) |
| 100 | 200 | C | D | unattributed |
| 120 | 212 | A | B | REVIEW-FULL |
| 150 | 306 | B | D | unattributed |
| 171 | 269 | CE | DE | unattributed |
| 172 | 220 | C | A | unattributed |
| 180 | 171 | A | D | REVIEW-339 §2 (rejected: MultiWorkerMirroredStrategy on a single VM is a misuse) |
| 184 | 18 | C | D | unattributed |
| 194 | 32 | D | A | REVIEW-339 §2 (rejected: max_batch_size trades latency for throughput) |
| 218 | 17 | D | C | unattributed |
| 260 | 49 | B | C | unattributed |
| 266 | 141 | B | C | REVIEW-339 §2 (rejected: 0.9·0.82 + 0.1·0.99 = 83.7% < 90% baseline) |
| 272 | 213 | D | A | unattributed |
| 274 | 166 | D | B | unattributed (flagged `ambiguous`) |
| 282 | 85 | C | D | unattributed |
| 284 | 260 | C | B | REVIEW-FULL |
| 299 | 291 | D | C | unattributed |
| 301 | 295 | B | A | REVIEW-339 §2 (rejected: linear regression cannot represent the interactions) |
| 305 | 299 | D | C | REVIEW-FULL |
| 309 | 303 | D | B | unattributed |
| 311 | 22 | D | B | unattributed (flagged `defective_source`) |
| 313 | 48 | C | B | unattributed |
| 315 | 76 | C | B | unattributed |
| 323 | 96 | D | B | unattributed |
| 325 | 162 | C | D | unattributed |
| 332 | 138 | B | D | REVIEW-FULL |
| 336 | 150 | D | A | REVIEW-FULL |
| 343 | 164 | C | B | unattributed |
| 348 | 207 | A | D | REVIEW-FULL |
| 370 | 324 | D | B | REVIEW-FULL |
| 373 | 327 | C | D | REVIEW-FULL — **and confirmed by dump #351, see §3** |
| 375 | 373 | — | — | superseded by the revised reprint, see §2 |
| 383 | 339 | D | A | REVIEW-FULL |

The four still marked `answer_disputed` (50, 63, 97, 102) are unchanged and remain the ones to check
first — the new dump adds no evidence either way, since it just reprints the key those reviews already
rejected.

## 5. Questions added (34)

New ids **384–417**, from dump #340–#375 (excluding the two reprints in §2 and §3). All 34 are
genuinely absent from the bank — the nearest existing question scores ≤ 0.24 Jaccard on the stem.

They are visibly a newer generation of the exam: Vertex AI is rebranded **"Agent Platform" / "Gemini
Enterprise Agent Platform"** throughout, and the subject matter has moved on — Model Armor, context
caching, the Gemini Live API, Ray on Vertex AI, Model Garden MaaS, TPU parameter/optimizer sharding,
AutoSxS, Managed Lustre + Slurm, DeepSeek. Ten carry official `cloud.google.com` reference URLs, now
rendered under the explanation.

Every stated answer was checked against Google Cloud docs and all 34 hold up, so none is flagged.
Domains were assigned on **what the correct answer turns on**, and cross-checked against how the bank
already classifies the same services (AutoSxS → §2, Document AI → §1, ARIMA → §1, Colab → §2, traffic
split → §4, Cloud Build → §5, Airflow → §5):

| § | count | new ids |
|---|---|---|
| 1 low-code | 9 | 384, 389, 390, 395, 397, 398, 400, 407, 412 |
| 2 data & collab | 6 | 386, 392, 393, 402, 411, 413 |
| 3 training | 4 | 385, 388, 401, 409 |
| 4 serving | 5 | 394, 396, 399, 408, 415 |
| 5 pipelines | 7 | 387, 391, 403, 404, 405, 406, 416 |
| 6 monitoring | 3 | 410, 414, 417 |

### Text repairs applied to the new questions

`pdftotext` drops the soft hyphen when it merges a wrapped line, welding two words together. Every
over-long line in the new block was inspected and seven prose welds repaired — `cloudbased`,
`crossplatform`, `policybased`, `trafficsplitting`, `outof-memory`, `Text-toSpeech`, `endto-end` —
plus six more inside reference URLs (e.g. `bigqueryml-syntax-createtime-series` →
`…-create-time-series`), which would otherwise 404. Q393's `●` criteria list was put back onto
separate lines so it renders as a list.

## 6. Two stale flags cleared, and a repair (Q71, Q130)

`npm run validate` and `npm test` were **already failing before this reconciliation** — worth knowing,
since neither failure was caused by it:

- **Q71 and Q130** carried `needsReview: true` with an empty `flags` array and no `reviewNote`, which
  `validate` hard-fails on (`needsReview === (flags.length > 0)`). Neither recorded *why* it was
  flagged. The new dump answers both: #211 confirms Q71's **D**, #53 confirms Q130's **B**. Flags
  cleared.
- **Q71 was also mis-extracted** by the original 解密 extractor — its stem read "a custom **TensorRow**
  model" and its options said "Vertex **Al**". Repaired wholesale from the clean text layer, the same
  way the 339題 pass repaired 33 records. Note that Q71 and **Q349 are the same question** (Q349 came
  in from 339題 #211); both answer D, so it is a benign duplicate, left in place.
- **`lib/format.test.ts`** asserted an exact count of 106 numbered options while the committed bank
  already contained 107. Updated to 107. None of the 34 added questions contributes a numbered option.

Still untouched and still known-bad: **Q235** (answer `C` not among its options — one of the five
records with no counterpart in any PDF) and the 33 questions with empty explanations, most of them
from the 339題 block.
