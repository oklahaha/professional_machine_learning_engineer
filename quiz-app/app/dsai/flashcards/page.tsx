import type { Metadata } from "next";
import FlashcardApp from "@/components/FlashcardApp";

export const metadata: Metadata = {
  title: "DSAI Flashcards",
  description:
    "Spaced-repetition flashcards for the MSc in Data Science and Artificial Intelligence.",
};

export default function Page() {
  return <FlashcardApp />;
}
