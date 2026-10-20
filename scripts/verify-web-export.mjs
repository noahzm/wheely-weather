// Smoke check for the web export: every app page in dist/ must load its JS bundle.
//
// Unit tests run in Node and never load the exported site, so an export whose pages
// render but never hydrate passes them. That shipped once: Expo Router 58 moved the
// bundle <script> tags into +html.tsx's useServerDocumentContext(), and the custom
// root didn't render them. Run after `npm run build:web`; wrangler.jsonc runs it
// before every Cloudflare deploy, and CI runs it after the export step.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLE_SCRIPT_RE = /<script\b[^>]*\bsrc="(\/_expo\/static\/js\/[^"]+\.js)"/g;

/**
 * Lists the problems with exported pages: a page with no bundle script, or one
 * that references a script file the export doesn't contain.
 *
 * @param {{ file: string, html: string }[]} pages Exported app pages (dist-relative paths).
 * @param {(src: string) => boolean} scriptExists Whether a `/_expo/...` script is in the export.
 * @returns {string[]} One message per problem; empty when the export is sound.
 */
export function findExportProblems(pages, scriptExists) {
  const problems = [];
  for (const { file, html } of pages) {
    const sources = [...html.matchAll(BUNDLE_SCRIPT_RE)].map((match) => match[1]);
    if (sources.length === 0) {
      problems.push(`${file}: no bundle <script> tags (the page would never load its JS)`);
      continue;
    }
    for (const src of sources) {
      if (!scriptExists(src)) problems.push(`${file}: references missing ${src}`);
    }
  }
  return problems;
}

/** Every .html file under `dir`, as paths relative to it. */
function listHtmlFiles(dir, prefix = '') {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) return relative === '_expo' ? [] : listHtmlFiles(dir, relative);
    return entry.name.endsWith('.html') ? [relative] : [];
  });
}

/** Checks dist/ and returns the process exit code. */
function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dist = path.join(root, 'dist');
  if (!existsSync(dist)) {
    console.error('verify-web-export: dist/ not found; run `npm run build:web` first.');
    return 1;
  }
  // Static pages copied verbatim from public/ (e.g. privacy.html) carry no app bundle.
  const pages = listHtmlFiles(dist)
    .filter((file) => !existsSync(path.join(root, 'public', file)))
    .map((file) => ({ file, html: readFileSync(path.join(dist, file), 'utf8') }));
  if (pages.length === 0) {
    console.error('verify-web-export: no exported pages found in dist/.');
    return 1;
  }
  const problems = findExportProblems(pages, (src) => existsSync(path.join(dist, src)));
  if (problems.length > 0) {
    console.error(`verify-web-export: ${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  ${problem}`);
    return 1;
  }
  console.log(`verify-web-export: ${pages.length} pages load their JS bundles.`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main();
