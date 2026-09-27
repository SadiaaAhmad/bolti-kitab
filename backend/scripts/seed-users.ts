import { pool } from '../src/db/pool.js';
import { hashPassword } from '../src/modules/auth/crypto.js';

async function seedUsers() {
  const passwordHash = await hashPassword('SecureP@ss123!');

  const users = [
    {
      email: 'listener@boltikitab.test',
      fullName: 'Test Listener',
      role: 'listener',
    },
    {
      email: 'bob.neufeld@librivox.test',
      fullName: 'Bob Neufeld',
      role: 'narrator',
    },
    {
      email: 'editor@boltikitab.test',
      fullName: 'Lead Editor',
      role: 'editor',
    },
    {
      email: 'admin@boltikitab.test',
      fullName: 'System Admin',
      role: 'admin',
    },
  ];

  console.log('Seeding demo users with password: SecureP@ss123!');

  for (const u of users) {
    const res = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (email) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           status = 'active'
       RETURNING id, email, role;`,
      [u.email, passwordHash, u.fullName, u.role],
    );
    console.log(`Seeded user: ${res.rows[0]?.email} (${res.rows[0]?.role})`);
  }

  await pool.end();
  console.log('Done seeding users.');
}

seedUsers().catch((err) => {
  console.error('Failed to seed users:', err);
  process.exit(1);
});
