# Bury AI

A Chrome extension that suppresses Google's "AI Overview" and "AI Mode",
and DuckDuckGo's AI-generated summaries, in search results.

(The repository is still named `ai-blocker-extension` — only the
extension/listing name changed to "Bury AI".)

## How it works

### Google

Google search results skip the AI Overview when the URL has `udm=14` (the
same trick as clicking the "Web" search filter tab). This extension uses
`declarativeNetRequest` to rewrite Google search requests before they're
sent, adding `udm=14` when no `udm` parameter is already present.

Three static rules in [`rules/rules.json`](rules/rules.json) do the work,
scoped to `google.com`, `/search` paths, `main_frame` requests only:

1. **`udm=50` redirect rule** (priority 3, highest) — `udm=50` isn't one of
   Google's real tab codes but still triggers the AI Overview, so it's
   caught specifically and rewritten to `udm=14`. This also suppresses
   "AI Mode": tapping the "AI Mode" tab re-requests the page with
   `udm=50`, so this same rule catches it and rewrites it back to
   `udm=14` — no separate content script needed.
2. **Allow rule** (priority 2) — if the request has any *other* `udm=`
   value (e.g. `udm=2` for "Images", `udm=7` for "Videos"), leave it alone.
   This prevents the extension from fighting Google's own search tabs and
   avoids re-processing a URL that already has `udm=14` applied. It's
   lower priority than rule 1, so `udm=50` is still caught by that rule
   first even though it also matches this one.
3. **Redirect rule** (priority 1, lowest) — for any other `google.com/search`
   request (i.e. no `udm` param at all), add `udm=14` via a query transform.

### DuckDuckGo

DuckDuckGo publishes a separate hostname, `noai.duckduckgo.com`, that skips
its AI-generated "Search Assist" summary box while keeping normal results
(including the older, non-AI Wikipedia-snippet instant answers). One rule
handles this:

6. **Host rewrite** — any `main_frame` request to `duckduckgo.com` (or a
   subdomain) gets redirected to the same path/query on
   `noai.duckduckgo.com`, via `redirect.transform.host`. Unlike the Google
   rules, this needs no separate guard against re-triggering: redirecting
   a request that's already on `noai.duckduckgo.com` computes an identical
   target URL, and Chrome doesn't perform a redirect whose target matches
   the original request, so it's naturally idempotent.

   Scoped to `main_frame` only (not restricted to a specific path or
   query), so it won't touch DuckDuckGo's autocomplete/API subrequests —
   only actual page navigations get redirected.

### Permissions

`host_permissions` for `*://*.google.com/*` and `*://*.duckduckgo.com/*`
is required in the manifest — without it, Chrome silently refuses to apply
a `redirect` action to a `main_frame` (top-level navigation) request, even
though the same static-ruleset-based `declarativeNetRequest` permission is
enough on its own for actions like `block` or `allow`.

`service-worker.js` can log every rule match via `onRuleMatchedDebug`, but
this requires the `declarativeNetRequestFeedback` permission, which is
*not* in the published manifest — it only works for unpacked/dev-mode
extensions and does nothing for anyone who installs this normally, so
there's no reason to carry it (and justify it to Web Store reviewers) in
the shipped version. Add `"declarativeNetRequestFeedback"` to
`manifest.json`'s `permissions` array temporarily if you need it while
debugging a rule change locally (see "Debugging" below), then remove it
again before publishing.

## Install (unpacked, for development)

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select this directory
   (`extensions/ai-blocker-extension`)
4. Search on Google — the results page should load with `udm=14` in the
   address bar and no AI Overview panel
5. Search on DuckDuckGo — the address bar should switch to
   `noai.duckduckgo.com` and no "Search Assist" panel should appear

If you change `manifest.json` (e.g. permissions) or `rules/rules.json`,
prefer removing and re-loading the extension over clicking "Reload" —
reload doesn't always pick up permission changes reliably.

## Debugging

Both techniques below require `"declarativeNetRequestFeedback"` in
`manifest.json`'s `permissions` array (removed from the published
manifest — see "Permissions" above). Add it back locally, remove/re-add
the unpacked extension, then open the extension's service worker console
from its card on `chrome://extensions` (click "service worker"):

```js
chrome.declarativeNetRequest.testMatchOutcome(
  { url: "https://www.google.com/search?q=test123", type: "main_frame" },
  (result) => console.log(JSON.stringify(result))
)
```

This asks the compiled ruleset directly whether/which rule matches a given
URL, independent of any real navigation.

## Automated tests

```bash
npm test
```

Runs [`test/rules.test.js`](test/rules.test.js) against
[`scripts/dnr-simulator.js`](scripts/dnr-simulator.js), a small
reimplementation of the subset of `declarativeNetRequest`'s matching and
redirect logic this extension actually uses (`requestDomains`, `urlFilter`,
`regexFilter`, priority-based rule selection, `queryTransform`, `host`
rewrites, `regexSubstitution`). Zero dependencies — just Node's built-in
test runner (`node --test`), which is why there's a `package.json` even
though the extension itself has no build step or dependencies.

**What it catches:** regressions in `rules.json` — a query-tab value that
stops being preserved, a rewrite that stops converging (infinite redirect
loop), a resource type that starts leaking to sub-resources it shouldn't
touch — plus two specific bugs from this project's history, encoded as
standing checks so they can't quietly come back:
- a `redirect` rule targeting `main_frame`/`sub_frame` whose domain isn't
  covered by `host_permissions` (redirects silently never fire without it,
  even though plain `declarativeNetRequest` is enough for `allow`/`block`)
- a `regexFilter` with more than one unbounded `.*` (matched fine against
  short test URLs, then silently failed to match real ~200+ character
  search URLs)

**What it does NOT catch:** anything that depends on Chrome's actual
network stack or a search engine's real behavior — the simulator uses
JS `RegExp`, not Chrome's RE2 engine, and it can't know when Google or
DuckDuckGo change what suppresses their AI features. After a real change
to `rules.json`, still verify in an actual loaded extension via
`testMatchOutcome`/`onRuleMatchedDebug` (see Debugging above) before
considering it done — this suite is a regression net for editing rules
you already know work, not a substitute for that verification.

## Status

- [x] Suppress Google's "AI Overview" via `udm=14` query rewrite
- [x] Suppress Google's "AI Mode" — turned out to share the `udm=50` signal
      with AI Overview, so the same redirect rule handles it. Tapping the
      "AI Mode" tab is effectively a no-op.
- [x] Suppress DuckDuckGo's AI-generated "Search Assist" summary via
      redirecting to `noai.duckduckgo.com`
- [ ] Bing was attempted (appending `-ai` to the query, plus forcing
      `webscp=1` for the "Web" tab) but abandoned: Bing's search results
      page updates the visible URL via `history.pushState`, decoupled
      from the actual content-fetching request, and that fetch appears to
      chain through further requests our rules didn't reliably reach —
      results were inconsistent (alternating between suppressed and not
      across identical repeated searches) in a way that wasn't practical
      to keep chasing declaratively. Bing (and Yahoo, for the same
      reason — no reliable query-param trick and no admin-level setting
      for suppressing its AI summary) are instead blocked outright at the
      network level via GoGuardian, with students directed to Google.

## Notes

- Only scoped to `google.com` and `duckduckgo.com` — other TLDs (e.g.
  `google.co.uk`) aren't covered yet.
- If a search engine changes how its AI answer is gated, the fix is in
  `rules/rules.json` only.

## Publishing to the Chrome Web Store

See [`CHROMEWEBSTORE.md`](CHROMEWEBSTORE.md) for listing copy, permission
justifications, and the pre-submission checklist, and
[`PRIVACY.md`](PRIVACY.md) for the privacy policy (linked from the listing
as a GitHub-rendered page — no separate hosting needed while the repo
stays public). Run `./scripts/package-for-webstore.sh` to build the ZIP
to upload — it excludes `test/`, `scripts/`, `package.json`, and the
markdown docs, none of which the extension needs at runtime.
