# Juniper

Juniper is a tutoring marketplace for learners and tutors. The mobile app also runs on the web through Expo Web. Account-backed requests, tutor applications, offers, sessions, and chat are served by a NestJS API and PostgreSQL. Fictional tutor cards and role-play flows are development previews only. Juniper does not process payments or take a commission; learners and tutors arrange payment directly.

## Run and operate

- `pnpm --filter @workspace/api-server run typecheck` — check the NestJS API
- `pnpm --filter @workspace/juniper-tutoring run typecheck` — check the Expo app
- `pnpm run typecheck` — check workspace packages
- `pnpm --filter @workspace/api-server run build` — bundle the API
- `pnpm --filter @workspace/api-server run start` — start the built API from deployment-provided environment variables (does not load the local `.env`)
- `pnpm --filter @workspace/db run migrate:production` — apply schema using the current shell's `DATABASE_URL` (use only from a trusted production migration environment)
- `pnpm --filter @workspace/api-server run start` — start the built API
- `pnpm --filter @workspace/juniper-tutoring exec expo start --web` — run the web app
- `pnpm --filter @workspace/juniper-tutoring exec expo start` — run the native app
- `pnpm --filter @workspace/db run migrate` — apply the checked-in PostgreSQL schema
- `POST /api/marketplace/bookings/:bookingId/payment/report` — learner reports a Cash, Whish, or OMT payment; multipart field `receipt` is optional
- `POST /api/marketplace/bookings/:bookingId/payment/confirm` — assigned tutor confirms the reported payment
- `GET /api/marketplace/bookings/:bookingId/payment/receipt` — learner or assigned tutor downloads the private receipt
- `PATCH /api/marketplace/admin/tutors/:tutorId/subscription` — allowlisted administrator sets `{ "subscriptionPaid": true|false }`
- `powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1` — start local PostgreSQL, apply migrations, and start the API after `/api/readyz` is healthy
- `bash ./scripts/start-local.sh` — equivalent local startup flow for Bash environments
- `pnpm --filter @workspace/db admin:bootstrap -- user@example.com` — add an existing local user UUID to `JUNIPER_ADMIN_USER_IDS` in `.env`

### Run the account flow on Windows

Use two PowerShell windows from the project root. The local Juniper Postgres container should map host port `5433` to container port `5432`; this avoids colliding with another local Postgres service that may already own `5432`.

In the first window, start the database if it is stopped, configure the API, and start it:

```powershell
docker start juniper-postgres
$env:DATABASE_URL = "postgresql://juniper:juniper-local@localhost:5433/juniper"
$env:JWT_SECRET = "juniper-local-only-signing-secret-change-before-deployment"
$env:APP_ORIGIN = "http://localhost:8081"
$env:APP_PUBLIC_URL = "http://localhost:8081"
$env:NODE_ENV = "development"
$env:PORT = "3001"
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/api-server run start
```

Keep that window open. In a second window, start the web app:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://localhost:3001"
pnpm --filter @workspace/juniper-tutoring exec expo start --web --port 8081
```

Open `http://localhost:8081`. Create an account, then follow the email verification link printed in the API window. If the database container is missing, create it once with `docker run --name juniper-postgres -e POSTGRES_USER=juniper -e POSTGRES_PASSWORD=juniper-local -e POSTGRES_DB=juniper -p 5433:5432 -d postgres:16`. If port `5433` is also occupied, choose another host port and update `DATABASE_URL` to match.

## Required configuration

Set secrets in the deployment environment, never in source control:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — random signing secret of at least 32 characters
- `TUTOR_DOCUMENT_STORAGE=replit` — use the app's private Replit Object Storage bucket for tutor application evidence; the bucket must be provisioned for the deployment. Local development uses `.local/tutor-documents` and does not expose uploaded files publicly.
- `JUNIPER_ADMIN_USER_IDS` — comma-separated UUIDs of staff accounts allowed to review tutor applications and access their private evidence
- `EXPO_PUBLIC_API_URL` — API origin, such as `https://api.example.com`; Expo Web development defaults to `http://localhost:3001`, while production may leave it blank for same-origin proxying
- `APP_ORIGIN` — exact web app origin allowed by API CORS, such as `https://juniper.example.com`
- `APP_PUBLIC_URL` — public web app origin used in email links
- `EXPO_PUBLIC_SUPPORT_EMAIL` — support contact included in the client build
- `RESEND_API_KEY` and `EMAIL_FROM` — required for production verification and reset emails
- `JUNIPER_ADMIN_USER_IDS` — comma-separated account UUID allowlist for the protected tutor review screen
- `PORT` — set by most app hosts; otherwise the API uses `API_PORT` or port 3001

Production startup rejects missing app URLs, non-HTTPS app URLs, and a localhost PostgreSQL URL. Email configuration and private tutor-document storage are also required for production startup.

Development email links are printed to the API log when Resend is not configured. For web sign-in, the frontend and API must be same-site or deployed with secure cross-site cookies and a matching CORS origin. Native refresh tokens are stored with Expo SecureStore.

## Architecture

- `artifacts/juniper-tutoring/` — Expo Router app, responsive web layout, native screens, and the Juniper cream-and-forest visual system
- `artifacts/juniper-tutoring/context/AuthContext.tsx` — account session lifecycle and authenticated API client
- `artifacts/api-server/` — NestJS modules for email/password auth and marketplace operations
- `lib/db/src/schema/` — Drizzle PostgreSQL schema
- `lib/db/migrations/` — checked-in SQL migrations
- `lib/db/scripts/migrate.mjs` — PostgreSQL migration runner
- `lib/api-spec/openapi.yaml` — existing API specification scaffold; update it as routes are formalized

## Account and data boundaries

- Sign-up, sign-in, verification, password reset, and refresh live in the app’s `(auth)` routes and `/api/auth` API. Passwords use scrypt; API account IDs come from verified bearer tokens, not request bodies.
- Learner requests, learner level, preferred study windows and time zone, tutor applications and availability, offers, bookings, session recaps, reviews, notifications, and booking messages are stored in PostgreSQL and scoped to the authenticated account.
- Tutor accounts must be email-verified and have an approved tutor profile before seeing matching requests or sending offers. New profiles are pending review and do not appear in public tutor results. The active workspace role is account-backed and can switch to tutor only after approval.
- Tutor applications support current students, graduates, and professionals. A transcript is required for every pathway; current students provide proof of enrollment, while graduates and professionals provide a degree certificate. Documents are stored privately and served only to allowlisted Juniper reviewers; approval is blocked until staff verify the pathway evidence.
- Chat is available only to the learner and tutor on an accepted booking. Offer acceptance creates a booking, conversation, and tutor notification atomically. Messages sync over authenticated WebSockets with read receipts; polling is a fallback when realtime is unavailable. Private PDF/JPG/PNG attachments are participant-only.
- Tutors can suggest an initial time with an offer or agree on another time in chat. A tutor can add a learning recap and next step after a session; learners can then leave one review per session.
- Tutor profiles are public only while approved. They show the tutor's reviewed profile details, proposed hourly rate, subjects, levels, availability, and aggregate session/review history.
- Learners and tutors arrange payment directly. Juniper does not collect, send, hold, refund, or guarantee payment. Offers and bookings are records of agreed tutoring details, not proof of payment.
- Learner requests are for tutoring, explanations, practice, and feedback. Tutors must not complete graded work for a learner to submit as their own.
- The production home does not display sample tutors or sample marketplace activity. Local-only sample profiles and role-play screens are development previews only.
- Tutor discovery filters on subject and learner level, ranks verified profiles using learner reviews, completed sessions, and response times over the last 90 days, and shows each tutor's local study windows. Tutor request matching checks subject, learner level, actual time-zone overlap, and direct requests.
- In-app, realtime, and native push notifications are enabled. Native push needs an EAS project ID and a development or production build; Expo Go is not a production push target. Email review decisions use a retrying outbox; account verification and password email use Resend.
- No grade outcome or refund promise is active. Payment processing, commission, and payouts are out of scope; the current beta uses direct arrangements between tutor and learner.

## Operational notes

- Apply `pnpm --filter @workspace/db run migrate` before starting the API. The SQL uses an advisory lock and idempotent DDL.
- Tutor evidence uploads are limited to PDF, JPG, and PNG files up to 10 MB. Local files are stored under the ignored `.local/tutor-documents` directory. Production startup refuses to use local filesystem storage; configure and provision Replit Object Storage first.
- Tutor signup creates a learner-role account with tutor application access. Tutor workspace permissions remain locked until a staff member approves the transcript and pathway-specific evidence; approval changes the account's active role to tutor.
- API liveness is available at `/api/healthz`; `/api/readyz` checks PostgreSQL readiness.
- Authentication, marketplace, and tutor-application endpoints use shared PostgreSQL rate-limit buckets. Apply migration `0005` before running the API.
- Set `SENTRY_DSN` to enable backend error capture. Request bodies, query strings, and authorization/cookie headers are removed before events are sent. Monitoring remains disabled if the DSN is blank.
- `pnpm db:backup` creates a private, ignored PostgreSQL custom-format dump under `.backups/`. It requires `pg_dump` on `PATH`. Production must also schedule encrypted off-host backups with the selected PostgreSQL provider and periodically verify restores; a local dump is not a production backup plan.
- Tutor evidence and chat attachments share the configured private storage service. In production, provision private Replit Object Storage and set `TUTOR_DOCUMENT_STORAGE=replit`.
- Follow `docs/BETA-LAUNCH.md` before opening invitations; configure `EXPO_PUBLIC_SUPPORT_EMAIL` so users have a working escalation route.
- `EXPO_PUBLIC_API_URL` is needed for native clients; a blank value uses relative `/api` requests for same-origin web deployment.

## Product direction

Build a more trusted, clearer tutoring experience with original product identity and interaction design. OurEasyGame is a category reference only; do not reuse its logo, copy, images, or exact screen designs.

## Pilot and growth foundations

- Start with a small, manually supported learner-and-tutor cohort in a few subjects where the team can reliably review tutors and respond to support questions.
- Recruit and approve a small supply of tutors before inviting learners. Keep each tutor's approved subjects, rate, time-zone context, and availability current.
- During the pilot, review the funnel weekly: requests created, requests receiving an offer, time to first offer, offers accepted, sessions with a time agreed, sessions completed, reviews submitted, and learners returning for another request.
- Establish a baseline before setting conversion targets. Pair the numbers with short learner and tutor interviews so the team can find where trust, scheduling, or expectations break down.
- Keep the pilot invitation-based until tutor review, support ownership, cancellation handling, and privacy practices are dependable. Do not describe an accepted offer as a paid booking while Phase 4 is excluded.
- Add product analytics only after defining event ownership, retention, consent, and data minimization. The pilot can use aggregated operational counts; it does not require sending learner message content or education details to an analytics provider.
