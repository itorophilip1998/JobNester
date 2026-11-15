import { connection } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PublicPortfolio } from "../../portfolio-view";
export default async function PortfolioPreviewPage() {
  if (process.env.WEB_OUTPUT !== "export") await connection();
  if (
    process.env.NEXT_PUBLIC_API_URL &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  )
    await auth.protect();
  return <PublicPortfolio preview />;
}
