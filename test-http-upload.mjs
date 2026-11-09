import { createHmac } from 'node:crypto';
import pg from 'pg';

function encode(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

const client = new pg.Client('postgresql://juniper:juniper-local@localhost:5433/juniper');
await client.connect();

const userId = 'd8c8997f-c4e0-423a-894b-2f60ab0bc918';
const sessionRes = await client.query('SELECT id FROM auth_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
const sessionId = sessionRes.rows[0].id;
await client.end();

const secret = 'juniper-local-development-secret-change-before-deployment-2026';
const now = Math.floor(Date.now() / 1000);
const header = encode({ alg: 'HS256', typ: 'JWT' });
const payload = encode({
  sub: userId, sid: sessionId, iss: 'juniper-api', aud: 'juniper-mobile-and-web',
  iat: now, exp: now + 3600,
});
const unsigned = `${header}.${payload}`;
const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
const token = `${unsigned}.${signature}`;

console.log('Generated token for user:', userId, 'session:', sessionId);

// Now let's simulate the frontend FormData upload!
const form = new FormData();
form.append('category', 'transcript');
const dummyPdf = new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'], { type: 'application/pdf' });
form.append('file', dummyPdf, 'my_transcript.pdf');

console.log('Sending upload request to http://localhost:3001/api/marketplace/tutor-application/documents ...');

const res = await fetch('http://localhost:3001/api/marketplace/tutor-application/documents', {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'X-Juniper-Client': 'web',
    Authorization: `Bearer ${token}`,
  },
  body: form,
});

console.log('HTTP Status:', res.status, res.statusText);
const body = await res.text();
console.log('Response body:', body);
