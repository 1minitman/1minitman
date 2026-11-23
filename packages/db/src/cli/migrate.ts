import { migrate, migrationStatus } from '../migrator';

// Migrations use the direct (non-pooled) URL when one is set: Neon's pooler cannot hold session locks.
const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.development first.');
  process.exit(1);
}

const command = process.argv[2] ?? 'up';
if (command === 'status') {
  for (const m of await migrationStatus(url)) {
    console.log(`${m.appliedAt ? 'applied' : 'pending'}  ${m.name}`);
  }
} else if (command === 'up') {
  await migrate(url);
} else {
  console.error(`Unknown command "${command}". Use: up | status`);
  process.exit(1);
}
