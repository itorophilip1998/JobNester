import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import { z } from "zod";
import {
  emptyState,
  matchAll,
  canonicalUrl,
  fingerprint,
  stages,
  type AppState,
  type Job,
  type Profile,
  type Portfolio,
  type CareerMode,
  type Settings,
} from "@jobnester/core";
import { redisConnection } from "./config.js";
import { unseal } from "./security.js";
export const db = new PrismaClient();
const connection = {
  host: new URL(redisConnection.url).hostname,
  port: Number(new URL(redisConnection.url).port) || 6379,
  password: new URL(redisConnection.url).password || undefined,
  username: new URL(redisConnection.url).username || undefined,
  tls: redisConnection.url.startsWith("rediss:") ? {} : undefined,
};
export const queue = new Queue(process.env.JOB_QUEUE_NAME || "jobnester", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
export const json = (x: unknown) =>
  JSON.parse(JSON.stringify(x)) as Prisma.InputJsonValue;
const id = z.string().min(1).max(200);
const short = z.string().trim().min(1).max(200);
const optional = z.string().max(5000).default("");
const httpUrl = z
  .url()
  .refine((s) => /^https?:\/\//i.test(s), "Only HTTP(S) URLs are supported")
  .refine((s) => {
    const u = new URL(s);
    return !u.username && !u.password;
  }, "URLs cannot contain credentials");
const optionalUrl = z.union([z.literal(""), httpUrl]);
const evidence = z.object({
  id,
  company: short,
  role: short,
  start: short,
  end: short,
  text: z.string().trim().min(1).max(10000),
});
const timezone = z.string().refine((s) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: s });
    return true;
  } catch {
    return false;
  }
}, "Invalid timezone");
const country = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .refine((s) => {
    const regions = new Intl.DisplayNames(["en"], { type: "region" });
    for (let a = 65; a <= 90; a++)
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        if (regions.of(code)?.toLowerCase() === s.toLowerCase()) return true;
      }
    return false;
  }, "Use the English country name, e.g. United Kingdom or Canada");
export const profileSchema = z
  .object({
    name: short,
    headline: short,
    country,
    timezone,
    skills: z.array(short).max(100),
    evidence: z.array(evidence).max(100),
    confirmed: z.boolean(),
    salaryMin: z.number().min(0).max(10000000),
    employment: short,
    usWorkAuthorized: z.boolean().optional().default(false),
    needsSponsorship: z.boolean().optional().default(false),
    contactEmail: z.union([z.literal(""), z.email()]).optional(),
    phone: z.string().max(50).optional(),
    portfolioUrl: optionalUrl.optional(),
  })
  .refine(
    (p) => !p.confirmed || p.evidence.length > 0,
    "Confirmed profiles need at least one experience record",
  );
export const portfolioSchema = z.object({
  layout: z.enum(["studio", "editorial"]).default("studio"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#b39af3"),
  motion: z.enum(["none", "subtle", "expressive"]).default("subtle"),
  heroHeading: z
    .string()
    .max(200)
    .default("Thoughtful software.\nMeaningful impact."),
  avatar: optionalUrl.default(""),
  sections: z
    .object({
      work: z.boolean(),
      about: z.boolean(),
      resume: z.boolean(),
      certifications: z.boolean(),
      contact: z.boolean(),
    })
    .default({
      work: true,
      about: true,
      resume: true,
      certifications: true,
      contact: true,
    }),
  sectionOrder: z
    .array(z.enum(["work", "about", "resume", "certifications", "contact"]))
    .length(5)
    .refine((a) => new Set(a).size === 5)
    .default(["work", "about", "resume", "certifications", "contact"]),
  resume: z.object({ url: optionalUrl, name: z.string().max(200) }).optional(),
  certifications: z
    .array(
      z.object({
        id,
        name: short,
        issuer: z.string().max(200),
        issuedAt: z.string().max(100),
        credentialUrl: optionalUrl,
        image: optionalUrl,
        description: z.string().max(5000),
        documentType: z.enum(["image", "pdf"]).optional(),
      }),
    )
    .max(100)
    .default([]),
  name: short,
  headline: short,
  bio: z.string().max(10000),
  email: z.union([z.literal(""), z.email()]),
  github: optionalUrl,
  location: z.string().max(200),
  skills: z.array(short).max(100),
  projects: z
    .array(
      z.object({
        id,
        title: short,
        description: z.string().max(20000),
        tags: z.array(short).max(30),
        url: optionalUrl,
        image: optionalUrl,
        video: optionalUrl.optional(),
        repositoryUrl: optionalUrl.optional(),
      }),
    )
    .max(50),
  experience: z
    .array(
      evidence.extend({
        start: z.string().max(200),
        end: z.string().max(200),
        text: z.string().max(10000),
      }),
    )
    .max(100),
  published: z.boolean(),
  publicResumeId: id.nullable(),
});
const schemas: Record<string, z.ZodType> = {
  "profile.save": profileSchema,
  "mode.save": z.object({
    id,
    name: short,
    short,
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    keywords: z.array(short).min(1).max(50),
    titles: z.array(short).min(1).max(30),
    weights: z
      .object({
        skills: z.number().min(0).max(100),
        title: z.number().min(0).max(100),
        evidence: z.number().min(0).max(100),
      })
      .refine(
        (w) => w.skills + w.title + w.evidence === 100,
        "Weights must total 100",
      )
      .optional(),
  }),
  "job.save": z.object({ id }),
  "job.hide": z.object({ id }),
  "job.view": z.object({ id }),
  "job.import": z.object({
    url: httpUrl,
    company: short,
    title: short,
    location: z.string().max(200).default("Not specified"),
    description: z.string().min(10).max(50000),
  }),
  "application.update": z.object({
    id,
    stage: z.enum(stages as [string, ...string[]]),
    resumeId: id.nullable(),
    followUp: z.union([z.literal(""), z.iso.date()]).optional(),
    contactEmail: z.union([z.literal(""), z.email()]).optional(),
    emailDraft: z
      .object({
        subject: z.string().min(1).max(300),
        body: z.string().min(1).max(20000),
        coverLetter: z.string().min(1).max(50000),
      })
      .optional(),
  }),
  "application.reapply": z.object({ id }),
  "application.compose": z.object({
    jobIds: z.array(id).min(1).max(20),
    modeId: id,
  }),
  "application.send": z.object({
    id,
    resumeId: id.optional(),
  }),
  "resume.batch": z.object({ jobIds: z.array(id).min(1).max(20), modeId: id }),
  "resume.generate": z.object({ jobId: id, modeId: id }),
  "resume.ready": z.object({ id }),
  "portfolio.save": portfolioSchema,
  "portfolio.publish": z.object({}),
  "portfolio.unpublish": z.object({}),
  "portfolio.contact-settings": z.object({
    email: z.union([z.literal(""), z.email()]),
  }),
  "settings.save": z.object({
    dailyTarget: z.number().int().min(20).max(500),
    scanTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    scanEnabled: z.boolean(),
    aiBudget: z.number().min(0).max(1000),
  }),
  "source.add": z.object({
    company: short,
    provider: z.enum(["greenhouse", "lever", "ashby"]),
    board: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  }),
  "source.toggle": z.object({ id }),
  "recruiter.save": z.object({
    id: id.optional(),
    name: short,
    email: z.email(),
    company: short,
    notes: optional,
    followUp: z.union([z.literal(""), z.iso.date()]).default(""),
  }),
  "recruiter.delete": z.object({ id }),
  "linkedin.import": z.object({}),
  "linkedin.disconnect": z.object({}),
  "gmail.sync": z.object({}),
  "gmail.disconnect": z.object({}),
  "gmail.link": z.object({ id, jobId: id.nullable() }),
  scan: z.object({}),
};
@Injectable()
export class AppService {
  async owner() {
    let owner = await db.owner.findUnique({ where: { id: "owner" } });
    if (!owner) {
      const s = emptyState();
      owner = await db.owner.create({
        data: {
          id: "owner",
          profile: json(s.profile),
          modes: json(s.modes),
          settings: json(s.settings),
          portfolioDraft: json(s.portfolio),
        },
      });
    }
    return owner;
  }
  async state(): Promise<AppState> {
    const owner = await this.owner();
    const [
      jobs,
      apps,
      resumes,
      sources,
      tasks,
      recruiters,
      inquiries,
      threads,
      gmail,
    ] = await Promise.all([
      db.job.findMany({ orderBy: { discoveredAt: "desc" }, take: 5000 }),
      db.application.findMany({
        include: { events: { orderBy: { at: "asc" } } },
      }),
      db.resume.findMany({ orderBy: { createdAt: "desc" } }),
      db.source.findMany(),
      db.task.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
      db.recruiter.findMany(),
      db.inquiry.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
      db.mailThread.findMany({ orderBy: { date: "desc" }, take: 100 }),
      db.integration.findUnique({
        where: { provider: "gmail" },
        select: { provider: true },
      }),
    ]);
    return {
      profile: owner.profile as unknown as Profile,
      modes: owner.modes as unknown as CareerMode[],
      settings: owner.settings as unknown as Settings,
      portfolio: owner.portfolioDraft as unknown as Portfolio,
      contactRecipient:
        owner.contactRecipient ||
        process.env.CONTACT_NOTIFY_EMAIL ||
        process.env.OWNER_EMAIL ||
        "",
      emailDeliveryConfigured: !!(
        (process.env.RESEND_API_KEY && process.env.CONTACT_FROM_EMAIL) ||
        (process.env.SMTP_HOST && process.env.CONTACT_FROM_EMAIL)
      ),
      jobs: jobs.map((j) => ({
        ...(j.payload as unknown as Job),
        id: j.id,
        active: j.active,
        viewed: j.viewed,
        hidden: j.hidden,
        discoveredAt: j.discoveredAt.toISOString(),
      })),
      applications: JSON.parse(JSON.stringify(apps)),
      resumes: JSON.parse(JSON.stringify(resumes)),
      sources: JSON.parse(JSON.stringify(sources)),
      tasks: JSON.parse(JSON.stringify(tasks)),
      recruiters,
      inquiries: JSON.parse(JSON.stringify(inquiries)),
      threads: JSON.parse(JSON.stringify(threads)),
      gmailConnected: !!gmail,
      linkedinConnected: !!(await db.integration.findUnique({
        where: { provider: "linkedin" },
        select: { provider: true },
      })),
    };
  }
  async task(type: string, data: unknown = {}) {
    const task = await db.$transaction(async (tx) => {
      const lock = BigInt(
        type === "scan"
          ? 1001
          : type === "gmail"
            ? 1002
            : type === "resume"
              ? 1003
              : type === "compose"
                ? 1005
                : type === "send"
                  ? 1006
                  : 1004,
      );
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lock})`;
      const limit =
        type === "resume" || type === "compose"
          ? 20
          : type === "notify"
            ? 200
            : type === "send"
              ? 20
              : 1;
      if (
        (await tx.task.count({
          where: { type, status: { in: ["queued", "running"] } },
        })) >= limit
      )
        throw new BadRequestException(
          type === "resume" || type === "compose"
            ? "Up to 20 generation tasks can be queued at a time."
            : type === "send"
              ? "Up to 20 send tasks can be queued at a time."
              : "This task is already queued or running.",
        );
      return tx.task.create({ data: { type } });
    });
    try {
      await queue.add(
        type,
        { taskId: task.id, ...(data as object) },
        { jobId: task.id },
      );
    } catch {
      await db.task.update({
        where: { id: task.id },
        data: {
          status: "failed",
          message: "Queue unavailable. Check Redis and retry.",
        },
      });
      throw new BadRequestException(
        "Queue unavailable. Start Redis and the worker.",
      );
    }
    return { taskId: task.id };
  }
  async action(action: string, raw: unknown) {
    const schema = schemas[action];
    if (!schema) throw new NotFoundException("Unknown action");
    const parsed = schema.safeParse(raw);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
    const d = parsed.data as any;
    const o = await this.owner();
    switch (action) {
      case "profile.save": {
        await db.owner.update({
          where: { id: o.id },
          data: { profile: json(d) },
        });
        await this.rematch(d, o.modes as unknown as CareerMode[]);
        break;
      }
      case "mode.save": {
        const modes = o.modes as unknown as CareerMode[];
        if (!modes.some((m) => m.id === d.id))
          throw new BadRequestException("Unknown career mode");
        const updated = modes.map((m) => (m.id === d.id ? d : m));
        await db.owner.update({
          where: { id: o.id },
          data: { modes: json(updated) },
        });
        await this.rematch(o.profile as unknown as Profile, updated);
        break;
      }
      case "job.save": {
        const job = await db.job.findUnique({ where: { id: d.id } });
        if (!job) throw new NotFoundException("Job not found");
        const payload = job.payload as unknown as Job;
        await db.application.upsert({
          where: { jobId: d.id },
          update: {},
          create: {
            jobId: d.id,
            contactEmail: payload.contactEmail || null,
            sendStatus: "none",
            events: { create: { type: "saved", note: "Job saved" } },
          },
        });
        break;
      }
      case "job.hide": {
        const j = await db.job.findUniqueOrThrow({ where: { id: d.id } });
        await db.job.update({
          where: { id: j.id },
          data: { hidden: !j.hidden },
        });
        break;
      }
      case "job.view": {
        await db.job.update({ where: { id: d.id }, data: { viewed: true } });
        const a = await db.application.findUnique({ where: { jobId: d.id } });
        if (a)
          await db.applicationEvent.create({
            data: {
              applicationId: a.id,
              type: "opened",
              note: "Opened employer application page. Submission not confirmed.",
            },
          });
        break;
      }
      case "job.import": {
        const url = canonicalUrl(d.url);
        if (await db.job.findUnique({ where: { url } }))
          throw new BadRequestException(
            "This job URL is already in your workspace.",
          );
        const now = new Date().toISOString();
        const payload = matchAll(
          {
            id: "",
            company: d.company,
            title: d.title,
            location: d.location || "Not specified",
            url,
            remote: false,
            countries: [],
            worldwide: false,
            salary: "Not disclosed",
            salaryMin: null,
            employment: "Not specified",
            technologies: [],
            description: d.description,
            source: "Manual",
            sourceId: crypto.randomUUID(),
            postedAt: now,
            discoveredAt: now,
            active: true,
            viewed: false,
            hidden: false,
            matches: {},
          },
          o.profile as unknown as Profile,
          o.modes as unknown as CareerMode[],
        );
        await db.job.create({
          data: {
            company: d.company,
            title: d.title,
            location: payload.location,
            url,
            fingerprint: fingerprint(payload),
            payload: json(payload),
          },
        });
        break;
      }
      case "application.update": {
        const a = await db.application.findUniqueOrThrow({
          where: { id: d.id },
        });
        if (d.resumeId) {
          const r = await db.resume.findUnique({ where: { id: d.resumeId } });
          if (!r || !r.ready || r.jobId !== a.jobId)
            throw new BadRequestException(
              "Select a reviewed CV belonging to this job.",
            );
        }
        if (d.stage === "Applied" && !d.resumeId)
          throw new BadRequestException(
            "Select the CV actually submitted before marking Applied.",
          );
        if (
          a.appliedAt &&
          a.resumeId &&
          d.resumeId &&
          a.resumeId !== d.resumeId
        )
          throw new BadRequestException(
            "The submitted CV is immutable. Record a deliberate reapplication instead of replacing history.",
          );
        await db.application.update({
          where: { id: a.id },
          data: {
            stage: d.stage,
            resumeId: d.resumeId || a.resumeId,
            appliedAt:
              d.stage === "Applied" ? a.appliedAt || new Date() : a.appliedAt,
            followUp: d.followUp ? new Date(d.followUp) : null,
            ...(d.contactEmail !== undefined
              ? { contactEmail: d.contactEmail || null }
              : {}),
            ...(d.emailDraft
              ? {
                  emailDraft: json(d.emailDraft),
                  sendStatus:
                    a.sendStatus === "sent" ? a.sendStatus : "drafted",
                }
              : {}),
            events: {
              create: {
                type: "status",
                note: `Moved to ${d.stage}${d.stage === "Applied" ? ` • CV: ${d.resumeId}` : ""}`,
              },
            },
          },
        });
        break;
      }
      case "application.compose": {
        if (!(o.profile as unknown as Profile).confirmed)
          throw new BadRequestException("Confirm your experience first.");
        if (
          !(o.modes as unknown as CareerMode[]).some((m) => m.id === d.modeId)
        )
          throw new BadRequestException("Unknown mode");
        const ids = [...new Set(d.jobIds)] as string[];
        if ((await db.job.count({ where: { id: { in: ids } } })) !== ids.length)
          throw new BadRequestException("One or more jobs no longer exist.");
        const tasks = [];
        for (const jobId of ids) {
          await db.application.upsert({
            where: { jobId },
            update: { sendStatus: "none" },
            create: { jobId, stage: "Saved", sendStatus: "none" },
          });
          const queued = await this.task("compose", { jobId, modeId: d.modeId });
          await db.application.update({
            where: { jobId },
            data: { composeTaskId: queued.taskId },
          });
          tasks.push(queued);
        }
        return { tasks };
      }
      case "application.send": {
        const a = await db.application.findUniqueOrThrow({
          where: { id: d.id },
        });
        const draft = a.emailDraft as {
          subject?: string;
          body?: string;
          coverLetter?: string;
        } | null;
        if (!draft?.subject || !draft?.body || !draft?.coverLetter)
          throw new BadRequestException(
            "Compose and review the application email before sending.",
          );
        if (!a.contactEmail)
          throw new BadRequestException(
            "Add a recipient email, or open the job link when no company email is available.",
          );
        if (
          !(await db.integration.findUnique({ where: { provider: "gmail" } }))
        )
          throw new BadRequestException(
            "Connect Gmail in Settings to send applications.",
          );
        const resumeId = d.resumeId || a.resumeId;
        if (!resumeId)
          throw new BadRequestException(
            "Select a reviewed CV to attach before sending.",
          );
        const resume = await db.resume.findUnique({ where: { id: resumeId } });
        if (!resume || !resume.ready || resume.jobId !== a.jobId)
          throw new BadRequestException(
            "Select a reviewed CV belonging to this job.",
          );
        await db.application.update({
          where: { id: a.id },
          data: { resumeId, sendStatus: "sending" },
        });
        return this.task("send", { applicationId: a.id, resumeId });
      }
      case "application.reapply": {
        const a = await db.application.findUniqueOrThrow({
          where: { id: d.id },
        });
        if (!a.appliedAt)
          throw new BadRequestException(
            "This application has no previous submission.",
          );
        await db.application.update({
          where: { id: a.id },
          data: {
            stage: "Saved",
            resumeId: null,
            appliedAt: null,
            followUp: null,
            events: {
              create: {
                type: "reapplication",
                note: `Deliberate reapplication started. Previous submission: ${a.appliedAt.toISOString()}; submitted CV: ${a.resumeId || "not recorded"}.`,
              },
            },
          },
        });
        break;
      }
      case "resume.batch": {
        if (!(o.profile as unknown as Profile).confirmed)
          throw new BadRequestException("Confirm your experience first.");
        if (
          !(o.modes as unknown as CareerMode[]).some((m) => m.id === d.modeId)
        )
          throw new BadRequestException("Unknown mode");
        const ids = [...new Set(d.jobIds)] as string[];
        if ((await db.job.count({ where: { id: { in: ids } } })) !== ids.length)
          throw new BadRequestException("One or more jobs no longer exist.");
        const tasks = [];
        for (const jobId of ids)
          tasks.push(await this.task("resume", { jobId, modeId: d.modeId }));
        return { tasks };
      }
      case "resume.generate": {
        if (!(o.profile as unknown as Profile).confirmed)
          throw new BadRequestException(
            "Confirm your professional experience first.",
          );
        if (!(await db.job.findUnique({ where: { id: d.jobId } })))
          throw new NotFoundException("Job not found");
        if (
          !(o.modes as unknown as CareerMode[]).some((m) => m.id === d.modeId)
        )
          throw new BadRequestException("Unknown mode");
        return this.task("resume", d);
      }
      case "resume.ready": {
        await db.resume.update({ where: { id: d.id }, data: { ready: true } });
        break;
      }
      case "portfolio.save": {
        if (
          d.publicResumeId &&
          !(await db.resume.findFirst({
            where: { id: d.publicResumeId, ready: true },
          }))
        )
          throw new BadRequestException("Public CV must be reviewed.");
        await db.owner.update({
          where: { id: o.id },
          data: { portfolioDraft: json(d) },
        });
        break;
      }
      case "portfolio.contact-settings": {
        await db.owner.update({
          where: { id: o.id },
          data: { contactRecipient: d.email || null },
        });
        break;
      }
      case "portfolio.unpublish": {
        await db.owner.update({
          where: { id: o.id },
          data: {
            portfolioPublished: Prisma.DbNull,
            portfolioDraft: json({
              ...(o.portfolioDraft as object),
              published: false,
            }),
          },
        });
        break;
      }
      case "portfolio.publish": {
        const p = portfolioSchema.parse(o.portfolioDraft);
        await db.owner.update({
          where: { id: o.id },
          data: {
            portfolioPublished: json({ ...p, published: true }),
            portfolioDraft: json({ ...p, published: true }),
          },
        });
        break;
      }
      case "settings.save": {
        await db.owner.update({
          where: { id: o.id },
          data: { settings: json(d) },
        });
        break;
      }
      case "source.add": {
        await db.source.upsert({
          where: { provider_board: { provider: d.provider, board: d.board } },
          update: { company: d.company, enabled: true },
          create: d,
        });
        break;
      }
      case "source.toggle": {
        const source = await db.source.findUniqueOrThrow({
          where: { id: d.id },
        });
        await db.source.update({
          where: { id: d.id },
          data: { enabled: !source.enabled },
        });
        break;
      }
      case "recruiter.save": {
        const { id, ...data } = d;
        if (id) await db.recruiter.update({ where: { id }, data });
        else await db.recruiter.create({ data });
        break;
      }
      case "recruiter.delete": {
        await db.recruiter.delete({ where: { id: d.id } });
        break;
      }
      case "linkedin.disconnect": {
        await db.integration.deleteMany({ where: { provider: "linkedin" } });
        break;
      }
      case "linkedin.import": {
        const integration = await db.integration.findUnique({
          where: { provider: "linkedin" },
        });
        if (!integration)
          throw new BadRequestException("Connect LinkedIn first.");
        const { identity } = unseal<any>(integration.encryptedTokens);
        await db.owner.update({
          where: { id: o.id },
          data: {
            profile: json({
              ...(o.profile as object),
              ...(identity.name
                ? { name: String(identity.name).slice(0, 200) }
                : {}),
              ...(identity.email ? { contactEmail: identity.email } : {}),
            }),
          },
        });
        break;
      }
      case "gmail.sync": {
        if (
          !(await db.integration.findUnique({ where: { provider: "gmail" } }))
        )
          throw new BadRequestException("Connect Gmail first.");
        return this.task("gmail");
      }
      case "gmail.disconnect": {
        await db.integration.deleteMany({ where: { provider: "gmail" } });
        await db.mailThread.deleteMany();
        break;
      }
      case "gmail.link": {
        if (
          d.jobId &&
          !(await db.application.findUnique({ where: { jobId: d.jobId } }))
        )
          throw new BadRequestException("Choose an existing application.");
        await db.mailThread.update({
          where: { id: d.id },
          data: { jobId: d.jobId },
        });
        break;
      }
      case "scan": {
        if (!(o.profile as unknown as Profile).country)
          throw new BadRequestException(
            "Set your work country before scanning.",
          );
        if (!(await db.source.count({ where: { enabled: true } })))
          throw new BadRequestException(
            "Add an enabled employer source in Settings.",
          );
        return this.task("scan");
      }
    }
    await db.auditLog.create({
      data: { action, metadata: json({ recordId: d.id || null }) },
    });
    return { ok: true };
  }
  async rematch(profile: Profile, modes: CareerMode[]) {
    const jobs = await db.job.findMany();
    for (const job of jobs)
      await db.job.update({
        where: { id: job.id },
        data: {
          payload: json(
            matchAll(job.payload as unknown as Job, profile, modes),
          ),
        },
      });
  }
}
