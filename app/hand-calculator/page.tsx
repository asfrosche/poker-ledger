import type { Metadata } from "next";
import { HandCalculatorView } from "@/components/hand-calculator/hand-calculator-view";

export const metadata: Metadata = {
  title: "Hand calculator",
  description: "Set up a Texas hold'em table, seat players, deal hole cards and one or more runouts.",
};

// Reads the shared player list from the browser ledger, so it is not server-validated.
export const instant = false;

export default function HandCalculatorPage() {
  return <HandCalculatorView />;
}
