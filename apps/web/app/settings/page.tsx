import { connection } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Workspace from "../workspace";

export default async function SettingsPage() {
  if (process.env.WEB_OUTPUT !== "export") await connection();
  if (
    process.env.NEXT_PUBLIC_API_URL &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  )
    await auth.protect();
  return <Workspace initialPage="Settings" />;
}
