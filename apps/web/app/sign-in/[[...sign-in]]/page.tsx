import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "../../clerk-appearance";
export function generateStaticParams() {
  return [{ "sign-in": [] }];
}
export default function SignInPage() {
  return (
    <main className="auth-page">
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignIn
          appearance={clerkAppearance}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/jobs"
        />
      ) : (
        <div className="auth-box">
          <h1>Portfolio editor sign-in</h1>
          <p>
            Configure Clerk keys to enable owner login. Your public portfolio
            remains available without signing in.
          </p>
          <a className="btn secondary" href="/portfolio">
            View portfolio
          </a>
        </div>
      )}
    </main>
  );
}
