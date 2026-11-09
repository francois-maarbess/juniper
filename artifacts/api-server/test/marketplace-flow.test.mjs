import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const apiDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(apiDirectory, '../..');
const { Client } = pg;
let serverProcess;
let databaseClient;
let apiOrigin;
let serverLog = '';
let serverStartupError;
let ownedTestDatabase;
let testAdminUrl;
const storageDirectory = path.join(repositoryRoot, '.local', 'juniper-integration-attachments');

function connectionSettings() {
  const source = process.env.JUNIPER_TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!source) throw new Error('Set DATABASE_URL or JUNIPER_TEST_DATABASE_URL in .env to run the local integration flow.');
  const base = new URL(source);
  if (!['localhost', '127.0.0.1', '::1'].includes(base.hostname)) {
    throw new Error('Integration tests are restricted to localhost PostgreSQL.');
  }
  const databaseName = decodeURIComponent(base.pathname.replace(/^\//, ''));
  const testName = process.env.JUNIPER_TEST_DATABASE_URL
    ? databaseName
    : `${databaseName}_test_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  if (!process.env.JUNIPER_TEST_DATABASE_URL && !/^[a-z0-9_]+_test_[a-f0-9]{8}$/i.test(testName)) {
    throw new Error('The generated integration test database name is invalid.');
  }
  const testUrl = new URL(base);
  testUrl.pathname = `/${testName}`;
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  return {
    testName,
    testUrl: testUrl.toString(),
    adminUrl: adminUrl.toString(),
    disposable: !process.env.JUNIPER_TEST_DATABASE_URL,
  };
}

async function reservePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => probe.once('error', reject).listen(0, '127.0.0.1', resolve));
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a local API port.');
  const port = address.port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function prepareTestDatabase() {
  const { testName, testUrl, adminUrl, disposable } = connectionSettings();
  testAdminUrl = adminUrl;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [testName]);
    if (!existing.rowCount) {
      await admin.query(`CREATE DATABASE "${testName}"`);
      if (disposable) ownedTestDatabase = testName;
    }
  } finally {
    await admin.end();
  }
  const environment = { ...process.env, DATABASE_URL: testUrl, NODE_ENV: 'test' };
  const migration = spawn(process.execPath, [path.resolve(repositoryRoot, 'lib/db/scripts/migrate.mjs')], {
    cwd: repositoryRoot, env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  migration.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  migration.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  const migrationExit = await new Promise((resolve, reject) => {
    migration.once('error', reject);
    migration.once('exit', resolve);
  });
  assert.equal(migrationExit, 0, `Test database migration failed:\n${output}`);
  databaseClient = new Client({ connectionString: testUrl });
  await databaseClient.connect();
  await databaseClient.query('DELETE FROM rate_limit_buckets');
  return testUrl;
}

async function waitUntilReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (serverStartupError) throw new Error(`API process could not start: ${serverStartupError.message}\n${serverLog}`);
    if (serverProcess.exitCode !== null) throw new Error(`API exited during startup:\n${serverLog}`);
    try {
      const response = await fetch(`${apiOrigin}/api/readyz`);
      if (response.ok) return;
    } catch { /* Wait for the API listener to become available. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`API did not become ready:\n${serverLog}`);
}

function api(pathname, { token, method = 'GET', body, headers = {}, ...options } = {}) {
  return fetch(`${apiOrigin}/api${pathname}`, {
    ...options,
    method,
    headers: {
      ...(body instanceof FormData ? {} : body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
}

async function json(response) {
  return response.json();
}

async function expectStatus(response, expected) {
  if (response.status !== expected) assert.equal(response.status, expected, `${await response.text()}\n${serverLog}`);
}

test('accounts can complete a real learner-to-tutor workroom flow', async () => {
  const testDatabaseUrl = await prepareTestDatabase();
  await mkdir(storageDirectory, { recursive: true });
  const port = await reservePort();
  apiOrigin = `http://127.0.0.1:${port}`;
  const environment = {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    JWT_SECRET: `juniper-local-integration-${randomUUID()}-${randomUUID()}`,
    NODE_ENV: 'test',
    PORT: String(port),
    APP_ORIGIN: apiOrigin,
    APP_PUBLIC_URL: apiOrigin,
    RESEND_API_KEY: '',
    EMAIL_FROM: '',
    SENTRY_DSN: '',
    TUTOR_DOCUMENT_STORAGE: 'local',
    TUTOR_DOCUMENTS_DIR: storageDirectory,
  };
  serverProcess = spawn(process.execPath, ['--enable-source-maps', path.join(apiDirectory, 'dist/index.mjs')], {
    cwd: apiDirectory, env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  serverProcess.stdout.setEncoding('utf8').on('data', (chunk) => { serverLog = `${serverLog}${chunk}`.slice(-12_000); });
  serverProcess.stderr.setEncoding('utf8').on('data', (chunk) => { serverLog = `${serverLog}${chunk}`.slice(-12_000); });
  serverProcess.once('error', (error) => { serverStartupError = error; });
  try {
  await waitUntilReady();

  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const learnerEmail = `juniper-learner-${suffix}@example.invalid`;
  const tutorEmail = `juniper-tutor-${suffix}@example.invalid`;
  const outsiderEmail = `juniper-outsider-${suffix}@example.invalid`;
  const password = 'IntegrationOnly-Local-Password-2026';
  const signup = async (email, role) => api('/auth/sign-up', {
    method: 'POST', body: { email, password, firstName: 'Juniper', lastName: 'Flow', role },
  });

    const ready = await api('/readyz');
    await expectStatus(ready, 200);
    assert.equal((await json(ready)).database, 'available');

    const learnerSignUp = await signup(learnerEmail, 'student');
    await expectStatus(learnerSignUp, 202);
    await expectStatus(await signup(learnerEmail, 'student'), 409);
    const tutorSignUp = await signup(tutorEmail, 'tutor');
    await expectStatus(tutorSignUp, 202);
    const outsiderSignUp = await signup(outsiderEmail, 'student');
    await expectStatus(outsiderSignUp, 202);

    await databaseClient.query('UPDATE users SET email_verified_at = now() WHERE email = ANY($1::text[])', [[learnerEmail, tutorEmail, outsiderEmail]]);
    const badPassword = await api('/auth/sign-in', { method: 'POST', body: { email: learnerEmail, password: 'incorrect-password' } });
    await expectStatus(badPassword, 401);

    const login = async (email) => {
      const response = await api('/auth/sign-in', { method: 'POST', body: { email, password } });
      await expectStatus(response, 200);
      return json(response);
    };
    const [learner, tutor, outsider] = await Promise.all([login(learnerEmail), login(tutorEmail), login(outsiderEmail)]);

    const subjectResponse = await api('/marketplace/subjects', { token: learner.accessToken });
    await expectStatus(subjectResponse, 200);
    const availableSubjects = await json(subjectResponse);
    const subject = availableSubjects.find((item) => item.name === 'Mathematics');
    assert.ok(subject, 'the seeded subject catalog should include Mathematics');
    const otherSubject = availableSubjects.find((item) => item.name === 'Other subject');
    const broadSubjects = availableSubjects.map((item) => item.name);
    assert.ok(broadSubjects.includes('Spanish') && broadSubjects.includes('Public health'), 'the broad subject catalog should include languages and additional study fields');
    assert.ok(otherSubject, 'learners should be able to request a subject that is not in the catalog');

    const tutorProfileResponse = await api('/marketplace/tutor-profile', {
      method: 'POST', token: tutor.accessToken,
      body: {
        displayName: 'Juniper Flow Tutor', headline: 'Maths, one clear step at a time',
        biography: 'Guided practice, clear examples, and supportive lessons.',
        educationSummary: 'Mathematics tutor with university-level study and teaching experience.',
        hourlyRateCents: 3200, subjectIds: [subject.id], availability: ['Weekday mornings'],
        timezone: 'UTC', levels: ['University'],
      },
    });
    await expectStatus(tutorProfileResponse, 201);
    await databaseClient.query("UPDATE tutor_profiles SET approval = 'approved' WHERE display_name = $1", ['Juniper Flow Tutor']);
    await databaseClient.query("UPDATE tutor_profiles SET custom_subjects = ARRAY['Marine navigation'], custom_courses = ARRAY['NAV 601'], custom_universities = ARRAY['Oceanic U'] WHERE display_name = $1", ['Juniper Flow Tutor']);
    await databaseClient.query("UPDATE tutor_applications SET languages = ARRAY['French', 'English'] WHERE user_id = (SELECT user_id FROM tutor_profiles WHERE display_name = $1)", ['Juniper Flow Tutor']);

    const tutorsResponse = await api('/marketplace/tutors?subject=Mathematics&level=University');
    await expectStatus(tutorsResponse, 200);
    assert.ok((await json(tutorsResponse)).some((item) => item.displayName === 'Juniper Flow Tutor'), 'subject and level filters should include the matching approved tutor');

    const requestResponse = await api('/marketplace/requests', {
      method: 'POST', token: learner.accessToken,
      body: {
        subjectId: subject.id, title: 'Understand integration by parts',
        details: 'I want to understand the method and practise a few examples before my exam.',
        level: 'University', deadline: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
        budgetCents: 4500, timezone: 'UTC', preferredTimes: ['Weekday mornings'], sessionDurationMinutes: 60,
        serviceType: 'exam_prep',
      },
    });
    await expectStatus(requestResponse, 201);
    const studyRequest = await json(requestResponse);
    const boardResponse = await api('/marketplace/requests/board', { token: tutor.accessToken });
    await expectStatus(boardResponse, 200);
    assert.ok((await json(boardResponse)).some((item) => item.id === studyRequest.id), 'matching subject, level, time window, and timezone should show the request');

    const customRequestResponse = await api('/marketplace/requests', {
      method: 'POST', token: learner.accessToken,
      body: {
        subjectId: otherSubject.id, customSubject: 'Marine navigation', customCourse: 'NAV 601', university: 'Oceanic U', instructionLanguage: 'French',
        title: 'Plan a coastal navigation route', details: 'I need help understanding coastal charts and route planning.',
        level: 'University', deadline: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
        budgetCents: 4500, timezone: 'UTC', preferredTimes: ['Weekday mornings'], sessionDurationMinutes: 60,
      },
    });
    await expectStatus(customRequestResponse, 201);
    const customRequest = await json(customRequestResponse);
    const customBoardResponse = await api('/marketplace/requests/board', { token: tutor.accessToken });
    await expectStatus(customBoardResponse, 200);
    assert.ok((await json(customBoardResponse)).some((item) => item.id === customRequest.id && item.customSubject === 'Marine navigation' && item.instructionLanguage === 'French'), 'tutors should match custom subjects, courses, institutions, and language entered by learners');
    const customOfferResponse = await api(`/marketplace/requests/${customRequest.id}/offers`, {
      method: 'POST', token: tutor.accessToken,
      body: { amountCents: 3800, note: 'We can work through chart reading and route planning together.', turnaroundHours: 24, includesWalkthrough: true },
    });
    await expectStatus(customOfferResponse, 201);

    const offerResponse = await api(`/marketplace/requests/${studyRequest.id}/offers`, {
      method: 'POST', token: tutor.accessToken,
      body: { amountCents: 3800, note: 'We can work through examples together and build your confidence.', turnaroundHours: 24, includesWalkthrough: true },
    });
    await expectStatus(offerResponse, 201);
    const offer = await json(offerResponse);
    const offerList = await api(`/marketplace/requests/${studyRequest.id}/offers`, { token: learner.accessToken });
    await expectStatus(offerList, 200);
    assert.ok((await json(offerList)).some((item) => item.id === offer.id));

    const offerThreadPath = `/marketplace/requests/${studyRequest.id}/offers/${offer.id}/messages`;
    const learnerOfferMessage = await api(offerThreadPath, {
      method: 'POST', token: learner.accessToken, body: { text: 'Could you explain what we would cover in the session?' },
    });
    await expectStatus(learnerOfferMessage, 201);
    const learnerOfferMessageBody = await json(learnerOfferMessage);
    const tutorOfferThread = await api(offerThreadPath, { token: tutor.accessToken });
    await expectStatus(tutorOfferThread, 200);
    assert.ok((await json(tutorOfferThread)).some((item) => item.id === learnerOfferMessageBody.id), 'the tutor should see the learner’s pre-acceptance question');
    const tutorOfferMessage = await api(offerThreadPath, {
      method: 'POST', token: tutor.accessToken, body: { text: 'We will work through the method and practise two examples.' },
    });
    await expectStatus(tutorOfferMessage, 201);
    const outsiderOfferThread = await api(offerThreadPath, { token: outsider.accessToken });
    await expectStatus(outsiderOfferThread, 404);

    const acceptedResponse = await api(`/marketplace/offers/${offer.id}/accept`, { method: 'POST', token: learner.accessToken, body: {} });
    await expectStatus(acceptedResponse, 201);
    const booking = await json(acceptedResponse);
    assert.ok(booking.id);
    assert.equal(booking.escrowStatus, undefined, 'the API must not expose a preview settlement state');
    const bookingList = await api('/marketplace/bookings', { token: learner.accessToken });
    assert.ok((await json(bookingList)).some((item) => item.id === booking.id));

    const messageResponse = await api(`/marketplace/bookings/${booking.id}/messages`, {
      method: 'POST', token: learner.accessToken, body: { text: 'Could we start with one worked example?' },
    });
    await expectStatus(messageResponse, 201);
    const sentMessage = await json(messageResponse);
    const tutorMessages = await api(`/marketplace/bookings/${booking.id}/messages`, { token: tutor.accessToken });
    await expectStatus(tutorMessages, 200);
    assert.ok((await json(tutorMessages)).some((item) => item.id === sentMessage.id && item.text === 'Could we start with one worked example?'));
    const learnerMessages = await api(`/marketplace/bookings/${booking.id}/messages`, { token: learner.accessToken });
    assert.ok((await json(learnerMessages)).find((item) => item.id === sentMessage.id)?.readAt, 'opening the conversation should mark the other participant message as read');

    const form = new FormData();
    form.append('file', new File([Buffer.from('%PDF-1.4\nJuniper integration attachment')], 'lesson.pdf', { type: 'application/pdf' }));
    const attachmentResponse = await api(`/marketplace/bookings/${booking.id}/messages/attachments`, { method: 'POST', token: learner.accessToken, body: form });
    await expectStatus(attachmentResponse, 201);
    const attachment = await json(attachmentResponse);
    const attachedMessageResponse = await api(`/marketplace/bookings/${booking.id}/messages`, {
      method: 'POST', token: learner.accessToken, body: { text: '', attachmentIds: [attachment.id] },
    });
    await expectStatus(attachedMessageResponse, 201);
    const download = await api(`/marketplace/bookings/${booking.id}/messages/attachments/${attachment.id}`, { token: tutor.accessToken });
    await expectStatus(download, 200);
    assert.ok(Buffer.from(await download.arrayBuffer()).toString('utf8').startsWith('%PDF-'));

    const forbidden = await api(`/marketplace/bookings/${booking.id}/messages`, { token: outsider.accessToken });
    await expectStatus(forbidden, 404);
    const forbiddenAttachment = await api(`/marketplace/bookings/${booking.id}/messages/attachments/${attachment.id}`, { token: outsider.accessToken });
    await expectStatus(forbiddenAttachment, 404);
    const withoutSession = await api('/marketplace/bookings');
    await expectStatus(withoutSession, 401);
  } finally {
    if (databaseClient) await databaseClient.end().catch(() => undefined);
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill();
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 3_000);
        serverProcess.once('exit', () => { clearTimeout(timer); resolve(); });
      });
    }
    await rm(storageDirectory, { recursive: true, force: true });
  }
});

after(async () => {
  if (databaseClient) await databaseClient.end().catch(() => undefined);
  if (ownedTestDatabase && testAdminUrl) {
    const admin = new Client({ connectionString: testAdminUrl });
    await admin.connect();
    try {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [ownedTestDatabase]);
      await admin.query(`DROP DATABASE IF EXISTS "${ownedTestDatabase}"`);
    } finally {
      await admin.end().catch(() => undefined);
    }
  }
});
