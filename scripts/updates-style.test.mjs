// Checks that the weekly updates in js/updates.js keep the same language:
// plain, short, for the whole company. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

// Load window.DOC_UPDATES the way the browser does
const sandbox = { window: {} };
vm.runInNewContext(read("js/updates.js"), sandbox);
const releases = JSON.parse(JSON.stringify(sandbox.window.DOC_UPDATES || []));

// Page ids from NAV, and every section card / heading id on the site
const pageIds = new Set([...read("js/site.js").matchAll(/\bid: '([a-z0-9-]+)'/g)].map((m) => m[1]));
const htmlFiles = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? htmlFiles(path.join(dir, d.name)) : d.name.endsWith(".html") ? [path.join(dir, d.name)] : []));
const anchors = new Set(["index.html", ...htmlFiles("pages")]
  .flatMap((f) => [...read(f).matchAll(/\b(?:data-file|id)="([^"]+)"/g)].map((m) => m[1])));

const words = (s) => s.trim().split(/\s+/).length;
const DEV_TERMS = /\b(liquid|schema|css|scss|javascript|js|json|html|class(?:es)? name|refactor|commit|merge|pull request|PR #|bug ?fix|snippet|metafield key|custom\.[a-z_]+|data-[a-z-]+|z-index|div|selector|endpoint|api)\b/i;
const US_SPELLING = /\b(color|colors|center|centered|favorite|favorites|organize|organized|customize[sd]?|behavior|gray)\b/i;
const items = releases.flatMap((r) => (r.items || []).map((it) => ({ ...it, date: r.date })));

test("releases are newest first, with valid dates", () => {
  assert.ok(releases.length > 0, "js/updates.js has no releases");
  for (const r of releases) assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/, `bad date ${r.date}`);
  const dates = releases.map((r) => r.date);
  assert.deepEqual(dates, [...dates].sort().reverse(), "put the newest release at the top");
});

for (const [i, it] of items.entries()) {
  const where = `${it.date} item ${i + 1} (${it.page}${it.section ? " › " + it.section : ""})`;

  test(`${where}: points to a real page and section`, () => {
    assert.ok(pageIds.has(it.page), `unknown page "${it.page}"`);
    if (it.section) assert.ok(anchors.has(it.section), `unknown section or heading "${it.section}"`);
    if (it.type) assert.ok(["new", "updated"].includes(it.type), `type must be "new" or "updated"`);
  });

  test(`${where}: text is one short statement`, () => {
    const t = it.text || "";
    assert.ok(t, "missing text");
    assert.ok(words(t) <= 12, `text has ${words(t)} words (max 12): "${t}"`);
    assert.match(t, /[.!?]$/, `text should end with a full stop: "${t}"`);
    assert.doesNotMatch(t, /^you can\b/i, `text shouldn't start with "You can" (that goes in the note): "${t}"`);
  });

  test(`${where}: note starts with "Now" and is short`, () => {
    const n = it.note || "";
    assert.ok(n, "missing note");
    assert.match(n, /^Now\b/, `note should start with "Now": "${n}"`);
    assert.ok(words(n) <= 20, `note has ${words(n)} words (max 20): "${n}"`);
    assert.match(n, /[.!?]$/, `note should end with a full stop: "${n}"`);
  });

  test(`${where}: plain language for the whole company`, () => {
    for (const s of [it.text || "", it.note || ""]) {
      assert.doesNotMatch(s, /[`<>]/, `no backticks or HTML: "${s}"`);
      assert.doesNotMatch(s, /\.(liquid|js|css|scss|json|html)\b/i, `no file names: "${s}"`);
      assert.doesNotMatch(s, DEV_TERMS, `developer term in: "${s}"`);
      assert.doesNotMatch(s, US_SPELLING, `use British spelling: "${s}"`);
      assert.doesNotMatch(s, /Ancient (and|&) Brave|\bA&B\b/, `write "Ancient + Brave": "${s}"`);
    }
  });
}
