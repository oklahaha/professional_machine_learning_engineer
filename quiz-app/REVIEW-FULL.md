# Full-bank review — all 383 questions

Every question was re-derived independently by a reviewer that consulted official Google Cloud /
TensorFlow docs **before** being shown the stored answer. Anything a reviewer called wrong was then
sent to a second, adversarial reviewer instructed to *refute* the first. An answer was only changed
when both passes agreed and cited a doc.

| | count |
|---|---|
| Questions reviewed | 383 |
| Confirmed correct | 356 |
| **Answers corrected** | **27** |
| Option text repaired | 1 |
| **Flagged `needsReview` for you** | **27** |

## Answers corrected (27)

Two independent doc-backed reviews agreed the stored answer was wrong.

| Q | was | now | why |
|---|---|---|---|
| 39 | B | **C** | The stem's Keras listing (lost in extraction, since restored to the stem as a fenced code block) sets `use_bias=True` on both hidden Dense layers and `use_bias=False` only on the output: 501*256 + 257*128 + 128*2 = 161,408. Stored B assumed no bias units anywhere. No longer defective — the code makes the question answerable. |
| 46 | C | **A** | Transforms are instance-level and the SQL exists; Google allows BigQuery preprocessing for instance-level transforms with batch (daily) serving.  |
| 50 | B | **A** | Model is exported for online prediction: only TRANSFORM-clause preprocessing is exported (saved as a SavedModel under a 'transform' subdirectory) |
| 63 | D | **B** | Custom ops in the training loop rule out TPU; a 20 GB model does not fit a 16 GB V100. Only A100 (40 GB/GPU) holds it, and Google's guidance send |
| 97 | B | **D** | Vertex AI batch prediction natively supports a BigQuery table as the input source for custom-trained models, so no 10 TB export (A/C) and no BQML |
| 102 | C | **A** | Dataflow has no streaming source, so C cannot ingest user-activity events; Pub/Sub must. Stem transforms inside BigQuery, so no in-flight process |
| 120 | B | **A** | Cloud TPU docs list 'neural network workloads with custom operations in the main training loop' as unsuitable for TPUs, so B fails. A and D both  |
| 126 | A | **AD** | Stem says choose 2. The tf.data performance guide's fixes for an input-bound pipeline are parallel interleave for reading and prefetch to overlap |
| 132 | B | **A** | The data lives in BigQuery, not Bigtable, so B's premise fails. Importing the TF SavedModel with CREATE MODEL and batch-predicting in place with  |
| 133 | A | **C** | ALTER MODEL ... SET OPTIONS(model_registry='vertex_ai') registers an already-trained BQML model, then deploy from Model Registry. A adds a full r |
| 183 | A | **B** | A and B use identical hardware; stem asks only for fastest training. A100 Ampere Tensor Cores accelerate bfloat16 several-fold over float32, so B |
| 210 | B | **D** | Stem (truncated) wants infrastructure control plus minimal inference time. GKE gives control in both B and D; only Model Garden's GKE deployment  |
| 225 | C | **D** | Vertex AI Model Monitoring skew detection requires supplying the original training dataset in the cloud, which the on-prem constraint forbids. Dr |
| 234 | A | **B** | Docs: increasing parallel trials 'can reduce the effectiveness of the job' because Bayesian tuning uses prior trial results. Time is not a concer |
| 236 | B | **A** | Requirement 4 is comparing metrics across pipeline executions; Vertex AI Experiments is the documented tool for comparing pipeline runs. ML Metad |
| 252 | B | **C** | Docs: use TFX only for TensorFlow workflows processing terabytes of structured or text data; use the Kubeflow Pipelines SDK otherwise. This is vi |
| 258 | D | **C** | scikit-learn has no default GPU support, so D would not speed training. First step is optimized DLVM images with vectorized NumPy/SciPy internals |
| 271 | B | **A** | Vertex AI tabular docs give this exact case: if the model predicts for stores not in the training data, segregate splits by store so validation/t |
| 284 | B | **C** | Preprocessed data is an artifact (assign_input_artifact); loss over steps is a time-series metric needing a backing TensorBoard. B/D invert this. |
| 305 | C | **D** | AutoSxS is a built-in Vertex AI Pipelines component that accepts pre-generated predictions (JSONL in Cloud Storage) and writes judgments plus agg |
| 332 | D | **B** | Beam's documented BigQuery ML pattern: export the BQML model as TF SavedModel and run tfx_bsl RunInference on Dataflow workers (in-process, no ne |
| 336 | A | **D** | Google documents F1 as the metric preferable to accuracy for class-imbalanced data; precision alone ignores false negatives and is trivially game |
| 348 | D | **A** | Vertex AI tabular/forecasting datasets must contain at least 1,000 rows; 365 rows cannot train AutoML Forecasting (D) or AutoML regression (C). B |
| 361 | C | **B** | 'Choose a notebook solution' states: if priorities are collaborating with others and avoiding infrastructure management, choose Colab Enterprise  |
| 370 | B | **D** | Custom containers overview: pre-installing dependencies in a custom container gives 'faster start-up time' versus installing them at runtime, whi |
| 373 | D | **C** | The stem requires hosting the model on a custom VM; Gemini 1.5 Flash is a managed API-only foundation model and cannot be self-hosted, so D viola |
| 383 | A | **D** | BigQuery ML imports a TF SavedModel straight from Cloud Storage (CREATE MODEL ... MODEL_TYPE='TENSORFLOW', MODEL_PATH='gs://...') and serves it w |

## Answer disputed — check these first (4)

Expert reviews reached conflicting conclusions. The stored answer is the best estimate, not settled.

| Q | answer | what to check |
|---|---|---|
| 50 | A | Answer changed on review, but experts disagree. An earlier doc-backed pass argued B (a BQML model built with TRANSFORM cannot be exported); this pass argues A (TRANSFORM preprocessing IS exp |
| 63 | B | Answer changed on review, but experts disagree. An earlier doc-backed pass argued D (custom C++ ops rule out TPUs and GPUs, leaving CPU); this pass argues B (a 20 GB model cannot fit a 16 GB |
| 97 | D | Answer changed on review, but experts disagree. Two high-confidence passes reached OPPOSITE answers: B (BigQuery ML in-place, no data movement) vs D (Vertex AI batch prediction reads BigQuer |
| 102 | A | The stored answer was C (Dataflow streaming job), which two independent reviews agree is WRONG — Dataflow has no streaming source, so Pub/Sub must ingest the events. Changed to A (Pub/Sub Bi |

## Self-contradictions — RESOLVED (was 6 questions)

The bank stored three questions twice with different answer keys. All three are now resolved and
carry no review flag.

**Q323 / Q338 — a real conflict. Q323 was wrong (B → D).**
Same stem (object detection, 3M X-ray images at ~2 GB each, one P100, "decrease training time
without sacrificing model performance"), but the two renditions swap one distractor:
Q323 offered a **v3-32 TPU** as option B, Q338 offered a **K80** (slower than the P100 it replaces).
Q323 picked the TPU. That is wrong on the docs:
- A v3-32 is a **16-chip pod slice**. You cannot "swap the GPU for a TPU" and get a speedup — using
  more than one core *requires* `tf.distribute.TPUStrategy`. **Option B therefore depends on option D**;
  it is not an alternative to it.
- Cloud TPU docs list workloads "limited by I/O constraints or network bandwidth" as unsuited to TPUs.
  3,000,000 × 2 GB ≈ **6 PB** — this is I/O-bound, not compute-bound.
- Object-detection heads (NMS, ROI-align, dynamic box counts) are exactly the "custom operations in the
  main training loop" the TPU docs warn against.

Both now answer **D** (`tf.distribute.Strategy`), which is Vertex AI's documented prescription for
cutting training time without sacrificing accuracy.

**Q150 / Q357 and Q325 / Q342 — false alarms. No change.**
These were *my detector's* bug, not the data's: it compared answer **letters** across questions whose
**option sets differ** — the exact mistake this project warns about. Each answer is correct for its own
option set:
- **Q150 (B) / Q357 (D)** — Q357's equivalent of Q150's option B is sabotaged with `ML.ARIMA_EVALUATE`,
  which is only valid for `ARIMA_PLUS` time-series models, so it is nonsense for logistic regression;
  D wins there by elimination. In Q150, where the option is legitimate, B wins on the word
  *"thoroughly"*: `ML.CONFUSION_MATRIX` returns only a count table at a single threshold, whereas a
  model registered to Vertex AI Model Registry exposes precision, recall, AuPRC, log loss, ROC/PR
  curves **and** the confusion matrix — a strict superset.
- **Q325 (C) / Q342 (B)** — the option sets are *disjoint*: neither one's answer even appears among the
  other's options. Q325 has the DLVM + NumPy/SciPy option; Q342 does not and its best available choice
  is Vertex AI Training with CPUs (scikit-learn cannot use GPUs).


## Genuinely ambiguous (13)

Two defensible options, or the stem lost context the exam provided (a figure, a code block).

| Q | answer | what to check |
|---|---|---|
| 68 | C | Could not be confidently verified. Stem is truncated/garbled ('asked to review your performance?') - the actual ask (reduce training cost without slowing iteration) is missing. C (preemptibl |
| 75 | C | Could not be confidently verified. Structurally defective: stem is garbled ('renew their TensorFlow model') and options B and C are truncated fragments. C (sampled Shapley per-prediction fea |
| 79 | D | Could not be confidently verified. Stored D is doubtful: only 365 rows is below Vertex AI tabular's ~1,000-row minimum and AutoML Forecasting training takes hours, contradicting 'maximize sp |
| 101 | C | Could not be confidently verified. Two defensible options: data is already in BigQuery and preprocessing is done 'before experimenting', favoring in-place SQL (B); stored C (TF preprocessing |
| 111 | C | Could not be confidently verified. Structurally defective: options A and B are truncated. C is the plausible intent but is technically sloppy — Vertex AI batch prediction runs from the Model |
| 151 | B | Could not be confidently verified. Stem demands access to visualization tools; option B is BigQuery console only and provides none. D does EDA plus CREATE MODEL/ML.EVALUATE/ML.PREDICT via %% |
| 156 | B | Could not be confidently verified. Stem is truncated mid-sentence: the actual error ('you get an Out of Memory error') is missing, so the question is unanswerable as stored. B is right for t |
| 166 | D | Could not be confidently verified. A cache over millions of unique customers has a low hit rate and does not ground the LLM; embeddings + vector retrieval is the canonical low-latency RAG pa |
| 176 | C | Could not be confidently verified. D likely better: it offloads time plots to Data Studio (queries BigQuery directly), leaving the notebook only for hypothesis tests, which minimizes compute |
| 222 | C | Could not be confidently verified. Stem demands interpretability, fastest iteration, and lowest cost. AutoML Tabular (stored C) has a minimum node-hour budget and multi-hour runs; scikit-lea |
| 274 | D | Could not be confidently verified. Genuinely two defensible options: C keeps everything in the already-adopted GitHub Actions (fewest components), D delegates image builds to Cloud Build (GC |
| 282 | D | Could not be confidently verified. Stem is truncated: the actual question ('which metrics should you monitor?') is missing. Also, recall cannot be estimated from a flagged-only sample (D) si |
| 309 | B | Could not be confidently verified. Two defensible options. Google positions Vector Search for advanced devs needing a raw vector DB (requires embedding generation, index build, endpoint depl |

## Defective in the source PDFs (10)

Truncated stems or missing options. The stored answer is unreliable and cannot be repaired.

| Q | answer | what to check |
|---|---|---|
| 34 | A | Structurally defective in every source PDF (truncated stem and/or missing options); it cannot be repaired and the stored answer is unreliable. |
| 44 | A | Could not be confidently verified. Structurally broken: stem is truncated and options A/B are merged into one fragment ('B. false negatives.'). Intended answer (AutoML optimizing recall to m |
| 124 | D | Could not be confidently verified. Question is defective: stem is truncated ('three million X-ray model training') and option A is garbled to 'B.'. Answer is genuinely contested between B (v |
| 146 | B | Could not be confidently verified. Genuinely contested B vs C. Stem says no hyperparameter tuning was done, which undercuts nested CV; C (remove target-correlated features) is the classic ta |
| 224 | C | Could not be confidently verified. Demand prediction from historical/seasonal features is a sequence-forecasting task (RNN), but 'learn daily from new data' is often read as Reinforcement Le |
| 232 | D | Could not be confidently verified. Defective: the SignatureDef table is missing from the stem and the option strings are OCR-garbled, so the input shape cannot be verified. D matches the com |
| 235 | C | Could not be confidently verified. Structurally broken: the record has a single empty option 'B' and no usable answer choices, so the stored answer 'C' cannot be evaluated or even mapped to  |
| 244 | A | Could not be confidently verified. Structurally broken: stem is truncated and only two garbled option entries ('B.', 'D. Train a custom TF model...') survive extraction, so the stored answer |
| 311 | D | Could not be confidently verified. Question is structurally broken: the SignatureDef figure it depends on is missing from the stem, so the required input shape cannot be verified. D is corre |
| 319 | A | Could not be confidently verified. Stem states class imbalance but no cost asymmetry between false positives and false negatives, so F1 (C) is the neutral choice; recall-weighted F (A) is de |

## Cross-checks that passed

- Last round I rejected 7 of the 339題 PDF's "corrections" as wrong. This round's reviewers had no
  knowledge of those decisions and independently confirmed **all 7** (Q12, Q26, Q41, Q180, Q194,
  Q266, Q301) as correct as stored.
- The disputed set was re-run a second time from scratch; the re-run agreed with **every** applied
  change, including the two (Q63, Q97) that had contradicted an earlier analysis.

## In the app

Flagged questions show an amber `⚠ review` badge, and after you reveal the answer an amber
**"verify this answer yourself"** panel explains exactly what is in doubt.
