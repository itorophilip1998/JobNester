export type Stage =
  | "Saved"
  | "Applied"
  | "Interviewing"
  | "Assessment"
  | "Offer"
  | "Rejected"
  | "Withdrawn";
export const stages: Stage[] = [
  "Saved",
  "Applied",
  "Interviewing",
  "Assessment",
  "Offer",
  "Rejected",
  "Withdrawn",
];
export type Eligibility = "Eligible" | "Needs verification" | "Ineligible";
export interface CareerMode {
  id: string;
  name: string;
  short: string;
  keywords: string[];
  titles: string[];
  color: string;
  weights?: { skills: number; title: number; evidence: number };
}
export const modes: CareerMode[] = [
  {
    id: "fullstack",
    name: "Senior Full-Stack Developer",
    short: "Full-Stack",
    keywords: [
      "typescript",
      "react",
      "next.js",
      "node.js",
      "postgresql",
      "apis",
    ],
    titles: ["full stack", "fullstack", "full-stack", "backend"],
    color: "#a78bfa",
  },
  {
    id: "devops",
    name: "Senior DevOps & Cloud Engineer",
    short: "DevOps & Cloud",
    keywords: ["kubernetes", "docker", "azure", "terraform", "ci/cd", "aws"],
    titles: ["devops", "platform", "cloud", "infrastructure"],
    color: "#60a5fa",
  },
  {
    id: "ai",
    name: "AI & Machine Learning Engineer",
    short: "AI & ML",
    keywords: ["python", "llm", "machine learning", "fastapi", "pytorch", "ai"],
    titles: ["machine learning", "ai", "ml", "applied ai"],
    color: "#fbbf24",
  },
  {
    id: "software",
    name: "Senior Software Engineer",
    short: "Software Engineer",
    keywords: [
      "typescript",
      "python",
      "system design",
      "postgresql",
      "distributed systems",
      "apis",
    ],
    titles: ["software engineer", "backend", "software developer"],
    color: "#34d399",
  },
];
export interface Evidence {
  id: string;
  text: string;
  company: string;
  role: string;
  start: string;
  end: string;
}
export interface Profile {
  name: string;
  headline: string;
  country: string;
  timezone: string;
  skills: string[];
  evidence: Evidence[];
  confirmed: boolean;
  salaryMin: number;
  employment: string;
  usWorkAuthorized?: boolean;
  needsSponsorship?: boolean;
  contactEmail?: string;
  phone?: string;
  portfolioUrl?: string;
}
export interface Match {
  score: number;
  eligibility: Eligibility;
  reasons: string[];
  gaps: string[];
}
export interface Job {
  id: string;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  countries: string[];
  worldwide: boolean;
  salary: string;
  salaryMin: number | null;
  employment: string;
  technologies: string[];
  description: string;
  url: string;
  contactEmail?: string | null;
  source: string;
  sourceId: string;
  postedAt: string;
  discoveredAt: string;
  active: boolean;
  viewed: boolean;
  hidden: boolean;
  matches: Record<string, Match>;
}
export interface ApplicationEmailDraft {
  subject: string;
  body: string;
  coverLetter: string;
}
export interface Application {
  id: string;
  jobId: string;
  stage: Stage;
  resumeId: string | null;
  appliedAt: string | null;
  events: { id: string; type: string; at: string; note: string }[];
  followUp: string | null;
  contactEmail?: string | null;
  emailDraft?: ApplicationEmailDraft | null;
  sendStatus?: "none" | "drafted" | "sending" | "sent" | "failed";
  sentAt?: string | null;
  composeTaskId?: string | null;
}
export interface Resume {
  id: string;
  jobId: string;
  modeId: string;
  name: string;
  createdAt: string;
  ready: boolean;
  content: string;
  coverLetter: string;
  evidenceIds: string[];
}
export {
  portfolioDefaults,
  portfolioSections,
  productLink,
  publicAssetReferences,
} from "./portfolio.js";
export type { PortfolioSection } from "./portfolio.js";
export interface Portfolio {
  layout?: "studio" | "editorial";
  accentColor?: string;
  motion?: "none" | "subtle" | "expressive";
  heroHeading?: string;
  avatar?: string;
  sections?: Partial<
    Record<"work" | "about" | "resume" | "certifications" | "contact", boolean>
  >;
  sectionOrder?: ("work" | "about" | "resume" | "certifications" | "contact")[];
  resume?: { url: string; name: string };
  certifications?: {
    id: string;
    name: string;
    issuer: string;
    issuedAt: string;
    credentialUrl: string;
    image: string;
    description: string;
    documentType?: "image" | "pdf";
  }[];
  name: string;
  headline: string;
  bio: string;
  email: string;
  github: string;
  location: string;
  skills: string[];
  projects: {
    id: string;
    title: string;
    description: string;
    tags: string[];
    url: string;
    image: string;
    video?: string;
    repositoryUrl?: string;
  }[];
  experience: Evidence[];
  published: boolean;
  publicResumeId: string | null;
}
export interface Source {
  id: string;
  provider: "greenhouse" | "lever" | "ashby";
  board: string;
  company: string;
  enabled: boolean;
  lastRun: string | null;
  lastError: string | null;
}
export interface Settings {
  dailyTarget: number;
  scanTime: string;
  scanEnabled: boolean;
  aiBudget: number;
}
export interface Task {
  id: string;
  type: string;
  status: string;
  progress: number;
  message: string;
  createdAt: string;
}
export interface Recruiter {
  id: string;
  name: string;
  email: string;
  company: string;
  notes: string;
  followUp: string;
}
export interface Inquiry {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  read: boolean;
}
export interface MailThread {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
  category: string;
  jobId: string | null;
  date: string;
}
export interface AppState {
  profile: Profile;
  modes: CareerMode[];
  jobs: Job[];
  applications: Application[];
  resumes: Resume[];
  portfolio: Portfolio;
  sources: Source[];
  settings: Settings;
  tasks: Task[];
  recruiters: Recruiter[];
  inquiries: Inquiry[];
  threads: MailThread[];
  gmailConnected: boolean;
  linkedinConnected?: boolean;
  contactRecipient?: string;
  emailDeliveryConfigured?: boolean;
}
export function emptyState(): AppState {
  return {
    profile: {
      name: "",
      headline: "",
      country: "",
      timezone: "Africa/Lagos",
      skills: [],
      evidence: [],
      confirmed: false,
      salaryMin: 0,
      employment: "Full-time or contract",
    },
    modes: structuredClone(modes),
    jobs: [],
    applications: [],
    resumes: [],
    portfolio: {
      name: "",
      headline: "",
      bio: "",
      email: "",
      github: "",
      location: "",
      skills: [],
      projects: [],
      experience: [],
      published: false,
      publicResumeId: null,
    },
    sources: [],
    settings: {
      dailyTarget: 20,
      scanTime: "07:00",
      scanEnabled: false,
      aiBudget: 10,
    },
    tasks: [],
    recruiters: [],
    inquiries: [],
    threads: [],
    gmailConnected: false,
  };
}
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const containsTerm = (text: string, term: string) =>
  ` ${normalize(text)} `.includes(` ${normalize(term)} `);
export function canonicalUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  for (const k of [...u.searchParams.keys()])
    if (/^(utm_|ref$|source$|tracking|gh_src)/i.test(k))
      u.searchParams.delete(k);
  u.searchParams.sort();
  return u.toString().replace(/\/$/, "");
}
export function fingerprint(
  j: Pick<Job, "company" | "title" | "location">,
): string {
  return [j.company, j.title, j.location].map(normalize).join("|");
}
export function matchJob(job: Job, profile: Profile, mode: CareerMode): Match {
  const text = normalize(
    `${job.title} ${job.description} ${job.technologies.join(" ")}`,
  );
  const has = (s: string) => containsTerm(text, s);
  const relevant = mode.keywords.filter(has);
  const owned = relevant.filter((s) =>
    profile.skills.some((p) => normalize(p) === normalize(s)),
  );
  const title = mode.titles.some((t) => containsTerm(job.title, t));
  let eligibility: Eligibility = "Needs verification";
  const reasons: string[] = [];
  if (profile.country && job.remote && job.worldwide) {
    eligibility = "Eligible";
    reasons.push(
      "Listing explicitly permits worldwide remote work. Verify employment arrangements before applying.",
    );
  } else if (profile.country && job.remote && job.countries.length) {
    eligibility = job.countries.some(
      (c) => normalize(c) === normalize(profile.country),
    )
      ? "Eligible"
      : "Ineligible";
    reasons.push(
      eligibility === "Eligible"
        ? "Your work country is explicitly listed."
        : "Your work country is outside the listed hiring countries.",
    );
  }
  if (!profile.country)
    reasons.push("Set your work country to assess eligibility.");
  else if (eligibility === "Needs verification")
    reasons.push(
      "Confirm hiring country, remote conditions, and authorization requirements.",
    );
  if (
    !profile.usWorkAuthorized &&
    /must (?:be |already be )?(?:legally )?authori[sz]ed to work in (?:the )?(?:united states|u\.s\.|us)\b|(?:us|u\.s\.) work authori[sz]ation (?:is )?required/i.test(
      job.description,
    )
  ) {
    eligibility = "Ineligible";
    reasons.push("The listing explicitly requires US work authorization.");
  }
  if (
    profile.needsSponsorship &&
    /(?:cannot|unable to|do not|does not|will not) (?:provide |offer )?(?:visa )?sponsor|no (?:visa )?sponsorship/i.test(
      job.description,
    )
  ) {
    eligibility = "Ineligible";
    reasons.push("You require sponsorship, but the listing excludes it.");
  }
  const coverage = relevant.length ? owned.length / relevant.length : 0;
  const evidence = profile.evidence.filter((e) =>
    mode.keywords.some((k) => containsTerm(e.text, k)),
  ).length;
  const weights = mode.weights || { skills: 60, title: 25, evidence: 15 };
  const junior =
    /\b(?:intern|internship|junior|entry[- ]level|graduate)\b/i.test(job.title);
  if (junior)
    reasons.push(
      "The title indicates a junior role, below your senior career target.",
    );
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        coverage * weights.skills +
          (title ? weights.title : 0) +
          (Math.min(evidence, 3) / 3) * weights.evidence,
      ),
    ) - (junior ? 50 : 0),
  );
  return {
    score,
    eligibility,
    reasons: [
      ...reasons,
      ...(owned.length ? [`Verified skills: ${owned.join(", ")}.`] : []),
      ...(title ? ["Job title aligns with this career mode."] : []),
    ],
    gaps: relevant.filter((k) => !owned.includes(k)),
  };
}
export function matchAll(j: Job, p: Profile, ms: CareerMode[] = modes): Job {
  return {
    ...j,
    matches: Object.fromEntries(ms.map((m) => [m.id, matchJob(j, p, m)])),
  };
}
export function composeResume(
  profile: Profile,
  job: Job,
  mode: CareerMode,
  selectedIds?: string[],
): Pick<Resume, "content" | "coverLetter" | "evidenceIds"> {
  if (selectedIds?.some((id) => !profile.evidence.some((e) => e.id === id)))
    throw new Error("Selected evidence is not verified.");
  if (!profile.confirmed || !profile.evidence.length)
    throw new Error(
      "Review and confirm your professional evidence before generating a CV.",
    );
  const evidence = selectedIds
    ? selectedIds
        .map((id) => profile.evidence.find((e) => e.id === id))
        .filter((e): e is Evidence => !!e)
    : [...profile.evidence].sort(
        (a, b) =>
          mode.keywords.filter((k) => normalize(b.text).includes(normalize(k)))
            .length -
          mode.keywords.filter((k) => normalize(a.text).includes(normalize(k)))
            .length,
      );
  if (!evidence.length) throw new Error("No verified evidence was selected.");
  const skills = [...profile.skills].sort(
    (a, b) =>
      Number(normalize(job.description).includes(normalize(b))) -
      Number(normalize(job.description).includes(normalize(a))),
  );
  const content = [
    profile.name,
    profile.headline,
    [profile.contactEmail, profile.phone, profile.country, profile.portfolioUrl]
      .filter(Boolean)
      .join(" | "),
    "",
    "SKILLS",
    skills.join(" • "),
    "",
    "EXPERIENCE",
    ...evidence.flatMap((e) => [
      `${e.role} | ${e.company}`,
      `${e.start} – ${e.end}`,
      e.text,
      "",
    ]),
  ].join("\n");
  const coverLetter = `Dear Hiring Team,\n\nI am applying for ${job.title} at ${job.company}. My background includes ${skills.slice(0, 5).join(", ")}.\n\n${evidence
    .slice(0, 3)
    .map((e) => e.text)
    .join(
      "\n\n",
    )}\n\nI would welcome a conversation about how this experience could support your team.\n\nBest regards,\n${profile.name}`;
  return { content, coverLetter, evidenceIds: evidence.map((e) => e.id) };
}
export function applyTransition(
  app: Application,
  stage: Stage,
  resumeId: string | null,
  now = new Date().toISOString(),
): Application {
  if (app.appliedAt && app.resumeId && resumeId && resumeId !== app.resumeId)
    throw new Error(
      "The submitted CV cannot be replaced. Start a deliberate reapplication.",
    );
  if (stage === "Applied" && !resumeId)
    throw new Error(
      "Select the CV you submitted before confirming your application.",
    );
  return {
    ...app,
    stage,
    resumeId: resumeId ?? app.resumeId,
    appliedAt: stage === "Applied" ? (app.appliedAt ?? now) : app.appliedAt,
    events: [
      ...app.events,
      {
        id: crypto.randomUUID(),
        type: "status",
        at: now,
        note: `Moved to ${stage}${stage === "Applied" ? ` • CV: ${resumeId}` : ""}`,
      },
    ],
  };
}
