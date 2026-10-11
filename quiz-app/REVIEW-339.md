# Review of `339题 答案修正版` against the question bank

Bank went from **309 → 383 questions**. The PDF has a clean text layer, so all 339 questions
were recovered by `pdftotext` (no OCR, no custom extractor).

| | count |
|---|---|
| Questions added (not previously in the bank) | 74 |
| Existing questions repaired from the clean PDF | 33 |
| Answers corrected | 19 |
| PDF "corrections" **rejected** as wrong | 7 |
| Stale flags cleared | 1 |
| Still `needsReview` (no counterpart in any PDF) | 5 |

## 1. Answers I corrected (19)

The PDF is right and the bank was wrong.

| Q | was | now | why |
|---|---|---|---|
| 33 | D | **A** | Importing the model into BigQuery ML lets ML.PREDICT run in place on the BigQuery data -- no data movement, minimal computational overhead. |
| 42 | D | **B** | The target can be NEGATIVE, and RMSLE (existing answer D) is undefined for negative values. BQML boosted-tree/XGBoost regression is the low-effort, fast, correct choice. |
| 50 | A | **B** | The model must be EXPORTED to Cloud Storage for online prediction, and BigQuery ML models built with the TRANSFORM clause cannot be exported. So the encoding must be done outside TRANSFORM. |
| 63 | B | **D** | Custom TensorFlow ops written in C++ rule out TPUs entirely and would need bespoke CUDA kernels on GPUs. A CPU-only cluster is the only one that runs the custom ops; 86 GB RAM/machine holds the 20 GB model. |
| 82 | A | **B** | Vertex AI Workbench MANAGED notebooks can browse and query BigQuery tables directly from the JupyterLab UI, which minimizes development effort versus %%bigquery magics on a user-managed VM. |
| 97 | D | **B** | The 10 TB already lives in BigQuery. Importing the SavedModel with CREATE MODEL keeps all inference co-located with the data; a Vertex AI batch job (existing answer D) serializes every row to JSON over HTTP and does not autoscale. |
| 98 | B | **BC** | This is a 'Choose two' item and the existing record stored only one answer -- a genuine data defect. Lowering the score threshold plus adding positive examples both improve fraud recall. |
| 139 | C | **CE** | Also a 'Choose two' item stored with a single answer. Early stopping plus fewer max trials both speed up tuning without gutting its effectiveness. |
| 140 | B | **D** | 'Model server never became ready' with NO further logs means you cannot diagnose remotely -- pull the image and run it locally to read the container's own logs. Changing the port is a blind guess. |
| 145 | C | **A** | Vertex AI custom training manages the cluster for you, and MultiWorkerMirroredStrategy needs no model-code rewrite. TPUStrategy (existing answer C) requires real code changes and TPU VM management. |
| 149 | B | **C** | The labels are CUSTOM, so the Healthcare NL API's predefined entities do not apply. AutoML Entity Extraction trains on custom labels with far less effort than hand-rolling BERT. |
| 162 | A | **C** | The bottleneck IS the single file -- one file cannot be read in parallel. Sharding it and using a parallel interleave is the documented first fix; a single 5 TB TFRecord is still a single file. |
| 184 | C | **D** | The time signal is spread across MULTIPLE columns, so AutoML's Time column (which takes one column) cannot be used -- you must split manually on the time signal. |
| 202 | C | **A** | Kubeflow Pipelines tracks per-run metrics natively and exposes them through its API. Writing metrics to Cloud Monitoring requires manual instrumentation. |
| 212 | D | **B** | Vertex AI Pipelines automatically records lineage in ML Metadata for both the training component and the batch-predict component. |
| 233 | B | **A** | BigQuery's built-in scheduled queries retrain the BQML model with zero extra infrastructure -- lowest development effort and lowest scheduling cost. |
| 245 | B | **D** | You must compare against the PREVIOUS run to know whether the model improved; comparing this run's train vs eval loss only detects overfitting. Skew-triggered retraining beats a nightly cron on cost. |
| 250 | A | **C** | Riders confirm attendance a day ahead, so demand is KNOWN -- no prediction is needed. This is a routing/optimization problem, not an ML problem. |
| 268 | D | **C** | The requirement is to automatically PREVENT the upload. The existing answer D only reports flagged images to a human moderation team, so it fails the stated requirement. |

## 2. PDF "corrections" I REJECTED (7)

These are the ones to double-check me on — the PDF asserts a different answer and I kept the
existing one. Each was verified against official Google Cloud / TensorFlow docs.

| Q | PDF says | kept | why the PDF is wrong |
|---|---|---|---|
| 12 | A | **B** | OOM on a 224x224/batch-64 job is fixed by reducing the batch size. Changing the optimizer (PDF's A) does not fix OOM -- SGD already has the smallest memory footprint; switching to Adam would increase it. |
| 26 | C | **B** | Stem optimizes purely for minimum serving latency. Loading the model in-process in the Dataflow worker is the only option with no network hop; a Vertex AI endpoint (PDF's C) adds an RPC round trip per element. Confirmed against Beam RunInference / Dataflow ML best-practices docs. |
| 41 | A | **C** | All four fields are quasi-identifiers, so Google's DLP guidance prescribes generalization/bucketing, which preserves utility. Tokenizing with hashed dummy values (PDF's A) destroys AGE and SHIRT_SIZE as predictive features; tokenization is for direct identifiers. |
| 194 | A | **D** | Increasing max_batch_size (PDF's A) raises throughput at the COST of latency -- wrong lever. TF Serving's performance guide explicitly recommends recompiling from source for CPU-specific instructions (AVX2/FMA), since prebuilt binaries omit them for compatibility. |
| 266 | C | **B** | Arithmetic: overall accuracy = 0.90*0.82 + 0.10*0.99 = 83.7%, which is WORSE than the 90% you get by always predicting 'renew'. So the model IS worse than the trivial baseline; PDF's C is wrong. |
| 301 | A | **B** | Retail sales signal lives in interactions (store x category x promotion) that linear regression (PDF's A) structurally cannot represent. BQML's boosted tree is the accuracy play for tabular data, and label encoding is exactly what BQML applies to boosted trees natively. |
| 180 | D | **A** | PDF's D applies MultiWorkerMirroredStrategy to a SINGLE n1-standard-4 VM -- a misuse (single-machine multi-GPU calls for MirroredStrategy). A TPU VM can be SSH'd into directly, which is what preserves 'ease of debugging' while cutting training time. |

## 3. Questions repaired from the PDF (33)

These records had mangled text from the obfuscated-PDF extraction (truncated options, missing
options, duplicated labels). Text replaced wholesale from the clean PDF.

| Q | answer before → after |
|---|---|
| 1 | B (unchanged) |
| 29 | A → **D** |
| 43 | D → **C** |
| 49 | D (unchanged) |
| 56 | D (unchanged) |
| 61 | B (unchanged) |
| 62 | B (unchanged) |
| 72 | C → **D** |
| 74 | A (unchanged) |
| 84 | D → **B** |
| 92 | D → **B** |
| 110 | D (unchanged) |
| 112 | D (unchanged) |
| 114 | D (unchanged) |
| 120 | D → **B** |
| 125 | A → **B** |
| 130 | C → **B** |
| 144 | B (unchanged) |
| 164 | D → **C** |
| 178 | B → **C** |
| 180 | A (unchanged) |
| 182 | C → **A** |
| 205 | D → **A** |
| 206 | B → **D** |
| 224 | B → **C** |
| 238 | D → **B** |
| 247 | B (unchanged) |
| 249 | D → **C** |
| 255 | A (unchanged) |
| 260 | A → **B** |
| 284 | A → **B** |
| 292 | A (unchanged) |
| 307 | B (unchanged) |

## 4. Questions added (74)

New ids 310–383. Five are "choose two" (multi-select).

Choose-two among the new: Q312

## 5. Left alone

- **Q121** — same question as PDF #12, but the bank uses current *Vertex AI* naming while the PDF
  reverted to legacy *AI Platform* wording. Both point at Cloud Natural Language API, so the
  substance is identical; adopting the PDF would be a terminology regression.
- **Q34, Q44, Q124, Q235, Q244** — still `needsReview`. Defective in the original dump and absent
  from the 339題 PDF, so there is nothing to repair them from.
- **PDF #49** was dropped: it is a corrupted twin of #80, missing the Firestore option entirely.
