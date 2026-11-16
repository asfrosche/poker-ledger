import type { Metadata } from "next";
import { CalculatorView } from "@/components/calculator/calculator-view";

export const metadata: Metadata = {
  title: "Odds calculator",
  description: "Estimate your Texas hold'em equity against random hands and compare it with pot odds.",
};

// Stateless page with no server data; opt out of instant-navigation validation like the other pages.
export const instant = false;

export default function CalculatorPage() {
  return <CalculatorView />;
}
