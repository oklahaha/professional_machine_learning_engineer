"use client";

import { questions } from "@/lib/questions";
import { DOMAINS } from "@/lib/domains";
import PracticeApp, { type Bank } from "./PracticeApp";

// A client module of its own, so the bank is bundled with /pmle only — passing it from the
// server page would serialise all of it into the HTML as well.
const bank: Bank = {
  questions,
  domains: DOMAINS,
  storageKey: "pmle-practice-v3", // v3: answers are label arrays (multi-answer)
  name: "PMLE",
  subtitle: "Google Professional Machine Learning Engineer",
};

export default function PmleApp() {
  return <PracticeApp bank={bank} />;
}
