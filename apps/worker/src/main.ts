import { deliverInquiry } from "../../api/src/documents/contact-email.js";
import { writeFile } from "node:fs/promises";
import {
  aiRequest,
  aiCapabilities,
  resumeResponse,
  composeResponse,
} from "../../api/src/ai/ai-client.js";
import "../../api/src/config/index.js";
import { Worker } from "bullmq";
import { Prisma, type Source as DbSource } from "@prisma/client";
import { db, json, queue } from "../../api/src/service.js";
import {
  redisConnection,
  required,
  ownerEmail,
} from "../../api/src/config/index.js";
import { seal, unseal } from "../../api/src/common/security.js";
import {
  buildApplicationMime,
  encodeGmailRaw,
} from "../../api/src/documents/gmail-mime.js";
import { renderPdf } from "../../api/src/documents/pdf-render.js";
import {
  collect,
  normalizePosting,
  descriptionSimilarity,
} from "./collectors.js";
import {
  matchAll,
  fingerprint,
  emptyState,
  type Profile,
  type Settings,
  type CareerMode,
  type Job,
  type Source,
} from "@jobnester/core";
const u = new URL(redisConnection.url);
const connection = {
  host: u.hostname,
  port: Number(u.port) || 6379,
  password: u.password || undefined,
  username: u.username || undefined,
  tls: u.protocol === "rediss:" ? {} : undefined,
};
async function progress(id: string, message: string, progress: number) {
  await db.task.update({
    where: { id },
    data: { status: "running", message, progress },
  });
}
async function scan(taskId: string) {
  const owner = await db.owner.findUniqueOrThrow({ where: { id: "owner" } });
  const p = owner.profile as unknown as Profile,
    ms = owner.modes as unknown as CareerMode[],
    settings = owner.settings as unknown as Settings;
  if (!p.country) throw Error("Set your work country before scanning.");
  const sources = await db.source.findMany({
    where: { enabled: true },
    orderBy: { lastRun: "asc" },
  });
  if (!sources.length) throw Error("Add an enabled employer source.");
  let collected = 0,
    created = 0,
    duplicates = 0,
    failed = 0;
  const allowance = Math.max(
    1,
    Math.ceil(settings.dailyTarget / sources.length),
  );
  for (let i = 0; i < sources.length && collected < settings.dailyTarget; i++) {
    const source = sources[i];
    await progress(
      taskId,
      `Scanning ${source.company} (${i + 1}/${sources.length})`,
      Math.round((i / sources.length) * 90),
    );
    try {
      const raw = await collect(source as unknown as Source);
      const candidates = raw
        .map((r) => normalizePosting(source as unknown as Source, r, ms))
        .filter((j): j is Job => !!j);
      const cursor = (source as any).scanCursor || 0;
      const count = Math.min(
        allowance,
        settings.dailyTarget - collected,
        candidates.length,
      );
      const selected = Array.from(
        { length: count },
        (_, n) => candidates[(cursor + n) % candidates.length],
      );
      for (const posting of selected) {
        const provider = `${source.provider}:${source.board}`;
        const existing = await db.sourceRecord.findUnique({
          where: {
            provider_externalId: { provider, externalId: posting.sourceId },
          },
          include: { job: true },
        });
        let canonical =
          existing?.job ||
          (await db.job.findUnique({ where: { url: posting.url } }));
        if (!canonical) {
          const lookalikes = await db.job.findMany({
            where: { fingerprint: fingerprint(posting) },
            take: 20,
          });
          canonical =
            lookalikes.find((j) => {
              const old = j.payload as unknown as Job;
              return (
                old.source !== posting.source &&
                descriptionSimilarity(old.description, posting.description) >
                  0.95
              );
            }) || null;
        }
        if (canonical) {
          duplicates++;
          await db.job.update({
            where: { id: canonical.id },
            data: {
              payload: json(matchAll({ ...posting, id: canonical.id }, p, ms)),
              active: true,
            },
          });
          await db.sourceRecord.upsert({
            where: {
              provider_externalId: { provider, externalId: posting.sourceId },
            },
            update: { jobId: canonical.id, lastSeen: new Date() },
            create: {
              provider,
              externalId: posting.sourceId,
              jobId: canonical.id,
            },
          });
        } else {
          const createdJob = await db.job.create({
            data: {
              company: posting.company,
              title: posting.title,
              location: posting.location,
              url: posting.url,
              fingerprint: fingerprint(posting),
              payload: json(matchAll(posting, p, ms)),
              sightings: { create: { provider, externalId: posting.sourceId } },
            },
          });
          if (posting.contactEmail) {
            await db.application.create({
              data: {
                jobId: createdJob.id,
                stage: "Saved",
                contactEmail: posting.contactEmail,
                sendStatus: "none",
              },
            });
          }
          created++;
        }
        collected++;
      }
      await db.source.update({
        where: { id: source.id },
        data: {
          lastRun: new Date(),
          lastError: null,
          scanCursor: candidates.length
            ? (cursor + count) % candidates.length
            : 0,
        } as any,
      });
    } catch (e) {
      failed++;
      await db.source.update({
        where: { id: source.id },
        data: {
          lastRun: new Date(),
          lastError: e instanceof Error ? e.message : "Source unavailable",
        },
      });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (failed === sources.length)
    throw Error("All sources failed. Review source health in Settings.");
  return `${collected}/${settings.dailyTarget} listings processed; ${created} new, ${duplicates} duplicate sightings, ${failed} source failures. ${collected < settings.dailyTarget ? "Target not reached; expand your employer registry." : ""}`;
}
async function reserveAi(
  taskId: string,
  budget: number,
  attempt: number,
): Promise<boolean> {
  if (budget <= 0 || !(await aiCapabilities()).llmConfigured) return false;
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8675309)`;
      const usage = await tx.aiUsage.aggregate({
        _sum: { reservedUsd: true },
        where: { createdAt: { gte: since } },
      });
      if ((usage._sum.reservedUsd || 0) + 0.1 > budget) return false;
      await tx.aiUsage.create({
        data: {
          taskId: `${taskId}:${attempt}`,
          model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
          reservedUsd: 0.1,
        },
      });
      return true;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
async function gmailAccessToken() {
  const integration = await db.integration.findUniqueOrThrow({
    where: { provider: "gmail" },
  });
  let tokens = unseal<any>(integration.encryptedTokens);
  if (!tokens.expiresAt || tokens.expiresAt < Date.now() + 60000) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: required("GOOGLE_CLIENT_ID"),
        client_secret: required("GOOGLE_CLIENT_SECRET"),
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Error(
        "Gmail access expired or was revoked. Reconnect Gmail in Settings.",
      );
    const refreshed = (await response.json()) as any;
    tokens = {
      ...tokens,
      ...refreshed,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
    };
    await db.integration.update({
      where: { provider: "gmail" },
      data: { encryptedTokens: seal(tokens) },
    });
  }
  return tokens.access_token as string;
}
async function resume(taskId: string, data: any, attempt: number) {
  const existing = await db.resume.findUnique({
    where: { generationTaskId: taskId },
  });
  if (existing) return "Documents already generated.";
  const [owner, record] = await Promise.all([
    db.owner.findUniqueOrThrow({ where: { id: "owner" } }),
    db.job.findUniqueOrThrow({ where: { id: data.jobId } }),
  ]);
  const p = owner.profile as unknown as Profile;
  const mode = (owner.modes as unknown as CareerMode[]).find(
    (m) => m.id === data.modeId,
  );
  if (!mode) throw Error("Career mode was removed.");
  if (!p.confirmed) throw Error("Review and confirm your experience first.");
  await progress(taskId, "Selecting relevant verified experience", 30);
  const job = { ...(record.payload as unknown as Job), id: record.id };
  const useAi = await reserveAi(
    taskId,
    (owner.settings as unknown as Settings).aiBudget,
    attempt,
  );
  const content = await aiRequest(
    "/v1/resumes/generate",
    { profile: p, job, mode, useAi },
    resumeResponse,
  );
  if (content.evidenceIds.some((id) => !p.evidence.some((e) => e.id === id)))
    throw new Error("Python returned unverified evidence IDs.");
  await db.resume.create({
    data: {
      jobId: record.id,
      modeId: mode.id,
      generationTaskId: taskId,
      name: `${job.company} — ${mode.short}`,
      content: content.content,
      coverLetter: content.coverLetter,
      evidenceIds: json(content.evidenceIds),
    },
  });
  return `CV and cover letter created using ${content.method} verified evidence. Review before use.`;
}
async function compose(taskId: string, data: any, attempt: number) {
  const [owner, record] = await Promise.all([
    db.owner.findUniqueOrThrow({ where: { id: "owner" } }),
    db.job.findUniqueOrThrow({ where: { id: data.jobId } }),
  ]);
  const p = owner.profile as unknown as Profile;
  const mode = (owner.modes as unknown as CareerMode[]).find(
    (m) => m.id === data.modeId,
  );
  if (!mode) throw Error("Career mode was removed.");
  if (!p.confirmed) throw Error("Review and confirm your experience first.");
  await progress(taskId, "Composing application email with Gemini", 25);
  const job = { ...(record.payload as unknown as Job), id: record.id };
  let resume = await db.resume.findFirst({
    where: { jobId: record.id, ready: true },
    orderBy: { createdAt: "desc" },
  });
  if (!resume) {
    await progress(taskId, "Generating résumé before email compose", 35);
    const useAiForResume = await reserveAi(
      `${taskId}:resume`,
      (owner.settings as unknown as Settings).aiBudget,
      attempt,
    );
    const generated = await aiRequest(
      "/v1/resumes/generate",
      { profile: p, job, mode, useAi: useAiForResume },
      resumeResponse,
    );
    resume = await db.resume.create({
      data: {
        jobId: record.id,
        modeId: mode.id,
        generationTaskId: `${taskId}:resume`,
        name: `${job.company} — ${mode.short}`,
        content: generated.content,
        coverLetter: generated.coverLetter,
        evidenceIds: json(generated.evidenceIds),
        ready: true,
      },
    });
  }
  const useAi = await reserveAi(
    `${taskId}:compose`,
    (owner.settings as unknown as Settings).aiBudget,
    attempt,
  );
  const draft = await aiRequest(
    "/v1/applications/compose",
    {
      profile: p,
      job,
      mode,
      coverLetter: resume?.coverLetter || "",
      useAi,
    },
    composeResponse,
  );
  const contactEmail = job.contactEmail || null;
  await db.application.upsert({
    where: { jobId: record.id },
    update: {
      emailDraft: json({
        subject: draft.subject,
        body: draft.body,
        coverLetter: draft.coverLetter,
      }),
      contactEmail: contactEmail || undefined,
      sendStatus: "drafted",
      composeTaskId: taskId,
      resumeId: resume?.id || undefined,
    },
    create: {
      jobId: record.id,
      stage: "Saved",
      emailDraft: json({
        subject: draft.subject,
        body: draft.body,
        coverLetter: draft.coverLetter,
      }),
      contactEmail,
      sendStatus: "drafted",
      composeTaskId: taskId,
      resumeId: resume?.id || null,
      events: {
        create: {
          type: "compose",
          note: `Application email drafted via ${draft.method}`,
        },
      },
    },
  });
  return `Application email drafted using ${draft.method}${contactEmail ? "" : ". No company email found — keep the job link and paste a recipient if you want to send."}`;
}
async function sendApplication(taskId: string, data: any) {
  const application = await db.application.findUniqueOrThrow({
    where: { id: data.applicationId },
    include: { job: true },
  });
  const draft = application.emailDraft as {
    subject?: string;
    body?: string;
    coverLetter?: string;
  } | null;
  if (!application.contactEmail || !draft?.subject || !draft?.body || !draft?.coverLetter)
    throw Error("Application email draft or recipient is incomplete.");
  const resume = await db.resume.findUniqueOrThrow({
    where: { id: data.resumeId || application.resumeId || "" },
  });
  if (!resume.ready) throw Error("Mark the résumé ready before sending.");
  await progress(taskId, "Rendering PDF attachments", 30);
  const [resumePdf, letterPdf] = await Promise.all([
    renderPdf(`${resume.name} résumé`, resume.content),
    renderPdf(`${resume.name} cover letter`, draft.coverLetter),
  ]);
  await progress(taskId, "Sending via Gmail", 70);
  const accessToken = await gmailAccessToken();
  const from = ownerEmail || "me";
  const mime = buildApplicationMime({
    from,
    to: application.contactEmail,
    subject: draft.subject,
    body: draft.body,
    attachments: [
      {
        filename: "resume.pdf",
        mimeType: "application/pdf",
        content: resumePdf,
      },
      {
        filename: "cover-letter.pdf",
        mimeType: "application/pdf",
        content: letterPdf,
      },
    ],
  });
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodeGmailRaw(mime) }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) {
    await db.application.update({
      where: { id: application.id },
      data: { sendStatus: "failed" },
    });
    throw Error(`Gmail send failed with HTTP ${response.status}. Reconnect Gmail with send permission.`);
  }
  await db.application.update({
    where: { id: application.id },
    data: {
      sendStatus: "sent",
      sentAt: new Date(),
      stage: "Applied",
      resumeId: resume.id,
      appliedAt: application.appliedAt || new Date(),
      events: {
        create: {
          type: "sent",
          note: `Sent application email to ${application.contactEmail} with résumé and cover letter attached.`,
        },
      },
    },
  });
  await db.auditLog.create({
    data: {
      action: "application.send",
      metadata: json({
        applicationId: application.id,
        jobId: application.jobId,
        to: application.contactEmail,
      }),
    },
  });
  return `Application emailed to ${application.contactEmail}.`;
}
async function gmail(taskId: string) {
  const accessToken = await gmailAccessToken();
  const api = async (path: string) => {
    const r = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!r.ok)
      throw Error(`Gmail returned HTTP ${r.status}; check account access.`);
    return r.json() as Promise<any>;
  };
  let pageToken = "",
    count = 0;
  do {
    const query = new URLSearchParams({
      q: 'newer_than:90d {interview recruiter application "next steps" assessment "job opportunity"}',
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const result = await api(`threads?${query}`);
    for (const item of result.threads || []) {
      const thread = await api(
        `threads/${encodeURIComponent(item.id)}?format=full`,
      );
      const message = thread.messages?.at(-1);
      if (!message) continue;
      const headers = message.payload?.headers || [];
      const header = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name)?.value || "";
      const subject = header("Subject"),
        sender = header("From"),
        snippet = String(message.snippet || "").slice(0, 1000);
      const text = `${subject} ${snippet}`.toLowerCase();
      const category = /unfortunately|not moving forward|rejected/.test(text)
        ? "Rejection"
        : /interview|schedule a call/.test(text)
          ? "Interview"
          : /assessment|coding challenge/.test(text)
            ? "Assessment"
            : "Recruitment";
      await db.mailThread.upsert({
        where: { id: thread.id },
        update: {
          subject,
          sender,
          snippet,
          category,
          date: new Date(Number(message.internalDate)),
        },
        create: {
          id: thread.id,
          subject,
          sender,
          snippet,
          category,
          date: new Date(Number(message.internalDate)),
        },
      });
      count++;
      await progress(
        taskId,
        `Imported ${count} recruitment threads`,
        Math.min(90, count),
      );
    }
    pageToken = result.nextPageToken || "";
  } while (pageToken && count < 100);
  return `Synchronized ${count} threads from the last 90 days. Review associations and suggested status updates manually.`;
}
const worker = new Worker(
  process.env.JOB_QUEUE_NAME || "jobnester",
  async (job) => {
    const { taskId } = job.data;
    await progress(taskId, "Working…", 5);
    let message = "";
    if (job.name === "scan") message = await scan(taskId);
    else if (job.name === "resume")
      message = await resume(taskId, job.data, job.attemptsMade);
    else if (job.name === "compose")
      message = await compose(taskId, job.data, job.attemptsMade);
    else if (job.name === "send")
      message = await sendApplication(taskId, job.data);
    else if (job.name === "gmail") message = await gmail(taskId);
    else if (job.name === "notify")
      message = await deliverInquiry(job.data.inquiryId);
    else throw Error("Unsupported task");
    await db.task.update({
      where: { id: taskId },
      data: { status: "completed", progress: 100, message },
    });
    return message;
  },
  { connection, concurrency: 2 },
);
worker.on("failed", async (job, error) => {
  if (!job?.data.taskId) return;
  const final = job.attemptsMade >= (job.opts.attempts || 1);
  await db.task
    .update({
      where: { id: job.data.taskId },
      data: {
        status: final ? "failed" : "queued",
        message: final
          ? error.message
          : "Task interrupted; retrying with backoff.",
      },
    })
    .catch(() => {});
  if (final && job.name === "send" && job.data.applicationId) {
    await db.application
      .update({
        where: { id: job.data.applicationId },
        data: { sendStatus: "failed" },
      })
      .catch(() => {});
  }
});
worker.on("error", (error) =>
  console.error("Worker connection:", error.message),
);
async function schedule() {
  try {
    const owner = await db.owner.findUnique({ where: { id: "owner" } });
    if (!owner) return;
    const p = owner.profile as unknown as Profile,
      settings = owner.settings as unknown as Settings;
    if (!settings.scanEnabled || !p.country) return;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: p.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const val = (type: string) => parts.find((p) => p.type === type)?.value;
    const today = `${val("year")}-${val("month")}-${val("day")}`,
      time = `${val("hour")}:${val("minute")}`;
    if (time < settings.scanTime) return;
    const key = `daily-${today}`;
    const existing = await db.task.findUnique({ where: { id: key } });
    if (existing) {
      if (existing.status === "queued" && !(await queue.getJob(key)))
        await queue.add("scan", { taskId: key }, { jobId: key });
      return;
    }
    if (
      await db.task.count({
        where: { type: "scan", status: { in: ["queued", "running"] } },
      })
    )
      return;
    await db.task.create({ data: { id: key, type: "scan" } });
    await queue.add("scan", { taskId: key }, { jobId: key });
  } catch (e) {
    if ((e as any)?.code !== "P2002")
      console.error("Scheduler:", e instanceof Error ? e.message : "Failed");
  }
}
const heartbeat = setInterval(
  () =>
    writeFile("/tmp/jobnester-worker-heartbeat", String(Date.now())).catch(
      () => {},
    ),
  30000,
);
void worker
  .waitUntilReady()
  .then(() => writeFile("/tmp/jobnester-worker-heartbeat", String(Date.now())))
  .catch(() => {});
const timer = setInterval(schedule, 60000);
void schedule();
console.log("JobNester worker listening. Scheduled scans check every minute.");
async function shutdown() {
  clearInterval(timer);
  clearInterval(heartbeat);
  await worker.close();
  await queue.close();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
