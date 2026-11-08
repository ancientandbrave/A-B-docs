# Scripts

## import-images.mjs

Moves images downloaded with "Download added images" into `assets/images`. Run `npm run import-images`.

## weekly-release.mjs — Website releases

Checks the live branch of the UK, EU and US repos. When one has moved since the last run, the script:

1. Lists the new commits (merge commits skipped) and groups them by Notion ticket: `#9769 - …` at the start of the commit title, or `AB-123` anywhere (see `ticketPatterns`). Until Notion is connected, a ticket is named after its first commit. Commits without a ticket aren't shown on the docs; their number and titles are listed in the job summary.
2. Saves every release and each ticket's release date per region in `data/releases.json` (never pruned), then rebuilds the docs from it:
   - **Website releases** (`pages/releases/website.html`, data in `js/releases-data.js`): tickets first released in the last 14 days. One table per release week (Monday to Sunday), newest first: Ticket | What changed | UK | EU | US. A region cell shows "✓ 5 Nov" when live there, "Not yet" when the ticket's Region label includes it (or it has no label), and "—" otherwise. A ticket stays in the week it first went live; later regions update its cell.
   - **What changed** is the Notion **Release note** if filled in, otherwise the ticket title. Tickets with the same text share a row.
   - **Archive** (`pages/releases/archive/`): an index plus one page per month, with the same weekly tables. `js/releases-nav.js` adds the months to the menu and search. These are made in the same commit as the release.
3. Updates each ticket in Notion:
   - adds a tag like **UK live 5 Nov 2026** to **Released in** (format set by `notion.releasedInLabel`)
   - adds one short comment with a link to the release notes and the PR
   - sets **Status** to Complete only when it's Testing, On staging or For review **and** every region in its Region label is released. With no Region label, the first release is enough.
   - never changes Backlog, To do, In progress or On hold. These tickets are listed under "Needs attention" in the run summary.
4. Saves the last released commit per region in `data/release-state.json`.
5. Updates **Latest updates** on the home page and the **Updated** tags on docs sections and tabs (`js/updates.js`). For dev main commits that went live for the first time, with or without a ticket ID, each changed theme file marks its docs card:
   - `sections/<name>.liquid` → the Sections library card with the same name.
   - Blocks, snippets and the Navigation menu tabs → the `docUpdates.map` list in `release.config.json` (`"blocks/nav-menu.liquid": ["navigation#nav-60-menu"]`; just `"navigation"` for the page itself). Add a line there when a file should mark a card.
   - Cart files (the slide-in cart, the cart page and any `snippets/cart-*.liquid`) → the **Cart** guide. Map keys can use `*` as a wildcard.
   - Anything else that went live, with or without a ticket ID, adds one line: "Small fixes across the website.", pointing to Website releases for the full list.
   - Wording follows the rules at the top of `js/updates.js` (checked by `npm test`): plain words for the whole company, text max 12 words, the hover note starts with "Now" (max 20 words), British spelling, names as people see them in the Theme editor.
     - A new block: "There's a new Promo Banner block in Collection pages." / "Now you can add a Promo Banner block to Collection pages in the Theme editor."
     - A new setting: "There's a new Show Flash Banner option in Product pages v2." / "Now you can tick Show Flash Banner in the Product pages v2 settings."
     - Anything else: "Small fixes to the Title section." / "Now the Title section has the latest fixes. Nothing changes in how you set it up."
     - A ticket's Notion **Release note** replaces the text when it follows the rules. Ticket titles aren't used: they name the task, not what changed.
     - Changes to code layout or comments only are skipped.
   - The script can only see what changed in the code, not why. Read the new lines after each release and rewrite them to say what people can do now (see the 5 November entry for examples).
   - A new entry dated with the release goes on top, or items are added to that day's entry. Existing entries, including hand-written ones and any line you've edited, are never changed. A commit is only announced once, even when it goes live in several regions.

The workflow (`.github/workflows/weekly-release.yml`) then makes one commit if anything changed. You can run it again safely: it never adds the same release, tag or comment twice.

### Setup

1. **Fill in `release.config.json`.** Replace every `TODO` value. The script won't run until they're all filled in.
   - `devRepo`, and `repo` + `branch` for each region, as `owner/name`.
   - `notionName` for each region: the option name exactly as it appears in Notion. Use the same name in **Released in** and in the Region label.
   - `notion.properties.region`: the name of the Region label property.
   - `docs.siteUrl`: the address of the docs site, used for links in the Notion comments.
2. **Notion.**
   - Add a multi-select property called **Released in** to the dev board. The script adds options like "UK live 5 Nov 2026" itself.
   - Optional: add a text property called **Release note** for a plain sentence to show on the docs instead of the ticket title.
   - Create an internal integration at notion.so/my-integrations. Turn on **Read content**, **Update content**, **Read comments** and **Insert comments**.
   - On the dev board, open **••• › Connections** and add the integration.
3. **GitHub token.** Create a fine-grained token with access to the dev, UK, EU and US repos and these read-only permissions: **Contents**, **Pull requests** and **Metadata**. Contents (read) also covers the push history used for release dates.
4. **Secrets.** In this repo, open **Settings › Secrets and variables › Actions** and add:
   - `RELEASE_REPOS_TOKEN`: the GitHub token
   - `NOTION_TOKEN`: the integration's secret
   - `NOTION_DATABASE_ID`: the 32-character ID in the dev board's address
5. **First run.** In **Actions › Website releases › Run workflow**, tick **Dry run** and check the job summary. Then run it again without Dry run. The first run reads the last 14 days for each region.
6. **Daily check (optional).** In the workflow file, remove the `#` from the `schedule:` and `cron:` lines. It then checks every weekday at 18:00 UTC.

### Run it on your computer

```sh
export RELEASE_REPOS_TOKEN=… NOTION_TOKEN=… NOTION_DATABASE_ID=…
DRY_RUN=1 npm run release   # shows what would change, writes nothing
NOTION_READ_ONLY=1 npm run release   # reads titles and links from Notion, writes nothing to Notion
npm test                    # tests with mocked GitHub and Notion
```

### Work out the last 14 days again

```sh
DRY_RUN=1 npm run release -- --rebuild   # see the result first
npm run release -- --rebuild
```

This ignores `data/release-state.json` and redoes everything in `data/releases.json` from the last 14 days. Older releases are kept, so the archive doesn't lose anything. Wrong "UK live …" tags in Notion are replaced with the right date.

### Test with your local clones (no GitHub token needed)

Run `git fetch` in each region repo first, then:

```sh
LOCAL_REPOS="ancientandbrave/uk=~/uk,dougalcrowder/braver-eu=~/eu,ancientandbrave/us=~/us" DRY_RUN=1 npm run release
```

Leave out `DRY_RUN=1` to write the files locally and see them on the Website releases page. To undo, delete `data/` and `pages/releases/archive/`, then run the script again on an empty history.

### Good to know

- **Theme editor saves:** the "Update from Shopify for theme…" commits that Shopify adds to the live branch are ignored (see `ignoreCommits` in the config). They never count as a release.
- **Release dates:** each commit is dated by when it reached the live branch: the time of the earliest push to that branch that contains it (GitHub's repository activity). A ticket's date in a region is the earliest push with any of its commits. If a commit isn't in any push (e.g. it came in with a force push, which is skipped), the script uses the date of the merge on the live branch that brought it in, then the date of the branch's newest commit. Each fallback is listed as a warning in the job summary. Dates are in `timeZone` (UTC by default).
- **Local test mode** has no push history, so every date there is a fallback.
- **PR links:** merged PRs in the dev repo with the ticket ID in their title. If none are found, the script uses `(#123)` from the commit titles.
- **Notion links:** set `notion.linkTickets` to `false` to show ticket IDs without links.
- **Failed Notion updates:** they're marked as pending in `data/releases.json` and retried on the next run.
- **Release notes written later:** tickets from the last 14 days are read from Notion on every run, so an edited Release note shows on the next run.
- **Starting again for one region:** remove that region from `data/release-state.json`. The next run reads the last 14 days again.
