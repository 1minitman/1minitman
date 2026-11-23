// Product terms that must never ship (admin and website specs, "banned terms" CI check):
// the retired fifth plan, its price, and the Black Badge described as a subscription.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BANNED = [/All Access/i, /\$5\.40/, /Black Badge subscription/i];
const SKIP = [
  /^docs\//,
  /^packages\/db\/migrations\//, // schema changelog comments record the retirement
  /^packages\/db\/SCHEMA_DATA_DICTIONARY\.md$/,
  /^scripts\/check-banned-terms\.mjs$/,
  /^pnpm-lock\.yaml$/,
  /\.(png|ico|webp|woff2|svg)$/,
];

const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((file) => file && !SKIP.some((pattern) => pattern.test(file)));

const hits = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, index) => {
    for (const pattern of BANNED) {
      if (pattern.test(line)) hits.push(`${file}:${index + 1}  ${pattern}`);
    }
  });
}
if (hits.length > 0) {
  console.error(`Banned terms found:\n${hits.map((hit) => `  ${hit}`).join('\n')}`);
  process.exit(1);
}
console.log(`banned-terms: ${files.length} files clean`);
