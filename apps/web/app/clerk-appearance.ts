/** Shared Clerk appearance aligned with JobNester CSS variables. */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#7ac8ad",
    colorBackground: "#14161e",
    colorInputBackground: "#191b25",
    colorInputText: "#eeeff5",
    colorText: "#eeeff5",
    colorTextSecondary: "#9295a7",
    colorDanger: "#e48cb6",
    colorSuccess: "#7ac8ad",
    colorNeutral: "#9295a7",
    borderRadius: "12px",
    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontFamilyButtons:
      '"Manrope", "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  elements: {
    card: {
      background: "#14161e",
      border: "1px solid #252731",
      boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
    },
    headerTitle: { fontFamily: "Manrope, sans-serif", fontWeight: "700" },
    headerSubtitle: { color: "#9295a7" },
    formButtonPrimary: {
      background: "#7ac8ad",
      color: "#0d0f15",
      fontWeight: "650",
      boxShadow: "none",
    },
    socialButtonsBlockButton: {
      background: "#191b25",
      border: "1px solid #252731",
      color: "#eeeff5",
    },
    footerActionLink: { color: "#7ac8ad" },
    identityPreviewEditButton: { color: "#7ac8ad" },
  },
} as const;
