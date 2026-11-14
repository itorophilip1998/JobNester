import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Portfolio — Engineering with intention",
  description: "Selected work, experience, and contact information.",
};
import { PublicPortfolio } from "../workspace";
export default function Page() {
  return <PublicPortfolio />;
}
