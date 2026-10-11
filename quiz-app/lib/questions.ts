import raw from "@/data/questions.json";

export type Option = {
  label: string; // "A".."E"
  text: string;
};

export type Question = {
  id: number;
  question: string;
  options: Option[];
  answers: string[]; // correct option labels, e.g. ["B"]
  domain: number; // 1..6 — section of the official exam guide; see lib/domains.ts
  explanation: string;
  reference?: string;
  needsReview: boolean;
  flags: string[];
  source?: string; // provenance: 解密 dump vs ExamTopics community-voted
  reviewNote?: string; // why this question is flagged — what a human should check
};

export const questions: Question[] = raw as Question[];

export const totalQuestions = questions.length;

export function getQuestion(index: number): Question | undefined {
  return questions[index];
}
