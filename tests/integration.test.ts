import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { emptyState, type Job } from "@jobnester/core";
test(
  "PostgreSQL, queue, CV worker, duplicate prevention, public snapshot and application integrity",
  { skip: process.env.RUN_INTEGRATION !== "1", timeout: 60000 },
  async () => {
    process.env.JOB_QUEUE_NAME = `integration-${process.pid}-${Date.now()}`;
    const { AppService, db, queue, json } =
      await import("../apps/api/src/service.js");
    const service = new AppService();
    const owner = await service.owner();
    const tag = `integration-${Date.now()}`;
    const uploadDirectory = await mkdtemp(
      join(tmpdir(), "jobnester-integration-"),
    );
    const messages: string[] = [];
    const smtp = createServer((socket) => {
      socket.write("220 localhost SMTP test\r\n");
      let buffer = "",
        data = false,
        message = "";
      socket.on("data", (bytes) => {
        buffer += bytes.toString();
        let end;
        while ((end = buffer.indexOf("\r\n")) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (data) {
            if (line === ".") {
              messages.push(message);
              message = "";
              data = false;
              socket.write("250 Message accepted\r\n");
            } else message += line + "\n";
          } else if (/^EHLO|^HELO/i.test(line))
            socket.write("250-localhost\r\n250 SIZE 1000000\r\n");
          else if (/^DATA/i.test(line)) {
            data = true;
            socket.write("354 End with dot\r\n");
          } else if (/^QUIT/i.test(line)) {
            socket.end("221 Bye\r\n");
          } else socket.write("250 OK\r\n");
        }
      });
    });
    await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
    const smtpEnv = {
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String((smtp.address() as { port: number }).port),
      SMTP_SECURE: "false",
      SMTP_USER: "",
      RESEND_API_KEY: "",
      CONTACT_FROM_EMAIL: "portfolio@example.com",
      CONTACT_NOTIFY_EMAIL: "owner@example.com",
    };
    let inquiryId = "";
    const assetIds: string[] = [];
    let worker: ReturnType<typeof spawn> | undefined;
    let server: ReturnType<typeof spawn> | undefined;
    let jobId = "",
      taskId = "";
    try {
      await db.owner.update({
        where: { id: "owner" },
        data: { clerkUserId: null },
      });
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
          env: { ...process.env, ...smtpEnv, OPENAI_API_KEY: "" },
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
      assert.ok(finished, "CV worker should complete. " + logs);
      const { privateKey, publicKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });
      const encode = ({ email }: { email: string }) => {
        const sub =
          email === "owner@example.com" ? "user_owner_test" : "user_other_test";
        const header = Buffer.from(
          JSON.stringify({ alg: "RS256", typ: "JWT", cat: "cl_B7d4PD111AAA" }),
        ).toString("base64url");
        const now = Math.floor(Date.now() / 1000);
        const body = Buffer.from(
          JSON.stringify({
            sub,
            iss: "https://test.clerk.accounts.dev",
            azp: "http://localhost:3000",
            sid: "sess_test",
            iat: now,
            nbf: now - 5,
            exp: now + 300,
          }),
        ).toString("base64url");
        return `${header}.${body}.${sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey).toString("base64url")}`;
      };
      server = spawn(
        process.execPath,
        ["--import", "tsx", "apps/api/src/main.ts"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            ...smtpEnv,
            UPLOAD_DIRECTORY: uploadDirectory,
            PORT: "4011",
            API_ORIGIN: "http://localhost:4011",
            WEB_ORIGIN: "http://localhost:3000",
            CLERK_JWT_KEY: publicKey
              .export({ type: "spki", format: "pem" })
              .toString(),
            CLERK_OWNER_USER_ID: "user_owner_test",
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
      for (const provider of ["gmail", "linkedin"])
        assert.equal(
          (
            await fetch(
              `http://localhost:4011/api/integrations/${provider}/callback?code=fake&state=fake`,
            )
          ).status,
          400,
        );
      const jwt = encode({ email: "owner@example.com" });
      const headers = { Authorization: `Bearer ${jwt}` };
      assert.equal(
        (await fetch("http://localhost:4011/api/state", { headers })).status,
        200,
      );
      const wrongJwt = encode({ email: "other@example.com" });
      assert.equal(
        (
          await fetch("http://localhost:4011/api/state", {
            headers: { Authorization: `Bearer ${wrongJwt}` },
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
        assert.equal(
          response.status,
          201,
          `${name}: ${await response.clone().text()}`,
        );
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
      const importedForm = new FormData();
      importedForm.append("file", new Blob([docx]), "original-resume.docx");
      const importedResponse = await fetch(
        "http://localhost:4011/api/portfolio/from-cv",
        {
          method: "POST",
          headers: { ...headers, Origin: "http://localhost:3000" },
          body: importedForm,
        },
      );
      assert.equal(importedResponse.status, 201);
      const imported = (await importedResponse.json()) as any;
      assert.equal(imported.reviewRequired, true);
      assert.ok(imported.extractedText.includes("Integration Engineer"));
      const assetId = imported.resume.url.split("/").at(-1);
      assetIds.push(assetId);
      assert.equal(
        (await fetch(`http://localhost:4011/api/public/assets/${assetId}`))
          .status,
        404,
      );
      assert.equal(
        (await fetch("http://localhost:4011/api/portfolio/draft")).status,
        401,
      );
      await service.action("portfolio.save", {
        ...portfolio,
        resume: imported.resume,
      });
      await service.action("portfolio.publish", {});
      assert.equal(
        (await fetch(`http://localhost:4011/api/public/assets/${assetId}`))
          .status,
        200,
      );
      await service.action("portfolio.contact-settings", {
        email: "owner@example.com",
      });
      const contactResponse = await fetch(
        "http://localhost:4011/api/public/contact",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Recruiter",
            email: `${tag}@example.com`,
            message:
              "A complete inquiry delivered through the loopback SMTP test server.",
            website: "",
          }),
        },
      );
      assert.equal(contactResponse.status, 201);
      const inquiry = await db.inquiry.findFirstOrThrow({
        where: { email: `${tag}@example.com` },
      });
      inquiryId = inquiry.id;
      for (let i = 0; i < 50 && !messages.length; i++)
        await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(messages.length, 1);
      assert.ok(messages[0].includes("A complete inquiry delivered"));
      assert.ok(messages[0].includes("Reply-To:"));
      assert.equal(
        (await db.inquiry.findUniqueOrThrow({ where: { id: inquiryId } }))
          .deliveryStatus,
        "delivered",
      );
      await service.action("portfolio.unpublish", {});
      assert.equal(
        (await fetch("http://localhost:4011/api/public/portfolio")).status,
        404,
      );
      assert.equal(
        (await fetch(`http://localhost:4011/api/public/assets/${assetId}`))
          .status,
        404,
      );
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
          clerkUserId:
            owner.clerkUserId === "user_owner_test" ? null : owner.clerkUserId,
          contactRecipient: owner.contactRecipient,
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
      if (inquiryId) await db.inquiry.deleteMany({ where: { id: inquiryId } });
      if (assetIds.length)
        await db.asset.deleteMany({ where: { id: { in: assetIds } } });
      await new Promise<void>((resolve) => smtp.close(() => resolve()));
      await rm(uploadDirectory, { recursive: true, force: true });
      const queued = await queue.getJobs([
        "completed",
        "failed",
        "wait",
        "active",
        "delayed",
      ]);
      await db.task.deleteMany({
        where: {
          id: { in: queued.map((job) => job.data.taskId).filter(Boolean) },
        },
      });
      await queue.obliterate({ force: true });
      await queue.close();
      await db.$disconnect();
    }
  },
);
