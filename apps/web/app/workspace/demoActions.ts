"use client";
import {
  type AppState,
  type Job,
  composeResume,
  applyTransition,
  canonicalUrl,
  matchAll,
} from "@jobnester/core";

function demoAction(s: AppState, action: string, d: any): AppState {
  const n = structuredClone(s);
  const now = new Date().toISOString();
  if (action === "profile.save") {
    n.profile = d;
    n.jobs = n.jobs.map((j) => matchAll(j, n.profile, n.modes));
  }
  if (action === "mode.save") {
    n.modes = n.modes.map((m) => (m.id === d.id ? d : m));
    n.jobs = n.jobs.map((j) => matchAll(j, n.profile, n.modes));
  }
  if (action === "job.save" && !n.applications.some((a) => a.jobId === d.id))
    n.applications.push({
      id: crypto.randomUUID(),
      jobId: d.id,
      stage: "Saved",
      resumeId: null,
      appliedAt: null,
      followUp: null,
      events: [
        { id: crypto.randomUUID(), type: "saved", at: now, note: "Job saved" },
      ],
    });
  if (action === "job.hide")
    n.jobs = n.jobs.map((j) =>
      j.id === d.id ? { ...j, hidden: !j.hidden } : j,
    );
  if (action === "job.view") {
    n.jobs = n.jobs.map((j) => (j.id === d.id ? { ...j, viewed: true } : j));
    const a = n.applications.find((a) => a.jobId === d.id);
    if (a)
      a.events.push({
        id: crypto.randomUUID(),
        type: "opened",
        at: now,
        note: "Opened employer application page. Submission not confirmed.",
      });
  }
  if (action === "job.import") {
    const url = canonicalUrl(d.url);
    if (n.jobs.some((j) => canonicalUrl(j.url) === url))
      throw Error("This link is already in your workspace.");
    n.jobs.unshift(
      matchAll(
        {
          id: crypto.randomUUID(),
          company: d.company,
          title: d.title,
          location: d.location || "Not specified",
          remote: true,
          countries: [],
          worldwide: false,
          salary: "Not disclosed",
          salaryMin: null,
          employment: "Not specified",
          technologies: [],
          description: d.description,
          url,
          source: "Manual",
          sourceId: crypto.randomUUID(),
          postedAt: now,
          discoveredAt: now,
          active: true,
          viewed: false,
          hidden: false,
          matches: {},
        },
        n.profile,
        n.modes,
      ),
    );
  }
  if (action === "application.update") {
    const i = n.applications.findIndex((a) => a.id === d.id);
    if (i < 0) throw Error("Application not found.");
    if (
      d.stage === "Applied" &&
      !n.resumes.some(
        (r) =>
          r.id === d.resumeId && r.ready && r.jobId === n.applications[i].jobId,
      )
    )
      throw Error("Review a CV for this job before confirming submission.");
    n.applications[i] = applyTransition(n.applications[i], d.stage, d.resumeId);
    n.applications[i].followUp = d.followUp || null;
    if (d.contactEmail !== undefined)
      n.applications[i].contactEmail = d.contactEmail || null;
    if (d.emailDraft) {
      n.applications[i].emailDraft = d.emailDraft;
      if (n.applications[i].sendStatus !== "sent")
        n.applications[i].sendStatus = "drafted";
    }
  }
  if (action === "application.reapply") {
    const a = n.applications.find((a) => a.id === d.id);
    if (!a?.appliedAt) throw Error("No previous submission to reapply from.");
    a.events.push({
      id: crypto.randomUUID(),
      type: "reapplication",
      at: now,
      note: `Deliberate reapplication started. Previous submission: ${a.appliedAt}; submitted CV: ${a.resumeId || "not recorded"}.`,
    });
    a.stage = "Saved";
    a.appliedAt = null;
    a.resumeId = null;
    a.followUp = null;
  }
  if (action === "resume.batch") {
    for (const jobId of [...new Set(d.jobIds)] as string[]) {
      const j = n.jobs.find((j) => j.id === jobId),
        m = n.modes.find((m) => m.id === d.modeId);
      if (!j || !m) throw Error("Job or mode not found.");
      n.resumes.unshift({
        id: crypto.randomUUID(),
        jobId,
        modeId: m.id,
        name: `${j.company} — ${m.short}`,
        createdAt: now,
        ready: false,
        ...composeResume(n.profile, j, m),
      });
    }
  }
  if (action === "resume.generate") {
    const j = n.jobs.find((j) => j.id === d.jobId),
      m = n.modes.find((m) => m.id === d.modeId);
    if (!j || !m) throw Error("Select a job and career mode.");
    const content = composeResume(n.profile, j, m);
    n.resumes.unshift({
      id: crypto.randomUUID(),
      jobId: j.id,
      modeId: m.id,
      name: `${j.company} — ${m.short}`,
      createdAt: now,
      ready: false,
      ...content,
    });
  }
  if (action === "resume.ready")
    n.resumes = n.resumes.map((r) =>
      r.id === d.id ? { ...r, ready: true } : r,
    );
  if (action === "portfolio.contact-settings") n.contactRecipient = d.email;
  if (action === "portfolio.unpublish") {
    n.portfolio.published = false;
    localStorage.removeItem("jobnester-published-demo");
    localStorage.setItem("jobnester-unpublished-demo", "true");
  }
  if (action === "portfolio.save") n.portfolio = d;
  if (action === "portfolio.publish") {
    n.portfolio.published = true;
    localStorage.removeItem("jobnester-unpublished-demo");
    localStorage.setItem(
      "jobnester-published-demo",
      JSON.stringify(n.portfolio),
    );
  }
  if (action === "settings.save") n.settings = d;
  if (action === "source.add")
    n.sources.push({
      ...d,
      id: crypto.randomUUID(),
      enabled: true,
      lastRun: null,
      lastError: null,
    });
  if (action === "source.toggle")
    n.sources = n.sources.map((x) =>
      x.id === d.id ? { ...x, enabled: !x.enabled } : x,
    );
  if (action === "recruiter.save") {
    if (d.id) n.recruiters = n.recruiters.map((r) => (r.id === d.id ? d : r));
    else n.recruiters.push({ ...d, id: crypto.randomUUID() });
  }
  if (action === "recruiter.delete")
    n.recruiters = n.recruiters.filter((r) => r.id !== d.id);
  if (action === "application.compose") {
    const mode = n.modes.find((m) => m.id === d.modeId) || n.modes[0];
    for (const jobId of d.jobIds as string[]) {
      const j = n.jobs.find((job) => job.id === jobId);
      if (!j) continue;
      let resume = n.resumes.find((r) => r.jobId === jobId && r.ready);
      if (!resume && mode) {
        const content = composeResume(n.profile, j, mode);
        resume = {
          id: crypto.randomUUID(),
          jobId,
          modeId: mode.id,
          name: `${j.company} — ${mode.short}`,
          createdAt: now,
          ready: true,
          ...content,
        };
        n.resumes.unshift(resume);
      }
      const draft = {
        subject: `Application: ${j.title} — ${n.profile.name || "Candidate"}`,
        body: `Hello ${j.company} hiring team,\n\nI am applying for ${j.title}. Please find my résumé and cover letter attached.\n\nBest regards,\n${n.profile.name || "Candidate"}`,
        coverLetter: resume?.coverLetter || `Dear Hiring Team,\n\nI am applying for ${j.title} at ${j.company}.\n\nBest regards,\n${n.profile.name || "Candidate"}`,
      };
      const existing = n.applications.find((a) => a.jobId === jobId);
      if (existing) {
        existing.emailDraft = draft;
        existing.contactEmail = j.contactEmail || existing.contactEmail || null;
        existing.sendStatus = "drafted";
        existing.resumeId = resume?.id || existing.resumeId;
        existing.events.push({
          id: crypto.randomUUID(),
          type: "compose",
          at: now,
          note: "Application email drafted (demo)",
        });
      } else {
        n.applications.push({
          id: crypto.randomUUID(),
          jobId,
          stage: "Saved",
          resumeId: resume?.id || null,
          appliedAt: null,
          followUp: null,
          contactEmail: j.contactEmail || null,
          emailDraft: draft,
          sendStatus: "drafted",
          events: [
            {
              id: crypto.randomUUID(),
              type: "compose",
              at: now,
              note: "Application email drafted (demo)",
            },
          ],
        });
      }
    }
  }
  if (action === "application.send") {
    throw Error(
      "Sending via Gmail is available in the live app after connecting Gmail with send permission.",
    );
  }
  if (action === "scan")
    throw Error(
      "Live scanning requires the API and worker. Demo jobs are illustrative and are never presented as live results.",
    );
  if (action === "gmail.sync")
    throw Error(
      "Connect Gmail in the live app to synchronize recruitment messages.",
    );
  return n;
}

export { demoAction };
