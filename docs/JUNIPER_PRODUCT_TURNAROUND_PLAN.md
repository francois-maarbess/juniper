# Juniper product turnaround plan

**Prepared:** 7 November 2026  
**Scope:** Product strategy, UX, UI, content, feature scope, reliability, trust, growth, and interaction audit  
**Decision:** Build Juniper as a complete, broad-coverage tutoring marketplace before the public Play Store launch: any university, major, course, school subject, and language-learning need should have a clear way into discovery and matching. Validate the complete product in closed testing before launch; do not reduce the product to a few-campus demo.

**Revision:** This direction supersedes the earlier recommendation to launch from one local community and a few subject clusters. Broad coverage is a product requirement before public release.

## 1. Executive direction

Juniper already has meaningful product infrastructure: student accounts, a broad subject catalogue, tutor applications and document review, discovery, learner requests, tutor offers, offer acceptance, bookings, chat, attachments, session recaps, and reviews. The gap is not “more features.” The gap is a reliable, credible, low-friction path from a learner’s need to a completed tutoring session, with enough tutor supply and operating support to make the promise believable.

The product should be organized around one outcome:

> **Tell Juniper what you are studying. Find a suitable tutor, or get a clear reply from one. Agree on a session and learn together.**

Keep two entry paths because they solve different problems:

1. **Find a tutor** when a learner knows whom or what they want.
2. **Ask tutors for offers** when a learner knows the subject but wants help finding a fit.

Make each path explain the same facts consistently: tutor identity and qualifications are reviewed; availability is a proposed schedule until both people agree; listed price is a tutor proposal; payment happens directly between learner and tutor; Juniper does not process, protect, or refund it.

### The complete-product decision

The product scope is broad from day one: university and school learning, majors and disciplines, specific courses and topics, and language teaching. The app must accept a university, course, subject, or language even when it is missing from a built-in catalogue. The catalogue should accelerate search; it must never define who the product can serve. Build institution/course self-entry, aliases, multi-language course names, and an admin import/update path so coverage can grow without shipping a new app release for every course.

Separate **product coverage** from **live tutor availability**. Juniper can support a request for any institution or subject, but no software can create a real tutor where none has joined. Discovery and request flows should make current supply visible, accept unsupported demand, route it to qualified tutors who opted into related subjects, and give the learner an honest status. Do not label missing supply as a broken app or pretend tutors exist. This is a truth-and-capacity rule, not a reason to narrow the product.

The launch target is a broad public marketplace after the full end-to-end product is ready, exercised across representative universities, subjects, language-learning needs, regions, and devices, and has enough actual reviewed supply to support the coverage claims made in each launch market. Closed testing is a quality gate for the complete product, not a limited product launch. Recruit tutors across the planned launch markets in parallel with product work; publish availability by category/region and expand claims only as the real supply supports them.

## 2. What I inspected and what I could verify

### Workspace and product surface

- Expo Router app with four main tabs: Home, My learning/Sessions, Find tutors/Requests, Profile/Tutor Hub. Studio and Groups routes exist but are hidden from the tab bar.
- Secondary routes include tutor application, tutor profile, request creation and detail, booking, chat, session detail, workroom, group class, community, AI chat/library, bounties, and admin tutor review.
- API and PostgreSQL cover authentication, subject/tutor/request/offer/booking operations, messages and attachments, tutor application documents, matching, groups, community, AI, and business features.
- The project playbook says payment is arranged directly and Juniper takes no commission. Tutor application transcripts and degree evidence are stored privately and reviewer-gated. Those are valuable trust foundations, but they need to be communicated simply in the interface and operated consistently.
- The subject catalogue has 34 broad categories, but the course/institution selector is not yet a universal, self-serve catalogue. Preserve the broad intent and make the data model extensible instead of forcing a Lebanon-only or hand-seeded list.
- The local preview database returned two tutor records with clearly malformed names/headlines/biographies. Discovery nevertheless labels them “Approved” and shows them as real profiles. I did not edit or delete local user data. This is a **P0 data-quality and trust defect**: approval of documents must not be confused with approval of public copy quality, and local/demo records must never appear in production.
- Tutor studio includes “Create invoice” that routes to Activity and “Manage vault storefront” that routes to Profile. These labels promise actions the destination does not perform. Remove or relabel them before any tutor launch.
- The OpenGraph helper contains claims about verified university tutoring in Lebanon and mentions Whish, OMT, and cash. Confirm every public claim against the actual service and operating policy; do not imply Juniper has verified payment methods or provides payment protection.

### Hands-on checks

- Opened the local web preview at `http://localhost:8081`; homepage rendered at a narrow 333 px viewport. Its main route was understandable and the tab navigation visible.
- Navigated Home → Browse tutors. Discovery loaded, with subject filters, a filter sheet, request action, profile links, and session request actions. It showed the malformed local records noted above.
- Opened Filters. The bottom sheet rendered visually with university, exact course code, and learner level choices. The sheet’s visible content did not expose useful controls in the accessibility tree beyond the sheet handle/container; improve semantic labels and keyboard/screen-reader operability.
- Opened `/request` while signed out. The app redirected to Welcome and preserved `next=/request`; the page rendered account creation, sign-in, and explore-first options. This is good behavior worth protecting in regression checks.
- `GET /api/healthz` returned 200 and `GET /api/readyz` returned ready with the local database available.
- Tried the existing API marketplace integration test against its isolated local test database. It failed before exercising the learner-to-tutor flow because its spawned API never became ready within 25 seconds; the captured server log was empty. The test database is separate from the normal local database. This is a **test harness/startup investigation item**, not evidence that the marketplace flow itself is broken or passed.
- Prior work in this workspace had app and API TypeScript checks passing; the full monorepo check had unrelated errors in `artifacts/mockup-sandbox`. Re-run all checks after implementation and resolve workspace failures that block a trustworthy release.

### Changes made during this audit

- Removed the two Studio quick actions whose destinations did not perform the labeled action (invoice creation and storefront management). The real invoice list actions remain.
- Corrected tutor share metadata so it no longer claims every profile is a “Verified University Tutor,” asserts Lebanon as a universal service location, or names payment providers. The share card now identifies a tutor profile and states that payment is arranged directly.
- App and API package typechecks pass after these changes. The API integration test remains blocked at test-server readiness as described above.

### Audit boundary

I traced visible controls in source and exercised reachable, signed-out web states. I did **not** create accounts, submit tutor applications, create real requests, send messages, upload files, trigger camera/microphone, accept offers, or change database records in the preview. Those flows need isolated test fixtures and, for native-specific behavior, real iOS/Android builds. Static handler tracing is not equivalent to exercising every state on every device.

## 3. Product principles and non-negotiable decisions

1. **Marketplace liquidity beats feature count.** Make finding, responding, agreeing, and completing a session excellent before investing in side products.
2. **Show coverage honestly.** A subject card is a search route, not a supply promise. If no suitable tutor exists, say so and offer a request with a clear expectation about response uncertainty.
3. **Trust must be legible.** Explain what “reviewed” means, which evidence is reviewed, what is public/private, and what is not guaranteed.
4. **Tutoring is the product.** Position the service around explanation, guided practice, feedback, and learning. Remove assignment-completion, “solution delivery,” bounty, or AI claims that could make Juniper look like an answer-selling or academic-integrity-risk marketplace.
5. **One real action per button.** A label must match the destination and resulting state. Remove controls that are placeholders, misleading shortcuts, duplicated CTAs, or unreachable features.
6. **Optimize for clarity over decoration.** Keep the warm cream/forest identity, but reserve illustration, gradients, badges, chips, and cards for meaning. Increase contrast and scan speed; avoid repeated “thoughtful / confidence / next step” filler.
7. **Design mobile and web as real products.** Each needs touch-sized targets, visible focus, keyboard use, safe-area behavior, responsive cards, and appropriate empty/loading/error states.
8. **Do not claim perfection.** Use staged release gates, observed user outcomes, and a named owner for operational work. No software plan can guarantee zero failures.

## 4. Priority map

### P0 — Stop misleading users; make the complete marketplace safe to launch

- Add a public-profile quality gate separate from document/identity review: required profile fields, name sanity checks, subject/level/rate/availability completeness, copy review, and a “preview as learner” step before publish.
- Quarantine/disable local preview/sample records in production using explicit environment gating. Never use a development dataset as proof of launch supply. Seed content must be clearly fictional and must not share the production API/database.
- Fix or remove fake actions in Studio: “Create invoice” and “Manage vault storefront.” Either route to actual invoice/storefront screens that work end-to-end or remove the controls. The misleading shortcuts have been removed; retain only real, supportable actions in this area.
- Rework tutor application burden. Required degree transcript/certificate uploads may be disproportionate for current students and can exclude excellent peer tutors. Decide the trust tier model: student tutor (current enrollment/identity review), graduate/professional tutor (degree/credential review), with explicit badges describing evidence. Do not call a profile “verified” if only an application was reviewed.
- Confirm safeguarding, reporting, blocking, cancellation, no-show, dispute, privacy/retention, and account removal processes before inviting real learners. Add in-product report and block paths in profile, chat, request, and booking contexts, routed to the configured support owner.
- Fix workroom language that implies “delivery of a solution” or revision deliverables; tutoring bookings should represent a live or guided learning session. Remove any UI that suggests Juniper will complete graded work.
- Make payment limits impossible to misread at request, offer acceptance, booking, and chat: Juniper does not collect, hold, send, refund, or guarantee payment. Ask parties to agree on amount, method, timing, and cancellation terms directly.
- Add explicit consent and data minimization for course materials, tutor evidence, chat attachments, analytics, and AI assistance. Set retention/deletion expectations and restrict access consistently.
- Repair and stabilize the local API integration test startup, then use disposable per-run DBs and guaranteed cleanup. A failing harness creates false confidence and blocks safe delivery.

### P1 — Rebuild the “find help” journey around clarity and fit

- Restructure the homepage around two strong actions: **Find a tutor** and **Ask for tutor offers**. Keep one main headline, one short value proposition, one trust statement, then a concise three-step explanation. Remove duplicated hero/section language.
- Discovery filters should be purposeful: subject/topic, institution, course, learner level, language, teaching mode, price range, and actual availability. Search should visibly apply, clear, and preserve filters across profile/back navigation. Do not expose course-code filters with only a confusing handful of seeded examples.
- Replace “Why this could fit” statements generated from broad tags with specific, explainable fit facts backed by data. Do not show a fit badge if its field is missing or not verified.
- Tutor cards should prioritize name, subjects/course fit, learning approach, languages, proposed hourly rate, next available window, review count/rating when real, and the precise review badge. De-emphasize generic AI-like biography text and arbitrary activity stats.
- Tutor profile should answer: Can this person teach my exact topic? How do they teach? What is their experience? What is reviewed? How much do they propose? When can we meet? What happens after I request? Add report/block and share controls with accessible labels.
- Unify “Request a session” and “Book” into a single understandable action unless the booking route truly confirms availability and agreement. At present, competing CTAs risk making the learner wonder whether one is final booking and the other only a message.
- Empty discovery: show the active filters, offer clear “remove filters,” “try related subjects,” and “ask tutors” actions. Don’t imply the right person will necessarily find the learner.
- Requests should use one clean form with required subject/topic, what the learner wants to understand, university and course fields that support both search and custom entry, level, language, timeframe, mode, duration, and budget. Support every discipline and language through a broad taxonomy plus “not listed” entry. Ask for no unnecessary personal or academic details. Add an explicit “I’m seeking tutoring, not someone to complete submitted coursework” statement in context.
- Budget should be framed as learner preference, never a price guarantee. Validate minimum/maximum values, decimal entry, currency, and blank/invalid custom values. Show the selected number unambiguously.
- AI request helper should be optional, private, editable, and clearly labeled as a draft. It must not invent the learner’s topic or imply generated copy was verified. If unavailable, preserve all typed text and keep the manual path obvious.
- Offer comparison should make total cost, duration, number of sessions (for bundles), proposed time, cancellation expectations, tutor evidence, and what the session includes easy to compare. Require an explicit confirm step before offer acceptance and explain that acceptance creates a booking/conversation, not payment.
- Replace the fixed 1.6-second “broadcasting” interstitial with a server-confirmed success state containing the actual request status, next step, and a durable link. Do not navigate based only on a timeout.

### P2 — Make sessions dependable and useful

- Give each booking one clear state machine: offer accepted → time proposed → time agreed → session upcoming → completed/cancelled/no-show → review. Identify the actor and allowed transitions for every state.
- Build an activity screen that distinguishes learner requests from confirmed sessions and shows current next action. Avoid “complete session” being a one-tap control with no clear effect, confirmation, or guard that learning happened.
- Chat: preserve drafts, show delivery/read/retry state, handle disconnected sockets, protect against duplicate sends, explain attachment limits, and offer a report/block route. Do not bury essential scheduling or payment facts in chat copy.
- Workroom tools: keep only features that materially improve a tutoring session. Whiteboard should synchronize collaborators or be labeled local-only; voice notes, camera, and recording need permission-denied and device/browser fallback states. Avoid claiming a video call exists if there is only signaling code or a button without a complete call experience.
- Session notes should be learner-centered: what we covered, what the learner can practise, and next session goal. Keep tutoring recaps optional and private to the booking participants. Reviews should occur after completion and be one per booking.
- Notifications should point to the specific next action, deduplicate events, respect consent, and avoid exposing sensitive course/session detail on lock screens.

### P3 — Revisit expansion features only after the core loop works

Keep the app’s broad learning scope; do not cut major subjects, language teaching, universities, or course support to make the first release smaller. For secondary features such as Group classes, Community, Bounties, AI Library/Companion, Vault, Storefront, invoice, and complex business/tutor subscription surfaces, give each a concrete user job, complete lifecycle, safety/privacy model, and QA owner before exposing it at launch. Remove or hide only controls that are misleading, unfinished, unsafe, or not useful; do not delete data or backend capability as a substitute for product decisions.

Keep the app focused until a cohort repeatedly completes sessions and asks for an adjacent feature. A tool is not valuable because it exists in the codebase.

## 5. Screen-by-screen button and interaction audit

This is the interaction inventory from source tracing, grouped by controls that repeat across records (for example, one subject chip component renders 34 individual choices). The labels below refer to the actual controls/intent in the current UI. A checked route means I observed it; “static” means I traced its implementation but did not submit data.

| Screen / surface | Current buttons, controls, and action | Audit finding and required end state |
|---|---|---|
| Home, signed out | Sign in/Register; Tell us what you need; Browse tutors; search submit; See all; 8 subject cards; Become a tutor; four bottom tabs | Browse worked in the local browser. Keep search and subject taps passing the right query. Collapse duplicated hero and lower-page asks; use “Find a tutor” and “Ask for offers” as the two explicit paths. Add accessible label to search submit and visible focus. |
| Home, signed in as learner | request CTA; upcoming session card; All sessions; Find a tutor; subject cards; notification/open update controls | Each should land on the matching state and preserve context. Show one next action, not generic updates. Verify empty, loading, error, and stale data states. |
| Home, signed in as tutor | role switch; view requests; upcoming session; browse requests; session/workroom link; notification controls | Switching role must explain eligibility and persist safely. Do not show a “tutor” workspace before approval. Every workload count must match the API’s definition and date window. |
| Bottom navigation | Home; My learning/Sessions; Find tutors/Requests; Profile/Tutor Hub | Labels vary by role correctly in native and web navigation. Keep four destinations maximum. Check selected state, keyboard support, deep links, back behavior, safe-area and narrow viewport. |
| Welcome/auth gateway | Create your account; Sign In to Your Account; Explore tutors first | All three are clear. Signed-out request gate correctly preserves the target. Test every protected deep link after sign-in and role mismatch. |
| Sign up | learner/tutor role choices; create account; sign-in link | Role choice must not imply instant tutor approval. Make terms/privacy acceptance explicit and required only when legally appropriate; do not hide it behind a button. Validate fields inline and prevent duplicate submission. |
| Sign in | Sign in; forgot password; create account; any “continue next” redirect | Test wrong password, unverified email, rate limiting, session persistence, secure web cookies, native token storage, expired refresh, and safe redirect allowlist. |
| Verify email / reset password | resend/verify action; continue; back to sign in; reset link submit | Verify expiry, reuse, resend cooldown, clear status; return user to intended next route. Password changes require normal user ownership and clear confirmation. |
| Find tutors, learner | clear search; subject chips (34 categories); Filters; Post a request; profile details; Request a session; Ask for offers | Search and filter rules need a written precedence model. Filters sheet’s screen-reader controls were not represented beyond its container/handle in the observed tree. Add explicit accessible roles, selected values, close/apply/reset actions, and keyboard behavior. Avoid rendering “Approved” as a substitute for polished, useful profile content. |
| Tutor card | View full profile; Request a session with [tutor] | Profile link and request link work in source. Use a coherent tap target, no nested-button conflict, visible rate and next slot. Request must carry tutor and selected subject through auth and form. |
| Tutor board | switch filter tabs (all/direct/open); subject/level filters; open/close offer composer; amount; note; date/time; hourly/package type; session count/details; submit offer; attachment downloads | Validate the whole offer before submit; display why a request is eligible. Keep sent offers visible in “Sent” with edit/withdraw only if supported. Current client removes the request after successful send; a recoverable offer record/status is needed so tutor can confirm what was sent. Ensure date/time uses tutor timezone and is not parsed as device-local ambiguously. |
| Request form | subject search; subject chips and See all; AI description assist; title/details fields; learner-level chips; add/remove attachments; timeframe choices; budget presets/custom budget; send tutoring request; back | Core form exists and has useful file size/type limits. Add universal university/course entry, language of instruction, and learning mode/session duration. Keep any major/subject and language request possible when taxonomy records are missing. Fix custom budget validation and max, count files correctly when duplicate/over-limit selection happens, expose remove-file labels, and make AI busy/disabled state explicit. Signed-out gate is verified. |
| Request success | transient “Your request is ready” screen and delayed redirect | This is time-based, not server-state-based. Show the created request ID/status and actionable next step; retry navigation must not resubmit. If file upload fails after request creation, keep the request visible and allow retrying only the failed attachment. |
| Request detail | open/download attached material; accept offer; open offer/profile; bundle offer actions | Verify accept double-tap/idempotency and stale/withdrawn offer states. Explain the acceptance consequence before action. Current offer details should not require the learner to infer tutor identity from name/headline. Offer profile links and full offer breakdown need consistent destinations. |
| Tutor profile | share; knowledge/portfolio content; availability selection; Request a session; Book [slot] | Share uses native/web share fallback. Availability must be current and timezone-converted. The “Book” route must either reserve a specific confirmed slot or be removed in favor of one CTA. Clearly separate reviewed credentials from self-reported fields. |
| Become a tutor | subject/level/availability chips; optional course selector; weekly slot add/edit/remove; choose/remove evidence; Save and come back later; Send for review; Back to Juniper | Long application needs save/resume and field-level validation. Required transcript + degree certificate may wrongly exclude students; define student vs graduate credential paths. Explain what is private and retention. Disable mutating controls while saving; protect against repeated uploads/submission. A submitted application should be read-only except requested edits. |
| Activity / My learning | request cards; new/create request; filter tabs; session cards/open workroom; tutor complete session; find tutor/browse requests | Make learner and tutor states explicit. “Complete session” needs a confirm and a clear state transition, mutual expectations, and undo/support treatment for accidental taps. Filters must persist and empty states must offer the one relevant next action. |
| Session detail | Open session space; revision form open/cancel/submit; delivery/solution submit; 1–5 star selector; review submit; booking state actions | “Deliver solution”/“request revision” language is inconsistent with tutoring and risks academic-integrity confusion. Replace with session recap/practice plan. Gate reviews after completed sessions, explain who sees them, prevent duplicate reviews, and allow an honest no-comment rating. |
| Chat | back; open workroom; export study guide PDF; open AI chat; attach PDF/image; message input; send; retry failed send; voice recorder start/stop/cancel/send/play | Check persistence, realtime/poll fallback, duplicate messages, retry idempotency, draft retention, attachment permission and deletion, keyboard and screen-reader labels. PDF export and AI actions need clear boundaries and failure recovery; remove any route that fabricates a guide without grounded session context. Add report, block, and safety escalation. |
| Workroom | back; whiteboard toggle; resources/camera/media controls; payment receipt upload; tutor payment confirm; recap/delivery form; revision form; remove pending attachment; attach; send | This screen currently combines learning tools, payment evidence, content delivery, revisions, attachments, and chat. Separate the main tutoring workspace from optional tools. Whiteboard collaboration state, media permission handling, payment claim/confirmation semantics, and a complete RTC flow need verification. Payment confirmation cannot suggest Juniper verified funds. |
| Profile / Tutor Hub | edit profile or role; saved tutors; activity; tutor application; tutor studio; admin review; support email; sign out | Confirm each route is available only when eligible. Support mailto currently swallows open failure; surface a fallback address/copy action. “Sign out” should confirm only if unsaved work exists. Add privacy, data export/delete, notification controls, report/block. |
| Studio | Create invoice; Manage vault storefront | **Misleading controls confirmed by source and removed during this audit:** invoice routed to Activity; vault storefront routed to Profile. If these are part of the full product, implement true destinations, access control, lifecycle, and clear status before reintroducing them. |
| Groups | subject chips; class cards/open group | Hidden from tabs but route exists. No obvious create/join lifecycle found in the surface map. Keep hidden until a complete instructor create → discover → enroll → attend → cancel/refund policy exists. |
| AI Library / AI chat | lesson/topic cards; Open AI Companion; send prompt; back | Keep out of core navigation. Label generated output as unverified study help; add privacy disclosure, safe handling of uploaded material, failure and rate-limit states. Never claim tutor matching or learning outcomes are AI-guaranteed. |
| Community | discussion detail; answer input; Post answer | Defer unless moderation, abuse/report tools, academic-integrity rules, and useful seeded participation are ready. Empty communities damage credibility. |
| Bounties | browse/filter/apply/submit controls | High risk of confusing tutoring with paid answer completion. Do not expose until the offering is reframed and reviewed for integrity, payment, fraud, and moderation. |
| Admin tutor review | view docs; verify/request replacement; approve/request information/decline; close review | Restrict to explicit admin allowlist. Require a review reason, audit log, least privilege, safe private document downloads, and dual check of any high-risk access. Approval should reveal evidence level and remain separate from public-copy quality approval. |
| Shared controls/components | PageHeader back; pills/subject marks; EmptyState action; ActionButton; upload sheet; filter sheet; payment drawer; scheduler/course selector; whiteboard; voice recorder/player | Establish one interaction contract: minimum 44–48 px targets; visible keyboard focus; labels for icon-only buttons; accessibility role/state; loading, disabled, error and success; haptics never the only feedback; destructive actions confirm; all modal/sheet actions accessible and dismissible. |

### Required button-by-button release artifact

Before public launch, build a route-based interaction ledger from the actual rendered UI at mobile web, desktop web, iOS, and Android sizes. For every visible button record: screen/role/state, label, destination or mutation, preconditions, success state, loading/disabled behavior, API failure behavior, keyboard/screen-reader name, and regression case. Repeat conditional controls for signed-out, learner, tutor pending, tutor approved, admin, empty, loading, error, and stale/offline states. The table above is the audit baseline, not a claim that every conditional state has already been dynamically exercised.

## 6. Visual design and content direction

### Keep

- The cream background and deep forest identity, warm coral accent, Inter typography, generous rounded surfaces, and restrained plant/learning metaphor.
- Calm language and the sense that learners can explore before committing.
- Clear distinction between student and tutor workspace.

### Change

- Reduce repeated hero panels, stacked explanatory cards, pill overload, decorative icons, broad all-caps eyebrows, and unnecessary “success” badges. Let typography and whitespace carry hierarchy.
- Establish consistent tokens for background/card/primary/secondary/destructive colors, spacing, type scale, radii, elevation, focus ring, and motion. Check WCAG AA contrast for all text and controls in light/dark modes.
- Make the primary action visually singular on each page; secondary links should remain lower-weight. Replace tiny 10–11 px helper text with readable body sizes on high-impact flows.
- Standardize field spacing, keyboard avoidance, sticky action behavior, scrolling and bottom safe-area insets. Verify screen capture and viewport at 320 px, 375 px, 768 px, and desktop widths.
- Replace generic photography/sample portraits in production with tutor-approved headshots or intentional initials/illustration. Never display invented availability, session counts, reviews, or endorsements.
- Content voice: concrete and human, no “thoughtful support / grow with room / build confidence / next step” loops. Say what happens and what the user should do. Use “tutor” consistently, define “reviewed,” call prices “proposed,” and say “request a session” when no slot is confirmed.

## 7. Marketplace model and growth plan

### Broad supply, recruited deliberately

Build tutor acquisition for all intended launch markets in parallel with product work. Recruit by campus, discipline, language, and delivery mode. Use tutor ambassadors, department/student societies, referrals, alumni/professional networks, language-teaching communities, and direct outreach with permission. A public launch should not be announced until active tutor supply and support capacity match the coverage claims in each market.

For every tutor capture teachable subjects and subtopics, courses and aliases, institutions (including custom entries), learner levels, languages taught and languages of instruction, online/in-person mode, timezone, current availability, proposed rate, experience, teaching approach, evidence tier, and response expectations. Let tutors add a course that is missing instead of blocking them on a hand-maintained catalogue. Provide profile preview, availability pause, and clear application status.

Offer tutors a credible reason to join: high-intent learners, transparent rules, easy availability management, clear request details, and trustworthy treatment of profile evidence. Do not advertise guaranteed leads or income. Keep monetization choices explicit and consistent with the current no-commission/direct-payment model until a deliberate business decision changes it.

### Demand and validation before public release

Research learner and tutor needs across a representative set of universities, majors, school subjects, and language-learning use cases in the intended launch markets. Interview different levels and language communities; test course-code search, custom institution entry, profile trust, rate expectations, time zones, and online/in-person preferences. Use the findings to validate the complete product and fix gaps, not to reduce the catalogue to the easiest niche.

Run a **closed, representative beta of the whole product** with accounts from multiple campuses, disciplines, language needs, and device types. This beta is internal validation before Play Store release; it is not the public product scope. A human may help diagnose a failed match during testing, but record the gap and fix product or supply processes rather than silently making manual matching a permanent substitute.

For unsupported requests, support custom subject/course/institution entries and honest states such as “Request received; no matching tutor is available yet.” Capture consented demand and notify the learner only when a suitable tutor joins. Never fabricate profiles, promise response times the team cannot meet, or imply broad supply from the catalogue alone.

### Public launch readiness gate

Launch the broad product only after all major journeys work and representative closed-beta users can discover, request, compare, book, communicate, complete, and review across the supported markets and languages. Before making a coverage claim for a market/category, confirm reviewed active tutors, fresh availability, reasonable expected response capacity, translated/accessible support, and an assigned operator. The app can accept any subject or university request globally; marketing and availability labels must accurately distinguish supported supply from a request that is awaiting a tutor.

## 8. Product metrics

First establish baselines; do not invent conversion targets before volume exists. The primary metric should be **weekly completed tutoring sessions with a learner-reported useful outcome**, segmented by campus/subject and acquisition cohort. Supporting metrics:

- Discovery: search-to-profile, filter-to-result, no-result rate, request-form start and completion.
- Marketplace liquidity: percentage of eligible requests receiving at least one qualified offer, median time to first qualified offer, offer comparison rate, offer acceptance rate, and unsupported-demand rate.
- Tutor activation: application start/completion, median review time, profile completeness, availability freshness, time to first reply, tutor pause/churn.
- Session quality: accepted-to-scheduled, scheduled-to-completed, cancellations/no-shows, useful-session rating, repeat learner request, reported safety or integrity issues.
- Reliability: request/offer/chat send failure, duplicate mutation, upload failure, WebSocket reconnect, crash-free sessions, notification delivery, page performance by device class.
- Trust and operations: report response time, profile correction rate, document access audit, deletion request completion, support load per active learner.

Do not send message bodies, uploaded coursework, transcript contents, private tutor evidence, or precise availability to third-party analytics. Define event consent, purpose, retention, and access before adding analytics SDKs.

## 9. Delivery sequence and gates

### Stage 0 — Product truth and launch architecture

**Deliver:** current route map, button ledger, event/state model, trust language, student-tutor evidence policy, broad launch-market and language requirements, extensible taxonomy/catalogue plan, local-only fixture policy, support/safety ownership, and error log visibility. The two fake Studio actions are removed and share/OpenGraph claims corrected.  
**Gate:** product scope explicitly covers every major/subject and language request, institutions/courses can be added without app releases, and no public screen promises unavailable tutors, fake reviews/availability, payment protection, or unrelated button destinations.

### Stage 1 — Complete broad-coverage core

**Deliver:** redesigned home/discovery/profile/request/offer comparison/acceptance/Activity; universal subject + topic + institution/course capture with aliases/custom entry; language teaching and language-of-instruction; actual availability and timezone; clear no-result/demand-capture handling; accessible filter sheet; request success from server state; tutor application and evidence tiers that work for students and professionals.  
**Gate:** isolated accounts representing multiple universities, disciplines, languages, and roles can complete learner request → tutor offer → acceptance → chat → agree time → session recap → review, with errors/retries exercised and no false payment status.

### Stage 2 — Reliability, safety, and operational readiness

**Deliver:** report/block, cancellation/no-show paths, admin audit log and document privacy verification, idempotent actions, offline/delivery retry, notification preferences, backup/restore runbook, monitoring, app-store/native build checks, privacy and support pages, per-state accessibility audit.  
**Gate:** release checklist passes on production-like deployment, phone/web, fresh accounts, and current migrations; support owner can respond; security/privacy review has no unresolved critical issue.

### Stage 3 — Closed representative beta

Test the **complete broad product** with learners and tutors across representative universities, majors, school subjects, language needs, markets, and devices. This is prelaunch validation, not a public launch restricted to one campus. Interview both sides weekly, inspect the funnel and qualitative notes, reproduce edge cases, and fix gaps. Set numeric reliability and support gates from measured baseline; test empty-supply behavior honestly.

### Stage 4 — Broad public release and continued coverage growth

Release to the Play Store only after the public launch gate is met. Keep universal search/request intake available, while showing accurate active/limited/request-only supply. Continue recruiting and onboarding tutors so real coverage expands across universities, courses, majors, and languages. Revisit groups, business accounts, vault/storefront, invoices, AI tools, community, and bounties according to their own completeness and user value; do not let these side products displace broad, reliable tutoring coverage.

## 10. Definition of done

The app is ready for a broad public Play Store launch when:

- A learner can understand the offer, find or request a tutor, compare real profiles and offers, agree to a session, and know exactly what Juniper does and does not do.
- A tutor can understand the application decision, prove relevant expertise through an appropriate route, maintain availability, reply to a suitable request, and manage a confirmed session.
- Every major/subject and language-learning need can be searched or requested, and every university/course can be entered even when it is absent from the catalogue. Search aliases and localization have representative coverage tests.
- The launch markets have enough real, reviewed tutors to support the coverage claims made in app-store copy and discovery. Unsupported categories remain requestable and are labeled honestly; no fake supply is used to fill gaps.
- Every visible control has the action/result described in the interaction ledger and works in its applicable role/state; every failure preserves user work and offers recovery.
- Every marketplace metric is real, labeled and attributable; no fake users, reviews, rates, availability, or endorsements appear in production.
- All primary journeys pass with real isolated learner/tutor accounts on web, iOS, and Android at supported sizes, including representative universities, subjects, language needs, negative, error, slow-network, offline, and accessibility checks.
- Credentials, files, chat, user data, and session events follow least-privilege rules, retention policy, and support escalation. No critical security/privacy defects remain.
- A named operator can review tutors, respond to a report, resolve a missed session, explain direct payment, restore data, and pause a category when supply is insufficient.

## 11. Execution update — 7 November 2026

The first implementation pass has landed in the workspace:

- Added a broader subject catalogue for additional disciplines and 16 named language-learning subjects, plus a supported “Other subject” request path.
- Added tutor-entered subjects, courses, and institutions, and learner-entered subjects, courses, institutions, and language of tutoring. Matching uses those fields, so a missing catalogue record no longer blocks a request.
- Replaced the fixed university and sample course-code filters with options based on actual tutor/course data and free-text course search.
- Added student, graduate, and professional tutor application pathways. Each requires a transcript; current students provide enrollment evidence, while graduates and professionals provide a degree certificate.
- Tightened tutor-profile submission and public listing so obvious repeated-character filler and incomplete public descriptions do not appear as approved supply. Existing user records were left intact.
- Fixed tutor application save reporting so course and schedule failures surface to the tutor. Corrected custom-budget parsing/limits, attachment limits, and request success navigation.
- Removed the two non-working Studio quick actions, corrected misleading public/share claims, and renamed session output copy around learning recaps and clarifications.
- Made integration tests use a disposable uniquely named database by default and extended the marketplace flow to cover broad catalog entries and matching a custom subject, course, institution, and tutoring language.

**Validation completed:** database shared-library build, API typecheck, app typecheck, and the end-to-end integration flow all pass. The local development database has migrations through `0020_request_instruction_language.sql`. A visual web preview was inspected; the existing API preview process could not be restarted in this environment, so its screens may still show responses from the previous server build.

## 12. Remaining prelaunch gates

This implementation pass is meaningful progress, not proof that the product is ready for the Play Store. Before broad release:

1. Finish the complete screen/button ledger and accessibility audit across every student, tutor, and admin route, including native Android and iOS builds.
2. Add representative language aliases and localization, and verify matching for varied capitalization, accents, scripts, and multilingual tutor profiles.
3. Complete tutor profile editing/repair and the reviewer workflow for already-approved profiles that fail the new public quality rules; do not overwrite or discard their saved information.
4. Validate scheduling, timezone conversion, cancellations, no-shows, reports, blocking, notifications, offline recovery, and session reviews with isolated multi-role accounts.
5. Verify production deployment, backups and restore, document privacy, store privacy disclosures, support escalation, and the release checklist on production-like infrastructure.
6. Measure real reviewed tutor supply and demand by market, major, course, subject, and language. Keep unsupported areas requestable and describe supply honestly until tutors are available.

This plan is intentionally opinionated: Juniper should become a dependable, broad-coverage tutoring marketplace before public release. A wide catalogue, attractive UI, AI helper, and advanced workroom matter only when they work reliably and strengthen that promise.
