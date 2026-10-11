import type { Metadata } from "next";
import DsaiQuizApp from "@/components/DsaiQuizApp";

export const metadata: Metadata = {
  title: "DSAI Quiz",
  description:
    "Multiple-choice questions for the MSc in Data Science and Artificial Intelligence.",
};

export default function Page() {
  return <DsaiQuizApp />;
}
