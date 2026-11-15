/** No private sessions exist in a static demo. Never used in a live server build. */
export const auth = Object.assign(
  async () => ({ userId: null, isAuthenticated: false }),
  {
    protect: async () => {
      throw new Error("Clerk protection requires the live Next.js server.");
    },
  },
);
export function clerkMiddleware() {
  return () => {};
}
