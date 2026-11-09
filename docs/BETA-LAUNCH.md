# Juniper invite-only beta runbook

This runbook is for the first real learners and tutors. Juniper connects the two sides; it does not process money or take a commission. Learners and tutors agree on and exchange payment directly.

## Before opening invitations

## Deployment shape

Juniper is a monorepo with two separately running services: the Expo web client and the NestJS API. Your hosting provider must expose both through a supported setup: either a single-origin web server that serves the built Expo client and forwards `/api` and `/socket.io` to the API, or two deployments with the client configured to use the API's HTTPS origin. Do not publish the current development workflow as if it were a production topology; it starts local development servers and does not by itself prove that both services are reachable from the public internet.

The API's production `start` command reads deployment environment variables directly. The separate `dev` command loads the ignored root `.env` for local development. Never add `.env` to a deployment artifact.

For the first beta, choose the simplest topology you can verify end to end. A single public origin is preferable for browser sign-in because secure cookies and CORS are simpler. If the API and web client use different origins, configure the API origin in the client build and verify secure cross-site cookies on the actual production domains.

## Deployment sequence

1. Make sure this complete workspace is available in your chosen hosting provider and that the project can install the checked-in pnpm workspace from its root.
2. Configure the web app and API in the intended production topology. Set the client build command to `pnpm --filter @workspace/juniper-tutoring run build`. Set the API build command to `pnpm --filter @workspace/api-server run build`. The running public web entry point must serve the Expo export; the public API entry point must start with `pnpm --filter @workspace/api-server run start`. If one deployment handles both, use a production server/proxy that routes the web routes to the exported client and `/api` plus `/socket.io` to the API. A development run button is not a production run command.
3. Create a dedicated production PostgreSQL database in the provider you select. Copy its connection string directly into the API deployment's secret store. Never use the local Docker database or the development database for production.
4. Provision a private S3-compatible bucket for the API deployment. AWS S3, Cloudflare R2, Backblaze B2, and similar providers are supported through the S3 API. Keep tutor application evidence and chat/request attachments private. Confirm reads require Juniper authorization; do not expose a public bucket or public file routes.
5. Configure a domain and HTTPS for the public client and API. Prefer one origin with `/api` and `/socket.io` routed to the API. Set `APP_ORIGIN` and `APP_PUBLIC_URL` to the exact public HTTPS client origin. If using distinct origins, set `EXPO_PUBLIC_API_URL` to the API HTTPS origin before building the client and test cookie sign-in on the final domains.
6. Add deployment secrets to the API service: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (random, at least 32 characters), `APP_ORIGIN`, `APP_PUBLIC_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `TUTOR_DOCUMENT_STORAGE=s3`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, and optionally `STORAGE_ENDPOINT`, `STORAGE_FORCE_PATH_STYLE=true`, and `SENTRY_DSN`. Add `EXPO_PUBLIC_SUPPORT_EMAIL` to the client build environment. Add `EXPO_PUBLIC_API_URL` only for separate-origin/API routing; for a same-origin proxy, leave it blank so browser requests use `/api` on the client origin. Never put server secrets in an `EXPO_PUBLIC_*` variable.
7. Build the API and web client, then start the API. Check `https://<api-origin>/api/healthz` for liveness and `/api/readyz` for database readiness. Do not continue if either service fails or the database is not ready.
8. Take a database backup. In a trusted hosting shell or CI job that has the production `DATABASE_URL` available, run `pnpm --filter @workspace/db run migrate:production` once. Confirm the output says the schema is up to date. Do not paste the database URL into chat or commit it. Keep the migration logs and take a provider backup before later schema releases. The ordinary `migrate` script is for local development and reads the ignored root `.env` file.
9. Create one administrator account through the live app's signup and email-verification flow. Obtain that account's user UUID from the trusted admin/database workflow, add it to the API deployment secret `JUNIPER_ADMIN_USER_IDS`, then restart/redeploy the API. Do not invent or guess this UUID.
10. Sign in as the administrator. Submit a separate tutor application with test credentials, then verify both uploaded documents are visible only to the allowlisted reviewer and can be reviewed. Delete the test account and documents before opening the pilot.
11. Build/publish the client with the final API origin and support email. In a private browser window, test signup, verification, sign-in, sign-out, password reset, support email link, tutor discovery and profile, learner request, tutor offer, acceptance, chat, agreed session, completion, and review using two separate accounts.
12. Confirm email delivery and check the app on a narrow phone viewport. Verify no preview tutors or sample activity appears, payment wording is clear, documents remain private, and both client and API error logs are quiet.
13. Open invitations to a small cohort only after the complete flow passes. Keep the team available to review tutor credentials and respond to safety, access, cancellation, and missed-session reports.

Keep production values in your hosting provider's service secret manager and redeploy after changing them. Do not rely on local `.env` files for production.

### Production services

- Use a dedicated production PostgreSQL database. Never point the production API at a developer or preview database.
- Set `NODE_ENV=production`, `DATABASE_URL`, and a unique `JWT_SECRET` of at least 32 characters.
- Set `APP_ORIGIN` to the exact HTTPS web origin and `APP_PUBLIC_URL` to the HTTPS URL used in verification and password-reset links.
- Set `EXPO_PUBLIC_API_URL` to the deployed API URL when building the client.
- Configure `RESEND_API_KEY` and a verified `EMAIL_FROM` sender.
- Provision a private S3-compatible bucket and set `TUTOR_DOCUMENT_STORAGE=s3` before starting the API. Tutor credentials and learner attachments contain private information.
- Set `EXPO_PUBLIC_SUPPORT_EMAIL` in the client build. The app exposes this address in the support section.
- Set `JUNIPER_ADMIN_USER_IDS` after creating the initial administrator account so the tutor-review queue can be operated.
- Configure `SENTRY_DSN` for production error reporting. Set `EXPO_PUBLIC_EAS_PROJECT_ID` if native push notifications are enabled.
- Keep secrets in the deployment provider’s secret manager. Do not place production credentials in `.env.example`, source control, or a client `EXPO_PUBLIC_*` variable.

### First administrator setup

1. Deploy the API with the production database, HTTPS app URLs, email provider, and private object storage configured.
2. Create the administrator account through the normal signup and email-verification flow.
3. Add that account’s user ID to `JUNIPER_ADMIN_USER_IDS` and restart the API.
4. Sign in as that administrator and confirm the tutor application queue loads and can review documents and applications.
5. Build the client with the production API URL and support email, then verify account creation, email verification, password reset, and support contact.

## Beta operating rules

- Start with a small number of approved tutors and a few subjects where you can respond to requests reliably.
- Review identity and qualification documents before approving a tutor. Keep the documents private and never copy them into public profiles or support messages.
- Describe the listed amount as a tutor’s proposed rate. Before accepting, learners and tutors should agree on the final price, payment method, session details, and cancellation expectations.
- State clearly that Juniper does not collect, send, hold, or refund money and does not guarantee either party’s payment.
- Tutors provide explanations, feedback, practice, and guided learning. They must not complete graded work for a learner to submit as their own.
- Route safety, impersonation, harassment, missed sessions, and account-access concerns to the configured support address. Review the in-app request, offer, and chat history; do not promise to reverse direct payments.
- Pause a tutor profile if a credible safety concern requires review. Record the decision and communicate next steps through the existing review workflow.

## Before each release

- Apply pending SQL migrations to the production database before starting the new API version:

  ```powershell
  pnpm --filter @workspace/db migrate
  ```

- Confirm API health, production CORS origin, secure cookies, HTTPS links, and email delivery.
- Confirm tutor documents, learner request attachments, and chat attachments upload and can only be opened by authorized reviewers or conversation participants.
- Confirm a learner can create a request, receive a real tutor offer, accept it, chat, see an agreed session, and submit a review after completion.
- Confirm a tutor can apply, upload qualifications, be reviewed, see eligible learner requests, send an offer, and manage confirmed sessions.
- Confirm the client contains no sample tutors, example requests, sample offers, or local preview bookings in production.
- Confirm every offer and confirmed session states that payment is arranged directly between learner and tutor.
- Check recent errors and create a database backup before a release that includes schema changes.

## Beta measures

Review these weekly before expanding invitations:

- Requests successfully posted and percentage receiving a relevant offer.
- Time from request to first tutor response.
- Offers accepted and sessions scheduled.
- Sessions completed and learner reviews submitted.
- Support reports, cancellations, and the steps that caused confusion.

Expand subject coverage or invitations only when the current cohort is receiving timely responses and sessions are completing reliably.
