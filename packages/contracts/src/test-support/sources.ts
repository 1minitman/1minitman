// Readers for the documents and migrations the contract tests compare the code against.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoFile = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));

export const readRepoFile = (path: string) => readFileSync(repoFile(path), 'utf8');

/** The `### n.n` sections of a Markdown document, keyed by their number (for example "4.1"). */
export const markdownSections = (markdown: string): Map<string, string> => {
  const sections = new Map<string, string>();
  for (const part of markdown.split(/^### /m).slice(1)) {
    const number = /^(\d+\.\d+)/.exec(part)?.[1];
    if (number) sections.set(number, part);
  }
  return sections;
};

/** Rows of every Markdown table in `text` whose first header cell is `firstHeader`. */
export const tableRows = (text: string, firstHeader: string): string[][] => {
  const rows: string[][] = [];
  let inTable = false;
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) {
      inTable = false;
      continue;
    }
    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
    if (cells[0] === firstHeader) {
      inTable = true;
      continue;
    }
    if (!inTable || /^-+$/.test(cells[0] ?? '')) continue;
    rows.push(cells);
  }
  return rows;
};

/** Strips the backticks of a Markdown code span: "`not_found`" -> "not_found". */
export const codeSpan = (cell: string | undefined) => /^`([^`]+)`$/.exec(cell ?? '')?.[1];

/** Every migration file, in order, concatenated. */
export const readMigrations = (): string => {
  const dir = 'packages/db/migrations';
  return readdirSync(repoFile(dir))
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readRepoFile(`${dir}/${name}`))
    .join('\n');
};

/** The keys seeded into `rate_limit_policies` by the migrations. */
export const seededRateLimitPolicies = (): Set<string> => {
  const keys = new Set<string>();
  for (const [, block] of readMigrations().matchAll(
    /INSERT INTO rate_limit_policies\b[^)]*\)\s*VALUES([\s\S]*?)\);\r?\n/g,
  )) {
    for (const [, key] of (block ?? '').matchAll(/^\s*\('([^']+)'/gm)) keys.add(key ?? '');
  }
  return keys;
};
