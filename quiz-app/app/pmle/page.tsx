import type { Metadata } from "next";
import PracticeApp from "@/components/PracticeApp";

export const metadata: Metadata = {
  title: "PMLE Eval Console",
  description:
    "Evaluate yourself against the Google Professional Machine Learning Engineer question bank.",
};

export default function Page() {
  return <PracticeApp />;
}
