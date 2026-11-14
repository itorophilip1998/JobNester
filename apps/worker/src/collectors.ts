import {
  canonicalUrl,
  normalize,
  containsTerm,
  type Job,
  type Source,
  type CareerMode,
} from "@jobnester/core";
export function stripHtml(s: string) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}
const countries = [
  "United States",
  "United Kingdom",
  "Canada",
  "Nigeria",
  "Germany",
  "France",
  "Spain",
  "Portugal",
  "Netherlands",
  "Poland",
  "India",
  "Australia",
  "Brazil",
  "Kenya",
  "South Africa",
  "Ghana",
  "Egypt",
  "Pakistan",
  "Argentina",
  "Mexico",
  "Ireland",
  "Italy",
  "Sweden",
  "Denmark",
  "Finland",
  "Norway",
  "Switzerland",
  "Austria",
  "New Zealand",
  "Singapore",
  "Japan",
];
export function locationEligibility(
  location: string,
  description: string,
  remote: boolean,
) {
  const t = `${location} ${description}`;
  const negated =
    /not (?:available|open|eligible).{0,30}(?:worldwide|globally)|(?:worldwide|globally).{0,20}(?:except|excluding)|(?:US|U\.S\.|United States)[- ]only|must (?:be|reside|live).{0,30}(?:US|United States)/i.test(
      t,
    );
  const worldwide =
    remote &&
    !negated &&
    /\b(?:worldwide|anywhere in the world|remote[ :–-]+anywhere|globally remote|work from anywhere)\b/i.test(
      t,
    );
  const found = countries.filter((c) =>
    new RegExp(`\\b${c}\\b`, "i").test(location),
  );
  if (
    /\b(?:USA|U\.S\.|US)\b/.test(location) &&
    !found.includes("United States")
  )
    found.push("United States");
  if (/\bUK\b/.test(location) && !found.includes("United Kingdom"))
    found.push("United Kingdom");
  return { worldwide, countries: found };
}
export function normalizePosting(
  source: Source,
  raw: any,
  ms: CareerMode[],
  now = new Date().toISOString(),
): Job | null {
  const title = String(raw.title || raw.text || "").slice(0, 200);
  if (
    !title ||
    !/\b(?:engineer|developer|architect|devops|scientist|researcher)\b|full[- ]?stack/i.test(
      title,
    )
  )
    return null;
  const desc =
    stripHtml(
      String(
        raw.content ||
          raw.descriptionPlain ||
          raw.descriptionHtml ||
          raw.description ||
          "",
      ),
    ) +
    (Array.isArray(raw.lists)
      ? "\n" +
        raw.lists
          .map((l: any) => stripHtml(`${l.text || ""}\n${l.content || ""}`))
          .join("\n")
      : "");
  const location = String(
    raw.location?.name ||
      raw.location ||
      raw.categories?.location ||
      "Not specified",
  );
  const url = String(
    raw.absolute_url || raw.applyUrl || raw.hostedUrl || raw.jobUrl || "",
  );
  if (!/^https:\/\//.test(url)) return null;
  const text = normalize(`${title} ${desc}`);
  if (
    !ms.some(
      (m) =>
        m.titles.some((t) => containsTerm(title, t)) ||
        m.keywords.filter((k) => containsTerm(text, k)).length >= 2,
    )
  )
    return null;
  const remote =
    raw.isRemote === true ||
    raw.workplaceType === "remote" ||
    /\bremote\b/i.test(location) ||
    /\b(?:fully remote|100% remote|remote position|remote role)\b/i.test(desc);
  const eligibility = locationEligibility(location, desc, remote);
  let salary = "Not disclosed",
    salaryMin: number | null = null;
  const range = raw.salaryRange || raw.compensation?.compensationTierSummary;
  if (
    raw.salaryRange?.min &&
    raw.salaryRange?.currency === "USD" &&
    raw.salaryRange?.interval === "per-year"
  ) {
    salaryMin = Number(raw.salaryRange.min);
    salary = `$${Number(raw.salaryRange.min).toLocaleString("en-US")} – $${Number(raw.salaryRange.max || raw.salaryRange.min).toLocaleString("en-US")}`;
  } else if (typeof range === "string") salary = stripHtml(range).slice(0, 200);
  const technologies = [...new Set(ms.flatMap((m) => m.keywords))].filter((k) =>
    containsTerm(text, k),
  );
  let date = now;
  const rawDate =
    raw.publishedAt || raw.createdAt || raw.first_published || raw.updated_at;
  if (rawDate && !Number.isNaN(new Date(rawDate).getTime()))
    date = new Date(rawDate).toISOString();
  const commitment = String(
    raw.employmentType || raw.categories?.commitment || "Not specified",
  );
  const employment = /full.?time/i.test(commitment)
    ? "Full-time"
    : /contract/i.test(commitment)
      ? "Contract"
      : /part.?time/i.test(commitment)
        ? "Part-time"
        : "Not specified";
  return {
    id: "",
    company: source.company,
    title,
    location,
    remote,
    ...eligibility,
    salary,
    salaryMin,
    employment,
    technologies,
    description: desc.slice(0, 50000),
    url: canonicalUrl(url),
    source: source.provider,
    sourceId: String(raw.id || raw.jobId || url),
    postedAt: date,
    discoveredAt: now,
    active: true,
    viewed: false,
    hidden: false,
    matches: {},
  };
}
export async function collect(source: Source): Promise<any[]> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(source.board))
    throw Error("Invalid board identifier");
  const board = encodeURIComponent(source.board);
  const urls = {
    greenhouse: `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`,
    lever: `https://api.lever.co/v0/postings/${board}?mode=json`,
    ashby: `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`,
  };
  const r = await fetch(urls[source.provider], {
    headers: {
      "User-Agent": "JobNester/0.1 (personal career manager)",
      Accept: "application/json",
    },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw Error(`Source returned HTTP ${r.status}`);
  if (Number(r.headers.get("content-length") || 0) > 15000000)
    throw Error("Source response exceeds size limit");
  const reader = r.body?.getReader();
  if (!reader) throw Error("Empty source response");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    bytes += item.value.length;
    if (bytes > 15000000) {
      await reader.cancel();
      throw Error("Source response exceeds size limit");
    }
    chunks.push(item.value);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const rows = Array.isArray(data) ? data : data.jobs;
  if (!Array.isArray(rows))
    throw Error("Source did not return a supported jobs feed");
  return rows.slice(0, 10000);
}
export function descriptionSimilarity(a: string, b: string) {
  const words = (s: string) =>
    new Set(
      normalize(s)
        .split(" ")
        .filter((w) => w.length > 2),
    );
  const x = words(a),
    y = words(b);
  if (x.size < 10 || y.size < 10) return a === b ? 1 : 0;
  const common = [...x].filter((w) => y.has(w)).length;
  return common / new Set([...x, ...y]).size;
}
