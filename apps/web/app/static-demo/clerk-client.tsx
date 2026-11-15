"use client";
/** Static preview only. The real Next.js server always imports Clerk's SDK. */
import type { ReactNode } from "react";
export function ClerkProvider({
  children,
}: {
  children: ReactNode;
  [key: string]: unknown;
}) {
  return <>{children}</>;
}
export function useAuth() {
  return { isLoaded: true, isSignedIn: false, getToken: async () => null };
}
export function SignInButton({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export const SignOutButton = SignInButton;
export function UserButton() {
  return null;
}
export function SignIn() {
  return <p>Clerk sign-in is available in the live app.</p>;
}
export const SignUp = SignIn;
