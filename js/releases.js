/* ==========================================================================
   Website releases — weekly tables (What changed | UK | EU | US | Ticket)
   --------------------------------------------------------------------------
   One table per release week (Monday to Sunday), newest first, one row per
   ticket. A ticket sits in the week it first went live in any region.

   Used in two places, so both look the same:
     - in the browser: fills [data-releases] on the Website releases page from
       js/releases-data.js (last 14 days). Loads before js/site.js so the weeks
       show in "On this page".
     - by scripts/weekly-release.mjs: builds the monthly archive pages.

   Each ticket: { id, text, url, firstRelease, releases: { uk: 'YYYY-MM-DD' },
                  expected: ['uk', 'us'] (its Region label) or null (no label) }
   ========================================================================== */

(function (root) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const safeUrl = u => (/^https:\/\//.test(u || '') ? esc(u) : '');
  const day = ymd => new Date(ymd + 'T12:00:00Z');
  const fmt = (ymd, opts) => day(ymd).toLocaleDateString('en-GB', Object.assign({ timeZone: 'UTC' }, opts));
  const iso = d => d.toISOString().slice(0, 10);

  function addDays(ymd, n) {
    const d = day(ymd);
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
  }

  // Monday of the week, YYYY-MM-DD
  function weekStart(ymd) {
    return addDays(ymd, -((day(ymd).getUTCDay() + 6) % 7));
  }

  // "3–9 November 2026", "27 October – 2 November 2026", "29 December 2025 – 4 January 2026"
  function weekLabel(monday) {
    const sunday = addDays(monday, 6);
    const full = { day: 'numeric', month: 'long', year: 'numeric' };
    if (monday.slice(0, 4) !== sunday.slice(0, 4)) return `${fmt(monday, full)} – ${fmt(sunday, full)}`;
    if (monday.slice(0, 7) !== sunday.slice(0, 7)) return `${fmt(monday, { day: 'numeric', month: 'long' })} – ${fmt(sunday, full)}`;
    return `${day(monday).getUTCDate()}–${fmt(sunday, full)}`;
  }

  // One cell per region. A merged row is "Not yet" while any of its tickets
  // still has to go live there.
  function cell(tickets, region) {
    const live = tickets.map(t => t.releases[region.id]).filter(Boolean).sort();
    const waiting = tickets.some(t => !t.releases[region.id] && (!t.expected || t.expected.includes(region.id)));
    if (waiting) return '<span class="muted">Not yet</span>';
    if (live.length) return `✓ ${esc(fmt(live[live.length - 1], { day: 'numeric', month: 'short' }))}`;
    return '<span class="muted">—</span>';
  }

  // [{ monday, rows: [[ticket, …], …] }], newest week first. Tickets with the
  // same text in a week share a row.
  function weeks(tickets) {
    const byWeek = new Map();
    tickets
      .slice()
      .sort((a, b) => a.firstRelease.localeCompare(b.firstRelease) || a.id.localeCompare(b.id, 'en', { numeric: true }))
      .forEach(t => {
        const monday = weekStart(t.firstRelease);
        if (!byWeek.has(monday)) byWeek.set(monday, new Map());
        const rows = byWeek.get(monday);
        const key = t.text.trim().toLowerCase();
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(t);
      });
    return [...byWeek.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monday, rows]) => ({ monday, rows: [...rows.values()] }));
  }

  // "What changed" links to the Notion ticket; when tickets share a row, to the first one with a link
  function whatChanged(row) {
    const linked = row.find(t => safeUrl(t.url));
    return linked ? `<a href="${safeUrl(linked.url)}">${esc(row[0].text)}</a>` : esc(row[0].text);
  }

  function render(tickets, regions, emptyText) {
    const list = weeks(tickets);
    if (!list.length) return `<p class="muted">${esc(emptyText)}</p>`;
    return list.map(w => `
    <h2 id="week-${w.monday}">${esc(weekLabel(w.monday))}</h2>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>What changed</th>${regions.map(r => `<th>${esc(r.label)}</th>`).join('')}<th>Ticket</th></tr></thead>
        <tbody>
${w.rows.map(row => `          <tr><td>${whatChanged(row)}</td>${regions.map(r => `<td>${cell(row, r)}</td>`).join('')}<td>${row.map(t => esc(t.id)).join(', ')}</td></tr>`).join('\n')}
        </tbody>
      </table>
    </div>`).join('\n');
  }

  const api = { weekStart, weekLabel, weeks, render };
  root.ABReleases = api;
  if (typeof module === 'object' && module.exports) module.exports = api;

  // Website releases page: the last windowDays, by first release date
  if (typeof document === 'undefined') return;
  const box = document.querySelector('[data-releases]');
  if (!box) return;
  const data = root.DOC_RELEASES || { windowDays: 14, regions: [], tickets: [] };
  const cutoff = iso(new Date(Date.now() - data.windowDays * 86400000));
  box.innerHTML = render(
    data.tickets.filter(t => t.firstRelease >= cutoff),
    data.regions,
    `No releases in the last ${data.windowDays} days.`
  );
})(typeof window !== 'undefined' ? window : globalThis);
