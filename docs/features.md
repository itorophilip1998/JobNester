# JobNester feature catalog

Product contract for the single-owner Docker stack.

## A. Authentication and ownership

- Clerk sign-in / sign-up with branded appearance
- Protected private routes (`/`, `/jobs`, `/applications`, `/settings`, `/portfolio/edit`, `/portfolio/preview`)
- API JWT verification; owner allowlist via `OWNER_EMAIL` or `CLERK_OWNER_USER_ID`
- Singleton owner profile bound to the authorized Clerk user
- Public portfolio/contact routes remain unauthenticated

## B. Portfolio (one only)

- CV upload (PDF/DOCX/TXT) → Gemini-assisted draft with deterministic fallback
- Edit identity, about, skills, experience, projects, certifications, resume, contact
- Layouts: Studio and Editorial; accent, motion, hero, section order/visibility
- Private assets (local or S3); draft save; auth-only preview; publish/unpublish
- Public `/portfolio` link; optional public approved CV; contact form → SMTP/Resend

## C. Profile, modes, settings

- Master profile + evidence library with confirm-before-AI gate
- Four editable career modes (titles, keywords, weights)
- Daily target (20–500), scan schedule, AI budget
- Greenhouse / Lever / Ashby sources; Gmail and LinkedIn connections

## D. Jobs

- Pull/scan (default UX: 20); official board collectors only
- Dedupe, fit scoring, eligibility; job URL always; email only when published
- Manual import; filters; save/hide/open; multi-select ≤20

## E. Applications and Gmail apply

- Stages: Saved → Applied → Interviewing → Assessment → Offer → Rejected → Withdrawn
- Compose email (batch ≤20) via Gemini or templates; editable draft
- Blank company email → show job link; paste recipient to send
- Gmail send with PDF résumé + cover letter; send status + audit

## F. Résumés / documents

- Single/batch generation; immutable versions; ready gate
- PDF/DOCX export (Playwright HTML→PDF with pdfkit fallback); TXT in demo

## G. Integrations

- Gmail OAuth (read + send); thread sync and manual job linking
- LinkedIn OpenID: name + verified email only
- Indeed: manual import only

## H. Interview prep

- Role kit (questions, coding, system design, outline); Gemini or fallback

## I. Recruiters, inbox, inquiries

- Recruiter CRUD; Gmail inbox categories; portfolio inquiry list/delivery

## J. AI (Python / Gemini)

- `/health`, `/v1/resumes/generate`, `/v1/applications/compose`, `/v1/interviews/prepare`, `/v1/portfolio/from-cv`
- Internal bearer token; budget ledger; never invent career claims

## K. Demo vs live + ops

- Demo when `NEXT_PUBLIC_API_URL` unset
- `./start.sh` Docker stack: web, api, ai, worker, postgres, redis

## Out of scope

Multi-user/multi-portfolio, LinkedIn/Indeed scraping, ATS auto-submit, guessing recruiter emails, Rust rewrite, conversational coach.
