# JobNester AI

A personal career workspace and public portfolio built with Next.js, NestJS, PostgreSQL/Prisma, and BullMQ/Redis. The web app includes a clearly labeled browser-local demo; the live app uses an owner-authenticated API and durable database.

## Run the demo

```sh
npm ci
npm run dev -w @jobnester/web
```

Open http://localhost:3000. No credentials are required. Demo job listings, compensation, companies' example roles, and work history are illustrative, not live vacancies or verified personal claims. Changes persist in this browser. Reset Demo restores the sample workspace. Demo scans never invent new results; demo contact forms never send messages. Demo document downloads are TXT. The live API exports PDF and DOCX.

## Run the live system

Requires Node.js 22 and Docker (or your own PostgreSQL 16 and Redis 7).

```sh
cp .env.example .env
# Populate OWNER_EMAIL, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# TOKEN_ENCRYPTION_KEY, and uncomment NEXT_PUBLIC_API_URL.
docker compose up -d db redis
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Generate each secret independently with `openssl rand -hex 32`. Set the encryption key to 64 hexadecimal characters. Use a real Google account for OWNER_EMAIL. The live dashboard fails closed without owner authentication. No database records are populated with demo experience.

The web dev server reads the root .env through its Next config. API and worker load the same file. Changing NEXT_PUBLIC_API_URL requires restarting the dev server or rebuilding the static web export. Frontend and API URLs must use the same hostname locally (use localhost for both).

### OAuth configuration

Create a Google OAuth Web application. Add these exact development callback URLs:

- `http://localhost:4000/api/auth/callback/google` — owner sign-in
- `http://localhost:4000/api/integrations/gmail/callback` — optional Gmail read-only connection

Enable Gmail API, configure the OAuth consent screen, and add your account as a test user while developing. Gmail read-only is a restricted scope; production verification requirements depend on your deployment and Google's policy. Google OAuth testing grants can expire, so reconnect when required. Sign-in requires the allowlisted, verified Google email. Enable MFA on that Google account.

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

OPENAI_API_KEY is optional. Without it, CV generation ranks verified evidence using deterministic rules. With it, the initial OpenAI adapter selects evidence IDs for relevance; it cannot introduce new claims. Documents retain reviewed source facts verbatim. Cover letters assemble those same facts. Match scores use configurable skills/title/evidence weights and are not hiring probabilities. Unknown eligibility stays unresolved; country exclusions and explicit US authorization requirements override fit.

AI spending uses a conservative reservation ledger with database locking, not provider billing reconciliation. The default model is gpt-4o-mini; only this model is enabled for external calls. Other model values use deterministic generation until their adapter and pricing reservation are reviewed. Each request reserves $0.10 against the monthly ceiling. When the ceiling is exhausted, generation falls back to deterministic ranking. For an absolute account-wide ceiling, also configure limits with your AI provider.

### Portfolio media and contact email

Hosted HTTPS image/video URLs work without object storage. Optional uploads support PNG, JPEG, WebP, and MP4 up to 20 MB. Set S3_BUCKET, AWS_REGION and AWS credentials; S3_ENDPOINT supports compatible services. Keep the bucket private. The API exposes signed media URLs only for assets referenced by the published portfolio. Removing a published asset revokes fresh access; previously signed links expire after 60 seconds. Draft assets remain private.

Contact inquiries are stored in PostgreSQL. Optional notifications use Resend when RESEND_API_KEY, CONTACT_FROM_EMAIL, and CONTACT_NOTIFY_EMAIL are set. Verify the sending domain with the provider. Notification messages contain no inquiry contents; read those in the dashboard.

Professional inbox hosting and domain registration remain external services. The application never creates a mailbox automatically.

## Production deployment

```sh
# Fill .env with production origins, database credentials, and secrets.
# Set NEXT_PUBLIC_API_URL=https://api.yourdomain.com
docker compose --profile full up --build -d
```

Use a TLS reverse proxy. The web export runs in Nginx; API and worker run as a non-root Node user. Database/Redis ports bind only to loopback in the supplied compose file. Replace local database passwords. For managed services, replace connection URLs in your deployment rather than using the local container overrides. Use same-site domains for the dashboard and API so OAuth cookies work reliably.

- `app.yourdomain.com` → static web app
- `api.yourdomain.com` → NestJS API
- `yourdomain.com` → the same static export, with `/` mapped to `/portfolio.html`

An example public-host Nginx config is in deploy/portfolio.nginx.conf. The portfolio is a single page with work, experience, resume download, and contact sections; project case studies open in dialogs. Add the public origin to PUBLIC_PORTFOLIO_ORIGINS. An example reverse proxy must be adapted with your actual TLS certificates and hostnames. Set TRUST_PROXY=1 only behind one trusted proxy.

The Sites deployment publishes the static browser-local demo privately. It does not host PostgreSQL, Redis, the NestJS API, or the worker. Deploy those services and build with NEXT_PUBLIC_API_URL to use live mode. Public employer sharing requires a public portfolio host; the private Sites preview cannot be shared with unauthenticated employers.

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
# With local PostgreSQL/Redis running and DATABASE_URL/REDIS_URL set:
npm run test:integration
# Playwright Chromium (or PLAYWRIGHT_CHROME=1 for installed Google Chrome):
npx playwright install chromium
npm run test:e2e
```

Integration tests cover database uniqueness, durable application history, worker CV generation, approved document versions, owner-only sessions, CSRF checks, public/draft separation, and PDF/DOCX exports and imports. Browser tests exercise mobile layout, filters, duplicate imports, CV review, submission tracking, and portfolio publication. CI repeats these checks with service containers.

Integration tests temporarily replace the owner profile and restore it on completion. Run them against a development/test database, not production. External OAuth consent, AI provider calls, S3 uploads, notification delivery, and real credentials are not exercised by automated tests.

## Current boundaries

The implemented product covers the core job loop, portfolio CMS, Gmail classification, recruiter contacts, basic analytics/advice, and role-specific practice kits. The practice kits and career advice are deterministic helpers, not a live conversational interview coach. Full LinkedIn/Indeed saved-job access remains dependent on approved provider capabilities. Native mobile apps, email sending on your behalf, semantic embeddings, negotiated-offer tools, portfolio visitor analytics, and statistical outcome modeling are not part of this release. Job listings are refreshed when revisited; vanished postings are not automatically treated as withdrawn applications.

See docs/architecture.md for the API, data flow, and deployment layout.
