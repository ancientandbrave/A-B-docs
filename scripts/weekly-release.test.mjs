// Tests for weekly-release.mjs with mocked GitHub and Notion.
// Run: node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { run, groupCommits, decideStatus, findTodos, releaseTag, isReleaseTag, assignDates, themeChange } from "./weekly-release.mjs";

const NOW = new Date("2026-11-05T12:00:00Z");
const STATUSES = {
  complete: "Complete",
  completeFrom: ["Testing", "On staging", "For review"],
  neverChange: ["Backlog", "To do", "In progress", "On hold"],
};
const CONFIG = {
  ticketPrefix: "AB",
  windowDays: 14,
  bootstrapDays: 14,
  timeZone: "UTC",
  ignoreCommits: { authors: ["shopify[bot]"], subjectStartsWith: ["Update from Shopify for theme"] },
  devRepo: "ab/dev",
  regions: [
    { id: "uk", label: "UK", repo: "ab/uk", branch: "live", notionName: "UK" },
    { id: "eu", label: "EU", repo: "ab/eu", branch: "live", notionName: "EU" },
    { id: "us", label: "US", repo: "ab/us", branch: "live", notionName: "US" },
  ],
  notion: {
    linkTickets: true,
    properties: { id: "ID", region: "Region", releasedIn: "Released in", status: "Status", releaseNote: "Release note" },
    statuses: STATUSES,
  },
  docs: {
    siteUrl: "https://docs.example.com",
    releasesPage: "pages/releases/website.html",
    dataFile: "js/releases-data.js",
    releasesData: "data/releases.json",
    archivePages: "pages/releases/archive",
    navFile: "js/releases-nav.js",
    stateFile: "data/release-state.json",
  },
};
const ENV = { RELEASE_REPOS_TOKEN: "gh", NOTION_TOKEN: "nt", NOTION_DATABASE_ID: "db" };

const sha = (n) => n.toString(16).padStart(40, "0");
const commit = (n, subject, parents = 1, { author = "Dev", date = "2026-11-04T16:30:00Z" } = {}) => ({
  sha: sha(n),
  commit: { message: `${subject}\n\nbody`, author: { name: author }, committer: { date } },
  // parents: a count, or the numbers of the parent commits (needed for the merge fallback)
  parents: Array.isArray(parents) ? parents.map((p) => ({ sha: sha(p) })) : Array.from({ length: parents }, () => ({})),
});
const shopifySave = (n, date) => commit(n, "Update from Shopify for theme uk/main by Jane", 1, { author: "shopify[bot]", date });

// ---- Fake GitHub + Notion ------------------------------------------------
// compare[repo]: a list for any range, or { "<base>...<head>": list } per range
// activity[repo]: events for the live branch, any order (the API gives newest first)
function world({ heads = {}, compare = {}, since = {}, tickets = {}, prs = {}, activity = {}, notionDb = "ok", noReleasedIn = false, noComments = false, files = {} } = {}) {
  const calls = [];
  const comments = {}; // page id -> [text]
  const reply = (body, status = 200, headers = {}) => ({
    ok: status < 400, status,
    headers: { get: (h) => headers[h.toLowerCase()] ?? null },
    json: async () => body, text: async () => JSON.stringify(body),
  });
  const notionPage = (num) => {
    const t = tickets[num];
    const opts = (names) => names.map((name) => ({ name }));
    return {
      id: `page-${num}`, url: `https://notion.so/page-${num}`,
      properties: {
        Name: { type: "title", title: [{ plain_text: t.title }] },
        Status: { type: "status", status: t.status ? { name: t.status } : null },
        Region: { type: "multi_select", multi_select: opts(t.regions || []) },
        ...(noReleasedIn ? {} : { "Released in": { type: "multi_select", multi_select: opts(t.releasedIn || []) } }),
        "Release note": { type: "rich_text", rich_text: t.releaseNote ? [{ plain_text: t.releaseNote }] : [] },
      },
    };
  };
  const extra = []; // queued responses (e.g. 429) for the next matching call

  async function fetch(url, opts = {}) {
    const method = opts.method || "GET";
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ method, url, body });
    const u = new URL(url);
    const queued = extra.findIndex((x) => u.pathname.includes(x.match));
    if (queued >= 0) return extra.splice(queued, 1)[0].res;

    if (u.host === "api.github.com") {
      let m;
      if ((m = u.pathname.match(/^\/repos\/(.+)\/branches\/(.+)$/))) {
        const h = heads[m[1]];
        return reply({ commit: { sha: h.sha, commit: { committer: { date: h.date } } } });
      }
      if ((m = u.pathname.match(/^\/repos\/(.+)\/compare\/(.+)\.\.\.(.+)$/))) {
        const spec = compare[m[1]];
        const all = Array.isArray(spec) ? spec : spec?.[`${m[2]}...${m[3]}`];
        if (!all) return reply({ message: "Not Found" }, 404);
        const page = Number(u.searchParams.get("page")), per = Number(u.searchParams.get("per_page"));
        return reply({ total_commits: all.length, commits: all.slice((page - 1) * per, page * per) });
      }
      if ((m = u.pathname.match(/^\/repos\/(.+)\/commits\/([0-9a-f]{40})$/))) {
        const list = files[m[2]] || [];
        return reply({ files: (Array.isArray(list) ? list.map((filename) => [filename, "+ changed line"]) : Object.entries(list)).map(([filename, patch]) => ({ filename, patch })) });
      }
      if ((m = u.pathname.match(/^\/repos\/(.+)\/activity$/))) {
        return reply([...(activity[m[1]] || [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
      }
      if ((m = u.pathname.match(/^\/repos\/(.+)\/commits$/))) {
        const all = since[m[1]] || [];
        const page = Number(u.searchParams.get("page")), per = Number(u.searchParams.get("per_page"));
        return reply(all.slice((page - 1) * per, page * per));
      }
      if (u.pathname === "/search/issues") {
        const id = u.searchParams.get("q").match(/"(.+?)"/)[1];
        return reply({ items: (prs[id] || []).map((n) => ({ number: n, title: `${id} thing`, html_url: `https://github.com/ab/dev/pull/${n}` })) });
      }
    }
    if (u.host === "api.notion.com") {
      let m;
      if (u.pathname.endsWith("/query")) {
        if (!body.filter) return notionDb === "ok" ? reply({ results: [] }) : reply({ object: "error", message: notionDb }, 400); // start-of-run check
        const num = body.filter.unique_id.equals;
        return reply({ results: tickets[num] ? [notionPage(num)] : [] });
      }
      if (method === "PATCH" && (m = u.pathname.match(/pages\/page-(\d+)$/))) {
        const t = tickets[m[1]];
        const p = body.properties;
        if (p["Released in"]) t.releasedIn = p["Released in"].multi_select.map((o) => o.name);
        if (p.Status) t.status = p.Status.status.name;
        return reply({});
      }
      if (u.pathname.endsWith("/comments") && noComments) return reply({ object: "error", status: 403, code: "restricted_resource", message: "Insufficient permissions for this endpoint." }, 403);
      if (u.pathname.endsWith("/comments") && method === "GET") {
        const id = u.searchParams.get("block_id");
        return reply({ results: (comments[id] || []).map((c) => ({ rich_text: [{ plain_text: c }] })), has_more: false });
      }
      if (u.pathname.endsWith("/comments") && method === "POST") {
        const id = body.parent.page_id;
        (comments[id] ||= []).push(body.rich_text.map((r) => r.text.content).join(""));
        return reply({});
      }
    }
    throw new Error(`Unmocked ${method} ${url}`);
  }
  return { fetch, calls, comments, tickets, queue: (match, res) => extra.push({ match, res }), reply };
}

function repo(state) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-test-"));
  fs.writeFileSync(path.join(root, "release.config.json"), JSON.stringify(CONFIG));
  if (state) {
    fs.mkdirSync(path.join(root, "data"), { recursive: true });
    fs.writeFileSync(path.join(root, "data/release-state.json"), JSON.stringify(state));
  }
  return root;
}
const quiet = { log() {}, warn() {}, error() {} };
// Calls other than the start-of-run Notion database check
const isDbCheck = (c) => c.url.endsWith("/query") && !c.body?.filter;
const workCalls = (w) => w.calls.filter((c) => !isDbCheck(c));
const go = (root, w, env = ENV, now = NOW) => run({ root, env, fetch: w.fetch, sleep: async () => {}, now, log: quiet });
const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");
const loadJs = (root, rel) => { const window = {}; new Function("window", read(root, rel))(window); return window; };
const pageTickets = (root) => loadJs(root, "js/releases-data.js").DOC_RELEASES.tickets; // what the page shows
const store = (root) => JSON.parse(read(root, "data/releases.json"));
const sameHeads = (state) => Object.fromEntries(Object.entries(state.regions).map(([id, r]) => [`ab/${id}`, { sha: r.sha, date: "2026-11-01T10:00:00Z" }]));
const STATE = { regions: { uk: { sha: sha(1), date: "2026-10-28" }, eu: { sha: sha(2), date: "2026-10-28" }, us: { sha: sha(3), date: "2026-10-28" } } };
const { render, weekStart, weekLabel } = createRequire(import.meta.url)("../js/releases.js");
const REGIONS = CONFIG.regions.map((r) => ({ id: r.id, label: r.label }));

// ---- Pure helpers ---------------------------------------------------------
test("one commit can reference several tickets; merge commits are skipped", () => {
  const { tickets, other, total } = groupCommits([
    { sha: sha(1), subject: "AB-12 AB-7 shared fix (#40)", merge: false },
    { sha: sha(2), subject: "ab-12 follow-up", merge: false },
    { sha: sha(3), subject: "Merge branch 'main' into live AB-12", merge: true },
  ], "AB");
  assert.equal(total, 2);
  assert.deepEqual(tickets.map((t) => [t.id, t.commits, [...t.prs]]), [["AB-7", 1, [40]], ["AB-12", 2, [40]]]);
  assert.equal(other.commits, 0);
});

test("a commit without a ticket is counted, with its title kept for the job summary", () => {
  const { tickets, other } = groupCommits([
    { sha: sha(1), subject: "Tidy CSS (#41)", merge: false },
    { sha: sha(2), subject: "Fix typo", merge: false },
    { sha: sha(3), subject: "ABC-12 is not AB-12x", merge: false },
  ], "AB");
  assert.equal(tickets.length, 0);
  assert.equal(other.commits, 3);
  assert.deepEqual(other.subjects, ["Tidy CSS (#41)", "Fix typo", "ABC-12 is not AB-12x"]);
});

test('"#9769 - title" commits are tickets, named after their first commit', () => {
  const { tickets, other } = groupCommits([
    { sha: sha(1), subject: "#9749 - PLP promo banner | blocks into snippet", merge: false },
    { sha: sha(2), subject: "#9749 - gap amend", merge: false },
    { sha: sha(3), subject: "#9769 - mobile gap", merge: false },
    { sha: sha(4), subject: "AB-12 header (#94)", merge: false },
    { sha: sha(5), subject: "fix plp stars (#94)", merge: false }, // a PR number, not a ticket
  ], "AB");
  assert.deepEqual(tickets.map((t) => [t.id, t.commits, t.commitTitle]), [
    ["AB-12", 1, "header (#94)"],
    ["AB-9749", 2, "PLP promo banner"],
    ["AB-9769", 1, "mobile gap"],
  ]);
  assert.equal(other.commits, 1);
});

test("status safety rules", () => {
  const d = (status, regions, releasedIn) => decideStatus({ status, regions, releasedIn }, STATUSES);
  for (const s of ["Testing", "On staging", "For review"]) assert.equal(d(s, [], ["UK"]).complete, true, s);
  assert.equal(d("Testing", ["UK", "EU"], ["UK"]).complete, false);
  assert.deepEqual(d("Testing", ["UK", "EU"], ["UK"]).waitingFor, ["EU"]);
  assert.equal(d("For review", ["UK", "EU"], ["EU", "UK"]).complete, true);
  for (const s of ["Backlog", "To do", "In progress", "On hold"]) {
    const r = d(s, [], ["UK", "EU", "US"]);
    assert.equal(r.complete, false, s);
    assert.match(r.attention, /not changed/);
  }
  assert.deepEqual(d("Complete", [], ["UK"]), { complete: false, attention: null, waitingFor: [] });
  assert.match(d("", [], ["UK"]).attention, /empty/);
});

test('Notion tags read "UK live 5 Nov 2026" and still count the region as released', () => {
  const cfg = { notion: { releasedInLabel: "{region} live {date}" } };
  const uk = { notionName: "UK" };
  assert.equal(releaseTag(cfg, uk, "2026-11-05"), "UK live 5 Nov 2026");
  assert.ok(isReleaseTag(cfg, uk, "UK live 28 Oct 2026"));
  assert.ok(!isReleaseTag(cfg, uk, "US live 5 Nov 2026"));
  assert.equal(releaseTag({ notion: {} }, uk, "2026-11-05"), "UK"); // no template: region name only
});

test("TODO values in the config are found", () => {
  assert.deepEqual(findTodos({ $comment: "TODO ok", a: "TODO x", b: [{ c: "fine" }, { d: "TODO" }] }), ["a", "b[1].d"]);
});

// ---- Weekly tables (js/releases.js) --------------------------------------
test("weeks run Monday to Sunday", () => {
  assert.equal(weekStart("2026-11-05"), "2026-11-02"); // Thursday
  assert.equal(weekStart("2026-11-08"), "2026-11-02"); // Sunday
  assert.equal(weekStart("2026-11-09"), "2026-11-09"); // Monday
  assert.equal(weekLabel("2026-11-02"), "2–8 November 2026");
  assert.equal(weekLabel("2026-10-26"), "26 October – 1 November 2026");
  assert.equal(weekLabel("2025-12-29"), "29 December 2025 – 4 January 2026");
});

test("table: one row per ticket in its first-release week, region cells, merged rows", () => {
  const html = render([
    { id: "AB-1", text: "New header", url: "https://notion.so/1", firstRelease: "2026-11-05", releases: { uk: "2026-11-05", us: "2026-11-10" }, expected: ["uk", "us"] },
    { id: "AB-2", text: "Footer links", firstRelease: "2026-11-05", releases: { uk: "2026-11-05" }, expected: ["uk", "us"] },
    { id: "AB-3", text: "Quiz", firstRelease: "2026-11-05", releases: { uk: "2026-11-05" }, expected: null },
    { id: "AB-4", text: "PLP promo banner", firstRelease: "2026-11-05", releases: { eu: "2026-11-05" }, expected: ["eu"] },
    { id: "AB-5", text: "PLP promo banner", firstRelease: "2026-11-06", releases: { eu: "2026-11-06" }, expected: ["eu"] },
    { id: "AB-6", text: "Older", firstRelease: "2026-10-28", releases: { uk: "2026-10-28" }, expected: ["uk"] },
  ], REGIONS, "None.");
  const rows = [...html.matchAll(/<tr>(<td>[\s\S]*?)<\/tr>/g)]
    .map((m) => [...m[1].matchAll(/<td>(.*?)<\/td>/g)].map((c) => c[1].replace(/<span class="muted">|<\/span>/g, "")).join(" | "));
  assert.deepEqual(rows, [
    '<a href="https://notion.so/1">New header</a> | ✓ 5 Nov | — | ✓ 10 Nov | AB-1', // What changed links to Notion; US shipped the week after: cell updated, row stays put
    "Footer links | ✓ 5 Nov | — | Not yet | AB-2",
    "Quiz | ✓ 5 Nov | Not yet | Not yet | AB-3", // no Region label: every region expected
    "PLP promo banner | — | ✓ 6 Nov | — | AB-4, AB-5", // same text: one row
    "Older | ✓ 28 Oct | — | — | AB-6",
  ]);
  assert.ok(html.indexOf("2–8 November 2026") < html.indexOf("26 October – 1 November 2026"), "newest week first");
  assert.match(html, /<th>What changed<\/th><th>UK<\/th><th>EU<\/th><th>US<\/th><th>Ticket<\/th>/);
  assert.equal(render([], REGIONS, "No releases."), '<p class="muted">No releases.</p>');
});

// ---- Full runs -----------------------------------------------------------
test("no new release: nothing is written and Notion is not called", async () => {
  const root = repo(STATE);
  await go(root, world({ heads: sameHeads(STATE) })); // writes the empty files once
  const w = world({ heads: sameHeads(STATE) });
  const res = await go(root, w);
  assert.equal(res.changed, false);
  assert.ok(workCalls(w).every((c) => c.url.includes("/branches/")));
  assert.deepEqual(JSON.parse(read(root, "data/release-state.json")), { regions: STATE.regions });
  assert.match(res.summary, /No new release/);
});

test("new release: one row per ticket, Notion tagged, commented and completed safely", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T16:30:00Z" } },
    compare: { "ab/uk": [
      commit(10, "AB-1 AB-2 header tweaks (#50)"),
      commit(11, "AB-1 fix"),
      commit(12, "Bump deps"),
      commit(13, "Merge branch 'main' into live", 2),
      commit(14, "AB-3 start"),
      commit(15, "AB-4 test"),
      commit(16, "AB-99 not in Notion"),
    ] },
    prs: { "AB-1": [50] },
    tickets: {
      1: { title: "New header", status: "Testing", regions: [], releaseNote: "The header has a new menu." },
      2: { title: "Footer links", status: "On staging", regions: ["UK", "EU"] },
      3: { title: "Quiz", status: "In progress", regions: [] },
      4: { title: "Done already", status: "Complete", regions: [], releasedIn: ["EU"] },
    },
  });
  const res = await go(root, w);
  assert.equal(res.changed, true);
  assert.equal(res.message, "Website releases: UK 2026-11-04");

  // Page data: Release note first, then the Notion title, then the commit title
  assert.deepEqual(pageTickets(root).map((t) => [t.id, t.text, t.releases, t.expected]), [
    ["AB-1", "The header has a new menu.", { uk: "2026-11-04" }, null],
    ["AB-2", "Footer links", { uk: "2026-11-04" }, ["uk", "eu"]],
    ["AB-3", "Quiz", { uk: "2026-11-04" }, null],
    ["AB-4", "Done already", { uk: "2026-11-04" }, null],
    ["AB-99", "not in Notion", { uk: "2026-11-04" }, null],
  ]);
  assert.equal(pageTickets(root)[0].url, "https://notion.so/page-1");
  // Stored with per-region dates and PRs; the release keeps its commit counts
  const s = store(root);
  // No push history in this mock, so the date falls back to the newest commit on the live branch
  assert.deepEqual(s.tickets["AB-1"].releases, { uk: { date: "2026-11-04", sha: sha(100), dateFrom: "head" } });
  assert.match(res.summary, /UK: 6 commits weren't found in any push or merge/);
  assert.deepEqual(s.tickets["AB-2"].prs.map((p) => p.number), [50]); // from "(#50)"
  assert.deepEqual(s.releases.map((r) => [r.region, r.date, r.commits, r.commitsWithoutTicket]), [["uk", "2026-11-04", 6, 1]]);

  // Notion
  assert.equal(w.tickets[1].status, "Complete"); // Testing, no Region label
  assert.equal(w.tickets[2].status, "On staging"); // waiting for EU
  assert.equal(w.tickets[3].status, "In progress"); // never changed
  assert.deepEqual(w.tickets[3].releasedIn, ["UK"]); // still tagged
  assert.deepEqual(w.tickets[4].releasedIn, ["EU", "UK"]);
  assert.equal(w.comments["page-3"].length, 1);
  assert.match(w.comments["page-1"][0], /^🚀 UK release 0000000 is live \(4 November 2026\)\. Release notes · PR #50$/);
  assert.match(res.summary, /Needs attention[\s\S]*AB-3 · Quiz \(UK\): status is "In progress"/);
  assert.match(res.summary, /Waiting for other regions[\s\S]*AB-2 · Footer links: waiting for EU/);
  assert.match(res.summary, /AB-99 not found in Notion/);
  assert.match(res.summary, /Commits without a ticket[\s\S]*UK: 1 commits[\s\S]*- Bump deps/);
  assert.equal(JSON.parse(read(root, "data/release-state.json")).regions.uk.sha, sha(100)); // the live branch HEAD

  // Re-running the same release adds nothing. Lose both the state and the
  // stored data, so only Notion's own tags and comments can stop duplicates.
  const state = JSON.parse(read(root, "data/release-state.json"));
  state.regions.uk.sha = sha(1);
  fs.writeFileSync(path.join(root, "data/release-state.json"), JSON.stringify(state));
  fs.rmSync(path.join(root, "data/releases.json"));
  const patches = w.calls.filter((c) => c.method === "PATCH").length;
  const again = await go(root, w);
  assert.equal(w.calls.filter((c) => c.method === "PATCH").length, patches);
  assert.equal(w.comments["page-1"].length, 1);
  assert.deepEqual(w.tickets[3].releasedIn, ["UK"]);
  assert.equal(store(root).releases.length, 1);
  assert.deepEqual(again.report.errors, []);
});

test("the page shows no commit counts or Other changes", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "#9769 - mobile gap"), commit(11, "Tidy up")] },
  });
  await go(root, w, { RELEASE_REPOS_TOKEN: "gh" });
  const data = read(root, "js/releases-data.js");
  const month = read(root, "pages/releases/archive/2026-11.html");
  for (const s of [data, month]) {
    assert.doesNotMatch(s, /commits|Other changes|Tidy up/);
  }
  assert.match(month, /<tr><td>mobile gap<\/td>[\s\S]*?<td>AB-9769<\/td><\/tr>/);
});

test("a later region updates the ticket's cell, not its week", async () => {
  const root = repo(STATE);
  const uk = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "#9769 - mobile gap", 1, { date: "2026-11-04T10:00:00Z" })] },
  });
  await go(root, uk, { RELEASE_REPOS_TOKEN: "gh" });
  const state = JSON.parse(read(root, "data/release-state.json"));
  const us = world({
    heads: { ...sameHeads(state), "ab/us": { sha: sha(300), date: "2026-11-11T10:00:00Z" } },
    compare: { "ab/us": [commit(10, "#9769 - mobile gap", 1, { date: "2026-11-11T10:00:00Z" })] },
  });
  await go(root, us, { RELEASE_REPOS_TOKEN: "gh" }, new Date("2026-11-12T12:00:00Z"));
  const [t] = pageTickets(root);
  assert.equal(t.firstRelease, "2026-11-04");
  assert.deepEqual(t.releases, { uk: "2026-11-04", us: "2026-11-11" });
  const month = read(root, "pages/releases/archive/2026-11.html");
  assert.match(month, /id="week-2026-11-02"/);
  assert.doesNotMatch(month, /id="week-2026-11-09"/);
  assert.match(month, /✓ 4 Nov<\/td><td><span class="muted">Not yet<\/span><\/td><td>✓ 11 Nov/); // no Region label: EU still expected
});

test("archive: one page per month, an index, and nav + search entries; nothing is deleted", async () => {
  const root = repo(STATE);
  // An October ticket already stored, older than 14 days
  fs.writeFileSync(path.join(root, "data/releases.json"), JSON.stringify({
    releases: [{ region: "uk", date: "2026-10-01", sha: sha(5), tickets: ["AB-7"] }],
    tickets: { "AB-7": { id: "AB-7", title: "Old thing", commitTitle: "old", prs: [], releases: { uk: { date: "2026-10-01", sha: sha(5) } }, notion: { uk: "done" } } },
  }));
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "#9769 - mobile gap")] },
  });
  await go(root, w, { RELEASE_REPOS_TOKEN: "gh" });

  assert.deepEqual(pageTickets(root).map((t) => t.id), ["AB-9769"]); // main page: last 14 days only
  assert.deepEqual(Object.keys(store(root).tickets), ["AB-7", "AB-9769"]); // never deleted
  const oct = read(root, "pages/releases/archive/2026-10.html");
  assert.match(oct, /<h1>October 2026<\/h1>/);
  assert.match(oct, /<tr><td>Old thing<\/td>[\s\S]*?<td>AB-7<\/td><\/tr>/);
  assert.match(oct, /<base href="..\/..\/..\/">/);
  assert.match(oct, /<body data-page="releases-2026-10"/);
  const index = read(root, "pages/releases/archive/index.html");
  assert.ok(index.indexOf("2026-11.html") < index.indexOf("2026-10.html"), "newest month first");
  const nav = loadJs(root, "js/releases-nav.js").DOC_RELEASE_ARCHIVE;
  assert.deepEqual(nav.map((m) => [m.month, m.title, m.href]), [
    ["2026-11", "November 2026", "pages/releases/archive/2026-11.html"],
    ["2026-10", "October 2026", "pages/releases/archive/2026-10.html"],
  ]);
  assert.match(nav[1].keywords, /AB-7 Old thing/);
});

test("theme editor saves alone are not a release", async () => {
  const root = repo(STATE);
  await go(root, world({ heads: sameHeads(STATE) })); // settle the files
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-08T09:11:00Z" } },
    compare: { "ab/uk": [shopifySave(90, "2026-11-07T10:00:00Z"), shopifySave(91, "2026-11-08T09:11:00Z")] },
  });
  const res = await go(root, w);
  assert.equal(res.changed, false);
  assert.match(res.summary, /only theme editor saves/);
  assert.equal(JSON.parse(read(root, "data/release-state.json")).regions.uk.sha, sha(1));
  assert.ok(!workCalls(w).some((c) => c.url.includes("notion")));
});

// ---- Release dates from pushes -------------------------------------------
const ev = (type, before, after, timestamp, login = "stefany") => ({
  activity_type: type, before: before ? sha(before) : "0".repeat(40), after: after ? sha(after) : "0".repeat(40), timestamp, actor: { login },
});
const noNotion = { RELEASE_REPOS_TOKEN: "gh" };

// UK: two pushes on different days, then a theme editor save. #100 is in both pushes.
function twoPushes() {
  const c11 = commit(11, "#100 - header", [1], { date: "2026-10-20T10:00:00Z" });
  const c12 = commit(12, "#101 - footer", [11], { date: "2026-10-21T10:00:00Z" });
  const c21 = commit(21, "#102 - quiz", [12], { date: "2026-10-22T10:00:00Z" });
  const c22 = commit(22, "#100 - header tweak", [21], { date: "2026-10-23T10:00:00Z" });
  const c30 = shopifySave(30, "2026-11-08T09:11:00Z");
  return world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(30), date: "2026-11-08T09:11:00Z" } },
    compare: { "ab/uk": {
      [`${sha(1)}...${sha(30)}`]: [c11, c12, c21, c22, c30],
      [`${sha(1)}...${sha(12)}`]: [c11, c12],
      [`${sha(12)}...${sha(22)}`]: [c21, c22],
    } },
    activity: { "ab/uk": [
      ev("push", 1, 12, "2026-11-03T09:00:00Z"),
      ev("push", 12, 22, "2026-11-05T10:00:00Z"),
      ev("push", 22, 30, "2026-11-08T09:11:00Z", "shopify[bot]"),
    ] },
  });
}
const NOV9 = new Date("2026-11-09T12:00:00Z");

test("two pushes on different days: each commit gets its push date", async () => {
  const root = repo(STATE);
  const w = twoPushes();
  const res = await go(root, w, noNotion, NOV9);
  const t = store(root).tickets;
  assert.deepEqual(t["AB-101"].releases.uk, { date: "2026-11-03", sha: sha(12), dateFrom: "push" });
  assert.deepEqual(t["AB-102"].releases.uk, { date: "2026-11-05", sha: sha(22), dateFrom: "push" });
  assert.deepEqual(store(root).releases.map((r) => [r.date, r.tickets]), [
    ["2026-11-03", ["AB-100", "AB-101"]],
    ["2026-11-05", ["AB-100", "AB-102"]],
  ]);
  assert.ok(!w.calls.some((c) => c.url.includes(`${sha(22)}...${sha(30)}`)), "theme editor pushes aren't listed");
  assert.doesNotMatch(res.summary, /weren't found in any push/);
  assert.match(res.summary, /live on 3 November, 5 November/);
  assert.deepEqual(JSON.parse(read(root, "data/release-state.json")).regions.uk, { sha: sha(30), pushedAt: "2026-11-08T09:11:00Z", date: "2026-11-05" });
  // The page cell shows the push date, not the HEAD date (8 Nov)
  assert.match(read(root, "pages/releases/archive/2026-11.html"), /<tr><td>quiz<\/td><td>✓ 5 Nov<\/td>[\s\S]*?<td>AB-102<\/td>/);
});

test("a ticket spanning two pushes takes the earlier push's date", async () => {
  // Pure rule: commit 11 is in both pushes, commit 22 only in the later one
  const c11 = { sha: sha(11), merge: false, parentShas: [sha(1)] };
  const c22 = { sha: sha(22), merge: false, parentShas: [sha(11)] };
  const dates = assignDates([c11, c22], [
    { at: "2026-11-05T10:00:00Z", sha: sha(22), commits: [c11, c22] },
    { at: "2026-11-03T09:00:00Z", sha: sha(11), commits: [c11] },
  ], { sha: sha(22), date: "2026-11-08T00:00:00Z" });
  assert.equal(dates.get(sha(11)).at, "2026-11-03T09:00:00Z");
  assert.equal(dates.get(sha(22)).at, "2026-11-05T10:00:00Z");
  // Full run: #100 has commits in the 3 Nov and the 5 Nov push
  const root = repo(STATE);
  await go(root, twoPushes(), noNotion, NOV9);
  assert.deepEqual(store(root).tickets["AB-100"].releases.uk, { date: "2026-11-03", sha: sha(12), dateFrom: "push" });
  assert.deepEqual(pageTickets(root).find((x) => x.id === "AB-100").releases, { uk: "2026-11-03" });
});

test("a fast-forward of the live branch dates every commit by the push, not the commit", async () => {
  const root = repo(STATE);
  // staging: #200 and #201 on two lines, merged, then #202. main is fast-forwarded to it.
  const c39 = commit(39, "#201 - gap", [1], { date: "2026-10-19T10:00:00Z" });
  const c40 = commit(40, "#200 - promo", [1], { date: "2026-10-20T10:00:00Z" });
  const c41 = commit(41, "Merge branch 'main' into staging", [40, 39], { date: "2026-10-25T10:00:00Z" });
  const c42 = commit(42, "#202 - badge", [41], { date: "2026-10-26T10:00:00Z" });
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(42), date: "2026-10-26T10:00:00Z" } },
    compare: { "ab/uk": { [`${sha(1)}...${sha(42)}`]: [c39, c40, c41, c42] } },
    activity: { "ab/uk": [ev("push", 1, 42, "2026-11-04T08:00:00Z")] },
  });
  await go(root, w, noNotion);
  const t = store(root).tickets;
  for (const id of ["AB-200", "AB-201", "AB-202"]) assert.equal(t[id].releases.uk.date, "2026-11-04", id);
  assert.deepEqual(store(root).releases.map((r) => [r.date, r.commits]), [["2026-11-04", 3]]); // merge not counted
});

test("force pushes and branch creation are skipped with a warning; commits fall back to the merge date", async () => {
  const root = repo(STATE);
  const c51 = commit(51, "#300 - fix", [1], { date: "2026-10-30T10:00:00Z" });
  const c52 = commit(52, "Merge branch 'staging'", [1, 51], { date: "2026-11-02T15:00:00Z" });
  const c53 = shopifySave(53, "2026-11-04T12:00:00Z");
  c53.parents = [{ sha: sha(52) }];
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(53), date: "2026-11-04T12:00:00Z" } },
    compare: { "ab/uk": { [`${sha(1)}...${sha(53)}`]: [c51, c52, c53] } },
    activity: { "ab/uk": [
      ev("branch_creation", 0, 52, "2026-11-01T08:00:00Z"),
      ev("force_push", 1, 52, "2026-11-04T09:00:00Z"),
      ev("push", 52, 53, "2026-11-04T12:00:00Z", "shopify[bot]"),
    ] },
  });
  const res = await go(root, w, noNotion);
  assert.deepEqual(res.report.errors, []);
  assert.deepEqual(store(root).tickets["AB-300"].releases.uk, { date: "2026-11-02", sha: sha(52), dateFrom: "merge" });
  assert.match(res.summary, /UK: ignored force push on 4 November 2026/);
  assert.match(res.summary, /UK: ignored branch creation on 1 November 2026/);
  assert.match(res.summary, /UK: 1 commits weren't found in any push, so they're dated by the merge that brought them in/);
});

test("without push history or a merge, the date falls back to the newest commit, with a warning", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(61), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(61, "#400 - straight on main", [1])] },
  });
  const res = await go(root, w, noNotion);
  assert.deepEqual(store(root).tickets["AB-400"].releases.uk, { date: "2026-11-04", sha: sha(61), dateFrom: "head" });
  assert.match(res.summary, /dated by the live branch's newest commit \(4 November 2026\)/);
});

test("--rebuild works the last 14 days out again and fixes wrong dates and tags", async () => {
  const root = repo({ regions: { ...STATE.regions, uk: { sha: sha(30), date: "2026-11-05" } } });
  const cfg = { ...CONFIG, notion: { ...CONFIG.notion, releasedInLabel: "{region} live {date}" } };
  fs.writeFileSync(path.join(root, "release.config.json"), JSON.stringify(cfg));
  // Old data: #100 wrongly dated 5 Nov (HEAD-style), plus an October ticket that must survive
  fs.writeFileSync(path.join(root, "data/releases.json"), JSON.stringify({
    releases: [{ region: "uk", date: "2026-11-05", sha: sha(30), tickets: ["AB-100"] }, { region: "uk", date: "2026-10-01", sha: sha(5), tickets: ["AB-7"] }],
    tickets: {
      "AB-100": { id: "AB-100", commitTitle: "header", prs: [], releases: { uk: { date: "2026-11-05", sha: sha(30) } }, notion: { uk: "done" } },
      "AB-7": { id: "AB-7", title: "Old thing", prs: [], releases: { uk: { date: "2026-10-01", sha: sha(5) } }, notion: { uk: "done" } },
    },
  }));
  const w = twoPushes();
  w.tickets[100] = { title: "Header", status: "Complete", regions: [], releasedIn: ["UK live 5 Nov 2026"] };
  w.tickets[101] = { title: "Footer", status: "Complete", regions: [] };
  w.tickets[102] = { title: "Quiz", status: "Complete", regions: [] };

  // Dry run first: nothing written anywhere
  const before = read(root, "data/releases.json");
  const dry = await run({ root, env: { ...ENV, DRY_RUN: "1" }, fetch: w.fetch, sleep: async () => {}, now: NOV9, log: quiet, rebuild: true });
  assert.ok(dry.report.changed.includes("data/releases.json"));
  assert.equal(read(root, "data/releases.json"), before);
  assert.deepEqual(w.tickets[100].releasedIn, ["UK live 5 Nov 2026"]);

  const res = await run({ root, env: ENV, fetch: w.fetch, sleep: async () => {}, now: NOV9, log: quiet, rebuild: true });
  assert.deepEqual(res.report.errors, []);
  const s = store(root);
  assert.equal(s.tickets["AB-100"].releases.uk.date, "2026-11-03");
  assert.equal(s.tickets["AB-7"].title, "Old thing"); // older than 14 days: kept
  assert.deepEqual(s.releases.map((r) => r.date).sort(), ["2026-10-01", "2026-11-03", "2026-11-05"]);
  assert.deepEqual(w.tickets[100].releasedIn, ["UK live 3 Nov 2026"]); // wrong tag replaced
  assert.match(res.summary, /first run/);
});

test("second region completes a ticket labelled for both", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" }, "ab/eu": { sha: sha(200), date: "2026-11-04T11:00:00Z" } },
    compare: { "ab/uk": [commit(10, "AB-2 footer")], "ab/eu": [commit(10, "AB-2 footer")] },
    tickets: { 2: { title: "Footer links", status: "For review", regions: ["UK", "EU"] } },
  });
  const res = await go(root, w);
  assert.equal(w.tickets[2].status, "Complete");
  assert.deepEqual(w.tickets[2].releasedIn, ["UK", "EU"]);
  assert.equal(w.comments["page-2"].length, 2);
  assert.equal(res.message, "Website releases: UK 2026-11-04, EU 2026-11-04");
  assert.equal(w.calls.filter((c) => c.method === "PATCH").length, 2);
});

test("dated tags: a ticket labelled UK + US completes once both have a live tag", async () => {
  const root = repo(STATE);
  const cfg = { ...CONFIG, notion: { ...CONFIG.notion, releasedInLabel: "{region} live {date}" } };
  fs.writeFileSync(path.join(root, "release.config.json"), JSON.stringify(cfg));
  const w = world({
    heads: { ...sameHeads(STATE), "ab/us": { sha: sha(300), date: "2026-11-05T11:19:00Z" } },
    compare: { "ab/us": [commit(10, "#9769 - mobile gap", 1, { date: "2026-11-05T11:19:00Z" })] },
    tickets: { 9769: { title: "Mobile gap", status: "On staging", regions: ["UK", "US"], releasedIn: ["UK live 28 Oct 2026"] } },
  });
  await go(root, w);
  assert.deepEqual(w.tickets[9769].releasedIn, ["UK live 28 Oct 2026", "US live 5 Nov 2026"]);
  assert.equal(w.tickets[9769].status, "Complete");
  assert.equal(pageTickets(root)[0].text, "Mobile gap");
});

test("300 commits are all read (paginated) and still one row per ticket", async () => {
  const root = repo(STATE);
  const many = Array.from({ length: 300 }, (_, i) => commit(1000 + i, i % 3 === 0 ? `AB-${1 + (i % 4)} work` : `wip ${i}`));
  const w = world({
    heads: { ...sameHeads(STATE), "ab/us": { sha: sha(300), date: "2026-11-03T09:00:00Z" } },
    compare: { "ab/us": many },
    tickets: { 1: { title: "One", status: "Testing" }, 2: { title: "Two", status: "Testing" }, 3: { title: "Three", status: "Testing" }, 4: { title: "Four", status: "Testing" } },
  });
  const res = await go(root, w);
  assert.equal(w.calls.filter((c) => c.url.includes("/compare/")).length, 3);
  assert.equal(pageTickets(root).length, 4);
  assert.deepEqual(store(root).releases.map((r) => [r.commits, r.commitsWithoutTicket]), [[300, 200]]);
  assert.match(res.summary, /US: 200 commits/);
});

test("first run with no state reads the last 14 days", async () => {
  const root = repo(null);
  const w = world({
    heads: {
      "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" },
      "ab/eu": { sha: sha(200), date: "2026-11-02T10:00:00Z" },
      "ab/us": { sha: sha(300), date: "2026-11-01T10:00:00Z" },
    },
    since: { "ab/uk": [commit(1, "AB-1 a")], "ab/eu": [commit(2, "No ticket")], "ab/us": [] },
    tickets: { 1: { title: "One", status: "Testing" } },
  });
  const res = await go(root, w);
  const sinceCall = w.calls.find((c) => c.url.includes("/repos/ab/uk/commits"));
  assert.match(sinceCall.url, /since=2026-10-22T12:00:00\.000Z/);
  assert.ok(!w.calls.some((c) => c.url.includes("/compare/")));
  const state = JSON.parse(read(root, "data/release-state.json"));
  assert.deepEqual(Object.keys(state.regions), ["uk", "eu"]); // US had no commits in 14 days
  assert.equal(store(root).releases.length, 2);
  assert.match(res.summary, /first run/);
});

test("Notion rate limits are retried", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "AB-1 a")] },
    tickets: { 1: { title: "One", status: "Testing" } },
  });
  w.queue("/query", w.reply({}, 429, { "retry-after": "1" }));
  w.queue("/comments", w.reply({}, 429, {}));
  const res = await go(root, w);
  assert.deepEqual(res.report.errors, []);
  assert.equal(w.tickets[1].status, "Complete");
  assert.equal(w.comments["page-1"].length, 1);
});

test("a failed Notion update is kept and retried on the next run", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "AB-1 a")] },
    tickets: { 1: { title: "One", status: "Testing" } },
  });
  for (let i = 0; i < 6; i++) w.queue("/pages/", w.reply({ message: "down" }, 502));
  const first = await go(root, w);
  assert.equal(first.report.errors.length, 1);
  assert.equal(w.tickets[1].status, "Testing");
  const second = await go(root, w); // no new release, but the pending ticket is retried
  assert.deepEqual(second.report.errors, []);
  assert.equal(w.tickets[1].status, "Complete");
  assert.equal(w.comments["page-1"].length, 1);
});

test("a Release note written later reaches the page on the next run", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "AB-1 a")] },
    tickets: { 1: { title: "One", status: "Testing" } },
  });
  await go(root, w);
  assert.equal(pageTickets(root)[0].text, "One");
  w.tickets[1].releaseNote = "Product pages load faster.";
  const res = await go(root, w);
  assert.equal(pageTickets(root)[0].text, "Product pages load faster.");
  assert.equal(res.changed, true);
});

test("DRY_RUN writes nothing to the repo or Notion", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "AB-1 a"), commit(11, "Other")] },
    tickets: { 1: { title: "One", status: "Testing" } },
  });
  const res = await go(root, w, { ...ENV, DRY_RUN: "1" });
  assert.equal(res.changed, true);
  for (const f of ["js/releases-data.js", "js/releases-nav.js", "data/releases.json", "pages/releases/archive/2026-11.html"]) {
    assert.ok(res.report.changed.includes(f), f);
  }
  assert.ok(!fs.existsSync(path.join(root, "js")));
  assert.ok(!fs.existsSync(path.join(root, "pages")));
  assert.ok(!fs.existsSync(path.join(root, "data/releases.json")));
  assert.deepEqual(JSON.parse(read(root, "data/release-state.json")), STATE);
  assert.ok(!w.calls.some((c) => c.method === "PATCH" || (c.method === "POST" && c.url.endsWith("/comments"))));
  assert.equal(w.tickets[1].status, "Testing");
  assert.match(res.summary, /dry run/);
});

test("Notion links can be turned off", async () => {
  const root = repo(STATE);
  const cfg = { ...CONFIG, notion: { ...CONFIG.notion, linkTickets: false } };
  fs.writeFileSync(path.join(root, "release.config.json"), JSON.stringify(cfg));
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "AB-1 a")] },
    tickets: { 1: { title: "One", status: "Testing" } },
  });
  await go(root, w);
  assert.equal(pageTickets(root)[0].url, undefined);
  assert.doesNotMatch(read(root, "pages/releases/archive/2026-11.html"), /notion\.so/);
});

test("without Notion: one clear warning, and ticket IDs stay plain text", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" }, "ab/eu": { sha: sha(200), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "#9769 - mobile gap")], "ab/eu": [commit(10, "#9769 - mobile gap")] },
  });
  // Token set but no database ID, like a half-finished setup
  const res = await go(root, w, { RELEASE_REPOS_TOKEN: "gh", NOTION_TOKEN: "nt" });
  assert.equal(res.report.warnings.filter((x) => x === "Notion not configured: ticket links and titles come from commits").length, 1);
  assert.ok(!w.calls.some((c) => c.url.includes("notion")));
  const [t] = pageTickets(root);
  assert.equal(t.url, undefined);
  assert.equal(t.text, "mobile gap"); // from the commit
  assert.match(read(root, "pages/releases/archive/2026-11.html"), /<tr><td>mobile gap<\/td>/); // no link
});

test("a database ID that can't be read (e.g. a page) falls back cleanly, with the reason", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "#9769 - mobile gap")] },
    tickets: { 9769: { title: "Mobile gap", status: "Testing" } },
    notionDb: "Provided ID abc is a page, not a database. Use the retrieve page API instead",
  });
  const res = await go(root, w);
  assert.deepEqual(res.report.errors, []);
  assert.equal(w.calls.filter((c) => c.url.includes("notion")).length, 1); // only the check
  assert.match(res.summary, /Notion not configured: ticket links and titles come from commits \(NOTION_DATABASE_ID can't be read as a database: Provided ID abc is a page, not a database/);
  assert.equal(pageTickets(root)[0].url, undefined);
  assert.equal(w.tickets[9769].status, "Testing");
});

test("A+B Tasks setup: #IDs, no Region label, Status never changed, missing \"Released in\" only warns", async () => {
  const root = repo(STATE);
  const cfg = {
    ...CONFIG,
    ticketIdFormat: "#{number}",
    regions: CONFIG.regions,
    notion: {
      ...CONFIG.notion,
      releasedInLabel: "{region} live {date}",
      properties: { ...CONFIG.notion.properties, region: null, status: "Status" },
      statuses: { ...STATUSES, update: false },
    },
    docs: { ...CONFIG.docs, siteUrl: "TODO: address of the docs site" },
  };
  fs.writeFileSync(path.join(root, "release.config.json"), JSON.stringify(cfg));
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "#9769 - mobile gap")] },
    tickets: { 9769: { title: "Christmas PLP Anchor links", status: "On staging" } },
    noReleasedIn: true,
  });
  const res = await go(root, w);
  assert.deepEqual(res.report.errors, []);
  const [t] = pageTickets(root);
  assert.equal(t.id, "#9769");
  assert.equal(t.text, "Christmas PLP Anchor links"); // Notion title
  assert.equal(t.url, "https://notion.so/page-9769"); // links work
  assert.equal(w.tickets[9769].status, "On staging"); // never changed
  assert.ok(!w.calls.some((c) => c.method === "PATCH"));
  assert.match(res.summary, /Notion property "Released in" not found: live tags skipped/);
  assert.match(res.summary, /docs.siteUrl not set/);
  assert.match(w.comments["page-9769"][0], /^🚀 UK release 0000000 is live \(4 November 2026\)\.$/);
  assert.match(read(root, "pages/releases/archive/2026-11.html"), /<tr><td><a href="https:\/\/notion.so\/page-9769">Christmas PLP Anchor links<\/a><\/td>[\s\S]*?<td>#9769<\/td><\/tr>/);
  // With the property added, the dated tag is set — still no Status change
  const w2 = world({
    heads: { ...sameHeads({ regions: { ...STATE.regions, uk: JSON.parse(read(root, "data/release-state.json")).regions.uk } }), "ab/eu": { sha: sha(200), date: "2026-11-05T10:00:00Z" } },
    compare: { "ab/eu": [commit(10, "#9769 - mobile gap")] },
    tickets: { 9769: { title: "Christmas PLP Anchor links", status: "On staging", releasedIn: [] } },
  });
  w2.comments["page-9769"] = [...w.comments["page-9769"]]; // same Notion: the UK comment is already there
  await go(root, w2);
  // UK was owed a tag from the first run; EU is new. One comment per region, no duplicates.
  assert.deepEqual([...w2.tickets[9769].releasedIn].sort(), ["EU live 5 Nov 2026", "UK live 4 Nov 2026"]);
  assert.equal(w2.comments["page-9769"].length, 2); // UK (kept, not repeated) + EU
  assert.equal(w2.tickets[9769].status, "On staging");
});

test("no comment permission: one warning, no errors, comments stay owed", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "#1 - a"), commit(11, "#2 - b")] },
    tickets: { 1: { title: "One", status: "Testing" }, 2: { title: "Two", status: "Testing" } },
    noComments: true,
  });
  const res = await go(root, w);
  assert.deepEqual(res.report.errors, []);
  assert.equal(res.report.warnings.filter((x) => x.includes("can't read comments")).length, 1);
  assert.equal(w.calls.filter((c) => c.url.includes("/comments")).length, 1); // tried once, then skipped
  assert.deepEqual(Object.values(store(root).tickets).map((t) => t.notion.uk), ["pending", "pending"]);
  assert.equal(pageTickets(root)[0].text, "One"); // titles still come from Notion
});

test("NOTION_READ_ONLY=1: titles and links from Notion, nothing written there, tags still owed", async () => {
  const root = repo(STATE);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(100), date: "2026-11-04T10:00:00Z" } },
    compare: { "ab/uk": [commit(10, "#9769 - mobile gap")] },
    tickets: { 9769: { title: "Christmas PLP Anchor links", status: "On staging" } },
  });
  const res = await go(root, w, { ...ENV, NOTION_READ_ONLY: "1" });
  assert.deepEqual(res.report.errors, []);
  assert.ok(!w.calls.some((c) => c.method === "PATCH" || (c.method === "POST" && c.url.endsWith("/comments"))));
  const [t] = pageTickets(root);
  assert.equal(t.text, "Christmas PLP Anchor links");
  assert.equal(t.url, "https://notion.so/page-9769");
  assert.equal(store(root).tickets["AB-9769"].notion.uk, "pending");
  await go(root, w); // a normal run afterwards adds the owed tag
  assert.deepEqual(w.tickets[9769].releasedIn, ["UK"]);
});

// ---- Latest updates (js/updates.js) from dev main changes -------------------
const UPDATES_JS = `/* hand-written header */
window.DOC_UPDATES = [
  {
    date: '2026-10-16',
    items: [
      {
        page: 'sections',
        section: 'hero',
        text: 'Hand-written line.',
        note: 'Now people can do something.',
      },
    ],
  },
];
`;
function docsRepo() {
  const root = repo(STATE);
  const cfg = {
    ...CONFIG,
    ticketIdFormat: "#{number}",
    docUpdates: {
      enabled: true,
      file: "js/updates.js",
      pages: { sections: { file: "pages/site/sections.html", title: "Sections library", noun: "section" }, navigation: { file: "pages/site/navigation.html", title: "Navigation", noun: "block", pageName: "the menu" } },
      map: { "blocks/nav-menu.liquid": ["navigation#nav-60-menu"], "blocks/nav-item-60_40.liquid": ["navigation"], "snippets/hero_image.liquid": ["sections#hero"] },
    },
  };
  fs.writeFileSync(path.join(root, "release.config.json"), JSON.stringify(cfg));
  fs.mkdirSync(path.join(root, "pages/site"), { recursive: true });
  fs.mkdirSync(path.join(root, "js"), { recursive: true });
  fs.writeFileSync(path.join(root, "pages/site/sections.html"), `<article class="section-card" data-file="hero" aria-label="Hero Image: open details"></article>
<article class="section-card" data-file="builder-50_50" aria-label="Builder 50/50: open details"></article>
<article class="section-card" data-file="content-image-product" aria-label="Content Image &amp; Product: open details"></article>`);
  fs.writeFileSync(path.join(root, "pages/site/navigation.html"), `<article class="section-card" data-file="nav-60-menu" aria-label="Menu: open details"></article>`);
  fs.writeFileSync(path.join(root, "js/updates.js"), UPDATES_JS);
  return root;
}
const docUpdates = (root) => loadJs(root, "js/updates.js").DOC_UPDATES;
const ukRelease = (commits, files, tickets = {}, region = "uk", headSha = 100) => world({
  heads: { ...sameHeads(STATE), [`ab/${region}`]: { sha: sha(headSha), date: "2026-11-04T10:00:00Z" } },
  compare: { [`ab/${region}`]: commits },
  files,
  tickets,
});

test("Latest updates: changed sections and tabs from dev main, in the js/updates.js language, even without a ticket ID", async () => {
  const root = docsRepo();
  const newSetting = `+      {
+        "type": "checkbox",
+        "id": "show_flash",
+        "label": "Show Flash Banner",
+        "default": false
+      },`;
  const newBlock = `+    {
+      "type": "promo_block",
+      "name": "Promo Banner",
+      "settings": [{ "type": "text", "id": "title", "label": "Title" }]
+    }`;
  const w = ukRelease(
    [commit(10, "tidy hero spacing"), commit(11, "#9769 - menu tweaks"), commit(12, "new tab layout"), commit(13, "#9770 - flash"), commit(14, "#9771 - promo")],
    {
      [sha(10)]: { "sections/hero.liquid": "-  margin: 4px\n+  margin: 8px", "assets/styles.css": "+x" },
      [sha(11)]: { "blocks/nav-menu.liquid": "-<a>\n+<a aria-label=\"x\">" },
      [sha(12)]: { "blocks/nav-item-60_40.liquid": "+<div>", "sections/not-in-docs.liquid": "+x" },
      [sha(13)]: { "sections/builder-50_50.liquid": newSetting },
      [sha(14)]: { "sections/content-image-product.liquid": newBlock },
    },
    {
      9769: { title: "Christmas PLP Anchor links", status: "On staging" }, // a title, not a statement: not used
      9771: { title: "PLP promo", status: "On staging", releaseNote: "Collection pages can show a promo banner." },
    },
  );
  const res = await go(root, w);
  assert.deepEqual(res.report.errors, []);
  const [latest, old] = docUpdates(root);
  assert.equal(latest.date, "2026-11-04");
  assert.deepEqual(latest.items.map((i) => [i.page, i.section, i.text, i.note]), [
    ["sections", "hero", "Small fixes to the Hero Image section.", "Now the Hero Image section has the latest fixes. Nothing changes in how you set it up."],
    ["navigation", "nav-60-menu", "Small fixes to the Menu block.", "Now the Menu block has the latest fixes. Nothing changes in how you set it up."],
    ["navigation", undefined, "Small fixes to the menu.", "Now the menu has the latest fixes. Nothing changes in how you set it up."],
    ["sections", "builder-50_50", "There's a new Show Flash Banner option in Builder 50/50.", "Now you can tick Show Flash Banner in the Builder 50/50 settings."],
    ["sections", "content-image-product", "Collection pages can show a promo banner.", "Now you can add a Promo Banner block to Content Image & Product in the Theme editor."],
  ]);
  assert.deepEqual(old.items.map((i) => i.text), ["Hand-written line."]); // untouched
  assert.match(read(root, "js/updates.js"), /^\/\* hand-written header \*\//);
});

test("Latest updates: the same commits going live in another region add nothing", async () => {
  const root = docsRepo();
  const commits = [commit(10, "tidy hero spacing")];
  const files = { [sha(10)]: ["sections/hero.liquid"] };
  await go(root, ukRelease(commits, files));
  const before = read(root, "js/updates.js");
  const state = JSON.parse(read(root, "data/release-state.json"));
  const eu = world({
    heads: { ...sameHeads(state), "ab/eu": { sha: sha(200), date: "2026-11-05T10:00:00Z" } },
    compare: { "ab/eu": commits }, files,
  });
  await go(root, eu);
  assert.equal(read(root, "js/updates.js"), before);
  assert.equal(store(root).liveCommits[sha(10)], "2026-11-04");
});

test("Latest updates: a later release the same day adds to that day's entry", async () => {
  const root = docsRepo();
  await go(root, ukRelease([commit(10, "hero")], { [sha(10)]: ["sections/hero.liquid"] }));
  const state = JSON.parse(read(root, "data/release-state.json"));
  const later = world({
    heads: { ...sameHeads(state), "ab/uk": { sha: sha(101), date: "2026-11-04T15:00:00Z" } },
    compare: { "ab/uk": [commit(20, "menu")] },
    files: { [sha(20)]: ["blocks/nav-menu.liquid", "sections/hero.liquid"] },
  });
  await go(root, later);
  const all = docUpdates(root);
  assert.equal(all.length, 2);
  assert.deepEqual(all[0].items.map((i) => i.section), ["nav-60-menu", "hero"]); // hero not repeated
});

test("Latest updates: nothing written when no docs section changed, or when disabled", async () => {
  const root = docsRepo();
  await go(root, ukRelease([commit(10, "assets only")], { [sha(10)]: ["assets/app.js"] }));
  assert.equal(read(root, "js/updates.js"), UPDATES_JS);
  const root2 = repo(STATE); // no docUpdates in the config
  await go(root2, ukRelease([commit(10, "hero")], { [sha(10)]: ["sections/hero.liquid"] }));
  assert.ok(!fs.existsSync(path.join(root2, "js/updates.js")));
});

test("Latest updates: the entry date ignores guessed dates, and card names are plain text", async () => {
  const root = docsRepo();
  // c10 is in a push on 4 Nov; c11 is in no push, so it gets the branch's newest date (8 Nov)
  const c10 = commit(10, "hero", [1]);
  const c11 = commit(11, "image product", [10]);
  const w = world({
    heads: { ...sameHeads(STATE), "ab/uk": { sha: sha(11), date: "2026-11-08T09:00:00Z" } },
    compare: { "ab/uk": { [`${sha(1)}...${sha(11)}`]: [c10, c11], [`${sha(1)}...${sha(10)}`]: [c10] } },
    activity: { "ab/uk": [{ activity_type: "push", before: sha(1), after: sha(10), timestamp: "2026-11-04T09:00:00Z", actor: { login: "dev" } }] },
    files: { [sha(10)]: ["sections/hero.liquid"], [sha(11)]: ["sections/content-image-product.liquid"] },
  });
  await go(root, w, { RELEASE_REPOS_TOKEN: "gh" }, new Date("2026-11-09T12:00:00Z"));
  const [latest] = docUpdates(root);
  assert.equal(latest.date, "2026-11-04");
  assert.ok(latest.items.some((i) => i.text === "Small fixes to the Content Image & Product section."));
});

test("reading a theme change: new settings and blocks, or only formatting", () => {
  const c = themeChange(`+      { "type": "checkbox", "id": "show_cta", "label": "Enable View CTA button" },
+      { "type": "select", "id": "style", "label": "Flash Banner Style",
+        "options": [{ "value": "filled", "label": "Filled" }, { "value": "outline", "label": "Outline" }] },
+    { "type": "promo_block", "name": "Promo Banner" }`);
  assert.deepEqual(c.settings, [{ label: "Enable View CTA button", type: "checkbox" }, { label: "Flash Banner Style", type: "select" }]);
  assert.deepEqual(c.blocks, ["Promo Banner"]);
  assert.equal(c.formattingOnly, false);
  // A setting that only moved is not new
  assert.deepEqual(themeChange(`-  { "type": "text", "id": "t", "label": "Title" }
+    { "type": "text", "id": "t", "label": "Title" }`).settings, []);
  // Re-indented code, a call split over lines, comment text and merge markers: nothing to announce
  assert.equal(themeChange(`-{% render 'card', product: product %}
-{% endschema %}{%- comment -%}
-old note
-<<<<<<< HEAD
+{% render 'card'
+  , product: product %}
+{% endschema %}
+{%- comment -%}
+  new note`).formattingOnly, true);
});

test("Latest updates: a formatting-only change marks nothing", async () => {
  const root = docsRepo();
  await go(root, ukRelease([commit(10, "tidy")], { [sha(10)]: { "sections/hero.liquid": "-<div class=\"a\">\n+<div\n+  class=\"a\">" } }));
  assert.equal(read(root, "js/updates.js"), UPDATES_JS);
});

test("Latest updates: cart files mark the Cart guide, and everything else adds one catch-all line", async () => {
  const root = docsRepo();
  const cfg = JSON.parse(read(root, "release.config.json"));
  cfg.docUpdates.pages.cart = { file: "pages/shop/cart.html", title: "Cart", pageName: "the cart" };
  cfg.docUpdates.map["snippets/cart-*.liquid"] = ["cart"];
  cfg.docUpdates.fallback = { page: "website-releases", text: "Small fixes across the website.", note: "Now the full list of what went live is on Website releases." };
  fs.writeFileSync(path.join(root, "release.config.json"), JSON.stringify(cfg));
  fs.mkdirSync(path.join(root, "pages/shop"), { recursive: true });
  fs.writeFileSync(path.join(root, "pages/shop/cart.html"), "<h1>Cart</h1>");
  const w = ukRelease(
    [commit(10, "Cart WIP"), commit(11, "css amend"), commit(12, "build"), commit(13, "Merge main", [11, 12])],
    {
      [sha(10)]: { "snippets/cart-gift-chooser.liquid": "+<div class=\"gift\">" },
      [sha(11)]: { "assets/styles.css": "+.a{color:red}" },
      [sha(12)]: { "locales/en.default.json": "+\"free\": \"Free\"" },
    },
  );
  await go(root, w);
  const [latest] = docUpdates(root);
  assert.deepEqual(latest.items.map((i) => [i.page, i.section, i.text]), [
    ["cart", undefined, "Small fixes to the cart."],
    ["website-releases", undefined, "Small fixes across the website."], // once, for both other commits
  ]);
  assert.equal(latest.items[0].note, "Now the cart has the latest fixes. Nothing changes in how you set it up.");
});
