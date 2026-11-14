import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { emptyState, type Job } from "@jobnester/core";
test(
  "PostgreSQL, queue, CV worker, duplicate prevention, public snapshot and application integrity",
  { skip: process.env.RUN_INTEGRATION !== "1", timeout: 60000 },
  async () => {
    const { AppService, db, queue, json } =
      await import("../apps/api/src/service.js");
    const service = new AppService();
    const owner = await service.owner();
    const tag = `integration-${Date.now()}`;
    let worker: ReturnType<typeof spawn> | undefined;
    let server: ReturnType<typeof spawn> | undefined;
    let jobId = "",
      taskId = "";
    try {
      const p = {
        ...emptyState().profile,
        name: "Integration Engineer",
        headline: "Engineer",
        country: "Canada",
        confirmed: true,
        skills: ["TypeScript", "React", "PostgreSQL", "APIs"],
        evidence: [
          {
            id: "verified",
            company: "Test Employer",
            role: "Engineer",
            start: "2020",
            end: "2026",
            text: "Built TypeScript APIs backed by PostgreSQL.",
          },
        ],
      };
      await service.action("profile.save", p);
      await assert.rejects(() =>
        service.action("job.import", {
          url: "javascript:alert(1)",
          company: "Test",
          title: "Engineer",
          description: "Test description",
        }),
      );
      const url = `https://example.com/${tag}`;
      await service.action("job.import", {
        url,
        company: tag,
        title: "Senior Software Engineer",
        description: "Build TypeScript and PostgreSQL APIs.",
        location: "Remote",
      });
      const job = await db.job.findUniqueOrThrow({ where: { url } });
      jobId = job.id;
      await assert.rejects(
        () =>
          service.action("job.import", {
            url: `${url}?utm_source=duplicate`,
            company: tag,
            title: "Senior Software Engineer",
            description: "Build TypeScript and PostgreSQL APIs.",
          }),
        /already/,
      );
      await service.action("job.save", { id: jobId });
      await service.action("job.save", { id: jobId });
      assert.equal(await db.application.count({ where: { jobId } }), 1);
      const app = await db.application.findUniqueOrThrow({ where: { jobId } });
      await service.action("job.view", { id: jobId });
      assert.equal(
        (await db.application.findUniqueOrThrow({ where: { id: app.id } }))
          .appliedAt,
        null,
      );
      await assert.rejects(
        () =>
          service.action("application.update", {
            id: app.id,
            stage: "Applied",
            resumeId: null,
            followUp: "",
          }),
        /CV/,
      );
      worker = spawn(
        process.execPath,
        ["--import", "tsx", "apps/worker/src/main.ts"],
        {
          cwd: process.cwd(),
          env: { ...process.env, OPENAI_API_KEY: "" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let logs = "";
      worker.stderr?.on("data", (b) => (logs += b.toString()));
      const task = (await service.action("resume.generate", {
        jobId,
        modeId: "software",
      })) as { taskId: string };
      taskId = task.taskId;
      let finished = false;
      for (let n = 0; n < 100; n++) {
        const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
        if (task.status === "failed") throw Error(task.message + logs);
        if (task.status === "completed") {
          finished = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      assert.ok(finished, "CV worker should complete");
      const secret = "integration-only-secret-01234567890123456789012345";
      server = spawn(
        process.execPath,
        ["--import", "tsx", "apps/api/src/main.ts"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            PORT: "4011",
            API_ORIGIN: "http://localhost:4011",
            WEB_ORIGIN: "http://localhost:3000",
            AUTH_SECRET: secret,
            OWNER_EMAIL: "owner@example.com",
            GOOGLE_CLIENT_ID: "test-client",
            GOOGLE_CLIENT_SECRET: "test-secret",
            RESEND_API_KEY: "",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let serverLogs = "";
      server.stderr?.on("data", (b) => (serverLogs += b.toString()));
      let healthy = false;
      for (let n = 0; n < 40; n++) {
        try {
          const h = await fetch("http://localhost:4011/api/health");
          if (h.ok) {
            healthy = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      assert.ok(healthy, "API startup: " + serverLogs);
      assert.equal(
        (await fetch("http://localhost:4011/api/state")).status,
        401,
      );
      const { encode } = await import("@auth/core/jwt");
      const jwt = await encode({
        secret,
        salt: "authjs.session-token",
        token: { email: "owner@example.com" },
      });
      const headers = { Cookie: `authjs.session-token=${jwt}` };
      assert.equal(
        (await fetch("http://localhost:4011/api/state", { headers })).status,
        200,
      );
      const wrongJwt = await encode({
        secret,
        salt: "authjs.session-token",
        token: { email: "other@example.com" },
      });
      assert.equal(
        (
          await fetch("http://localhost:4011/api/state", {
            headers: { Cookie: `authjs.session-token=${wrongJwt}` },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await fetch("http://localhost:4011/api/actions/source.add", {
            method: "POST",
            headers: {
              ...headers,
              Origin: "https://untrusted.example",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              company: "Bad origin",
              provider: "lever",
              board: "bad",
            }),
          })
        ).status,
        403,
      );
      const resume = await db.resume.findFirstOrThrow({ where: { jobId } });
      const pdfResponse = await fetch(
        `http://localhost:4011/api/resumes/${resume.id}/download?format=pdf`,
        { headers },
      );
      assert.equal(pdfResponse.status, 200);
      const pdf = Buffer.from(await pdfResponse.arrayBuffer());
      assert.ok(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
      const docxResponse = await fetch(
        `http://localhost:4011/api/resumes/${resume.id}/download?format=docx`,
        { headers },
      );
      assert.equal(docxResponse.status, 200);
      const docx = Buffer.from(await docxResponse.arrayBuffer());
      assert.equal(docx.readUInt16LE(0), 0x4b50);
      for (const [bytes, name] of [
        [pdf, "resume.pdf"],
        [docx, "resume.docx"],
      ] as const) {
        const form = new FormData();
        form.append("file", new Blob([bytes]), name);
        const response = await fetch(
          "http://localhost:4011/api/resume/import",
          {
            method: "POST",
            headers: { ...headers, Origin: "http://localhost:3000" },
            body: form,
          },
        );
        assert.equal(response.status, 201);
        const parsed = (await response.json()) as any;
        assert.ok(
          parsed.text.includes("Built TypeScript APIs backed by PostgreSQL."),
        );
      }
      assert.ok(resume.content.includes(p.evidence[0].text));
      assert.equal(resume.ready, false);
      await assert.rejects(
        () =>
          service.action("application.update", {
            id: app.id,
            stage: "Applied",
            resumeId: resume.id,
            followUp: "",
          }),
        /reviewed/,
      );
      await service.action("resume.ready", { id: resume.id });
      await service.action("application.update", {
        id: app.id,
        stage: "Applied",
        resumeId: resume.id,
        followUp: "",
      });
      const submitted = await db.application.findUniqueOrThrow({
        where: { id: app.id },
      });
      assert.ok(submitted.appliedAt);
      assert.equal(submitted.resumeId, resume.id);
      await service.action("application.update", {
        id: app.id,
        stage: "Interviewing",
        resumeId: resume.id,
        followUp: "2026-12-01",
      });
      assert.equal(
        (
          await db.application.findUniqueOrThrow({ where: { id: app.id } })
        ).appliedAt?.toISOString(),
        submitted.appliedAt?.toISOString(),
      );
      const portfolio = {
        ...emptyState().portfolio,
        name: "Published Snapshot",
        headline: "Engineer",
        publicResumeId: resume.id,
      };
      await service.action("portfolio.save", portfolio);
      await service.action("portfolio.publish", {});
      await service.action("portfolio.save", {
        ...portfolio,
        name: "Unpublished Draft",
      });
      const updated = await db.owner.findUniqueOrThrow({
        where: { id: "owner" },
      });
      assert.equal(
        (updated.portfolioPublished as any).name,
        "Published Snapshot",
      );
      assert.equal((updated.portfolioDraft as any).name, "Unpublished Draft");
    } finally {
      if (server && server.exitCode === null) {
        server.kill("SIGTERM");
        await Promise.race([
          once(server, "exit"),
          new Promise((r) => setTimeout(r, 3000)),
        ]);
        if (server.exitCode === null) server.kill("SIGKILL");
      }
      if (worker && worker.exitCode === null) {
        worker.kill("SIGTERM");
        await Promise.race([
          once(worker, "exit"),
          new Promise((r) => setTimeout(r, 3000)),
        ]);
        if (worker.exitCode === null) worker.kill("SIGKILL");
      }
      if (jobId) {
        await db.application.deleteMany({ where: { jobId } });
        await db.resume.deleteMany({ where: { jobId } });
        await db.job.deleteMany({ where: { id: jobId } });
      }
      if (taskId) {
        await db.aiUsage.deleteMany({
          where: { taskId: { startsWith: taskId } },
        });
        await db.task.deleteMany({ where: { id: taskId } });
      }
      await db.owner.update({
        where: { id: "owner" },
        data: {
          profile: json(owner.profile),
          modes: json(owner.modes),
          settings: json(owner.settings),
          portfolioDraft: json(owner.portfolioDraft),
          portfolioPublished:
            owner.portfolioPublished === null
              ? (await import("@prisma/client")).Prisma.DbNull
              : json(owner.portfolioPublished),
        },
      });
      await queue.close();
      await db.$disconnect();
    }
  },
);
