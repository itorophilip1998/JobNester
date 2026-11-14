import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  modes,
  matchJob,
  composeResume,
  canonicalUrl,
  fingerprint,
  applyTransition,
  type Job,
  type Profile,
  type Application,
} from "@jobnester/core";
import {
  normalizePosting,
  locationEligibility,
  descriptionSimilarity,
} from "../apps/worker/src/collectors.js";
const profile: Profile = {
  ...emptyState().profile,
  name: "Test Engineer",
  headline: "Software Engineer",
  country: "Canada",
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "APIs"],
  confirmed: true,
  evidence: [
    {
      id: "e1",
      company: "Real Employer",
      role: "Engineer",
      start: "2020",
      end: "Present",
      text: "Built TypeScript APIs with PostgreSQL.",
    },
  ],
};
const job: Job = {
  id: "j1",
  company: "Acme",
  title: "Senior Full-Stack Engineer",
  location: "Worldwide",
  remote: true,
  countries: [],
  worldwide: true,
  salary: "Not disclosed",
  salaryMin: null,
  employment: "Full-time",
  technologies: ["TypeScript", "React", "Node.js", "PostgreSQL", "APIs"],
  description:
    "Build software with TypeScript, React, Node.js, PostgreSQL, APIs.",
  url: "https://example.com/jobs/123",
  source: "greenhouse",
  sourceId: "123",
  postedAt: new Date().toISOString(),
  discoveredAt: new Date().toISOString(),
  active: true,
  viewed: false,
  hidden: false,
  matches: {},
};
test("eligibility never assumes a work country", () =>
  assert.equal(
    matchJob(job, { ...profile, country: "" }, modes[0]).eligibility,
    "Needs verification",
  ));
test("worldwide remote is eligible with a configured country", () =>
  assert.equal(matchJob(job, profile, modes[0]).eligibility, "Eligible"));
test("a high score does not override a country restriction", () => {
  const m = matchJob(
    { ...job, worldwide: false, countries: ["United States"] },
    profile,
    modes[0],
  );
  assert.ok(m.score > 80);
  assert.equal(m.eligibility, "Ineligible");
});
test("unknown eligibility stays unresolved", () =>
  assert.equal(
    matchJob({ ...job, worldwide: false }, profile, modes[0]).eligibility,
    "Needs verification",
  ));
test("country match is normalized", () =>
  assert.equal(
    matchJob(
      { ...job, worldwide: false, countries: ["Canada"] },
      { ...profile, country: "canada" },
      modes[0],
    ).eligibility,
    "Eligible",
  ));
test("career modes produce different rankings", () =>
  assert.ok(
    matchJob(job, profile, modes[0]).score >
      matchJob(job, profile, modes[1]).score,
  ));
test("tracking parameters merge but distinct requisitions survive", () => {
  assert.equal(
    canonicalUrl(
      "https://example.com/jobs/123/?utm_source=x&gh_src=foo&job=123#apply",
    ),
    "https://example.com/jobs/123/?job=123",
  );
  assert.notEqual(
    canonicalUrl("https://example.com/?id=1"),
    canonicalUrl("https://example.com/?id=2"),
  );
});
test("employer title and location fingerprints normalize punctuation", () =>
  assert.equal(
    fingerprint(job),
    fingerprint({
      ...job,
      company: "ACME",
      title: "Senior Full Stack Engineer",
    }),
  ));
test("CV generation requires reviewed evidence", () =>
  assert.throws(
    () => composeResume({ ...profile, confirmed: false }, job, modes[0]),
    /Review/,
  ));
test("generated claims come verbatim from verified evidence", () => {
  const cv = composeResume(profile, job, modes[0]);
  assert.ok(cv.content.includes(profile.evidence[0].text));
  assert.ok(cv.content.includes("Real Employer"));
  assert.ok(!cv.content.includes("increased revenue"));
  assert.deepEqual(cv.evidenceIds, ["e1"]);
});
test("CV generation rejects unverified evidence IDs", () =>
  assert.throws(
    () => composeResume(profile, job, modes[0], ["fabricated"]),
    /verified|evidence/i,
  ));
const app: Application = {
  id: "a1",
  jobId: "j1",
  stage: "Saved",
  resumeId: null,
  appliedAt: null,
  events: [],
  followUp: null,
};
test("applying requires an explicit submitted CV", () =>
  assert.throws(() => applyTransition(app, "Applied", null), /Select/));
test("submission records exact CV and timestamp; later changes preserve it", () => {
  const a = applyTransition(app, "Applied", "r1", "2026-11-14T00:00:00Z");
  const b = applyTransition(a, "Interviewing", null, "2026-11-15T00:00:00Z");
  assert.equal(b.resumeId, "r1");
  assert.equal(b.appliedAt, a.appliedAt);
  assert.equal(b.events.length, 2);
});
test("saving never creates a submitted date", () =>
  assert.equal(applyTransition(app, "Saved", null).appliedAt, null));
test("global advertising cannot bypass a US-only restriction", () => {
  assert.equal(
    locationEligibility(
      "Remote — US only",
      "Work from anywhere in the world",
      true,
    ).worldwide,
    false,
  );
});
test("location extraction identifies country restrictions", () =>
  assert.deepEqual(locationEligibility("Remote — US", "", true), {
    worldwide: false,
    countries: ["United States"],
  }));
test("remote status alone never means worldwide", () =>
  assert.equal(
    locationEligibility("Remote", "Distributed team", true).worldwide,
    false,
  ));
test("collector rejects irrelevant or unsafe postings", () => {
  const source = {
    id: "s",
    provider: "greenhouse" as const,
    board: "acme",
    company: "Acme",
    enabled: true,
    lastRun: null,
    lastError: null,
  };
  assert.equal(
    normalizePosting(
      source,
      {
        id: 1,
        title: "Barista",
        content: "Make coffee",
        location: { name: "Remote" },
        absolute_url: "https://example.com",
      },
      modes,
    ),
    null,
  );
  assert.equal(
    normalizePosting(
      source,
      {
        id: 2,
        title: "Software Engineer",
        content: "TypeScript",
        absolute_url: "javascript:alert(1)",
      },
      modes,
    ),
    null,
  );
});
test("normalizes Greenhouse, Lever, and Ashby feed shapes", () => {
  for (const provider of ["greenhouse", "lever", "ashby"] as const) {
    const source = {
      id: "s",
      provider,
      board: "acme",
      company: "Acme",
      enabled: true,
      lastRun: null,
      lastError: null,
    };
    const fields = {
      greenhouse: {
        id: 1,
        title: "Senior Software Engineer",
        content: "<p>TypeScript PostgreSQL APIs</p>",
        location: { name: "Remote — Worldwide" },
        absolute_url: "https://example.com/1",
      },
      lever: {
        id: 2,
        text: "Senior Software Engineer",
        descriptionPlain: "TypeScript PostgreSQL APIs",
        categories: { location: "Remote — Worldwide", commitment: "Full-time" },
        hostedUrl: "https://example.com/2",
      },
      ashby: {
        id: 3,
        title: "Senior Software Engineer",
        descriptionPlain: "TypeScript PostgreSQL APIs",
        location: "Worldwide",
        isRemote: true,
        jobUrl: "https://example.com/3",
      },
    };
    const j = normalizePosting(source, fields[provider], modes)!;
    assert.ok(j);
    assert.equal(j.worldwide, true);
    assert.ok(!j.description.includes("<p>"));
  }
});
test("similarity is conservative for unrelated vacancies", () => {
  assert.equal(descriptionSimilarity("Build APIs", "Work retail"), 0);
  assert.equal(descriptionSimilarity(job.description, job.description), 1);
});
test("AI keyword does not match words like maintain", () => {
  const m = matchJob(
    {
      ...job,
      title: "Systems Maintainer",
      description: "Maintain websites and repair systems.",
      technologies: [],
    },
    profile,
    modes[2],
  );
  assert.equal(m.score, 0);
});
test("explicit US authorization gates a worldwide skills match", () =>
  assert.equal(
    matchJob(
      {
        ...job,
        description:
          job.description + " Must be authorized to work in the United States.",
      },
      { ...profile, usWorkAuthorized: false },
      modes[0],
    ).eligibility,
    "Ineligible",
  ));
test("configured weights affect the score", () =>
  assert.equal(
    matchJob(job, profile, {
      ...modes[0],
      weights: { skills: 0, title: 100, evidence: 0 },
    }).score,
    100,
  ));
test("submitted CV cannot be silently replaced", () =>
  assert.throws(
    () =>
      applyTransition(
        { ...app, appliedAt: new Date().toISOString(), resumeId: "original" },
        "Applied",
        "replacement",
      ),
    /cannot be replaced/,
  ));

test("DOCX inspection rejects oversized archive metadata before decompression", async () => {
  const { inspectDocx } = await import("../apps/api/src/documents.js");
  const name = Buffer.from("word/document.xml");
  const archive = Buffer.alloc(46 + name.length + 22);
  archive.writeUInt32LE(0x02014b50, 0);
  archive.writeUInt32LE(21 * 1024 * 1024, 24);
  archive.writeUInt16LE(name.length, 28);
  name.copy(archive, 46);
  const footer = 46 + name.length;
  archive.writeUInt32LE(0x06054b50, footer);
  archive.writeUInt16LE(1, footer + 10);
  archive.writeUInt32LE(0, footer + 16);
  assert.throws(() => inspectDocx(archive), /too large/);
});

test("AI sales roles do not consume an engineering collection target", () => {
  const source = {
    id: "s",
    provider: "greenhouse" as const,
    board: "acme",
    company: "Acme",
    enabled: true,
    lastRun: null,
    lastError: null,
  };
  assert.equal(
    normalizePosting(
      source,
      {
        id: 1,
        title: "Account Executive, AI Sales",
        content: "AI software TypeScript APIs",
        location: { name: "Worldwide" },
        absolute_url: "https://example.com/sales",
      },
      modes,
    ),
    null,
  );
});
test("junior titles rank below an otherwise identical senior position", () =>
  assert.ok(
    matchJob(
      { ...job, title: "Junior Full-Stack Developer" },
      profile,
      modes[0],
    ).score < 50,
  ));
