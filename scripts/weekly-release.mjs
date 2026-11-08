#!/usr/bin/env node
// Website releases: for each region (uk, eu, us) spots a new release on the
// live branch, adds it to the Website releases page and updates the Notion
// tickets. Settings: release.config.json. Setup: scripts/README.md.
// Node 20+, no dependencies.
//
//   node scripts/weekly-release.mjs            run
//   DRY_RUN=1 node scripts/weekly-release.mjs  show what would change, write nothing
//   node scripts/weekly-release.mjs --rebuild  work out the last 14 days again from scratch
//                                              (ignores data/release-state.json; works with DRY_RUN=1)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// The same weekly tables the Website releases page uses in the browser
const { render: renderReleases, weekStart } = createRequire(import.meta.url)("../js/releases.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const GITHUB_API = "https://api.github.com";
const NOTION_API = "https://api.notion.com/v1";
const unescapeHtml = (s) => s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'", "#x27": "'" })[e]);
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);

// ---------- 1. Config ----------
export function loadConfig(root, { notion = true } = {}) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "release.config.json"), "utf8"));
  // Without Notion, its settings (and the docs address used in comments) can wait
  const notionOnly = /^(notion\.|regions\[\d+\]\.notionName$)/;
  const todos = findTodos(cfg).filter((t) => t !== "docs.siteUrl" && (notion || !notionOnly.test(t)));
  if (todos.length) {
    throw new Error(`release.config.json still has TODO values. Fill these in first:\n  - ${todos.join("\n  - ")}`);
  }
  return cfg;
}

export function findTodos(value, at = "") {
  if (typeof value === "string") return /TODO/.test(value) ? [at] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findTodos(v, `${at}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => (k === "$comment" ? [] : findTodos(v, at ? `${at}.${k}` : k)));
  }
  return [];
}

// ---------- 2. HTTP with retry (rate limits and server errors) ----------
function makeRequest({ fetch, sleep, log }) {
  return async function request(url, options = {}, label = url, { withHeaders = false } = {}) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, options);
      const limited = res.status === 429
        || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");
      if ((limited || res.status >= 500) && attempt < 5) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const reset = Number(res.headers.get("x-ratelimit-reset"));
        const wait = retryAfter > 0 ? retryAfter * 1000
          : reset > 0 ? Math.max(1000, reset * 1000 - Date.now())
          : 1000 * 2 ** attempt;
        log.warn(`⏳ ${label}: ${res.status}, retrying in ${Math.round(wait / 1000)}s`);
        await sleep(Math.min(wait, 60_000));
        continue;
      }
      if (!res.ok) throw new Error(`${label} ${res.status}: ${await res.text()}`);
      const body = res.status === 204 ? null : await res.json();
      return withHeaders ? { body, headers: res.headers } : body;
    }
  };
}

// ---------- 3. GitHub helpers ----------
function makeGitHub(request, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const get = (p, opts) => request(`${GITHUB_API}${p}`, { headers }, `GitHub ${p.split("?")[0]}`, opts);
  const toCommit = (c) => normalise({
    sha: c.sha,
    message: c.commit?.message,
    parents: c.parents || [],
    author: c.commit?.author?.name,
    date: c.commit?.committer?.date,
  });

  return {
    async head(repo, branch) {
      const b = await get(`/repos/${repo}/branches/${encodeURIComponent(branch)}`);
      return { sha: b.commit.sha, date: b.commit.commit.committer.date };
    },
    // Commits in head that aren't in base. Paginated, so 250+ commits work.
    async between(repo, base, head) {
      const all = [];
      for (let page = 1; page <= 100; page++) {
        const r = await get(`/repos/${repo}/compare/${base}...${head}?per_page=100&page=${page}`);
        all.push(...r.commits);
        if (r.commits.length < 100 || all.length >= r.total_commits) break;
      }
      return all.map(toCommit);
    },
    async since(repo, branch, sinceIso) {
      const all = [];
      for (let page = 1; page <= 100; page++) {
        const list = await get(`/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&since=${sinceIso}&per_page=100&page=${page}`);
        all.push(...list);
        if (list.length < 100) break;
      }
      return all.map(toCommit).reverse(); // oldest first, like compare
    },
    // Updates to the live branch since sinceIso, newest first: pushes, force
    // pushes, PR merges… each with before, after and timestamp. Needs Contents: read.
    async activity(repo, branch, sinceIso, now) {
      const since = Date.parse(sinceIso);
      const days = (now - since) / 86_400_000;
      const period = days <= 1 ? "day" : days <= 7 ? "week" : days <= 28 ? "month" : days <= 90 ? "quarter" : "year";
      let next = `/repos/${repo}/activity?ref=${encodeURIComponent(branch)}&time_period=${period}&per_page=100`;
      const all = [];
      for (let page = 0; next && page < 100; page++) {
        const { body, headers: h } = await get(next, { withHeaders: true });
        all.push(...body);
        if (body.some((e) => Date.parse(e.timestamp) <= since)) break; // reached the window start
        const link = (h.get("link") || "").match(/<([^>]+)>;\s*rel="next"/);
        next = link ? link[1].replace(GITHUB_API, "") : null;
      }
      return all.filter((e) => Date.parse(e.timestamp) > since);
    },
    // Files changed by one commit (for Latest updates)
    async files(repo, sha) {
      const c = await get(`/repos/${repo}/commits/${sha}`);
      return (c.files || []).map((x) => ({ filename: x.filename, patch: x.patch || "" }));
    },
    // Merged PRs in the dev repo with the ticket ID in their title
    async prsFor(repo, ticketId) {
      const q = encodeURIComponent(`"${ticketId}" repo:${repo} is:pr is:merged in:title`);
      const r = await get(`/search/issues?q=${q}&per_page=20`);
      const re = new RegExp(`\\b${escapeRe(ticketId)}\\b`, "i");
      return r.items.filter((i) => re.test(i.title)).map((i) => ({ number: i.number, url: i.html_url }));
    },
  };
}

const normalise = ({ sha, message = "", parents, author = "", date }) => ({
  sha,
  short: sha.slice(0, 7),
  subject: message.split("\n")[0],
  merge: parents.length > 1,
  parentShas: parents.map((p) => (typeof p === "string" ? p : p.sha)).filter(Boolean),
  author,
  date,
});

// Local test mode: read local clones instead of the GitHub API.
// LOCAL_REPOS="ancientandbrave/uk=~/uk,ancientandbrave/us=~/us" (run `git fetch` in each first)
function makeLocalGit(spec) {
  const dirs = Object.fromEntries(spec.split(",").map((pair) => {
    const [repo, dir] = pair.split("=").map((s) => s.trim());
    return [repo, dir.replace(/^~(?=\/|$)/, process.env.HOME)];
  }));
  const dirFor = (repo) => {
    if (!dirs[repo]) throw new Error(`No local clone for ${repo} in LOCAL_REPOS`);
    return dirs[repo];
  };
  const FMT = "--format=%H%x1f%P%x1f%an%x1f%cI%x1f%B%x1e";
  const log = (repo, ...args) => execFileSync("git", ["-C", dirFor(repo), "log", FMT, ...args], { encoding: "utf8", maxBuffer: 1 << 28 })
    .split("\x1e").map((s) => s.trim()).filter(Boolean)
    .map((s) => {
      const [sha, parents, author, date, message] = s.split("\x1f");
      return normalise({ sha, message, parents: parents.split(" ").filter(Boolean), author, date });
    })
    .reverse(); // oldest first, like the compare API
  return {
    async head(repo, branch) {
      const [c] = log(repo, "-1", `origin/${branch}`);
      return { sha: c.sha, date: c.date };
    },
    async between(repo, base, head) { return log(repo, `${base}..${head}`); },
    async since(repo, branch, sinceIso) { return log(repo, `--since=${sinceIso}`, `origin/${branch}`); },
    async prsFor() { return []; }, // PR search needs the GitHub API; falls back to (#123) in commit titles
    async files(repo, sha) {
      const out = execFileSync("git", ["-C", dirFor(repo), "show", "--format=", "--no-color", sha], { encoding: "utf8", maxBuffer: 1 << 28 });
      return out.split(/^diff --git /m).slice(1).map((chunk) => ({ filename: chunk.match(/ b\/(.+)\n/)[1], patch: chunk }));
    },
    async activity() { throw new Error("push history needs the GitHub API (not available with LOCAL_REPOS)"); },
  };
}

// Commits Shopify makes when someone saves in the theme editor aren't releases
export function isIgnored(c, ignore = {}) {
  return (ignore.authors || []).includes(c.author)
    || (ignore.subjectStartsWith || []).some((s) => c.subject.startsWith(s));
}

// When each commit reached the live branch.
//   1. the earliest push that contains it (push timestamp)
//   2. fallback: the committer date of the merge on the live branch that brought it in
//   3. fallback: the date of the live branch's newest commit (HEAD)
// commits: everything that reached the branch in this range (merges included, for the graph)
// pushes:  [{ at, sha, commits }] — sha is the push's "after"
// Returns Map sha → { at, sha, source: "push" | "merge" | "head" }
export function assignDates(commits, pushes, head) {
  const dated = new Map();
  for (const p of [...pushes].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    for (const c of p.commits) if (!dated.has(c.sha)) dated.set(c.sha, { at: p.at, sha: p.sha, source: "push" });
  }
  // Merges on the live branch's own line (first parents from HEAD), oldest first
  const bySha = new Map(commits.map((c) => [c.sha, c]));
  const line = [];
  for (let sha = head.sha; bySha.has(sha);) { line.push(bySha.get(sha)); sha = bySha.get(sha).parentShas[0]; }
  const onLine = new Set(line.map((c) => c.sha));
  const viaMerge = new Map();
  for (const m of line.reverse().filter((c) => c.merge)) {
    const stack = m.parentShas.slice(1);
    while (stack.length) {
      const sha = stack.pop();
      if (!bySha.has(sha) || onLine.has(sha) || viaMerge.has(sha)) continue;
      viaMerge.set(sha, m);
      stack.push(...bySha.get(sha).parentShas);
    }
  }
  const out = new Map();
  for (const c of commits) {
    const m = viaMerge.get(c.sha);
    out.set(c.sha, dated.get(c.sha)
      || (m ? { at: m.date, sha: m.sha, source: "merge" } : { at: head.date, sha: head.sha, source: "head" }));
  }
  return out;
}

// ---------- 4. Group commits by ticket ----------
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Ticket references in commit titles. Each pattern's first group is the ticket
// number. Default: "AB-123" anywhere, or "#9769 - …" at the start of the title.
export const defaultPatterns = (prefix) => [`\\b${escapeRe(prefix)}-(\\d+)\\b`, "^#(\\d+)\\b"];

// Commit title without the ticket references, e.g. "#9749 - PLP promo banner | blocks" → "PLP promo banner"
const cleanTitle = (subject, regexes) => regexes
  .reduce((s, re) => s.replace(re, ""), subject)
  .replace(/^[\s\-–—:|,&]+/, "")
  .split(" | ")[0]
  .trim();

export function groupCommits(commits, prefix, patterns = defaultPatterns(prefix), idFormat = null) {
  const regexes = patterns.map((p) => new RegExp(p, "gi"));
  const prRe = /\(#(\d+)\)/g;
  const tickets = new Map(); // "AB-123" -> { id, num, commits, prs:Set, commitTitle }
  const other = { commits: 0, prs: new Map(), subjects: [] }; // pr number -> commit count
  let total = 0;
  for (const c of commits) {
    if (c.merge) continue;
    total++;
    const nums = [...new Set(regexes.flatMap((re) => [...c.subject.matchAll(re)].map((m) => Number(m[1]))))];
    const prs = [...c.subject.matchAll(prRe)].map((m) => Number(m[1]));
    if (!nums.length) {
      other.commits++;
      other.subjects.push(c.subject);
      for (const n of prs) other.prs.set(n, (other.prs.get(n) || 0) + 1);
    }
    for (const num of nums) {
      const id = (idFormat || `${prefix.toUpperCase()}-{number}`).replace("{number}", num);
      const t = tickets.get(id) || { id, num, commits: 0, prs: new Set(), commitTitle: "" };
      t.commits++;
      // Commits are oldest first, so this is the first commit's title
      if (!t.commitTitle) t.commitTitle = cleanTitle(c.subject, regexes);
      prs.forEach((n) => t.prs.add(n));
      tickets.set(id, t);
    }
  }
  return { tickets: [...tickets.values()].sort((a, b) => a.num - b.num), other, total };
}

// ---------- 5. Notion helpers ----------
function makeNotion(request, cfg, token, dbId) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
  const call = (method, endpoint, body) => request(`${NOTION_API}/${endpoint}`, {
    method, headers, ...(body ? { body: JSON.stringify(body) } : {}),
  }, `Notion ${method} ${endpoint.split("?")[0]}`);
  const props = cfg.notion.properties;

  return {
    async findTicket(num) {
      const { results } = await call("POST", `databases/${dbId}/query`, {
        filter: { property: props.id, unique_id: { equals: num } },
        page_size: 1,
      });
      return results[0] ? readPage(results[0], props) : null;
    },
    async update(page, properties) {
      await call("PATCH", `pages/${page.id}`, { properties });
    },
    async comments(pageId) {
      const out = [];
      let cursor;
      do {
        const r = await call("GET", `comments?block_id=${pageId}&page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
        out.push(...r.results.map((c) => c.rich_text.map((t) => t.plain_text).join("")));
        cursor = r.has_more ? r.next_cursor : null;
      } while (cursor);
      return out;
    },
    async comment(pageId, richText) {
      await call("POST", "comments", { parent: { page_id: pageId }, rich_text: richText });
    },
  };
}

const optionNames = (p) => {
  if (!p) return [];
  if (p.type === "multi_select") return p.multi_select.map((o) => o.name);
  if (p.type === "select" || p.type === "status") return p[p.type] ? [p[p.type].name] : [];
  return [];
};

function readPage(page, props) {
  const need = (name) => {
    const p = page.properties[name];
    if (!p) throw new Error(`Notion property "${name}" not found. Check notion.properties in release.config.json`);
    return p;
  };
  const titleProp = Object.values(page.properties).find((p) => p.type === "title");
  const statusProp = need(props.status);
  // Optional: without it, live tags are skipped (one warning per run)
  const releasedProp = page.properties[props.releasedIn];
  if (releasedProp && releasedProp.type !== "multi_select") throw new Error(`"${props.releasedIn}" must be a multi-select property`);
  return {
    id: page.id,
    url: page.url,
    title: titleProp?.title.map((t) => t.plain_text).join("") || "(untitled)",
    status: optionNames(statusProp)[0] || "",
    statusType: statusProp.type,
    regions: props.region ? optionNames(need(props.region)) : [], // Region label (optional)
    // Optional: text written for this page. Empty or missing → the ticket title is used.
    releaseNote: props.releaseNote && page.properties[props.releaseNote]?.type === "rich_text"
      ? page.properties[props.releaseNote].rich_text.map((t) => t.plain_text).join("").trim() || null
      : null,
    releasedIn: releasedProp ? optionNames(releasedProp) : null,
  };
}

// ---------- 6. Status safety rules ----------
// Complete only from an allowed status, and only once every region in the
// ticket's Region label is in "Released in" (no Region label: first release).
export function decideStatus({ status, regions, releasedIn }, statuses) {
  if (status === statuses.complete) return { complete: false, attention: null, waitingFor: [] };
  if (!statuses.completeFrom.includes(status)) {
    return { complete: false, attention: `status is "${status || "empty"}", so it was not changed`, waitingFor: [] };
  }
  const waitingFor = regions.filter((r) => !releasedIn.includes(r));
  return { complete: waitingFor.length === 0, attention: null, waitingFor };
}

// Plain language for Latest updates (same rules as scripts/updates-style.test.mjs)
const DEV_TERMS = /\b(liquid|schema|css|scss|javascript|js|json|html|class(?:es)? name|refactor|commit|merge|pull request|PR #|bug ?fix|snippet|metafield key|custom\.[a-z_]+|data-[a-z-]+|z-index|div|selector|endpoint|api)\b/i;
const US_SPELLING = /\b(color|colors|center|centered|favorite|favorites|organize|organized|customize[sd]?|behavior|gray)\b/i;
export const isPlain = (s) => s.trim().split(/\s+/).length <= 12 && !/^you can\b/i.test(s) && !/[`<>]/.test(s)
  && !/\.(liquid|js|css|scss|json|html)\b/i.test(s) && !DEV_TERMS.test(s) && !US_SPELLING.test(s) && !/Ancient (and|&) Brave|\bA&B\b/.test(s);

// The js/updates.js rules: text is one short statement, the note starts with "Now"
export const isUpdateText = (t) => isPlain(t) && /[.!?]$/.test(t);
export const isUpdateNote = (n) => /^Now\b/.test(n) && n.trim().split(/\s+/).length <= 20 && /[.!?]$/.test(n)
  && !/[`<>]/.test(n) && !DEV_TERMS.test(n) && !US_SPELLING.test(n);

// What a theme file change means for people using the Theme editor:
// new settings ({ label, type }) and new blocks (names), or formatting only.
export function themeChange(patch) {
  const added = [], removed = [];
  for (const l of (patch || "").split("\n")) {
    if (l.startsWith("+") && !l.startsWith("+++")) added.push(l.slice(1));
    else if (l.startsWith("-") && !l.startsWith("---")) removed.push(l.slice(1));
  }
  // Code as it runs: no spaces, no Liquid comments, no leftover merge-conflict markers
  const squash = (lines) => lines.filter((l) => !/^(<{7}|={7}|>{7})/.test(l)).join("").replace(/\s+/g, "")
    .replace(/\{%-?comment-?%\}[\s\S]*?(\{%-?endcomment-?%\}|$)/g, "");
  const scan = (lines) => {
    const settings = [], blocks = [];
    let last = null, type = null;
    for (const l of lines) {
      for (const m of l.matchAll(/"(type|id|value|name|label|content)"\s*:\s*"([^"]*)"/g)) {
        const [, key, val] = m;
        if (key === "type") type = val;
        else if (key === "name" && last === "type") blocks.push(val);
        else if (key === "label" && last === "id") settings.push({ label: val, type });
        last = key;
      }
    }
    return { settings, blocks };
  };
  const now = scan(added), before = scan(removed);
  return {
    formattingOnly: added.length + removed.length > 0 && squash(added) === squash(removed),
    settings: now.settings.filter((x) => !before.settings.some((y) => y.label === x.label)),
    blocks: now.blocks.filter((b) => !before.blocks.includes(b)),
  };
}

// ---------- 7. Release tags in Notion ----------
// notion.releasedInLabel, e.g. "{region} live {date}" → "UK live 5 Nov 2026".
// Without it the tag is just the region name.
const shortDate = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
}).replace(/,/g, ""); // Notion option names can't contain commas
export const releaseTag = (cfg, region, ymd) => (cfg.notion.releasedInLabel || "{region}")
  .replace("{region}", region.notionName)
  .replace("{date}", shortDate(ymd));
export const isReleaseTag = (cfg, region, tag) => new RegExp(`^${escapeRe(cfg.notion.releasedInLabel || "{region}")
  .replace(escapeRe("{region}"), escapeRe(region.notionName))
  .replace(escapeRe("{date}"), ".+")}$`).test(tag);

// ---------- 8. Dates ----------
const dayIn = (date, timeZone) => new Intl.DateTimeFormat("en-CA", {
  timeZone, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(date));
const longDate = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

// ---------- 9. Run ----------
export async function run({
  root = ROOT,
  env = process.env,
  fetch = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = new Date(),
  log = console,
  rebuild = false,
} = {}) {
  const request = makeRequest({ fetch, sleep, log });
  // Notion is used only when both values are set and the database can actually be read
  let notionProblem = ["NOTION_TOKEN", "NOTION_DATABASE_ID"].filter((k) => !env[k]).map((k) => `missing ${k}`).join(", ");
  if (!notionProblem) {
    try {
      await request(`${NOTION_API}/databases/${env.NOTION_DATABASE_ID}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
        body: JSON.stringify({ page_size: 1 }),
      }, "Notion database check");
    } catch (e) {
      const why = (e.message.match(/"message":"([^"]+)"/) || [])[1] || e.message;
      notionProblem = `NOTION_DATABASE_ID can't be read as a database: ${why}`;
    }
  }
  const useNotion = !notionProblem;
  const cfg = loadConfig(root, { notion: useNotion });
  const dryRun = env.DRY_RUN === "1";
  // NOTION_READ_ONLY=1: read titles and links from Notion, but write nothing there (tags and comments stay owed)
  const notionReadOnly = env.NOTION_READ_ONLY === "1";
  const github = env.LOCAL_REPOS ? makeLocalGit(env.LOCAL_REPOS) : makeGitHub(request, env.RELEASE_REPOS_TOKEN);
  if (env.LOCAL_REPOS) log.log("LOCAL_REPOS set: reading local clones instead of GitHub.\n");
  const notion = useNotion ? makeNotion(request, cfg, env.NOTION_TOKEN, env.NOTION_DATABASE_ID) : null;
  const file = (rel) => path.join(root, rel);
  const siteUrl = /^https?:\/\//.test(cfg.docs.siteUrl || "") ? cfg.docs.siteUrl.replace(/\/$/, "") : null;
  const docsUrl = siteUrl && ((anchor) => `${siteUrl}/${cfg.docs.releasesPage}#${anchor}`);
  const prUrl = (n) => `https://github.com/${cfg.devRepo}/pull/${n}`;

  const report = { regions: [], attention: [], completed: [], waiting: [], untracked: [], warnings: [], errors: [], changed: [] };
  const warn = (msg) => { if (report.warnings.includes(msg)) return; log.warn(`⚠️  ${msg}`); report.warnings.push(msg); };
  if (!useNotion) {
    // Without Notion, ticket IDs stay plain text and "What changed" uses the commit title
    warn("Notion not configured: ticket links and titles come from commits");
    log.log(`   (${notionProblem})`);
    report.notionProblem = notionProblem;
  }
  if (dryRun) log.log("DRY RUN: nothing will be written to the repo or Notion.\n");

  function write(rel, content) {
    const target = file(rel);
    const before = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
    if (before === content) return false;
    report.changed.push(rel);
    if (dryRun) { log.log(`DRY RUN: would write ${rel}`); return true; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    log.log(`✅ Wrote ${rel}`);
    return true;
  }
  const json = (v) => JSON.stringify(v, null, 2) + "\n";

  const cutoff = dayIn(now - cfg.windowDays * 86_400_000, cfg.timeZone);
  const statePath = file(cfg.docs.stateFile);
  const state = !rebuild && fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : {};
  state.regions ||= {};

  // Every release and ticket ever seen, with per-region release dates. Never pruned.
  const storePath = file(cfg.docs.releasesData);
  const store = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : {};
  store.releases ||= [];
  store.tickets ||= {};
  store.liveCommits ||= {}; // sha → first date live in any region (for Latest updates; kept on --rebuild)
  const newlyLive = new Map(); // sha → { date, repo, ids } for commits live for the first time in this run
  const firstRelease = (t) => Object.values(t.releases).map((r) => r.date).sort()[0];

  // --rebuild: start the last windowDays again from scratch. Anything older stays,
  // so the archive keeps its history.
  if (rebuild) {
    log.log(`REBUILD: the last ${cfg.windowDays} days are worked out again from scratch.\n`);
    store.releases = store.releases.filter((r) => r.date < cutoff);
    store.tickets = Object.fromEntries(Object.entries(store.tickets)
      .filter(([, t]) => Object.values(t.releases).every((r) => r.date < cutoff)));
  }

  // Notion pages are cached for the run so a ticket released in two regions
  // in the same run sees the first region's tag.
  const pages = new Map();
  let commentsBlocked = false;
  async function ticketPage(id) {
    if (!pages.has(id)) pages.set(id, await notion.findTicket(Number(id.match(/\d+/g).pop())));
    return pages.get(id);
  }

  // Tag, comment and maybe complete one ticket for one region. Every step is skipped if already done.
  async function syncTicket(region, ticket, page) {
    if (notionReadOnly) {
      warn("NOTION_READ_ONLY=1: titles and links read from Notion; no tags, comments or status changes written. They'll be added on the next normal run.");
      return "pending";
    }
    const rel = ticket.releases[region.id];
    const props = cfg.notion.properties;
    const name = releaseTag(cfg, region, rel.date);
    const properties = {};
    const did = [];

    // One tag per region: a tag for this region with another date (e.g. a wrong
    // date from before a --rebuild) is replaced.
    if (page.releasedIn === null) {
      warn(`Notion property "${props.releasedIn}" not found: live tags skipped. Add a multi-select property called "${props.releasedIn}" to the Notion database.`);
    }
    const stale = (page.releasedIn || []).filter((n) => n !== name && isReleaseTag(cfg, region, n));
    if (page.releasedIn && (!page.releasedIn.includes(name) || stale.length)) {
      page.releasedIn = [...page.releasedIn.filter((n) => !stale.includes(n)), ...(page.releasedIn.includes(name) ? [] : [name])];
      properties[props.releasedIn] = { multi_select: page.releasedIn.map((n) => ({ name: n })) };
      did.push(stale.length ? `replace "${stale.join('", "')}" with "${name}"` : `add "${name}" to "${props.releasedIn}"`);
    }
    // Regions with at least one release tag, by their Region label name
    const releasedRegions = cfg.regions
      .filter((r) => (page.releasedIn || []).some((n) => isReleaseTag(cfg, r, n)))
      .map((r) => r.notionName);
    // notion.statuses.update: false → the script never changes Status
    const decision = cfg.notion.statuses.update === false
      ? { complete: false, attention: null, waitingFor: [] }
      : decideStatus({ ...page, releasedIn: releasedRegions }, cfg.notion.statuses);
    if (decision.complete) {
      properties[props.status] = { [page.statusType]: { name: cfg.notion.statuses.complete } };
      did.push(`set ${props.status} to ${cfg.notion.statuses.complete} (was ${page.status})`);
      report.completed.push(`${ticket.id} · ${page.title}`);
      page.status = cfg.notion.statuses.complete;
    }
    if (decision.attention) report.attention.push(`${ticket.id} · ${page.title} (${region.label}): ${decision.attention}`);
    if (decision.waitingFor.length) report.waiting.push(`${ticket.id} · ${page.title}: waiting for ${decision.waitingFor.join(", ")}`);

    if (Object.keys(properties).length) {
      if (dryRun) log.log(`DRY RUN: ${ticket.id} would ${did.join(", ")}`);
      else { await notion.update(page, properties); log.log(`🏷️  ${ticket.id}: ${did.join(", ")}`); }
    }

    // One short comment per region + release, found again by its key
    const key = `${region.label} release ${rel.sha.slice(0, 7)}`;
    // Without the "Released in" property the tag is still owed: stay pending so it's added once the property exists
    let result = page.releasedIn === null ? "pending" : "done";
    // No comment access (integration capabilities): one warning, comments stay owed
    if (commentsBlocked) return "pending";
    let existing;
    try { existing = await notion.comments(page.id); }
    catch (e) {
      if (!/ 403: /.test(e.message)) throw e;
      commentsBlocked = true;
      warn("The Notion integration can't read comments, so comments were skipped. In Notion, open Settings › Connections › A-B Docs releases › Capabilities and turn on Read comments and Insert comments.");
      return "pending";
    }
    if (existing.some((c) => c.includes(key))) return result;
    const text = (content, url) => ({ type: "text", text: { content, link: url ? { url } : null } });
    const rich = [text(`🚀 ${key} is live (${longDate(rel.date)}).`)];
    if (docsUrl) rich.push(text(" "), text("Release notes", docsUrl(`week-${weekStart(firstRelease(ticket))}`)));
    else warn("docs.siteUrl not set in release.config.json: Notion comments don't link to the docs page");
    for (const pr of ticket.prs) rich.push(text(" · "), text(`PR #${pr.number}`, pr.url));
    if (dryRun) log.log(`DRY RUN: ${ticket.id} would get comment "${rich.map((r) => r.text.content).join("")}"`);
    else { await notion.comment(page.id, rich); log.log(`💬 Commented on ${ticket.id}`); }
    return result;
  }

  // Marks the docs sections and tabs changed by commits that went live for the first
  // time in this run, and lists them under Latest updates. Existing entries are never changed.
  async function addDocUpdates() {
    const du = cfg.docUpdates;
    const cards = {}; // "page#card" → card title, from the docs pages
    for (const [page, p] of Object.entries(du.pages)) {
      cards[page] = p.title;
      for (const m of fs.readFileSync(file(p.file), "utf8").matchAll(/data-file="([^"]+)"[^>]*aria-label="([^":]+)/g)) cards[`${page}#${m[1]}`] = unescapeHtml(m[2]);
    }
    // Keys can use * as a wildcard, e.g. "snippets/cart-*.liquid"
    const patterns = Object.entries(du.map).map(([key, targets]) => [new RegExp(`^${key.split("*").map(escapeRe).join("[^/]*")}$`), targets]);
    const targetsFor = (filename) => {
      const direct = filename.match(/^sections\/(.+)\.liquid$/);
      const list = [...patterns.filter(([re]) => re.test(filename)).flatMap(([, t]) => t), ...(direct ? [`sections#${direct[1]}`] : [])];
      return [...new Set(list)].filter((t) => cards[t]);
    };
    let unplaced = null; // { date, guessed }: the newest real change that no docs page covers
    const items = new Map(); // target → { date, ids:Set, guessed }
    for (const [sha, c] of newlyLive) {
      let files = [];
      try { files = await github.files(c.repo, sha); }
      catch (e) { warn(`Latest updates: couldn't list the files of ${sha.slice(0, 7)}. ${e.message}`); continue; }
      for (const fl of files) {
        const change = themeChange(fl.patch);
        if (change.formattingOnly) continue; // only layout of the code changed: nothing for people to notice
        const targets = targetsFor(fl.filename);
        if (!targets.length) {
          const guessed = c.source === "head";
          // Prefer real dates; a guessed date only counts while there's nothing better
          if (!unplaced || (unplaced.guessed && !guessed) || (unplaced.guessed === guessed && c.date > unplaced.date)) unplaced = { date: c.date, guessed };
        }
        for (const t of targets) {
          const it = items.get(t) || { date: c.date, ids: new Set(), guessed: c.source === "head", settings: [], blocks: [] };
          if (c.date > it.date || (it.guessed && c.source !== "head")) { it.date = c.date; it.guessed = c.source === "head"; }
          c.ids.forEach((id) => it.ids.add(id));
          for (const x of change.settings) if (!it.settings.some((y) => y.label === x.label)) it.settings.push(x);
          for (const b of change.blocks) if (!it.blocks.includes(b)) it.blocks.push(b);
          items.set(t, it);
        }
      }
    }
    if (!items.size && !unplaced) { log.log("Latest updates: no docs sections or tabs changed."); return; }

    // Entry date: the release date. Dates guessed from the branch's newest commit only count if nothing better exists.
    const known = [...items.values()].filter((i) => !i.guessed);
    const date = (known.length ? known : [...items.values()]).map((i) => i.date).sort().pop() || unplaced.date;
    const releaseNote = (ids) => [...ids].sort().map((id) => store.tickets[id]?.releaseNote?.trim()).find(Boolean);
    const toItem = ([target, it]) => {
      const [page, section] = target.split("#");
      const p = du.pages[page];
      // The text people know the thing by: the docs card title, or the page itself
      const name = section ? cards[target] : p.pageName || p.title;
      const where = section ? `the ${name} ${p.noun || "section"}` : name;
      const options = [];
      // 1. A new block or setting, in the words people see in the Theme editor
      for (const b of it.blocks) options.push([`There's a new ${b} block in ${name}.`, `Now you can add a ${b} block to ${name} in the Theme editor.`]);
      for (const x of it.settings) {
        options.push(x.type === "checkbox"
          ? [`There's a new ${x.label} option in ${name}.`, `Now you can tick ${x.label} in the ${name} settings.`]
          : [`There's a new ${x.label} setting in ${name}.`, `Now you can set ${x.label} in the ${name} settings.`]);
      }
      // 2. Small changes with nothing new to set
      options.push([`Small fixes to ${where}.`, `Now ${where} has the latest fixes. Nothing changes in how you set it up.`]);
      // A Release note from Notion, when written, replaces the text
      const own = releaseNote(it.ids);
      if (own) options.unshift([/[.!?]$/.test(own) ? own : `${own}.`, options[0][1]]);
      const [text, note] = options.find(([t, n]) => isUpdateText(t) && isUpdateNote(n)) || options[options.length - 1];
      return { page, ...(section ? { section } : {}), text, note };
    };
    const newItems = [...items].map(toItem);
    // Everything else that went live: one line, pointing to the full list on Website releases
    if (unplaced && du.fallback) newItems.push({ page: du.fallback.page, text: du.fallback.text, note: du.fallback.note });
    if (!newItems.length) { log.log("Latest updates: nothing for people to notice."); return; }

    // Add to js/updates.js: into the newest entry if it has the same date, else as a new entry on top
    const src = fs.readFileSync(file(du.file), "utf8");
    const sandbox = { window: {} };
    vm.runInNewContext(src, sandbox);
    const top = (sandbox.window.DOC_UPDATES || [])[0];
    if (top && top.date > date) { warn(`Latest updates: js/updates.js already has a newer entry (${top.date}); nothing added for ${date}.`); return; }
    const q = (v) => `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    const fmt = (i) => [
      "      {",
      `        page: ${q(i.page)},`,
      ...(i.section ? [`        section: ${q(i.section)},`] : []),
      `        text: ${q(i.text)},`,
      `        note: ${q(i.note)},`,
      "      },",
    ].join("\n");
    let out;
    if (top && top.date === date) {
      const have = new Set(top.items.map((i) => `${i.page}#${i.section || ""}`));
      const add = newItems.filter((i) => !have.has(`${i.page}#${i.section || ""}`));
      if (!add.length) return;
      const at = src.indexOf("items: [", src.indexOf("window.DOC_UPDATES = [")) + "items: [".length;
      out = `${src.slice(0, at)}\n${add.map(fmt).join("\n")}${src.slice(at)}`;
      log.log(`Latest updates: ${add.length} items added to the ${date} entry.`);
    } else {
      const at = src.indexOf("window.DOC_UPDATES = [") + "window.DOC_UPDATES = [".length;
      const entry = [
        "  {",
        `    date: ${q(date)},`,
        "    // Added by scripts/weekly-release.mjs from dev main changes that went live. Edit the text freely.",
        "    items: [",
        newItems.map(fmt).join("\n"),
        "    ],",
        "  },",
      ].join("\n");
      out = `${src.slice(0, at)}\n${entry}${src.slice(at)}`;
      log.log(`Latest updates: new ${date} entry with ${newItems.length} items.`);
    }
    write(du.file, out);
  }

  // ---------- 9a. Each region: detect release, date each commit by its push ----------
  const ignoredActors = new Set(cfg.ignoreCommits?.authors || []);
  const ZERO = /^0+$/;
  const fmtAt = (at) => `${longDate(dayIn(at, cfg.timeZone))}`;
  for (const region of cfg.regions) {
    const result = { region: region.label, text: "" };
    report.regions.push(result);
    try {
      const head = await github.head(region.repo, region.branch);
      const last = state.regions[region.id];
      if (last?.sha === head.sha) { result.text = "No new release"; log.log(`${region.label}: no new release`); continue; }

      // Updates to the live branch since the last run (or in the last bootstrapDays)
      const sinceIso = last?.pushedAt || new Date(now - cfg.bootstrapDays * 86_400_000).toISOString();
      let events = [];
      try { events = await github.activity(region.repo, region.branch, sinceIso, Number(now)); }
      catch (e) { warn(`${region.label}: push history unavailable, so dates use the fallbacks. ${e.message}`); }
      events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)); // oldest first

      // Everything that reached the live branch in this range
      let commits;
      if (last?.sha) commits = await github.between(region.repo, last.sha, head.sha);
      else {
        const base = events.find((e) => !ZERO.test(e.before))?.before;
        commits = base ? await github.between(region.repo, base, head.sha) : await github.since(region.repo, region.branch, sinceIso);
      }
      const inRange = new Set([...commits.map((c) => c.sha), head.sha]);

      // Commits in each push. Force pushes and branch creation/deletion are skipped.
      const pushes = [];
      for (const e of events) {
        const type = e.activity_type;
        const when = `${type.replace(/_/g, " ")} on ${fmtAt(e.timestamp)} (${e.after.slice(0, 7)})`;
        if (!["push", "pr_merge", "merge_queue_merge"].includes(type) || ZERO.test(e.before) || ZERO.test(e.after)) {
          warn(`${region.label}: ignored ${when}. Its commits get a fallback date.`);
          continue;
        }
        if (ignoredActors.has(e.actor?.login)) continue; // theme editor saves
        if (!inRange.has(e.after)) continue; // already handled, or after HEAD was read
        try { pushes.push({ at: e.timestamp, sha: e.after, commits: await github.between(region.repo, e.before, e.after) }); }
        catch (err) { warn(`${region.label}: couldn't list the commits of ${when}. ${err.message}`); }
      }

      // Only theme editor saves since the last release: nothing to do. The state
      // stays where it was, so no commit is made either.
      const real = commits.filter((c) => !isIgnored(c, cfg.ignoreCommits));
      if (!real.length) {
        result.text = "No new release (only theme editor saves)";
        log.log(`${region.label}: ${result.text}`);
        continue;
      }

      const dates = assignDates(commits, pushes, head);
      for (const source of ["merge", "head"]) {
        const n = real.filter((c) => !c.merge && dates.get(c.sha).source === source).length;
        if (n) {
          warn(source === "merge"
            ? `${region.label}: ${n} commits weren't found in any push, so they're dated by the merge that brought them in.`
            : `${region.label}: ${n} commits weren't found in any push or merge, so they're dated by the live branch's newest commit (${fmtAt(head.date)}).`);
        }
      }

      // One delivery per push (or fallback), each with its own date
      const deliveries = new Map();
      for (const c of real) {
        const d = dates.get(c.sha);
        if (!deliveries.has(d.sha)) deliveries.set(d.sha, { ...d, date: dayIn(d.at, cfg.timeZone), commits: [] });
        deliveries.get(d.sha).commits.push(c);
        if (!c.merge && !store.liveCommits[c.sha]) {
          const date = dayIn(d.at, cfg.timeZone);
          const known = newlyLive.get(c.sha);
          if (!known || date < known.date) {
            const ids = groupCommits([c], cfg.ticketPrefix, cfg.ticketPatterns, cfg.ticketIdFormat).tickets.map((t) => t.id);
            newlyLive.set(c.sha, { date, repo: region.repo, ids, source: d.source });
          }
        }
      }
      const ordered = [...deliveries.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      const untracked = [];
      let ticketCount = 0;
      const seen = new Set();
      for (const d of ordered) {
        const { tickets, other, total } = groupCommits(d.commits, cfg.ticketPrefix, cfg.ticketPatterns, cfg.ticketIdFormat);
        untracked.push(...other.subjects);
        if (!total) continue;
        if (!store.releases.some((r) => r.region === region.id && r.sha === d.sha)) {
          store.releases.push({
            region: region.id,
            date: d.date,
            at: d.at,
            sha: d.sha,
            dateFrom: d.source,
            commits: total,
            commitsWithoutTicket: other.commits,
            tickets: tickets.map((t) => t.id),
          });
        }
        for (const t of tickets) {
          if (!seen.has(t.id)) { seen.add(t.id); ticketCount++; }
          let prs = [];
          try { prs = await github.prsFor(cfg.devRepo, t.id); }
          catch (e) { log.warn(`PR search failed for ${t.id}, using PR numbers from commits: ${e.message}`); }
          if (!prs.length) prs = [...t.prs].sort((a, b) => a - b).map((n) => ({ number: n, url: prUrl(n) }));

          const entry = store.tickets[t.id] ||= {
            id: t.id, title: null, releaseNote: null, notionUrl: null, regionLabel: null,
            commitTitle: t.commitTitle, prs: [], releases: {}, notion: {},
          };
          entry.commitTitle ||= t.commitTitle;
          for (const pr of prs) if (!entry.prs.some((p) => p.number === pr.number)) entry.prs.push(pr);
          // A ticket's date in a region is the earliest push with any of its commits
          const known = entry.releases[region.id];
          if (!known || d.date < known.date) {
            entry.releases[region.id] = { date: d.date, sha: d.sha, dateFrom: d.source };
            entry.notion[region.id] = "pending";
          }
        }
      }
      report.untracked.push({ region: region.label, subjects: untracked });

      const pushedAt = events.filter((e) => inRange.has(e.after)).map((e) => e.timestamp).sort().pop() || last?.pushedAt || null;
      state.regions[region.id] = { sha: head.sha, pushedAt, date: ordered[ordered.length - 1].date };

      const days = [...new Set(ordered.map((d) => longDate(d.date).replace(/ \d{4}$/, "")))];
      result.text = `New release · ${ticketCount} tickets · ${real.filter((c) => !c.merge).length} commits · live on ${days.join(", ")}`
        + (last ? "" : ` (first run: last ${cfg.bootstrapDays} days)`);
      log.log(`${region.label}: ${result.text}`);
    } catch (e) {
      result.text = `❌ ${e.message}`;
      report.errors.push(`${region.label}: ${e.message}`);
      log.error(`❌ ${region.label}: ${e.message}`);
    }
  }

  // ---------- 9b. Notion: refresh recent tickets, tag + comment new releases ----------
  // Recent tickets are read again on every run, so a Release note written after
  // the release still reaches the page. Failed updates stay pending and are retried.
  if (useNotion) {
    for (const t of Object.values(store.tickets)) {
      const pendingRegions = cfg.regions.filter((r) => t.notion[r.id] === "pending");
      if (!pendingRegions.length && firstRelease(t) < cutoff) continue;
      let page;
      try { page = await ticketPage(t.id); }
      catch (e) {
        report.errors.push(`${t.id}: Notion lookup failed, will retry next run. ${e.message}`);
        log.warn(`⚠️  ${t.id}: ${e.message}`);
        continue;
      }
      if (!page) {
        warn(`${t.id} not found in Notion`);
        pendingRegions.forEach((r) => { t.notion[r.id] = "missing"; });
        continue;
      }
      Object.assign(t, { title: page.title, releaseNote: page.releaseNote, notionUrl: page.url, regionLabel: page.regions });
      for (const region of pendingRegions) {
        try { t.notion[region.id] = await syncTicket(region, t, page); }
        catch (e) {
          report.errors.push(`${t.id} (${region.label}): Notion update failed, will retry next run. ${e.message}`);
          log.warn(`⚠️  ${t.id}: ${e.message}`);
        }
      }
    }
  }
  // ---------- 9b2. Latest updates (js/updates.js) from dev main changes that went live ----------
  if (cfg.docUpdates?.enabled && newlyLive.size) {
    try { await addDocUpdates(); }
    catch (e) { report.errors.push(`Latest updates: ${e.message}`); log.warn(`⚠️  Latest updates: ${e.message}`); }
  }
  for (const [sha, c] of newlyLive) store.liveCommits[sha] = c.date;
  write(cfg.docs.releasesData, json(store));

  // ---------- 9c. Docs: Website releases page data (last windowDays) ----------
  const regions = cfg.regions.map((r) => ({ id: r.id, label: r.label }));
  const publicTicket = (t) => ({
    id: t.id,
    text: t.releaseNote || t.title || t.commitTitle || t.id,
    ...(cfg.notion.linkTickets && t.notionUrl ? { url: t.notionUrl } : {}),
    firstRelease: firstRelease(t),
    releases: Object.fromEntries(Object.entries(t.releases).map(([id, r]) => [id, r.date])),
    // Region label as region ids; null when unknown or empty (then every region is expected)
    expected: t.regionLabel?.length
      ? cfg.regions.filter((r) => t.regionLabel.includes(r.notionName)).map((r) => r.id)
      : null,
  });
  const all = Object.values(store.tickets).map(publicTicket)
    .sort((a, b) => a.firstRelease.localeCompare(b.firstRelease) || a.id.localeCompare(b.id, "en", { numeric: true }));
  const header = (title, lines) => [
    "/* ==========================================================================",
    `   ${title} — made by scripts/weekly-release.mjs from ${cfg.docs.releasesData}.`,
    "   Don't edit by hand.",
    ...lines.map((l) => `   ${l}`),
    "   ========================================================================== */",
    "",
  ].join("\n");
  write(cfg.docs.dataFile, header("Website releases", [`Tickets first released in the last ${cfg.windowDays} days.`])
    + `window.DOC_RELEASES = ${JSON.stringify({ windowDays: cfg.windowDays, regions, tickets: all.filter((t) => t.firstRelease >= cutoff) }, null, 2)};\n`);

  // ---------- 9d. Docs: archive, one page per month (by first release) ----------
  const archiveDir = cfg.docs.archivePages;
  const base = "../".repeat(archiveDir.split("/").length);
  const monthName = (ym) => new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const months = [...new Set(all.map((t) => t.firstRelease.slice(0, 7)))].sort().reverse();
  const page = ({ id, title, lead, body }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<!-- Made by scripts/weekly-release.mjs from ${cfg.docs.releasesData}. Don't edit by hand. -->
<base href="${base}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>A+B Docs</title>
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="css/main.css">
<script src="js/updates.js" defer></script>
<script src="${cfg.docs.navFile}" defer></script>
<script src="js/image-edits.js" defer></script>
<script src="js/site.js" defer></script>
</head>
<body data-page="${id}" data-no-img-slots>

<main class="content" id="content">
  <header class="page-header">
    <h1>${escHtml(title)}</h1>
    <p class="lead">${escHtml(lead)}</p>
  </header>

  <div class="prose">
${body}
  </div>
</main>

</body>
</html>
`;
  for (const ym of months) {
    const label = `${monthName(ym)} ${ym.slice(0, 4)}`;
    write(`${archiveDir}/${ym}.html`, page({
      id: `releases-${ym}`,
      title: label,
      lead: `What went live on the website in each region in ${label}.`,
      body: renderReleases(all.filter((t) => t.firstRelease.startsWith(ym)), regions, "No releases this month."),
    }));
  }
  const years = [...new Set(months.map((m) => m.slice(0, 4)))];
  write(`${archiveDir}/index.html`, page({
    id: "releases-archive",
    title: "Archive",
    lead: "Every past website release, one page per month.",
    body: years.length
      ? years.map((y) => `    <h2 id="year-${y}">${y}</h2>
    <ul>
${months.filter((m) => m.startsWith(y)).map((m) => `      <li><a href="${archiveDir}/${m}.html">${monthName(m)}</a></li>`).join("\n")}
    </ul>`).join("\n\n")
      : `    <p class="muted">No releases yet.</p>`,
  }));
  // Nav + search: one entry per month, searchable by ticket ID and text
  write(cfg.docs.navFile, header("Website releases archive", ["Adds the monthly archive pages to the menu and search (see NAV in js/site.js)."])
    + `window.DOC_RELEASE_ARCHIVE = ${JSON.stringify(months.map((m) => ({
      month: m,
      title: `${monthName(m)} ${m.slice(0, 4)}`,
      href: `${archiveDir}/${m}.html`,
      keywords: all.filter((t) => t.firstRelease.startsWith(m)).map((t) => `${t.id} ${t.text}`).join(" "),
    })), null, 2)};\n`);

  // ---------- 9e. Save state ----------
  write(cfg.docs.stateFile, json({ regions: state.regions }));

  const released = report.regions.filter((r) => r.text.startsWith("New release"));
  const message = released.length
    ? `Website releases: ${cfg.regions.filter((r) => released.some((x) => x.region === r.label)).map((r) => `${r.label} ${state.regions[r.id].date}`).join(", ")}`
    : "Website releases: update list";
  return { changed: report.changed.length > 0, message, report, summary: summary(report, dryRun) };
}

// ---------- 10. Job summary ----------
export function summary(report, dryRun) {
  const list = (title, items) => (items.length ? `\n### ${title}\n\n${items.map((i) => `- ${i}`).join("\n")}\n` : "");
  const md1 = (s) => s.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
  let md = `## Website releases${dryRun ? " (dry run: nothing written)" : ""}\n\n| Region | Result |\n| --- | --- |\n`;
  md += report.regions.map((r) => `| ${r.region} | ${r.text.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`).join("\n") + "\n";
  md += list("Needs attention", report.attention);
  md += list("Set to Complete", report.completed);
  md += list("Waiting for other regions", report.waiting);
  const untracked = report.untracked.filter((u) => u.subjects.length);
  if (untracked.length) {
    md += "\n### Commits without a ticket\n\nNot shown on the docs page. Add a ticket ID (e.g. `#9769 - …`) to link them next time.\n";
    md += untracked.map((u) => `\n<details><summary>${u.region}: ${u.subjects.length} commits</summary>\n\n${u.subjects.map((s) => `- ${md1(s)}`).join("\n")}\n\n</details>\n`).join("");
  }
  md += list("Errors", report.errors);
  md += list("Warnings", report.warnings.map((w) => (w.startsWith("Notion not configured") && report.notionProblem ? `${w} (${report.notionProblem})` : w)));
  md += list(dryRun ? "Files that would change" : "Files changed", report.changed);
  return md;
}

// ---------- 11. CLI ----------
async function main() {
  let result;
  try {
    result = await run({ rebuild: process.argv.includes("--rebuild") });
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
  console.log(`\n${result.summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.summary);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${result.changed}\nmessage=${result.message}\n`);
  }
  if (result.report.errors.length) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
