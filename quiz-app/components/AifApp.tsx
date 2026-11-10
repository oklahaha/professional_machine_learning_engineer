"use client";

import raw from "@/data/aif-questions.json";
import type { Question } from "@/lib/questions";
import { AIF_DOMAINS } from "@/lib/domains";
import PracticeApp, { type Bank } from "./PracticeApp";

const bank: Bank = {
  questions: raw as Question[],
  domains: AIF_DOMAINS,
  storageKey: "aif-practice-v1",
  name: "AIF-C01",
  subtitle: "AWS Certified AI Practitioner",
};

export default function AifApp() {
  return <PracticeApp bank={bank} />;
}
