import type { Portfolio } from "./index.js";
export const portfolioSections = [
  "work",
  "about",
  "resume",
  "certifications",
  "contact",
] as const;
export type PortfolioSection = (typeof portfolioSections)[number];
export function portfolioDefaults(p: Portfolio): Portfolio {
  return {
    ...p,
    layout: p.layout || "studio",
    accentColor: p.accentColor || "#b39af3",
    motion: p.motion || "subtle",
    heroHeading: p.heroHeading || "Thoughtful software.\nMeaningful impact.",
    certifications: p.certifications || [],
    sectionOrder: p.sectionOrder || [...portfolioSections],
    sections: {
      work: true,
      about: true,
      resume: true,
      certifications: true,
      contact: true,
      ...p.sections,
    },
  };
}
export function productLink(p: Portfolio["projects"][number]): string {
  return p.url || p.repositoryUrl || "";
}
export function publicAssetReferences(p: Portfolio): string[] {
  return [
    ...p.projects.flatMap((x) => [x.image, x.video || ""]),
    ...(p.certifications || []).map((c) => c.image || ""),
    p.resume?.url || "",
    p.avatar || "",
  ].filter(Boolean);
}
