import type { Metadata } from "next";
import AifApp from "@/components/AifApp";

export const metadata: Metadata = {
  title: "AIF-C01 Eval Console",
  description: "Evaluate yourself against the AWS Certified AI Practitioner question bank.",
};

export default function Page() {
  return <AifApp />;
}
