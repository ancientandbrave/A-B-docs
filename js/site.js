/* ==========================================================================
   A+B Docs — shared site shell
   --------------------------------------------------------------------------
   Every page loads this script. It builds the topbar, sidebar, breadcrumbs,
   table of contents, prev/next links and search from the NAV list below.

   To add a page: copy _starter.html into its menu group's folder in pages/
   (site, shop, pdp, journal, reference or developers), then add one entry to
   NAV with that path as href, e.g. 'pages/shop/promos.html'. Nothing else needs
   updating.
   ========================================================================== */

(function () {
  'use strict';

  // Editing tools (and the Notes page) only appear on a local copy of the site
  // Add ?live to a local page's address to preview it as the live site
  const IS_LOCAL = (location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname))
    && !/[?&]live\b/.test(location.search);
  document.documentElement.classList.toggle('is-local', IS_LOCAL);

  // Guides sit in pages/<group>/ with <base href="../../">, so links and
  // assets resolve from the site root. "#…" links would then point at the
  // home page: keep them on this page instead.
  const here = suffix => location.pathname + (suffix.startsWith('#') ? location.search : '') + suffix;
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    location.hash = a.getAttribute('href'); // same as a normal "#" link
  });

  // ── Navigation (single source of truth) ────────────────────────────────────
  // `group` is optional — leave it empty for no sidebar heading.
  // `icon` is optional — use a key from ICONS.
  // `sidebar: false` keeps a page out of the left panel (it stays searchable).
  const NAV = [
    {
      group: '',
      items: [
        { id: 'home', title: 'Overview', sidebar: false, href: 'index.html', desc: 'What lives here and how to find your way around.', keywords: 'home start welcome' },
      ],
    },
    {
      group: 'Site',
      items: [
        { id: 'navigation', title: 'Navigation', icon: 'menu', href: 'pages/site/navigation.html', desc: 'Build the header menu tabs and override them for each market.', keywords: 'header menu mega menu dropdown mobile tab market country override' },
        { id: 'sections', title: 'Sections library', icon: 'stack', href: 'pages/site/sections.html', desc: 'Gallery of the sections you can add to a page.', keywords: 'sections gallery 50/50 carousel banner hero product cards video' },
        { id: 'image-sizes', title: 'Image sizes', icon: 'image', href: 'pages/site/image-sizes.html', desc: 'Desktop and mobile sizes for hero banners, video banners and article covers.', keywords: 'image size dimensions hero banner video cover desktop mobile' },
      ],
    },
    {
      group: 'Shop',
      items: [
        { id: 'promos', title: 'Promos & Products', icon: 'tag', href: 'pages/shop/promos.html', desc: 'Product page sections, free shipping bar, gift with purchase and cart add-ons.', keywords: 'promo product badge toggle subscription upsell bundle free gift cart banner' },
        { id: 'plp-banners', title: 'PLP banners', icon: 'layout', href: 'pages/shop/plp-banners.html', desc: 'Single and double banners in the collection grid.', keywords: 'collection plp banner single double grid tile' },
        { id: 'cart', title: 'Cart', icon: 'cart', href: 'pages/shop/cart.html', desc: 'Free delivery bar, spend rewards, free gift promotions and add-ons in the cart.', keywords: 'cart basket sidecart free delivery shipping bar progress checkpoint spend reward discount free gift chooser promotion gift with purchase add on cross sell' },
      ],
    },
    {
      group: 'PDP',
      items: [
        { id: 'pdp-subscriptions', title: 'Subscriptions', icon: 'repeat', href: 'pages/pdp/subscriptions.html', desc: 'Choose the "How subscriptions work" content and change the subscription message.', keywords: 'subscription subscribe save panel gifts message one-time offer' },
        { id: 'pdp-badges', title: 'Badges & Labels', icon: 'badge', href: 'pages/pdp/badges.html', desc: 'Add badges, ribbons, icons and messages to a product.', keywords: 'badge ribbon promo tag icon pill label' },
        { id: 'pdp-siblings', title: 'Sibling products', icon: 'siblings', href: 'pages/pdp/siblings.html', desc: 'Link product versions (tub, sachets…) with a switcher and pill.', keywords: 'siblings switcher pill tub sachets variants' },
        { id: 'pdp-more', title: 'More product options', icon: 'sliders', href: 'pages/pdp/more.html', desc: 'Pre-order, sold out, price per serving, product info sections and more.', keywords: 'preorder sold out back in stock servings price ingredients testimonials footprint minimal header' },
      ],
    },
    {
      group: 'Journal',
      items: [
        { id: 'new-article', title: 'Writing a new article', icon: 'pen', href: 'pages/journal/new-article.html', desc: 'Create an article, select the author, add At a glance and build with blocks.', keywords: 'blog article author at a glance blocks post' },
        { id: 'articles-by-tag', title: 'Articles by tag', icon: 'hash', href: 'pages/journal/articles-by-tag.html', desc: 'Show articles by tag on pages, under articles and in the menu.', keywords: 'blog tag tagged related articles filter' },
      ],
    },
    {
      group: 'Reference',
      items: [
        { id: 'metafields', title: 'Metafields', icon: 'database', href: 'pages/reference/metafields.html', desc: 'Every extra field the website uses, what it does and where it shows.', keywords: 'metafield metaobject custom data fields admin' },
      ],
    },
    {
      group: 'Developers',
      items: [
        { id: 'utilities', title: 'Utility classes', icon: 'grid', href: 'pages/developers/utilities.html', desc: 'Searchable reference of every A+B utility class, with CSS and copy buttons.', keywords: 'css classes flex spacing margin padding typography display responsive' },
        { id: 'notes', title: 'Notes', icon: 'alert', href: 'pages/developers/notes.html', desc: 'Settings that do nothing and other problems found in the theme.', keywords: 'bugs issues problems known broken does nothing' },
      ],
    },
    {
      group: 'Releases',
      items: [
        { id: 'website-releases', title: 'Website releases', icon: 'flag', href: 'pages/releases/website.html', desc: 'What went live in the UK, EU and US in the last 14 days.', keywords: 'release live deploy changelog tickets uk eu us region notion' },
        { id: 'releases-archive', title: 'Archive', icon: 'archive', href: 'pages/releases/archive/index.html', desc: 'Every past website release, one page per month.', keywords: 'release archive history past months older' },
        // One page per month, made by scripts/weekly-release.mjs (js/releases-nav.js).
        // Not in the left panel; searchable by ticket ID and what changed.
        ...(window.DOC_RELEASE_ARCHIVE || []).map(m => ({
          id: `releases-${m.month}`,
          title: m.title,
          sidebar: false,
          parent: 'releases-archive',
          crumbs: ['Releases', { label: 'Archive', href: 'pages/releases/archive/index.html' }, m.month.slice(0, 4), m.title.split(' ')[0]],
          href: m.href,
          desc: `Website releases in ${m.title}.`,
          keywords: `release archive ${m.keywords}`,
        })),
      ],
    },
  ];

  const LOGO_SRC = 'assets/logo.svg';

  // ── Helpers ────────────────────────────────────────────────────────────────
  if (!IS_LOCAL) NAV.forEach(g => { g.items = g.items.filter(p => p.id !== 'notes'); });
  if (!IS_LOCAL && document.body.dataset.page === 'notes') location.replace('index.html');
  const PAGES = NAV.flatMap(g => g.items.map(p => ({ ...p, group: g.group })));
  const body = document.body;
  const currentId = body.dataset.page;
  const current = PAGES.find(p => p.id === currentId);
  const content = document.querySelector('.content');

  // Latest release from js/updates.js: which pages and sections changed
  const LATEST = (window.DOC_UPDATES || [])[0] || null;
  const UPDATED_ITEMS = LATEST ? LATEST.items || [] : [];
  const UPDATED_PAGES = new Set(UPDATED_ITEMS.map(i => i.page));
  const UPDATED_HERE = new Set(UPDATED_ITEMS.filter(i => i.page === currentId && i.section).map(i => i.section));
  // "New" tag that knows which updates it belongs to (hover or click it for a note)
  const indexesFor = (pageId, section) => UPDATED_ITEMS
    .map((it, i) => (it.page === pageId && (section === undefined || (it.section || null) === section) ? i : -1))
    .filter(i => i >= 0);
  // "New" only for a new section; anything else is "Updated"
  const tagLabel = idx => (idx.some(i => (UPDATED_ITEMS[i] || {}).type === 'new') ? 'New' : 'Updated');
  const pill = idx => (idx.length
    ? `<span class="updated-pill" role="button" tabindex="0" data-updates="${idx.join(',')}" aria-label="${tagLabel(idx)}. Show what changed">${tagLabel(idx)}</span>`
    : '');

  // Link to an update: #update=<n> scrolls to it and opens its note
  function updateHref(pageId, index) {
    const page = PAGES.find(p => p.id === pageId);
    if (!page) return '#';
    const i = index != null ? index : UPDATED_ITEMS.findIndex(it => it.page === pageId);
    return `${page.href}#update=${i}`;
  }

  const ICONS = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg class="icon-close" viewBox="0 0 17 17" width="17" height="17" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="nonzero" d="M14.342.45c-1.756 2.552-3.852 4.948-5.939 7.269l-.73-.815C6.58 5.688 5.45 4.43 4.587 3.358c-.705-.877-1.006-1.4-1.459-2.19-.121-.211-.252-.439-.402-.695l-.27-.456L.096 2.381l.405.28c2.502 1.721 4.853 3.77 7.131 5.815-2.278 2.046-4.629 4.094-7.13 5.815l-.406.28 2.363 2.363.269-.456c.15-.254.279-.48.4-.69.454-.793.755-1.316 1.46-2.193.865-1.075 1.997-2.335 3.091-3.554.245-.272.487-.541.725-.808 2.087 2.32 4.183 4.717 5.94 7.268l.279.407 2.363-2.364-.456-.268c-.255-.15-.482-.28-.692-.4-.792-.455-1.315-.756-2.192-1.46-1.072-.863-2.33-1.994-3.547-3.086-.322-.29-.64-.574-.953-.854.311-.278.627-.56.947-.849 1.219-1.094 2.48-2.226 3.554-3.09.877-.707 1.4-1.007 2.192-1.46.21-.122.437-.252.69-.4l.457-.27L14.622.044l-.28.406z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
  };

  Object.assign(ICONS, {
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/></svg>',
    archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.5"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16"/></svg>',
    database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    badge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/></svg>',
    siblings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="6" width="8" height="12" rx="1.5"/><rect x="13" y="6" width="8" height="12" rx="1.5"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    stack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
    layout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="8" height="6" rx="1.5"/><rect x="13" y="14" width="8" height="6" rx="1.5"/></svg>',
  });

  const iconFor = p => (p.icon && ICONS[p.icon]) || '';

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function slugify(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(text).split(new RegExp('(' + pattern + ')', 'gi'))
      .map((part, i) => (i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part)))
      .join('');
  }

  // Clipboard with a fallback for file:// and non-secure origins
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      ok ? resolve() : reject(new Error('Copy failed'));
    });
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toastEl = el(`<div class="toast" role="status" aria-live="polite">${ICONS.check}<span></span></div>`);
  let toastTimer;
  function toast(msg) {
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1800);
  }

  // ── Topbar ─────────────────────────────────────────────────────────────────
  const skipLink = el('<a class="skip-link" href="#content">Skip to content</a>');

  const topbar = el(`
    <header class="topbar">
      <button class="topbar__menu" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">${ICONS.menu}</button>
      <a class="topbar__logo" href="index.html" aria-label="Ancient + Brave — Overview">
        <img src="${LOGO_SRC}" alt="Ancient + Brave" width="180" height="20">
      </a>
      <button class="topbar__search" type="button" data-open-search aria-label="Search documentation">
        ${ICONS.search}<span>Search docs…</span>
      </button>
    </header>`);

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const sidebar = el(`
    <nav class="sidebar" id="sidebar" aria-label="Documentation">
      ${NAV.map(g => ({ ...g, items: g.items.filter(p => p.sidebar !== false) }))
        .filter(g => g.items.length)
        .map(g => `
        <div class="sidebar__group">
          ${g.group ? `<p class="sidebar__heading">${esc(g.group)}</p>` : ''}
          <ul>
            ${g.items.map(p => {
              const active = p.id === currentId || (current && current.parent === p.id);
              const upd = UPDATED_PAGES.has(p.id);
              const dot = upd ? `<span class="updated-dot" role="link" tabindex="0" data-href="${esc(updateHref(p.id))}" title="Go to what changed" aria-label="Go to what changed in ${esc(p.title)}"></span>` : '';
              return `<li><a class="sidebar__link${active ? ' is-active' : ''}${upd ? ' is-updated' : ''}" href="${p.href}"${active ? ' aria-current="page"' : ''}>${iconFor(p)}${esc(p.title)}${dot}</a></li>`;
            }).join('')}
          </ul>
        </div>`).join('')}
    </nav>`);

  // Clicking the dot goes straight to what changed on that page
  sidebar.querySelectorAll('.updated-dot').forEach(dot => {
    const go = e => {
      e.preventDefault();
      e.stopPropagation();
      const target = new URL(dot.dataset.href, document.baseURI);
      if (target.pathname === location.pathname && target.hash) {
        location.hash = target.hash;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } else {
        location.href = dot.dataset.href;
      }
    };
    dot.addEventListener('click', go);
    dot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(e); });
  });

  const overlay = el('<div class="nav-overlay" aria-hidden="true"></div>');
  const menuBtn = topbar.querySelector('.topbar__menu');

  function setNav(open) {
    body.classList.toggle('nav-open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    menuBtn.innerHTML = open ? ICONS.close : ICONS.menu;
  }
  menuBtn.addEventListener('click', () => setNav(!body.classList.contains('nav-open')));
  overlay.addEventListener('click', () => setNav(false));

  // ── Assemble the shell ─────────────────────────────────────────────────────
  const shell = el('<div class="shell"></div>');
  content.id = content.id || 'content';
  content.before(shell);
  shell.append(sidebar, content);
  body.prepend(skipLink, topbar);
  body.append(overlay, toastEl);

  // Every tab is called "A+B Docs"
  document.title = 'A+B Docs';

  // ── Latest updates: list on the Overview ──────────────────────────────────
  // Also shows the newest website release from js/releases-data.js (made by
  // scripts/weekly-release.mjs): one row per ticket, linking to Website releases.
  function latestWebsiteRelease() {
    const data = window.DOC_RELEASES;
    const page = PAGES.find(p => p.id === 'website-releases');
    if (!data || !page || !data.tickets) return null;
    const dates = data.tickets.flatMap(t => Object.values(t.releases)).sort();
    return dates.length ? { date: dates[dates.length - 1], page } : null;
  }

  document.querySelectorAll('[data-updates]').forEach(box => {
    const web = latestWebsiteRelease();
    const releasesPage = PAGES.find(p => p.id === 'website-releases');
    const showGuide = Boolean(LATEST && UPDATED_ITEMS.length);
    if (!web && !showGuide) { box.remove(); return; }
    // The newest date of a website release or a guide update; it links to Website releases
    const newest = [web && web.date, showGuide && LATEST.date].filter(Boolean).sort().pop();
    const date = new Date(newest + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const title = showGuide && LATEST.date === newest && LATEST.title ? ` · ${esc(LATEST.title)}` : '';
    const dateHtml = releasesPage
      ? `<span class="updates__date"><a class="updates__date" href="${releasesPage.href}" title="See what went live on the website">${esc(date)}</a>${title}</span>`
      : `<span class="updates__date">${esc(date)}${title}</span>`;
    box.innerHTML = `
      <div class="updates__head">
        <h2>Latest updates</h2>
        ${dateHtml}
      </div>
      <ul class="updates__list">
        ${(showGuide ? UPDATED_ITEMS : []).map((item, i) => {
          const page = PAGES.find(p => p.id === item.page);
          if (!page) return '';
          return `<li><a class="updates__item" href="${updateHref(item.page, i)}">
            <span class="updates__page">${iconFor(page)}${esc(page.title)}</span>
            <span class="updates__text">${esc(item.text)}</span>
            <span class="updates__arrow">${ICONS.arrow}</span>
          </a></li>`;
        }).join('')}
      </ul>`;
  });


  // ── Latest updates: mark updated cards and headings on this page ──────────
  if (UPDATED_ITEMS.some(i => i.page === currentId && !i.section)) {
    const h1 = content.querySelector('.page-header h1, .hero__title');
    if (h1) {
      h1.classList.add('is-updated');
      h1.insertAdjacentHTML('beforeend', pill(indexesFor(currentId, null)));
    }
  }
  UPDATED_HERE.forEach(id => {
    const card = content.querySelector(`.section-card[data-file="${CSS.escape(id)}"]`);
    if (card) {
      card.classList.add('is-updated');
      card.insertAdjacentHTML('afterbegin', pill(indexesFor(currentId, id)));
    }
    const heading = document.getElementById(id);
    if (heading && /^H[23]$/.test(heading.tagName)) {
      heading.classList.add('is-updated');
      heading.insertAdjacentHTML('beforeend', pill(indexesFor(currentId, id)));
    }
  });

  // ── Page search beside the first heading ──────────────────────────────────
  // Puts the page's own search box in one row with the first h2, so it sits
  // opposite the heading and never overlaps the content.
  const pageSearch = content.querySelector('.gallery-search');
  const firstH2 = content.querySelector('.prose h2');
  if (pageSearch && firstH2) {
    const row = el('<div class="heading-row"></div>');
    firstH2.before(row);
    row.append(firstH2, pageSearch);
  }

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  // `crumbs` on a NAV item gives a longer trail (strings, or { label, href } links)
  if (current && current.group && !content.hasAttribute('data-no-breadcrumb')) {
    const crumbs = current.crumbs || [current.group, current.title];
    content.prepend(el(`
      <ol class="breadcrumb" aria-label="Breadcrumb">
        ${crumbs.map((c, i) => {
          if (i === crumbs.length - 1) return `<li><span aria-current="page">${esc(c.label || c)}</span></li>`;
          return c.href ? `<li><a href="${c.href}">${esc(c.label)}</a></li>` : `<li>${esc(c)}</li>`;
        }).join('')}
      </ol>`));
  }

  // ── Home: page cards built from NAV ────────────────────────────────────────
  document.querySelectorAll('[data-nav-cards]').forEach(grid => {
    grid.innerHTML = PAGES.filter(p => p.id !== 'home' && !p.parent).map(p => `
      <a class="card${UPDATED_PAGES.has(p.id) ? ' is-updated' : ''}" href="${UPDATED_PAGES.has(p.id) ? updateHref(p.id) : p.href}">
        ${UPDATED_PAGES.has(p.id) ? pill(indexesFor(p.id)) : ''}
        <span class="card__title">${iconFor(p)}${esc(p.title)}</span>
        <span class="card__desc">${esc(p.desc)}</span>
        <span class="card__arrow">${ICONS.arrow}</span>
      </a>`).join('');
  });

  // ── Headings: ids + copy-link anchors ──────────────────────────────────────
  const headings = [...content.querySelectorAll('.prose h2, .prose h3')];
  const usedIds = new Set();
  headings.forEach(h => {
    let id = h.id || slugify(h.textContent);
    while (usedIds.has(id) || (!h.id && document.getElementById(id))) id += '-1';
    usedIds.add(id);
    h.id = id;

    const anchor = el(`<a class="heading-anchor" href="#${id}" aria-label="Copy link to “${esc(h.textContent)}”">#</a>`);
    anchor.addEventListener('click', e => {
      e.preventDefault();
      history.replaceState(null, '', here('#' + id));
      h.scrollIntoView({ behavior: 'smooth' });
      copy(location.href).then(() => toast('Link copied'), () => {});
    });
    h.append(anchor);
  });

  // ── Image slots (temporary) ────────────────────────────────────────────────
  // A "+" placeholder closes every h2 section, and any <figure data-img="…">
  // in a page becomes one too. Save an image at the path it shows
  // (assets/images/<page>/<name>.png, .jpg or .webp) and it appears instead.
  const IMG_EXTS = ['jpg', 'png', 'webp'];
  const MAX_IMAGES = 8; // per slot: name.jpg, name-2.jpg … name-8.jpg

  // Images added with "+" are kept in this browser only (IndexedDB) until
  // the file is saved at the path shown and published with the site.
  const imgStore = (() => {
    let dbp;
    const db = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('ab-docs-images', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('images');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const run = (mode, fn) => db().then(d => new Promise((res, rej) => {
      const t = d.transaction('images', mode);
      const req = fn(t.objectStore('images'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    }));
    return {
      all: () => db().then(d => new Promise(res => {
        const out = [];
        const req = d.transaction('images').objectStore('images').openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (!c) return res(out);
          out.push([c.key, c.value]);
          c.continue();
        };
        req.onerror = () => res(out);
      })).catch(() => []),
      get: k => run('readonly', s => s.get(k)).catch(() => null),
      set: (k, v) => run('readwrite', s => s.put(v, k)),
      del: k => run('readwrite', s => s.delete(k)),
    };
  })();

  // Short fingerprint of an image's data URL (length + FNV-1a), matched
  // against window.IMAGE_IMPORTED; scripts/import-images.mjs uses the same
  function fingerprint(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return s.length + ':' + h.toString(16);
  }

  function probe(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  // Finds name.jpg, then name-2.jpg, name-3.jpg… until one is missing
  async function findRepoImages(base) {
    const found = [];
    for (let n = 1; n <= MAX_IMAGES; n++) {
      const stem = n === 1 ? base : `${base}-${n}`;
      let hit = null;
      for (const ext of IMG_EXTS) {
        if (await probe(`${stem}.${ext}`)) { hit = `${stem}.${ext}`; break; }
      }
      if (!hit) break;
      found.push(hit);
    }
    return found;
  }

  // Crossfading image slider with dots.
  // Options: autoplay (zoom view), arrows (prev/next buttons),
  // large (use the high-quality copy in assets/images/large/ when there is one)
  function buildSlider(images, { alt = '', interval = 3500, lazy = true, autoplay = false, arrows = false, large = false, start: startAt = 0 } = {}) {
    const el = document.createElement('div');
    el.className = 'img-slider' + (arrows ? ' img-slider--arrows' : '');
    const many = images.length > 1;
    const bigSrc = src => (large && src.startsWith('assets/images/') ? src.replace('assets/images/', 'assets/images/large/') + '?v=3' : src);
    el.innerHTML = '<div class="img-slider__frame">' + images.map((src, i) =>
      `<img class="img-slider__img${i ? '' : ' is-active'}" src="${esc(bigSrc(src))}" data-fallback="${esc(src)}" alt="${esc(alt)}${many ? ` (${i + 1} of ${images.length})` : ''}" loading="${lazy ? 'lazy' : 'eager'}" decoding="async">`).join('')
      + (many && arrows ? `
        <button type="button" class="img-slider__arrow img-slider__arrow--prev" aria-label="Previous image">‹</button>
        <button type="button" class="img-slider__arrow img-slider__arrow--next" aria-label="Next image">›</button>` : '')
      + '</div>'
      + (many ? `<div class="img-slider__dots">${images.map((_, i) =>
        `<button type="button" class="img-slider__dot${i ? '' : ' is-active'}" aria-label="Show image ${i + 1}"></button>`).join('')}</div>` : '');

    // No large copy? Fall back to the normal image
    el.querySelectorAll('.img-slider__img').forEach(img => {
      img.addEventListener('error', () => {
        if (img.src !== new URL(img.dataset.fallback, document.baseURI).href) img.src = img.dataset.fallback;
      }, { once: true });
    });

    const imgs = el.querySelectorAll('.img-slider__img');
    const dots = el.querySelectorAll('.img-slider__dot');

    // Loading shimmer until the image showing has loaded
    const frameEl = el.querySelector('.img-slider__frame');
    const markLoading = () => {
      const img = imgs[index];
      const loading = img && !(img.complete && img.naturalWidth);
      frameEl.classList.toggle('is-loading', !!loading);
      if (loading) {
        const done = () => { if (imgs[index] === img) frameEl.classList.remove('is-loading'); };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    };
    el.addEventListener('slidechange', markLoading);
    let index = 0;
    let timer;
    const go = i => {
      index = (i + imgs.length) % imgs.length;
      imgs.forEach((im, n) => im.classList.toggle('is-active', n === index));
      dots.forEach((d, n) => d.classList.toggle('is-active', n === index));
      el.dispatchEvent(new CustomEvent('slidechange', { detail: index }));
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stop = () => clearInterval(timer);
    const start = () => { stop(); if (autoplay && many && !reduce) timer = setInterval(() => go(index + 1), interval); };
    const step = d => { go(index + d); start(); };

    dots.forEach((d, i) => d.addEventListener('click', e => { e.stopPropagation(); go(i); start(); }));
    el.querySelectorAll('.img-slider__arrow').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      step(btn.classList.contains('img-slider__arrow--prev') ? -1 : 1);
    }));
    el.addEventListener('mouseenter', stop);
    el.addEventListener('mouseleave', start);
    if (startAt) go(startAt);
    markLoading();
    start();

    el.current = () => index;
    el.go = i => { go(i); start(); };
    el.images = images;
    el.next = () => step(1);
    el.prev = () => step(-1);
    el.count = imgs.length;
    el.stop = stop;
    return el;
  }

  // Shows a box layer the way its image shows: at once if the image is already
  // fully visible, otherwise fading in alongside it
  function showWithImage(layer, img, cls, remove = false) {
    const instant = getComputedStyle(img).opacity === '1';
    if (instant) layer.style.transition = 'none';
    layer.classList.toggle(cls, !remove);
    if (instant) { void layer.offsetWidth; layer.style.transition = ''; }
  }

  // Where the visible picture sits inside its frame (works for cover and contain)
  function imageArea(img, frame) {
    if (!img || !img.naturalWidth || !frame) return null;
    const fr = frame.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    const c = getComputedStyle(img);
    const scale = (c.objectFit === 'cover' ? Math.max : Math.min)(ir.width / img.naturalWidth, ir.height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const [px, py] = c.objectPosition.split(' ').map(v => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5));
    return { left: ir.left - fr.left + (ir.width - w) * px, top: ir.top - fr.top + (ir.height - h) * py, width: w, height: h };
  }

  // Light veil over the frame with a clear hole for each box (boxes in % of the picture)
  function veilSvg(id, area, boxes, fw, fh) {
    if (!boxes.length) return '';
    const holes = boxes.map(b => `<rect x="${area.left + (b.x / 100) * area.width}" y="${area.top + (b.y / 100) * area.height}" width="${(b.w / 100) * area.width}" height="${(b.h / 100) * area.height}" fill="black"/>`).join('');
    return `<svg class="img-editor__mask" viewBox="0 0 ${fw} ${fh}" preserveAspectRatio="none" aria-hidden="true">
      <defs><mask id="${id}"><rect width="${fw}" height="${fh}" fill="white"/>${holes}</mask></defs>
      <rect width="${fw}" height="${fh}" fill="#fff" fill-opacity="0.55" mask="url(#${id})"/></svg>`;
  }

  function fillSlot(slot) {
    const key = slot.dataset.img;
    const base = 'assets/images/' + key;
    const label = slot.dataset.label || '';
    const tag = slot.dataset.caption ? `<span class="img-slot__tag">${esc(slot.dataset.caption)}</span>` : '';
    slot.classList.add('img-slot');
    slot.images = [];

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.hidden = true;

    // Per slot, this browser keeps: images added with "+", saved images hidden
    // with "×", the image order, and boxes drawn on images (in % of the image)
    const saved = (window.IMAGE_EDITS || {})[key] || {};
    const imported = (window.IMAGE_IMPORTED || {})[key] || {};
    // The live site only ever shows what's saved with the site: it never reads
    // or writes this browser's edits
    const getState = () => (IS_LOCAL ? imgStore.get(key) : Promise.resolve(null)).then(v => {
      const st = typeof v === 'string' ? { added: [v] } : (v || {});
      // Images this browser added that are now saved with the site: use the
      // saved file (keeping its place and boxes) and drop the browser copy
      // (and follow saved images renamed or deleted since; null = deleted)
      const rename = {};
      (st.added || []).forEach(src => { const to = imported[fingerprint(src)]; if (to) rename[src] = to; });
      const renamed = window.IMAGE_RENAMED || {};
      const refs = [...(st.order || []), ...(st.hidden || []), ...Object.keys(st.boxes || {})];
      refs.forEach(src => { if (src in renamed) rename[src] = renamed[src]; });
      if (Object.keys(rename).length) {
        const to = src => (src in rename ? rename[src] : src);
        st.added = (st.added || []).filter(src => !(src in rename));
        st.order = [...new Set((st.order || []).map(to).filter(Boolean))];
        st.hidden = (st.hidden || []).map(to).filter(Boolean);
        st.boxes = Object.fromEntries(Object.entries(st.boxes || {}).map(([src, list]) => [to(src), list]).filter(([src]) => src));
        setState({ added: st.added, hidden: st.hidden, order: st.order, boxes: st.boxes });
      }
      return {
        added: st.added || [],
        hidden: [...new Set([...(saved.hidden || []), ...(st.hidden || [])])],
        order: (st.order && st.order.length ? st.order : saved.order) || [],
        boxes: { ...(saved.boxes || {}), ...(st.boxes || {}) },
      };
    });
    const setState = st => (!IS_LOCAL ? Promise.resolve() : st.added.length || st.hidden.length || st.order.length || Object.keys(st.boxes).length
      ? imgStore.set(key, st) : imgStore.del(key));
    const readFiles = files => Promise.all([...files].map(f => new Promise(res => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(f);
    })));

    const stopClick = fn => e => { e.stopPropagation(); fn(e); };

    function showEmpty() {
      slot.classList.remove('has-image', 'is-loading');
      if (!IS_LOCAL) {
        slot.innerHTML = '';
        slot.classList.add('img-slot--empty');
        if (!slot.closest('.section-card')) slot.hidden = true;
        return;
      }
      slot.innerHTML = `${tag}
        <button class="img-slot__add" type="button" aria-label="Add image">+</button>
        <button class="img-slot__path" type="button" title="Copy file path: ${esc(base)}.jpg">${esc(key.split('/').pop())}.jpg</button>`;
      slot.append(input);
      slot.querySelector('.img-slot__add').onclick = stopClick(() => input.click());
      slot.querySelector('.img-slot__path').onclick = stopClick(() => copy(base + '.jpg').then(() => toast('File path copied')));
    }

    // Boxes drawn in the editor also show on the normal image (read-only).
    // Each image has its own layer that fades in and out with it, and only
    // once the image has loaded, so boxes and image always appear together.
    let viewSlider = null;
    let viewList = [];
    const viewMask = 'view-mask-' + Math.random().toString(36).slice(2);
    function drawViewBoxes() {
      if (!viewSlider) return;
      const slider = viewSlider;
      const frame = slider.querySelector('.img-slider__frame');
      const i = slider.current();
      const img = slider.querySelectorAll('.img-slider__img')[i];
      frame.querySelectorAll('.img-view-boxes').forEach(l => l.classList.toggle('is-active', +l.dataset.i === i));
      getState().then(st => {
        if (slider !== viewSlider) return;
        const boxes = st.boxes[viewList[i]] || [];
        let layer = frame.querySelector(`.img-view-boxes[data-i="${i}"]`);
        if (!boxes.length) { if (layer) layer.remove(); return; }
        if (!layer) {
          layer = document.createElement('div');
          layer.className = 'img-editor__layer img-view-boxes';
          layer.dataset.i = i;
          frame.append(layer);
        }
        layer.classList.toggle('is-active', slider.current() === i);
        const place = () => {
          const a = imageArea(img, frame);
          if (!a) return;
          layer.innerHTML = veilSvg(`${viewMask}-${i}`, a, boxes, frame.clientWidth, frame.clientHeight)
            + `<div class="img-editor__area" style="left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px">${boxes.map(b =>
              `<div class="img-box img-box--view" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%"></div>`).join('')}</div>`;
          showWithImage(layer, img, 'is-ready');
        };
        img.complete && img.naturalWidth ? place() : img.addEventListener('load', place, { once: true });
      });
    }
    window.addEventListener('resize', () => drawViewBoxes());

    function showImages(list, st) {
      slot.classList.remove('is-loading');
      slot.classList.add('has-image');
      slot.innerHTML = tag;
      const slider = buildSlider(list.map(i => i.src), { alt: label });
      slot.prepend(slider);
      viewSlider = slider;
      viewList = list.map(i => i.src);
      slider.addEventListener('slidechange', drawViewBoxes);
      drawViewBoxes();
      if (!IS_LOCAL) return; // add / remove only on a local copy
      slot.insertAdjacentHTML('beforeend', `
        <div class="img-slot__actions">
          <button class="img-slot__btn" type="button" data-act="add" aria-label="Add another image" title="Add another image">+</button>
          <button class="img-slot__btn img-slot__btn--remove" type="button" data-act="remove" aria-label="Remove this image" title="Remove this image">${ICONS.close}</button>
        </div>`);
      slot.append(input);
      slot.querySelector('[data-act="add"]').onclick = stopClick(() => input.click());
      slot.querySelector('[data-act="remove"]').onclick = stopClick(() => {
        const item = list[slider.current()];
        if (item.local) st.added.splice(st.added.indexOf(item.src), 1);
        else st.hidden.push(item.src);
        setState(st).then(render);
      });
    }

    // Used by the "+" here and by the editor in the zoom views
    slot.api = {
      add(files) {
        if (!files.length) return Promise.resolve();
        return readFiles(files).then(urls => getState().then(st => {
          st.added.push(...urls);
          return setState(st);
        })).then(() => {
          render();
          toast(files.length > 1 ? `${files.length} images added in this browser` : 'Image added in this browser');
        });
      },
      remove(src) {
        return getState().then(st => {
          const i = st.added.indexOf(src);
          if (i >= 0) st.added.splice(i, 1);      // added in this browser: delete it
          else st.hidden.push(src);               // saved on the site: hide it here
          delete st.boxes[src];
          st.order = st.order.filter(x => x !== src);
          return setState(st);
        }).then(render);
      },
      reorder(srcs) {
        return getState().then(st => { st.order = srcs; return setState(st); }).then(render);
      },
      boxes(src) {
        return getState().then(st => st.boxes[src] || []);
      },
      setBoxes(src, list) {
        return getState().then(st => {
          st.boxes[src] = list; // an empty list also overrides boxes saved for everyone
          return setState(st);
        }).then(drawViewBoxes);
      },
    };

    input.addEventListener('change', () => {
      const files = [...input.files];
      input.value = '';
      slot.api.add(files);
    });

    function render() {
      Promise.all([getState(), findRepoImages(base)]).then(([st, repo]) => {
        const list = [
          ...repo.filter(src => !st.hidden.includes(src)).map(src => ({ src })),
          ...st.added.map(src => ({ src, local: true })),
        ];
        // Saved order first; anything new goes at the end
        const pos = src => { const i = st.order.indexOf(src); return i < 0 ? 1e6 : i; };
        list.sort((a, b) => pos(a.src) - pos(b.src));
        slot.images = list.map(i => i.src);
        slot.dispatchEvent(new CustomEvent('slotchange', { bubbles: true }));
        list.length ? showImages(list, st) : showEmpty();
      });
    }

    // Loading until we know whether this slot has images (no "+" flash)
    slot.classList.add('img-slot', 'is-loading');
    slot.innerHTML = '<span class="img-loader" aria-label="Loading"></span>';
    render();
  }

  // ── Image editor (zoom views) ─────────────────────────────────────────────
  // Large slider + a bar to reorder images (drag the thumbnails), add images,
  // and draw boxes on an image that can be moved, resized and deleted.
  // Everything is saved per slot in this browser (see slot.api).
  function buildEditor(slot, { start = 0, alt = '' } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'img-editor';
    const listeners = new AbortController();
    const fileInput = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    fileInput.addEventListener('change', () => {
      const files = [...fileInput.files];
      fileInput.value = '';
      slot.api.add(files);
    });

    let index = start;
    let slider = null;
    let layer = null;
    let boxes = [];
    let boxesFor = null; // the image whose boxes are loaded

    const currentSrc = () => (slot.images || [])[index];

    // The layer covers the whole image frame (so the veil does too); the boxes
    // sit in an inner area that matches the visible picture
    let area = { left: 0, top: 0, width: 0, height: 0 };
    function placeLayer() {
      if (!slider || !layer) return;
      const frame = slider.querySelector('.img-slider__frame');
      const img = slider.querySelectorAll('.img-slider__img')[index];
      const innerEl = layer.querySelector('.img-editor__area');
      // Until the image has loaded its size is unknown: hide boxes rather than misplace them
      if (!frame || !img || !img.naturalWidth) {
        if (innerEl) innerEl.style.visibility = 'hidden';
        return;
      }
      if (innerEl) innerEl.style.visibility = '';
      // Show the boxes with their image, once both are ready
      if (boxesFor === currentSrc() && layer.classList.contains('is-hidden')) showWithImage(layer, img, 'is-hidden', true);
      area = imageArea(img, frame);
      const inner = layer.querySelector('.img-editor__area');
      if (inner) Object.assign(inner.style, { left: `${area.left}px`, top: `${area.top}px`, width: `${area.width}px`, height: `${area.height}px` });
      drawMask();
    }

    // Light veil over the whole image, with a clear hole for each box
    const maskId = 'box-mask-' + Math.random().toString(36).slice(2);
    function drawMask() {
      if (!layer) return;
      const svg = layer.querySelector('.img-editor__mask');
      if (!svg) return;
      const fw = layer.clientWidth;
      const fh = layer.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${fw} ${fh}`);
      svg.innerHTML = `
        <defs><mask id="${maskId}"><rect width="${fw}" height="${fh}" fill="white"/>${boxes.map(b =>
          `<rect x="${area.left + (b.x / 100) * area.width}" y="${area.top + (b.y / 100) * area.height}" width="${(b.w / 100) * area.width}" height="${(b.h / 100) * area.height}" fill="black"/>`).join('')}</mask></defs>
        <rect width="${fw}" height="${fh}" fill="#fff" fill-opacity="0.55" mask="url(#${maskId})"/>`;
      svg.style.display = boxes.length ? '' : 'none';
    }

    function renderBoxes() {
      if (!layer) return;
      layer.innerHTML = `<svg class="img-editor__mask" preserveAspectRatio="none" aria-hidden="true"></svg>
        <div class="img-editor__area">${boxes.map((b, i) => (IS_LOCAL ? `
        <div class="img-box" data-i="${i}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%">
          <button class="img-box__del" type="button" aria-label="Delete box">${ICONS.close}</button>
          <span class="img-box__handle" aria-hidden="true"></span>
        </div>` : `<div class="img-box img-box--view" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%"></div>`)).join('')}</div>`;
      placeLayer();
    }

    function loadBoxes() {
      const src = currentSrc();
      if (!src) return;
      boxes = [];
      boxesFor = null;
      if (layer) layer.classList.add('is-hidden'); // the last image's boxes go with it
      renderBoxes();
      slot.api.boxes(src).then(list => {
        if (src !== currentSrc()) return; // moved on to another image meanwhile
        boxes = list.map(b => ({ ...b }));
        boxesFor = src;
        renderBoxes();
        requestAnimationFrame(placeLayer);
      });
    }

    const saveBoxes = () => { const src = currentSrc(); if (src) slot.api.setBoxes(src, boxes); };

    function enableBoxes() {
      // While the pointer is on a box, hide the editor bar so it never blocks it
      layer.addEventListener('pointerover', e => { if (e.target.closest('.img-box')) wrap.classList.add('is-on-box'); });
      layer.addEventListener('pointerout', e => {
        if (e.target.closest('.img-box') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.img-box'))) {
          if (!wrap.classList.contains('is-dragging')) wrap.classList.remove('is-on-box');
        }
      });
      // Move with the box, resize with the corner handle (values in % of the image)
      layer.addEventListener('pointerdown', e => {
        const box = e.target.closest('.img-box');
        if (!box || e.target.closest('.img-box__del')) return;
        e.preventDefault();
        e.stopPropagation();
        const b = boxes[+box.dataset.i];
        const resize = !!e.target.closest('.img-box__handle');
        const lr = layer.querySelector('.img-editor__area').getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const orig = { ...b };
        box.setPointerCapture(e.pointerId);
        wrap.classList.add('is-dragging', 'is-on-box');
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const move = ev => {
          const dx = ((ev.clientX - startX) / lr.width) * 100;
          const dy = ((ev.clientY - startY) / lr.height) * 100;
          if (resize) {
            b.w = clamp(orig.w + dx, 3, 100 - b.x);
            b.h = clamp(orig.h + dy, 3, 100 - b.y);
          } else {
            b.x = clamp(orig.x + dx, 0, 100 - b.w);
            b.y = clamp(orig.y + dy, 0, 100 - b.h);
          }
          Object.assign(box.style, { left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` });
          drawMask();
        };
        const up = () => {
          box.removeEventListener('pointermove', move);
          box.removeEventListener('pointerup', up);
          wrap.classList.remove('is-dragging', 'is-on-box');
          saveBoxes();
        };
        box.addEventListener('pointermove', move);
        box.addEventListener('pointerup', up);
      });
      layer.addEventListener('click', e => {
        const del = e.target.closest('.img-box__del');
        e.stopPropagation();
        if (!del) return;
        boxes.splice(+del.closest('.img-box').dataset.i, 1);
        renderBoxes();
        saveBoxes();
      });
    }

    function draw() {
      const images = slot.images || [];
      index = Math.max(0, Math.min(index, images.length - 1));
      wrap.innerHTML = '';
      slider = null;
      layer = null;

      if (images.length) {
        slider = buildSlider(images, { alt, lazy: false, arrows: true, large: true, start: index });
        layer = document.createElement('div');
        layer.className = 'img-editor__layer is-hidden';
        slider.querySelector('.img-slider__frame').append(layer);
        wrap.append(slider);
        if (IS_LOCAL) enableBoxes();
        slider.addEventListener('slidechange', e => {
          index = e.detail;
          wrap.querySelectorAll('.img-editor__thumb').forEach((t, i) => t.classList.toggle('is-active', i === index));
          loadBoxes();
        });
        slider.querySelectorAll('.img-slider__img').forEach(img => {
          img.addEventListener('load', placeLayer);
          img.addEventListener('click', e => e.stopPropagation()); // already zoomed in: no further zoom
        });
        loadBoxes();
      } else {
        wrap.insertAdjacentHTML('beforeend', '<p class="img-editor__empty">No image yet.</p>');
      }

      setTimeout(placeLayer, 50);
      if (!IS_LOCAL) return; // the editing bar only shows on a local copy

      const barHost = slider ? slider.querySelector('.img-slider__frame') : wrap;
      barHost.insertAdjacentHTML('beforeend', `
        <div class="img-editor__bar${slider ? ' img-editor__bar--over' : ''}">
          <div class="img-editor__thumbs">${images.map((src, i) => `
            <span class="img-editor__thumb-wrap">
              <button class="img-editor__thumb${i === index ? ' is-active' : ''}" type="button" draggable="true" data-src="${esc(src)}" aria-label="Image ${i + 1}. Drag to reorder" title="Drag to reorder">
                <img src="${esc(src)}" alt="" draggable="false">
              </button>
              <button class="img-editor__thumb-remove" type="button" data-remove="${esc(src)}" aria-label="Remove image ${i + 1}" title="Remove image">${ICONS.close}</button>
            </span>`).join('')}</div>
          <button class="img-editor__btn" type="button" data-act="add">+ Add image</button>
          ${images.length ? '<button class="img-editor__btn" type="button" data-act="box">Add box</button>' : ''}
          ${images.length ? '<button class="img-editor__btn img-editor__btn--remove" type="button" data-act="remove">Remove image</button>' : ''}
        </div>`);
      wrap.append(fileInput);

      wrap.querySelector('[data-act="add"]').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
      const boxBtn = wrap.querySelector('[data-act="box"]');
      if (boxBtn) boxBtn.addEventListener('click', e => {
        e.stopPropagation();
        boxes.push({ x: 35, y: 35, w: 30, h: 30 });
        renderBoxes();
        placeLayer();
        saveBoxes();
      });

      // Remove the image showing, or any image from its thumbnail
      const removeImage = src => {
        if (!src || !window.confirm('Remove this image?')) return;
        slot.api.remove(src).then(() => toast('Image removed'));
      };
      const removeBtn = wrap.querySelector('[data-act="remove"]');
      if (removeBtn) removeBtn.addEventListener('click', e => { e.stopPropagation(); removeImage(currentSrc()); });
      wrap.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); removeImage(b.dataset.remove); }));

      // Thumbnails: click to show, drag to reorder
      const strip = wrap.querySelector('.img-editor__thumbs');
      let dragged = null;
      strip.querySelectorAll('.img-editor__thumb').forEach((t, i) => {
        t.addEventListener('click', e => { e.stopPropagation(); if (slider) slider.go(i); });
        t.addEventListener('dragstart', e => { dragged = t.parentElement; t.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; });
        t.addEventListener('dragend', () => {
          t.classList.remove('is-dragging');
          const order = [...strip.querySelectorAll('.img-editor__thumb')].map(x => x.dataset.src);
          index = order.indexOf(currentSrc());
          dragged = null;
          slot.api.reorder(order);
        });
      });
      strip.addEventListener('dragover', e => {
        if (!dragged) return;
        e.preventDefault();
        const over = e.target.closest('.img-editor__thumb-wrap');
        if (!over || over === dragged) return;
        const r = over.getBoundingClientRect();
        (e.clientX - r.left > r.width / 2) ? over.after(dragged) : over.before(dragged);
      });

      setTimeout(placeLayer, 50);
    }

    slot.addEventListener('slotchange', draw, { signal: listeners.signal });
    window.addEventListener('resize', placeLayer, { signal: listeners.signal });
    draw();

    wrap.next = () => slider && slider.next();
    wrap.prev = () => slider && slider.prev();
    wrap.count = () => (slot.images || []).length;
    wrap.destroy = () => listeners.abort();
    return wrap;
  }

  if (currentId && !body.hasAttribute('data-no-img-slots')) {
    content.querySelectorAll('.prose h2').forEach(h => {
      const slot = document.createElement('figure');
      slot.dataset.img = currentId + '/' + h.id;
      slot.dataset.label = h.firstChild.textContent.trim();
      let end = h.nextElementSibling;
      while (end && end.tagName !== 'H2') end = end.nextElementSibling;
      end ? end.before(slot) : h.parentElement.append(slot);
    });
  }
  content.querySelectorAll('figure[data-img]').forEach(fillSlot);

  // ── Export edits (local copy only) ────────────────────────────────────────
  // Downloads js/image-edits.js (order, hidden images, boxes) plus any images
  // added with "+", named so `npm run import-images` puts them in place.
  if (IS_LOCAL) {
    const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const exportBtn = el('<button class="export-edits" type="button" hidden>Export edits</button>');
    body.append(exportBtn);
    imgStore.all().then(entries => { exportBtn.hidden = !entries.length; });
    document.addEventListener('slotchange', () => imgStore.all().then(entries => { exportBtn.hidden = !entries.length; }));

    exportBtn.addEventListener('click', async () => {
      const out = JSON.parse(JSON.stringify(window.IMAGE_EDITS || {}));
      const files = [];
      for (const [key, value] of await imgStore.all()) {
        const st = typeof value === 'string' ? { added: [value] } : (value || {});
        const base = 'assets/images/' + key;
        let n = (await findRepoImages(base)).length;
        const rename = {};
        for (const url of st.added || []) {
          n++;
          const ext = EXT[(url.match(/^data:([^;]+)/) || [])[1]] || 'jpg';
          const suffix = n > 1 ? '-' + n : '';
          rename[url] = `${base}${suffix}.${ext}`;
          files.push({ name: `${key.replace(/\//g, '__')}${suffix}.${ext}`, href: url });
        }
        const to = src => rename[src] || src;
        const cur = out[key] || {};
        const hidden = [...new Set([...(cur.hidden || []), ...(st.hidden || [])])];
        const order = (st.order && st.order.length ? st.order : cur.order || []).map(to);
        const boxes = { ...(cur.boxes || {}) };
        Object.entries(st.boxes || {}).forEach(([src, list]) => { if (list.length) boxes[to(src)] = list; else delete boxes[to(src)]; });
        const entry = {};
        if (hidden.length) entry.hidden = hidden;
        if (order.length) entry.order = order;
        if (Object.keys(boxes).length) entry.boxes = boxes;
        if (Object.keys(entry).length) out[key] = entry; else delete out[key];
      }
      // One file with everything (browsers block several downloads at once)
      const bundle = {
        exported: new Date().toISOString(),
        edits: out,
        images: files.map(f => ({ path: 'assets/images/' + f.name.replace(/__/g, '/'), data: f.href })),
      };
      const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ab-docs-edits.json';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast(`Exported ${files.length} image${files.length === 1 ? '' : 's'} and all boxes in ab-docs-edits.json`);
    });
  }

  // ── Image zoom ─────────────────────────────────────────────────────────────
  // Click any image in a slot to see it large. Cards that open their own
  // details view (Sections library, Navigation blocks) are left to card-zoom.js.
  const lightbox = el(`
    <div class="lightbox" role="dialog" aria-modal="true" aria-label="Image" hidden>
      <div class="lightbox__backdrop"></div>
      <div class="lightbox__stage"></div>
      <button class="lightbox__close" type="button" aria-label="Close">${ICONS.close}</button>
    </div>`);
  body.append(lightbox);
  const stage = lightbox.querySelector('.lightbox__stage');
  let lightboxSlider = null;
  let lightboxFrom = null;

  function openLightbox(slot) {
    const images = slot.images || [];
    if (!images.length) return;
    const shown = slot.querySelector('.img-slider');
    lightboxFrom = document.activeElement;
    lightboxSlider = buildEditor(slot, {
      alt: slot.dataset.label || '',
      start: shown && shown.current ? shown.current() : 0,
    });
    stage.replaceChildren(lightboxSlider);
    lightbox.hidden = false;
    body.classList.add('palette-open');
    stage.tabIndex = -1;
    stage.focus({ preventScroll: true });
  }

  function closeLightbox() {
    if (lightboxSlider) lightboxSlider.destroy();
    lightbox.hidden = true;
    stage.replaceChildren();
    body.classList.remove('palette-open');
    if (lightboxFrom) lightboxFrom.focus();
  }

  content.addEventListener('click', e => {
    const img = e.target.closest('.img-slot .img-slider__img');
    if (!img || img.closest('.section-card[data-file]')) return;
    openLightbox(img.closest('.img-slot'));
  });
  lightbox.querySelector('.lightbox__backdrop').addEventListener('click', closeLightbox);
  lightbox.querySelector('.lightbox__close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') { e.preventDefault(); lightboxSlider.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); lightboxSlider.prev(); }
  });


  // ── Table of contents ──────────────────────────────────────────────────────
  // Block cards (compact galleries) are listed under their section heading
  function tocCards(h) {
    if (h.tagName !== 'H2') return '';
    const cards = [];
    for (let el = h.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) {
      if (el.matches('.section-gallery--compact')) cards.push(...el.querySelectorAll('.section-card[data-file]'));
    }
    return cards.map(card => {
      card.id = card.id || 'card-' + card.dataset.file;
      const name = card.querySelector('.section-card__title').textContent;
      return `<li><a class="toc__link toc__link--sub" href="#${card.id}">${esc(name)}</a></li>`;
    }).join('');
  }

  if (!body.classList.contains('no-toc') && headings.length >= 2) {
    const toc = el(`
      <aside class="toc" aria-label="On this page">
        <p class="toc__title">On this page</p>
        <ul>
          ${headings.map(h => `<li><a class="toc__link${h.tagName === 'H3' ? ' toc__link--sub' : ''}" href="#${h.id}">${esc(h.firstChild.textContent.trim())}</a></li>${tocCards(h)}`).join('')}
        </ul>
      </aside>`);
    shell.append(toc);

    // Mark what changed in the latest release in "On this page"
    UPDATED_HERE.forEach(id => {
      let link = toc.querySelector(`a[href="#${CSS.escape(id)}"], a[href="#card-${CSS.escape(id)}"]`);
      if (!link) {
        // A section card: mark its group heading
        const card = content.querySelector(`.section-card[data-file="${CSS.escape(id)}"]`);
        let el = card && card.closest('.section-gallery');
        while (el && el.tagName !== 'H2' && !el.matches('.heading-row')) el = el.previousElementSibling;
        const h2 = el && (el.matches('.heading-row') ? el.querySelector('h2') : el);
        link = h2 && toc.querySelector(`a[href="#${CSS.escape(h2.id)}"]`);
      }
      if (link) {
        link.classList.add('toc__link--updated');
        link.dataset.tag = tagLabel(indexesFor(currentId, id));
      }
    });

    const links = new Map([...toc.querySelectorAll('a')].map(a => [a.getAttribute('href').slice(1), a]));
    const setActive = id => links.forEach((a, key) => a.classList.toggle('is-active', key === id));
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting);
      if (visible.length) setActive(visible[0].target.id);
    }, { rootMargin: '-80px 0px -70% 0px' });
    headings.forEach(h => observer.observe(h));
  } else {
    body.classList.add('no-toc');
  }

  // ── Code blocks: label + copy button ───────────────────────────────────────
  content.querySelectorAll('pre > code').forEach(code => {
    const pre = code.parentElement;
    if (pre.closest('.code-block')) return;
    const lang = (code.className.match(/language-(\w+)/) || [])[1] || 'code';
    const block = el(`
      <div class="code-block">
        <div class="code-block__bar"><span>${esc(lang)}</span>
          <button class="copy-btn" type="button">${ICONS.copy}<span>Copy</span></button>
        </div>
      </div>`);
    pre.before(block);
    block.append(pre);

    const btn = block.querySelector('.copy-btn');
    btn.addEventListener('click', () => {
      copy(code.textContent).then(() => {
        btn.classList.add('is-copied');
        btn.querySelector('span').textContent = 'Copied';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          btn.querySelector('span').textContent = 'Copy';
        }, 1600);
      });
    });
  });

  // ── Prev / next ────────────────────────────────────────────────────────────
  const index = PAGES.indexOf(current);
  if (current && !content.hasAttribute('data-no-pager')) {
    const prev = PAGES[index - 1];
    const next = PAGES[index + 1];
    if (prev || next) {
      content.append(el(`
        <nav class="pager" aria-label="Previous and next page">
          ${prev ? `<a class="pager__link" href="${prev.href}"><span class="pager__label">← Previous</span><span class="pager__title">${esc(prev.title)}</span></a>` : ''}
          ${next ? `<a class="pager__link pager__link--next" href="${next.href}"><span class="pager__label">Next →</span><span class="pager__title">${esc(next.title)}</span></a>` : ''}
        </nav>`));
    }
  }

  // ── Search palette ─────────────────────────────────────────────────────────
  const palette = el(`
    <div class="palette" role="dialog" aria-modal="true" aria-label="Search documentation" hidden>
      <div class="palette__backdrop"></div>
      <div class="palette__panel">
        <div class="palette__field">
          ${ICONS.search}
          <input type="search" placeholder="Search pages and sections…" aria-label="Search documentation" aria-controls="palette-results" autocomplete="off" spellcheck="false">
          <button class="palette__close" type="button" aria-label="Close">${ICONS.close}</button>
        </div>
        <ul class="palette__results" id="palette-results" role="listbox"></ul>
      </div>
    </div>`);
  body.append(palette);

  const paletteInput = palette.querySelector('input');
  const paletteList = palette.querySelector('.palette__results');
  let results = [];
  let activeIndex = 0;
  let lastFocus = null;

  // Searchable entries: all pages + the sections of the current page
  const ENTRIES = [
    ...PAGES.map(p => ({ title: p.title, desc: p.desc, group: 'Pages', href: p.href, haystack: [p.title, p.desc, p.group, p.keywords].join(' ').toLowerCase() })),
    ...headings.map(h => {
      const title = h.firstChild.textContent.trim();
      return { title, desc: current ? current.title : '', group: 'On this page', href: '#' + h.id, haystack: title.toLowerCase() };
    }),
  ];

  function search(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return ENTRIES.filter(e => e.group === 'Pages');
    return ENTRIES
      .filter(e => terms.every(t => e.haystack.includes(t)))
      .map(e => {
        const t = e.title.toLowerCase();
        const score = t.startsWith(terms[0]) ? 0 : t.includes(terms[0]) ? 1 : 2;
        return { e, score };
      })
      .sort((a, b) => a.score - b.score)
      .map(r => r.e);
  }

  function renderPalette() {
    const q = paletteInput.value.trim();
    results = search(q);
    activeIndex = 0;
    if (!results.length) {
      paletteList.innerHTML = `<li class="palette__empty">No results for “${esc(q)}”</li>`;
      return;
    }
    let lastGroup = '';
    paletteList.innerHTML = results.map((r, i) => {
      const groupHead = r.group !== lastGroup ? `<li class="palette__group" role="presentation">${esc(r.group)}</li>` : '';
      lastGroup = r.group;
      return `${groupHead}<li role="option" id="palette-opt-${i}">
        <a class="palette__item${i === 0 ? ' is-active' : ''}" href="${r.href}" data-index="${i}" tabindex="-1">
          <span class="palette__title">${highlight(r.title, q)}</span>
          ${r.desc ? `<span class="palette__desc">${highlight(r.desc, q)}</span>` : ''}
        </a></li>`;
    }).join('');
    paletteInput.setAttribute('aria-activedescendant', 'palette-opt-0');
  }

  function setActiveResult(i) {
    const items = paletteList.querySelectorAll('.palette__item');
    if (!items.length) return;
    activeIndex = (i + items.length) % items.length;
    items.forEach((it, n) => it.classList.toggle('is-active', n === activeIndex));
    items[activeIndex].scrollIntoView({ block: 'nearest' });
    paletteInput.setAttribute('aria-activedescendant', 'palette-opt-' + activeIndex);
  }

  function openPalette() {
    lastFocus = document.activeElement;
    palette.hidden = false;
    body.classList.add('palette-open');
    paletteInput.value = '';
    renderPalette();
    paletteInput.focus();
  }

  function closePalette() {
    palette.hidden = true;
    body.classList.remove('palette-open');
    if (lastFocus) lastFocus.focus();
  }

  function go(entry) {
    closePalette();
    if (entry.href.startsWith('#')) {
      document.getElementById(entry.href.slice(1)).scrollIntoView({ behavior: 'smooth' });
      history.replaceState(null, '', here(entry.href));
    } else {
      location.href = entry.href;
    }
  }

  paletteInput.addEventListener('input', renderPalette);
  paletteInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveResult(activeIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveResult(activeIndex - 1); }
    else if (e.key === 'Enter' && results[activeIndex]) { e.preventDefault(); go(results[activeIndex]); }
  });
  paletteList.addEventListener('click', e => {
    const item = e.target.closest('.palette__item');
    if (!item) return;
    e.preventDefault();
    go(results[+item.dataset.index]);
  });
  paletteList.addEventListener('mousemove', e => {
    const item = e.target.closest('.palette__item');
    if (item && +item.dataset.index !== activeIndex) setActiveResult(+item.dataset.index);
  });
  palette.querySelector('.palette__backdrop').addEventListener('click', closePalette);
  palette.querySelector('.palette__close').addEventListener('click', closePalette);
  document.querySelectorAll('[data-open-search]').forEach(b => b.addEventListener('click', openPalette));

  // ── Global shortcuts ───────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.hidden ? openPalette() : closePalette();
    } else if (e.key === 'Escape') {
      if (!palette.hidden) closePalette();
      else if (body.classList.contains('nav-open')) setNav(false);
    } else if (e.key === '/' && !typing && palette.hidden) {
      // "/" focuses the page's own search if it has one, otherwise opens the palette
      e.preventDefault();
      const pageSearch = document.querySelector('[data-page-search]');
      pageSearch ? pageSearch.focus() : openPalette();
    }
  });

  // ── Update note ────────────────────────────────────────────────────────────
  // Hover a "New" tag to see what changed; click it to keep the note open.
  // Links like page.html#update=<n> scroll to the update and open its note.
  let noteEl = null;
  let notePinned = false;
  let noteFor = null;

  function closeNote() {
    if (noteEl) noteEl.remove();
    noteEl = null;
    noteFor = null;
    notePinned = false;
    document.querySelectorAll('.is-update-target').forEach(el => el.classList.remove('is-update-target'));
  }

  function placeNote(anchor) {
    if (!noteEl) return;
    const r = anchor.getBoundingClientRect();
    const w = noteEl.offsetWidth;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    noteEl.style.top = `${r.bottom + window.scrollY + 10}px`;
    noteEl.style.left = `${left + window.scrollX}px`;
    noteEl.style.setProperty('--arrow-x', `${r.left + r.width / 2 - left}px`);
  }

  function openNote(anchor, items, pinned) {
    if (noteEl && noteFor === anchor) {
      if (pinned) notePinned = true;
      return;
    }
    closeNote();
    noteFor = anchor;
    notePinned = !!pinned;
    noteEl = el(`
      <div class="update-note" role="dialog" aria-label="What's new">
        <button class="update-note__close" type="button" aria-label="Close">${ICONS.close}</button>
        <ul class="update-note__list">${items.map(it => `<li>${esc(it.note || it.text)}</li>`).join('')}</ul>
      </div>`);
    body.append(noteEl);
    noteEl.querySelector('.update-note__close').addEventListener('click', closeNote);
    noteEl.addEventListener('mouseleave', () => { if (!notePinned) closeNote(); });
    placeNote(anchor);
    [300, 800].forEach(t => setTimeout(() => placeNote(anchor), t));
  }

  const itemsOf = tag => (tag.dataset.updates || '').split(',').filter(Boolean).map(Number).map(i => UPDATED_ITEMS[i]).filter(Boolean);

  // Hover shows the note; leaving closes it unless it was clicked
  document.addEventListener('mouseover', e => {
    const tag = e.target.closest('.updated-pill[data-updates]');
    if (tag && !notePinned) openNote(tag, itemsOf(tag), false);
  });
  document.addEventListener('mouseout', e => {
    const tag = e.target.closest('.updated-pill[data-updates]');
    if (!tag || notePinned || !noteEl) return;
    if (e.relatedTarget && (noteEl.contains(e.relatedTarget) || tag.contains(e.relatedTarget))) return;
    closeNote();
  });
  // Click (or Enter) keeps it open, without following the card's link
  const pinFromTag = e => {
    const tag = e.target.closest('.updated-pill[data-updates]');
    if (!tag) return false;
    e.preventDefault();
    e.stopPropagation();
    openNote(tag, itemsOf(tag), true);
    return true;
  };
  document.addEventListener('click', e => {
    if (pinFromTag(e)) return;
    if (noteEl && !noteEl.contains(e.target) && !e.target.closest('.updated-dot, .updates__item')) closeNote();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeNote();
    else if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.updated-pill[data-updates]')) pinFromTag(e);
  });
  window.addEventListener('resize', () => { if (noteEl && noteFor) placeNote(noteFor); });

  function showUpdate(index) {
    const item = UPDATED_ITEMS[index];
    if (!item || item.page !== currentId) return;
    let target = null;
    if (item.section) {
      target = content.querySelector(`.section-card[data-file="${CSS.escape(item.section)}"]`) || document.getElementById(item.section);
    }
    if (!target) target = content.querySelector('.page-header h1, .hero__title');
    if (!target) return;
    closeNote();
    // Top of the page, just under the header (scroll-padding-top keeps it clear).
    // A card in the first row of its group scrolls to the group title instead,
    // so the title stays in view.
    let scrollTo = target;
    const gallery = target.matches('.section-card') && target.closest('.section-gallery');
    if (gallery) {
      const first = gallery.querySelector('.section-card:not([hidden])');
      if (first && Math.abs(first.getBoundingClientRect().top - target.getBoundingClientRect().top) < 4) {
        let el = gallery.previousElementSibling;
        while (el && el.tagName !== 'H2' && !el.matches('.heading-row')) el = el.previousElementSibling;
        if (el) scrollTo = el;
      }
    }
    scrollTo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('is-update-target');
    setTimeout(() => target.classList.remove('is-update-target'), 2600);
  }

  function showUpdateFromHash() {
    const m = location.hash.match(/^#update=(\d+)$/);
    if (m) showUpdate(+m[1]);
  }
  window.addEventListener('hashchange', showUpdateFromHash);
  // Run once the page's own scripts (cards, reordering) have finished
  document.addEventListener('DOMContentLoaded', () => setTimeout(showUpdateFromHash, 100));

  // The shell is built: show the page (it is hidden until now to avoid a blink)
  body.classList.add('is-ready');

  // ── Public API for page scripts ────────────────────────────────────────────
  window.ABDocs = { NAV, PAGES, copy, toast, esc, highlight, buildSlider, buildEditor, isLocal: IS_LOCAL, icons: ICONS };
})();
