# Architecture and API

See [features.md](./features.md) for the full product feature catalog.

## Components

- **apps/web**: Next.js App Router. Feature folders under `app/features/*`, shell in `app/workspace/WorkspaceShell.tsx`, shared UI in `app/ui/primitives.tsx`. `NEXT_PUBLIC_API_URL` selects live API; absence selects the labeled demo.
- **apps/api**: Modular NestJS REST API (Clerk owner login, Gmail send+read, LinkedIn OpenID, documents, portfolio, applications).
- **apps/ai**: Modular Python/FastAPI service (Gemini). Owns `GEMINI_API_KEY`; internal bearer auth only.
- **apps/worker**: BullMQ job discovery, compose/send, Gmail sync, contact notifications, scheduling.
- **packages/core**: shared types and deterministic scoring/composition helpers.
- **prisma**: PostgreSQL schema/migrations.

## Nest API module map

```text
apps/api/src/
  main.ts                 bootstrap (CORS, rate limit, owner gate)
  app.module.ts
  config/                 env + origins
  common/                 prisma, queue, security
  documents/              pdf, gmail-mime, docx, portfolio-import, contact-email
  ai/                     ai-client (HTTP to Python)
  modules/
    workspace/            AppService (actions + state)
    health/ state/ actions/ tasks/
    resumes/ portfolio/ assets/ interview/ integrations/ auth/
```

## Python AI module map

```text
apps/ai/app/
  main.py                 FastAPI app + routers
  config.py deps.py
  routers/                health, resumes, applications, interviews, portfolio
  services/               gemini, evidence, resume_compose, email_compose, portfolio_parse, interview
  schemas/                request/response models
```

## Interfaces

All private endpoints require the allowlisted Clerk JWT session. Mutations require the configured WEB_ORIGIN. Responses containing private information use `Cache-Control: no-store`. Frontend requests include credentials.

| Endpoint                                                      | Purpose                                    |
| ------------------------------------------------------------- | ------------------------------------------ |
| GET /api/health                                               | Process liveness                           |
| /sign-in and /sign-up (Next.js)                               | Clerk authentication UI                    |
| GET /api/state                                                | Single-owner workspace snapshot            |
| POST /api/actions/:action                                     | Validated business action                  |
| GET /api/tasks/:id                                            | Background task status/progress            |
| POST /api/resume/import                                       | Extract PDF/DOCX/TXT text for owner review |
| GET /api/resumes/:id/download?format=pdf\|docx&kind=cv\|cover | Versioned CV or cover letter               |
| POST /api/assets/upload                                       | Private S3 media upload                    |
| GET /api/assets/:id                                           | Owner-only signed asset redirect           |
| GET /api/interview/:jobId                                     | Role-specific practice kit                 |
| GET /api/integrations/gmail/connect\|callback                 | Gmail read + send authorization            |
| GET /api/integrations/linkedin/connect\|callback              | Basic LinkedIn identity authorization      |
| GET /api/public/portfolio                                     | Published public snapshot only             |
| GET /api/public/resume                                        | Explicitly selected approved CV            |
| GET /api/public/assets/:id                                    | Published media only                       |
| POST /api/public/contact                                      | Rate-limited inquiry ingestion             |

Action bodies are validated in the workspace service. Actions include `profile.save`, `mode.save`, `settings.save`, `source.add`, `source.toggle`, `scan`, `job.import`, `job.save`, `job.hide`, `job.view`, `application.update`, `application.reapply`, `application.compose`, `application.send`, `resume.generate`, `resume.batch`, `resume.ready`, `portfolio.save`, `portfolio.publish`, `portfolio.unpublish`, `portfolio.contact-settings`, `recruiter.save`, `recruiter.delete`, `gmail.sync`, `gmail.link`, `gmail.disconnect`, `linkedin.import`, and `linkedin.disconnect`.

Example asynchronous request:

```http
POST /api/actions/resume.generate
Content-Type: application/json
Origin: https://app.yourdomain.com

{"jobId":"<canonical-job-id>","modeId":"fullstack"}
```

Returns `{ "taskId": "..." }`. Batch generation accepts `{ "jobIds": ["..."], "modeId": "fullstack" }` and returns task IDs. At most 20 CV tasks can be outstanding. Task states are queued, running, completed, or failed. The UI polls every 15 seconds. Scans/Gmail use one outstanding task per type, enforced under database locks.

## Data flow

1. A configured employer board is fetched through its fixed official API hostname with response size/time limits and no redirects.
2. Collectors normalize role, technology, salary, location, and source details. Unknown country eligibility is preserved.
3. Sightings merge on source ID/canonical URL. Cross-provider descriptions merge only when employer/title/location agree and content similarity is very high. Distinct source requisitions remain distinct for genuine reposts.
4. Each career mode gets an independent fit score and a separate eligibility result.
5. The owner reviews jobs and queues CVs. The Python service optionally calls Gemini to select existing evidence IDs / compose emails, then assembles original facts into documents. NestJS never holds the model key. Resume versions remain immutable after generation.
6. Opening an employer link records activity. Explicit confirmation selects the submitted CV and timestamps the application. Reapplication archives the prior association in its timeline before starting again.
7. Gmail imports recruitment thread headers/snippets, labels likely categories, and leaves ambiguous application association to the owner. It never changes an application stage automatically.
8. Portfolio publication copies a validated draft to a separate public JSON snapshot. Public endpoints never return the owner profile, integrations, inbox, job search, or private documents.

## Limits and recovery

Collectors rotate through relevant candidates using a persisted per-source cursor and distribute each scan's target across enabled sources. Collection count differs from new unique count. Retries are idempotent through database constraints and task-linked resume versions. A failed task surfaces in workspace notifications. Scheduled scans require a work country and respect the configured local time; missed scans run when the worker next checks after that time. Manual scans allow recovery after a failed scheduled run.

Country extraction is deliberately conservative and based on explicit listing metadata, not an inference that all remote roles are international. It is an assistance tool, not verification of an employer's legal hiring arrangements. Manual imports remain Needs verification.

The current single-owner snapshot is capped at 5,000 jobs, 100 threads, 200 inquiries, and 30 recent tasks. Move to cursor-paginated list endpoints before scaling this beyond personal use.

## Centralized runtime

`npm start` from either project directory runs `scripts/services.mjs`. Docker Compose builds six separately managed services: web (Next.js), api (NestJS), ai (Python/FastAPI), worker, PostgreSQL, and Redis. Health dependencies ensure the database, queue, and Python service are ready before NestJS starts; the worker and web wait for API health. The launcher initializes missing secrets locally without overwriting existing values. Stop/restart/status/logs use the same centralized launcher and never delete database volumes.

The worker calls `POST /v1/resumes/generate` with `{profile, job, mode, useAi}` and validates `{content, coverLetter, evidenceIds, method}`. It reserves budget in PostgreSQL before authorizing a provider request. NestJS proxies interview preparation to `POST /v1/interviews/prepare`. Both endpoints require `Authorization: Bearer <AI_SERVICE_TOKEN>`. `GET /health` returns readiness and whether an allowed LLM model is configured, never credentials. Python rejects unreviewed profiles and unsupported model-selected evidence IDs.
