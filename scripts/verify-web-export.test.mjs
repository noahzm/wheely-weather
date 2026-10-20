import { describe, expect, it } from 'vitest';
import { findExportProblems } from './verify-web-export.mjs';

const SCRIPT = '/_expo/static/js/web/entry-abc123.js';
const page = (file, body) => ({ file, html: `<html><head></head><body>${body}</body></html>` });

describe('findExportProblems', () => {
  it('accepts pages that load existing bundle scripts', () => {
    const pages = [
      page('index.html', `<div id="root"></div><script src="${SCRIPT}" defer></script>`),
    ];
    expect(findExportProblems(pages, () => true)).toEqual([]);
  });

  it('flags a page with no bundle script tags', () => {
    // The SDK 58 regression: server-rendered markup and only inline scripts.
    const pages = [
      page(
        'index.html',
        '<div id="root">Loading forecast…</div><script>globalThis.__EXPO_ROUTER_HYDRATE__=true;</script>',
      ),
    ];
    expect(findExportProblems(pages, () => true)).toEqual([
      'index.html: no bundle <script> tags (the page would never load its JS)',
    ]);
  });

  it('ignores scripts from other hosts when looking for the bundle', () => {
    const pages = [
      page(
        'index.html',
        '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>',
      ),
    ];
    expect(findExportProblems(pages, () => true)).toHaveLength(1);
  });

  it('flags a bundle script missing from the export', () => {
    const pages = [page('settings/index.html', `<script src="${SCRIPT}" defer></script>`)];
    expect(findExportProblems(pages, (src) => src !== SCRIPT)).toEqual([
      `settings/index.html: references missing ${SCRIPT}`,
    ]);
  });
});
