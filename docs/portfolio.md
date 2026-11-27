# Portfolio setup

JobNester stores **one portfolio** as a private draft and a separate public snapshot in PostgreSQL/Prisma. Draft changes never update the public version until you publish.

## Edit and publish

1. Run `npm start` from the top-level project directory.
2. Open http://localhost:3000/portfolio/edit and sign in with Clerk.
3. Upload a PDF, DOCX, or TXT CV under 5 MB. Python extracts common CV sections into editable fields. Review the extracted text, correct unsupported formatting, and complete any missing facts. Uploading never publishes.
4. Choose **Studio** (dark, technical, project grid) or **Editorial** (light, serif headings, wide case studies). Change the accent, heading, animation style, and section order. Hide sections you do not need.
5. Add your original résumé, experience, certifications, product screenshots, videos, and links. Each product supports a live URL and a separate GitHub/repository URL; the repository is used when the live URL is empty.
6. Choose **Save portfolio draft** to keep changes private, or **Preview draft** to open the latest draft. **Publish portfolio** saves current edits before publishing. **Unpublish** removes the public snapshot and public access to its local files.
7. Share http://localhost:3000/portfolio during local development; use your deployed public domain for employers. The Sites preview is owner-private and demo-only.

Animations respect reduced-motion preferences. Uploaded files are private until explicitly referenced by the published portfolio. New files in draft preview are loaded with owner authentication.

## Clerk login

The Next.js app uses `@clerk/nextjs`; NestJS validates JWTs with `@clerk/backend`. Public portfolio and contact endpoints are accessible without login. Editing, draft data, imports, and private files require owner authorization.

Set these in the root `.env` for Docker/production:

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your Clerk publishable key>
CLERK_SECRET_KEY=<your Clerk secret key>
OWNER_EMAIL=<your verified Clerk email>
```

Alternatively configure CLERK_OWNER_USER_ID with your Clerk user ID. On successful owner login, the existing owner profile is bound to that Clerk ID. Unrelated signed-in users are not allowed to edit it. Do not use first-visitor signup as an ownership mechanism. Do not put secret keys into NEXT_PUBLIC variables.

Clerk CLI initialized a development application for this project; local service scripts reuse its apps/web/.env.local keys without logging them. Configure production keys in `.env` before public deployment. Google OAuth credentials remain optional Gmail integration settings; they no longer control login. Old Auth.js sessions require a fresh Clerk sign-in.

## Send inquiries to your personal email

In the editor, set **Personal email — private destination**. This value is not included in the public portfolio JSON. Then configure either SMTP or Resend:

```dotenv
CONTACT_FROM_EMAIL=Portfolio <portfolio@your-verified-domain.com>
SMTP_HOST=<your SMTP host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your SMTP username>
SMTP_PASSWORD=<your SMTP password or app password>
```

For implicit TLS on port 465 use SMTP_SECURE=true. Alternatively set RESEND_API_KEY and use a verified CONTACT_FROM_EMAIL. CONTACT_NOTIFY_EMAIL or OWNER_EMAIL provides a default recipient when the editor's private destination is empty.

The full name, visitor email, and message are delivered to your inbox. Reply-To points to the visitor; the sender always remains your configured verified address. Messages also remain in the dashboard. Queue retries and delivery timestamps help diagnose failures. No email credentials are exposed to visitors. The demo never sends emails, and draft preview prevents contact submission.

## File storage

By default, the NestJS service writes uploads into `/data/uploads`, backed by the `portfolio_uploads` Docker volume. `npm stop` preserves it. Back up this volume together with PostgreSQL. For an S3-compatible bucket, set ASSET_STORAGE=s3 and the documented AWS/S3 variables. Public asset access checks references in the published snapshot; knowing a private file ID is insufficient.

## Verification

The tests exercise two layouts, CV-derived drafts, certifications, repository fallback, unpublished changes, preview, unpublishing, Clerk token verification, private/public file access, PDF/DOCX parsing, and full email delivery to a loopback SMTP server. Test messages are never sent to external email accounts. Real Clerk browser sign-in and real mailbox delivery still require your configured account and provider.
