import { deliverInquiry } from "../../api/src/contact-email.js";
import { writeFile } from "node:fs/promises";
import {
  aiRequest,
  aiCapabilities,
  resumeResponse,
} from "../../api/src/ai-client.js";
import "../../api/src/config.js";
import { Worker } from "bullmq";
import { Prisma, type Source as DbSource } from "@prisma/client";
import { db, json, queue } from "../../api/src/service.js";
import { redisConnection, required } from "../../api/src/config.js";
import { seal, unseal } from "../../api/src/security.js";
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
          await db.job.create({
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
          model: "gpt-4o-mini",
          reservedUsd: 0.1,
        },
      });
      return true;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
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
async function gmail(taskId: string) {
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
  const api = async (path: string) => {
    const r = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
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
