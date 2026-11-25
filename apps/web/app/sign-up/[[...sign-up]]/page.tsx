import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "../../clerk-appearance";
export function generateStaticParams() {
  return [{ "sign-up": [] }];
}
export default function SignUpPage() {
  return (
    <main className="auth-page">
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignUp
          appearance={clerkAppearance}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/jobs"
        />
      ) : (
        <a className="btn" href="/sign-in">
          Owner sign-in setup
        </a>
      )}
    </main>
  );
}
