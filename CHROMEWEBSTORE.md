# Chrome Web Store Listing — Bury AI

> Last Updated: 2026-09-23

Product/listing name is "Bury AI"; the GitHub repo stays
`ai-blocker-extension` (not renamed — no reason to churn the URL).

## Store Listing

**Extension Name**
Bury AI
<!-- Must exactly match manifest.json "name". -->

**Short Description**
Blocks AI Overview & AI Mode on Google and AI summaries on DuckDuckGo search results.
<!-- 85 characters -->

**Detailed Description**

```
Bury AI blocks AI-generated answer summaries from Google and
DuckDuckGo search results, so you see the same organic search results
you always have — without an AI box at the top.

FEATURES
• Google: automatically switches to the "Web" results view, which
  doesn't show an AI Overview — Images, Videos, Shopping, and Google's
  other search tabs keep working normally.
• Google: also closes off "AI Mode" — tapping that tab quietly returns
  you to the same AI-free web results instead of opening it.
• DuckDuckGo: automatically switches to DuckDuckGo's own no-AI results
  page, which skips its AI-generated summary box while keeping normal
  search results (including non-AI instant answers like Wikipedia
  summaries).

HOW TO USE
Nothing to configure. Install Bury AI and search normally on Google or
DuckDuckGo — it blocks AI answers automatically in the background.

PRIVACY
Bury AI does not collect any personal data, does not use cookies or
analytics, and never reads the content of any page you visit. It only
changes the address of a search page before it loads.
Full privacy policy: https://github.com/mjmadick/ai-blocker-extension/blob/main/PRIVACY.md

PERMISSIONS
"Read and change your data on google.com and duckduckgo.com" — needed
to detect that you're loading a search results page and redirect it to
the non-AI version before it loads. The extension does not read page
content, cookies, or browsing history on these or any other site.

SUPPORT
Found a bug or have a suggestion? email mjmadick@gmail.com

Version 0.5.0
```

<!-- "Bury AI" appears in the name; "block(s) AI" appears in the short
     description and twice in the detailed description (opener + "HOW TO
     USE") for search relevance against queries like "block ai" - kept to
     natural, non-repetitive phrasing per CWS's keyword-stuffing rule. -->

**Category**
Search Tools

**Single Purpose**
Removes AI-generated answer summaries from Google and DuckDuckGo search results.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/bury-ai-icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

### Screenshot Notes

- Screenshot 1: a Google search results page for a plain-text query,
  showing the "Web" tab active and no AI Overview box, ideally with
  the address bar visible showing `udm=14`.
- Screenshot 2: a DuckDuckGo search results page on `noai.duckduckgo.com`
  with no "Search Assist" box, address bar visible.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|----------------|
| `declarativeNetRequest` | permissions | Used to detect when a page being loaded is a Google or DuckDuckGo search results page, and to redirect it — before it loads — to an equivalent page that doesn't show an AI-generated answer summary. This only inspects the destination web address of the request; it never reads the content of any page. |
| `*://*.google.com/*` | host_permissions | Needed so the redirect above can apply to Google search page loads. Scoped to google.com only. |
| `*://*.duckduckgo.com/*` | host_permissions | Needed so the redirect above can apply to DuckDuckGo search page loads. Scoped to duckduckgo.com only. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

The extension has no `chrome.storage` usage, no cookies access, no
analytics, and makes no network requests of its own — it only rewrites
the destination of search requests the browser was already about to
make. See [`PRIVACY.md`](PRIVACY.md) for the full policy.

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**
[`PRIVACY.md`](PRIVACY.md) in this repo, rendered by GitHub at:
`https://github.com/mjmadick/ai-blocker-extension/blob/main/PRIVACY.md`

<!-- Requires the repo to be public (planned) for this URL to actually be
     publicly accessible - confirm the repo visibility switch happened
     before submitting, and re-check the link loads logged out. If the
     repo is ever made private again later, a different host (GitHub
     Pages, a project site, etc.) would be needed instead - see
     references/webstore/privacy-policy.md in the chrome-extensions skill
     for hosting options. -->

## Packaging

Run `./scripts/package-for-webstore.sh` to produce a ZIP containing only
`manifest.json`, `rules/`, `service-worker.js`, and `icons/` — this is
what to upload to the CWS dashboard, not the repo itself.

## Distribution

**Visibility**: Private (recommended — matches force-install to managed Chromebooks within your Google Workspace organization; confirm this pairs correctly with your Admin console setup before publishing)
**Regions**: All regions

## Developer Info

**Publisher Name**
Michael Madick

**Contact Email**
mjmadick@gmail.com

**Support URL / Email**
mjmadick@gmail.com

**Homepage URL**
`https://github.com/mjmadick/ai-blocker-extension`

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.5.0 | 2026-09-23 | Renamed listing/extension to "Bury AI" (repo path unchanged). Reworked description copy to include "block AI" for store-search relevance, since several existing CWS listings already use "block AI" in their name. | Draft |
| 0.4.1 | 2026-09-23 | Removed unused `declarativeNetRequestFeedback` permission ahead of submission (dev-only, inert once published). | Draft |
| 0.4.0 | 2026-09-23 | Added DuckDuckGo support (redirect to `noai.duckduckgo.com`). Removed Bing support (see Known Issues). | Draft |
| 0.3.0 | 2026-09-18 | Removed Bing suppression logic; back to Google + (later) DuckDuckGo only. | Draft |

<!-- Only the version actually submitted needs a "Submitted"/"In Review"/
     "Published" status — update this table as you go through the
     actual CWS dashboard flow. -->

## Review Notes

### Known Issues / Limitations

- Only `google.com` and `duckduckgo.com` are covered — other country
  TLDs (e.g. `google.co.uk`) are not currently rewritten.
- Bing and Yahoo are intentionally NOT covered by this extension. Bing
  was attempted and abandoned (see `README.md` "Status" section for
  why); both are blocked outright at the network level in this
  deployment's environment instead, so their absence here isn't a gap
  for the intended use case, but is worth knowing if a reviewer asks
  why "Bury AI" doesn't cover every search engine.
- `declarativeNetRequestFeedback` was intentionally removed before
  first submission (see Version History) — no action needed here,
  noted so a future permission audit doesn't wonder why the README
  mentions it.
- The listing name "Bury AI" was chosen partly to stand out from
  several existing "Block AI"-named extensions already on the store —
  "block AI" is instead placed in the description/keywords so the
  listing can still surface in searches for that phrase.

### Rejection History

<!-- None yet. -->
