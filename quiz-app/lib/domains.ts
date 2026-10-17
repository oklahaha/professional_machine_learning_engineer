/**
 * The six sections of the official Google Cloud "Professional Machine Learning Engineer
 * Certification exam guide". `id` is the section number, and it is what `Question.domain`
 * stores — so the data file stays readable against the published guide.
 *
 * `weight` is the section's share of the real exam. It is NOT the share of this question
 * bank (a community dump over-weights §2/§3), so the UI shows both: your accuracy per
 * domain, next to how much the exam actually cares about that domain.
 */
export type Domain = {
  id: number; // 1..6 — "Section N" in the exam guide
  name: string; // short label for chips and badges
  title: string; // the guide's own section title
  weight: number; // ~% of the real exam
  blurb: string; // what this section actually tests
};

export const DOMAINS: Domain[] = [
  {
    id: 1,
    name: "Low-code",
    title: "Architecting low-code AI solutions",
    weight: 13,
    blurb: "BigQuery ML, AutoML, pre-trained AI APIs, Model Garden.",
  },
  {
    id: 2,
    name: "Data & collab",
    title: "Collaborating within and across teams to manage data and models",
    weight: 16,
    blurb: "Data prep, PII, Feature Store, notebooks, experiments, evaluation metrics.",
  },
  {
    id: 3,
    name: "Training",
    title: "Scaling prototypes into ML models",
    weight: 21,
    blurb: "Model choice, custom training, tuning, training hardware, distribution.",
  },
  {
    id: 4,
    name: "Serving",
    title: "Serving and scaling models",
    weight: 20,
    blurb: "Endpoints, containers, Model Registry, rollout, latency, edge.",
  },
  {
    id: 5,
    name: "Pipelines",
    title: "Automating and orchestrating ML pipelines",
    weight: 18,
    blurb: "Vertex AI Pipelines, Kubeflow, TFX, retraining, CI/CD/CT.",
  },
  {
    id: 6,
    name: "Monitoring",
    title: "Monitoring AI solutions",
    weight: 13,
    blurb: "Drift and skew detection, explainability, bias, securing AI systems.",
  },
];

export function getDomain(id: number): Domain | undefined {
  return DOMAINS.find((d) => d.id === id);
}

/**
 * Sections are deliberately NOT colour-coded. Green and red are load-bearing in this app —
 * they mean "you got it right / you got it wrong" on the options, the verdict and the minimap.
 * Spending them on section identity, which carries no valence, made a §4 badge read as a wrong
 * answer. Colour here tracks your score instead: see PASS_MARK.
 */
export const PASS_MARK = 70; // % — at or above this a section reads as strong, below it as weak

/**
 * Narrow a run to the selected sections. An empty selection means "no filter" rather than
 * "no questions", which is what keeps the run from ever emptying — deselecting the last
 * section restores the full bank instead of leaving nothing to answer.
 */
export function filterByDomain(order: number[], domains: number[], domainOf: (i: number) => number): number[] {
  if (domains.length === 0) return order;
  const wanted = new Set(domains);
  const filtered = order.filter((i) => wanted.has(domainOf(i)));
  // A selection that matches nothing would render an empty run and crash the card. That needs
  // a malformed bank (a section with zero questions), but the component must not have to trust it.
  return filtered.length > 0 ? filtered : order;
}
