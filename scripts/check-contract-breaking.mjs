// Fails when the API contract changes in a way that breaks existing clients, compared with a
// base branch:   node scripts/check-contract-breaking.mjs origin/develop
// Released apps keep calling old endpoints for months, so a contract may grow but not shrink.
// Checked per surface: removed paths, removed operations, removed success responses,
// removed response fields, and newly required request fields.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = process.argv[2] ?? 'origin/develop';
const METHODS = ['get', 'put', 'post', 'delete', 'patch'];

const fromGit = (file) => {
  try {
    return JSON.parse(
      execFileSync('git', ['show', `${base}:${file}`], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
  } catch {
    return null; // the document did not exist on the base branch
  }
};

const resolve = (doc, schema) => {
  if (!schema) return {};
  if (schema.$ref)
    return resolve(
      doc,
      schema.$ref
        .split('/')
        .slice(1)
        .reduce((node, key) => node?.[key], doc),
    );
  return schema;
};
const jsonSchema = (doc, holder) => resolve(doc, holder?.content?.['application/json']?.schema);

const removedFields = (oldDoc, oldSchema, newDoc, newSchema, path = '') => {
  const out = [];
  const before = resolve(oldDoc, oldSchema);
  const after = resolve(newDoc, newSchema);
  for (const [name, child] of Object.entries(before.properties ?? {})) {
    const next = after.properties?.[name];
    if (!next) out.push(`${path}${name}`);
    else out.push(...removedFields(oldDoc, child, newDoc, next, `${path}${name}.`));
  }
  return out;
};

const breaks = [];
for (const surface of ['member', 'public', 'admin']) {
  const file = `packages/contracts/openapi/${surface}.json`;
  const before = fromGit(file);
  if (!before) continue;
  const after = JSON.parse(readFileSync(`${root}/${file}`, 'utf8'));

  for (const [path, item] of Object.entries(before.paths ?? {})) {
    for (const method of METHODS.filter((m) => item[m])) {
      const label = `${surface}: ${method.toUpperCase()} ${path}`;
      const next = after.paths?.[path]?.[method];
      if (!next) {
        breaks.push(`${label} was removed`);
        continue;
      }
      for (const [status, response] of Object.entries(item[method].responses ?? {})) {
        if (!status.startsWith('2')) continue;
        if (!next.responses?.[status]) {
          breaks.push(`${label}: response ${status} was removed`);
          continue;
        }
        for (const field of removedFields(
          before,
          jsonSchema(before, response),
          after,
          jsonSchema(after, next.responses[status]),
        )) {
          breaks.push(`${label}: response field "${field}" was removed`);
        }
      }
      const oldRequired = new Set(jsonSchema(before, item[method].requestBody).required ?? []);
      for (const field of jsonSchema(after, next.requestBody).required ?? []) {
        if (!oldRequired.has(field))
          breaks.push(`${label}: request field "${field}" is newly required`);
      }
    }
  }
}

if (breaks.length > 0) {
  console.error(
    `Breaking API changes against ${base}:\n${breaks.map((b) => `  - ${b}`).join('\n')}\n\n` +
      'Add instead of changing: keep the old field or route working, or version the route.',
  );
  process.exit(1);
}
console.log(`contract: no breaking change against ${base}`);
