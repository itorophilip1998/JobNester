# JobNester AI

A personal career workspace and public portfolio built with Next.js, NestJS, Python/FastAPI (Gemini), PostgreSQL/Prisma, and BullMQ/Redis. The web app includes a clearly labeled browser-local demo; the live app uses an owner-authenticated API and durable database.

Feature catalog: [docs/features.md](./docs/features.md). Module maps: [docs/architecture.md](./docs/architecture.md).

## Start all services (Docker-first)

JobNester runs as a full Docker Compose stack. From the project root:

```sh
./start.sh
```

Same thing via npm:

```sh
npm start
# or
npm run docker:up
```

Requires Node.js 22 (launcher only) and Docker with Compose v2. Host Python and app `npm install` are not required for Docker startup. The launcher:

1. Checks Docker/Compose, starts Docker Desktop if needed on macOS/Windows, and waits for the engine.
2. Initializes `.env` from `.env.example` if needed, fills missing local secrets, preserves existing values (including `GEMINI_API_KEY`), and never prints secrets.
3. Builds and starts PostgreSQL, Redis, Python AI (Gemini), NestJS API, BullMQ worker, and Next.js with Compose.
4. Applies Prisma migrations and seeds the owner profile before the API becomes healthy.

| Service            | Address                          |
| ------------------ | -------------------------------- |
| Next.js web server | http://localhost:3000            |
| NestJS API         | http://localhost:4000/api/health |
| Python AI service  | http://localhost:8000/health     |
| PostgreSQL         | localhost:5433                   |
| Redis              | localhost:6380                   |

```sh
./stop.sh                     # Stop containers; preserve volumes
./start.sh restart            # Rebuild and start all services
./start.sh status             # Container health/status
./start.sh logs api           # Follow one service (web/api/ai/worker/db/redis)
./start.sh logs               # Follow all logs
./start.sh setup              # Initialize .env without starting Docker

npm stop                      # same as ./stop.sh
npm run docker:restart
npm run docker:status
npm run logs -- api
```

Set OWNER_EMAIL to your verified Clerk email (or configure CLERK_OWNER_USER_ID), plus NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in `.env` before signing in. The local launcher can reuse the development keys created by Clerk CLI in apps/web/.env.local. Services run without them, but private dashboard access remains locked. The launcher does not fabricate credentials or enable a development authentication bypass. GEMINI_API_KEY is optional; only the Python container receives it. The worker calls Python over authenticated HTTP and owns task retries, database persistence, and AI budget reservations.

The web runs the actual Next.js Node server (`next start`), the API is a separate NestJS process, and AI generation/interview preparation run in Python/FastAPI. The Node worker performs collection, scheduling, and orchestration; it no longer calls OpenAI or composes live CVs itself.

## Frontend-only demo

```sh
npm ci
npm run dev:demo
```

Open http://localhost:3000. Stop the Docker web container first if it is using that port. Demo listings, compensation, and work history are illustrative. Changes stay in this browser. Demo scans do not invent jobs and demo contact forms do not send messages. Demo exports TXT; live mode exports PDF/DOCX. `npm run dev:demo` explicitly selects demo mode even when a live `.env` exists.

### Running individual services on the host

For development, install npm dependencies, create a Python virtual environment and install `apps/ai/requirements.txt`, then run `python -m uvicorn app.main:app --port 8000` from `apps/ai` with AI_SERVICE_TOKEN exported to match `.env`. Set AI_SERVICE_URL=http://localhost:8000 in the root `.env`. The API/worker read it automatically. Start the desired npm workspace with `npm run dev -w @jobnester/api`, `npm run dev -w @jobnester/worker`, or `npm run dev:web`.

### Clerk authentication and integration OAuth

Clerk manages login at `/sign-in`, with protected editing at `/portfolio/edit` and draft preview at `/portfolio/preview`. The API validates Clerk JWTs and binds your existing single-owner profile to the authorized Clerk user. Existing Auth.js cookies are no longer accepted; sign in again through Clerk. No passwords or career records are copied or deleted.

For the optional Gmail integration, create a Google OAuth Web application. Add these exact development callback URLs:

- `http://localhost:4000/api/integrations/gmail/callback` — Gmail read + send connection

Enable Gmail API, configure the OAuth consent screen, and add your account as a test user while developing. Gmail scopes include read (inbox sync) and send (application emails with résumé/cover letter attachments). Production verification requirements depend on your deployment and Google's policy. Google OAuth testing grants can expire, so reconnect when required. Owner login uses Clerk. Google OAuth is used only for Gmail access. Configure MFA in your Clerk application if desired.

Optional LinkedIn basic identity connection requires an approved **Sign In with LinkedIn using OpenID Connect** product and the callback `http://localhost:4000/api/integrations/linkedin/callback`. Configure LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET. It imports only the name and verified email when explicitly requested; it cannot read full work history, saved jobs, messages, or applications. Indeed uses manual job links and pasted descriptions. No restricted scraping or auto-submission is implemented.

### First live session

1. Complete your profile with your actual country, timezone, authorization details, skills, and experience. Review and confirm the evidence.
2. In Settings, add US employer career boards you have identified. Select Greenhouse, Lever, or Ashby and supply its board token/slug. JobNester does not assume that every employer using these systems is US-based.
3. Run a scan. The daily target is 100–500 processed candidate listings across all modes, not 100–500 guaranteed new eligible jobs. Small employer registries will produce shortfalls. Each source shows last-run health.
4. Review jobs by fit and eligibility. Save roles; tailor individual CVs or select up to 20 jobs for batch generation.
5. Review each immutable document version. Open the employer form and submit manually. Mark Applied only after submission, selecting the exact reviewed CV version.
6. Update stages, follow-ups, and recruiter contacts. A deliberate reapplication preserves the previous submission and CV ID in the timeline.
7. Edit your public portfolio draft, select an approved public CV if desired, then publish. Draft edits do not change the published snapshot.

### AI behavior

GEMINI_API_KEY is optional. Without it, CV generation and application emails use deterministic ranking/templates. With it, Gemini selects evidence IDs, structures portfolio drafts from CVs, and composes application emails; it cannot invent professional claims. Documents retain reviewed source facts. Match scores use configurable skills/title/evidence weights and are not hiring probabilities.

AI spending uses a conservative reservation ledger with database locking. The default model is `gemini-2.0-flash` (other allowlisted Gemini models are supported). Each request reserves $0.10 against the monthly ceiling. When the ceiling is exhausted, generation falls back to deterministic ranking.

### Portfolio media and contact email

Media uploads use a private local directory and the portfolio_uploads Docker volume by default. Draft files are owner-only; published references become accessible. Set ASSET_STORAGE=s3 to use a private bucket instead. Hosted HTTPS image/video URLs work without object storage. Optional uploads support PNG, JPEG, WebP, and MP4 up to 20 MB. Set S3_BUCKET, AWS_REGION and AWS credentials; S3_ENDPOINT supports compatible services. Keep the bucket private. The API exposes signed media URLs only for assets referenced by the published portfolio. Removing a published asset revokes fresh access; previously signed links expire after 60 seconds. Draft assets remain private.

Contact inquiries are stored in PostgreSQL and queued for delivery of the complete message to your personal inbox. Configure SMTP_HOST/SMTP_PORT (and SMTP_USER/SMTP_PASSWORD where required), or RESEND_API_KEY. Set CONTACT_FROM_EMAIL to a verified sender. Choose the private recipient in the portfolio editor or use CONTACT_NOTIFY_EMAIL/OWNER_EMAIL. Visitor email is Reply-To. Delivery failures surface in task history and are retried; if delivery is unconfigured the form reports that explicitly instead of falsely confirming delivery.

Professional inbox hosting and domain registration remain external services. The application never creates a mailbox automatically.

## Production deployment

Fill `.env` with your real origins and OAuth credentials, then use `npm start`. Configure TLS and replace local database passwords before exposing services. The supplied ports bind to loopback. Set NEXT_PUBLIC_API_URL to your browser-accessible API URL; the launcher rebuilds Next.js to embed it. Internal API/worker requests use the Docker address http://ai:8000.

- `app.yourdomain.com` → Next.js server on port 3000
- `api.yourdomain.com` → NestJS API on port 4000
- `yourdomain.com` → `/portfolio` on the Next.js server

Keep the Python service internal; only API and worker should call its private endpoints. AI_SERVICE_TOKEN protects those calls. Public portfolio origins belong in PUBLIC_PORTFOLIO_ORIGINS. Use same-site dashboard/API domains for OAuth cookies.

The earlier Sites preview remains a static browser-local demo. `npm run build:site` produces that separate static export; normal `npm run build` produces the Next.js server build. Docker startup does not publish or change the hosted demo.

### Operations

- `GET /api/health` is a process liveness endpoint. Verify database and queue connectivity independently in your hosting health checks.
- Tasks retain recent progress and error messages; Settings displays source failures. The worker retries transient failures with exponential backoff. Scheduled scans use the profile's timezone.
- Back up PostgreSQL and private object storage. Restore into a staging instance and run migrations before switching traffic. Redis uses append-only persistence; retained tasks are not a substitute for database backups.
- Protect and back up TOKEN_ENCRYPTION_KEY separately from data. Changing it invalidates existing encrypted connections; disconnect/reconnect integrations during key rotation.
- Keep secrets out of Git and client environment variables. Only NEXT_PUBLIC_API_URL belongs in the public web build.
- Stop local infrastructure with `docker compose stop db redis`; volumes remain intact.

## Tests

```sh
npm run db:generate
npm run typecheck
npm test
npm run build
# With PostgreSQL, Redis, and Python AI running (npm start), and .env configured:
npm run test:integration
# Python tests inside the running AI container:
npm run test:ai
# Playwright Chromium (or PLAYWRIGHT_CHROME=1 for installed Google Chrome):
npx playwright install chromium
npm run test:e2e
```

Integration tests cover database uniqueness, durable application history, worker CV generation, approved document versions, owner-only sessions, CSRF checks, public/draft separation, and PDF/DOCX exports and imports. Browser tests exercise mobile layout, filters, duplicate imports, CV review, submission tracking, and portfolio publication. CI repeats these checks with service containers.

Integration tests temporarily replace the owner profile and restore it on completion. Run them against a development/test database, not production. External OAuth consent, AI provider calls, S3 uploads, notification delivery, and real credentials are not exercised by automated tests.

## Current boundaries

The implemented product covers the core job loop, portfolio CMS, Gmail classification, recruiter contacts, basic analytics/advice, and role-specific practice kits. The practice kits and career advice are deterministic helpers, not a live conversational interview coach. Full LinkedIn/Indeed saved-job access remains dependent on approved provider capabilities. Native mobile apps, email sending on your behalf, semantic embeddings, negotiated-offer tools, portfolio visitor analytics, and statistical outcome modeling are not part of this release. Job listings are refreshed when revisited; vanished postings are not automatically treated as withdrawn applications.

See docs/architecture.md for the API, data flow, and deployment layout.

For the portfolio workflow, see [docs/portfolio.md](docs/portfolio.md).
