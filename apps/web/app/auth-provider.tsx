"use client";
import {
  ClerkProvider,
  useAuth,
  SignInButton,
  UserButton,
  SignOutButton,
} from "@clerk/nextjs";
import { createContext, useContext, type ReactNode } from "react";
import { clerkAppearance } from "./clerk-appearance";
const configured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const AuthContext = createContext({
  ready: true,
  signedIn: false,
  configured: false,
});
function Bridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <AuthContext.Provider
      value={{ ready: isLoaded, signedIn: !!isSignedIn, configured: true }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function AppAuthProvider({ children }: { children: ReactNode }) {
  return configured ? (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/jobs"
      signUpFallbackRedirectUrl="/jobs"
    >
      <Bridge>{children}</Bridge>
    </ClerkProvider>
  ) : (
    <AuthContext.Provider
      value={{ ready: true, signedIn: false, configured: false }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAppAuth = () => useContext(AuthContext);
export function LoginControl() {
  return configured ? (
    <SignInButton mode="modal">
      <button className="btn">Sign in to edit with Clerk</button>
    </SignInButton>
  ) : (
    <p className="fine-print">
      Configure Clerk keys to sign in and edit your portfolio.
    </p>
  );
}
export function AccountControl() {
  const auth = useAppAuth();
  return auth.configured && auth.signedIn ? <UserButton /> : null;
}
export function LogoutControl() {
  return configured ? (
    <SignOutButton>
      <button className="btn secondary">Sign out</button>
    </SignOutButton>
  ) : null;
}
