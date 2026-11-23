// Stops a commit that would add something secret-shaped. A light guard, not a scanner:
// CI should also run gitleaks (see .github/workflows/ci.yml).
import { execSync } from 'node:child_process';

const staged = process.argv.includes('--staged');
const diff = execSync(staged ? 'git diff --cached -U0' : 'git diff HEAD -U0', {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const files = execSync(staged ? 'git diff --cached --name-only' : 'git diff HEAD --name-only', {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const problems = [];
for (const file of files) {
  if (/(^|\/)\.env(\..+)?$/.test(file) && !file.endsWith('.env.example')) {
    problems.push(`${file}: env files are never committed (only .env.example).`);
  }
}
const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\b(sk|rk)_live_[0-9a-zA-Z]{16,}\b/, 'live secret key'],
  [/\bFLWSECK-[0-9a-zA-Z-]{20,}\b/, 'Flutterwave secret key'],
  [/\bre_[0-9a-zA-Z_]{24,}\b/, 'Resend API key'],
  [/^\+.*EXPO_TOKEN\s*[=:]\s*["']?[A-Za-z0-9_-]{20,}/m, 'Expo token'],
];
for (const line of diff.split('\n')) {
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  for (const [pattern, name] of PATTERNS) {
    if (pattern.test(line)) problems.push(`possible ${name}: ${line.slice(0, 60)}…`);
  }
}
if (problems.length > 0) {
  console.error('Commit blocked, possible secret:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
