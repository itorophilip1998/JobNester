import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "JobNester AI — Your next chapter starts here",
  description:
    "Your personal workspace for a more intentional job search. Discover, match, apply, and grow.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
