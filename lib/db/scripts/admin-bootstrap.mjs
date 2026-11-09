import pg from 'pg';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: pnpm --filter @workspace/db admin:bootstrap -- user@example.com');
  process.exitCode = 1;
  process.exit();
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL must be set. Load the local .env file before running this command.');
  process.exitCode = 1;
  process.exit();
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  const result = await client.query(
    'UPDATE users SET is_admin = true WHERE lower(email) = $1 RETURNING id, email, first_name, is_admin',
    [email],
  );
  if (result.rows.length === 0) {
    console.error(`No user found for ${email}. Create and verify the account first.`);
    process.exitCode = 1;
  } else {
    const user = result.rows[0];
    console.log(`Success: Administrator privileges granted to ${user.email} (ID: ${user.id}).`);
    console.log('Database flag users.is_admin is now true. No server restart required.');
  }
} finally {
  await client.end().catch(() => undefined);
}
