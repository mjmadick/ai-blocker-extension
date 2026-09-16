# AI Blocker for Google Search

A Chrome extension that suppresses Google's "AI Overview" in search results.

## How it works

Google search results skip the AI Overview when the URL has `udm=14` (the
same trick as clicking the "Web" search filter tab). This extension uses
`declarativeNetRequest` to rewrite Google search requests before they're
sent, adding `udm=14` when no `udm` parameter is already present.

Three static rules in [`rules/rules.json`](rules/rules.json) do the work,
scoped to `google.com`, `/search` paths, `main_frame` requests only:

1. **`udm=50` redirect rule** (priority 3, highest) — `udm=50` isn't one of
   Google's real tab codes but still triggers the AI Overview, so it's
   caught specifically and rewritten to `udm=14`.
2. **Allow rule** (priority 2) — if the request has any *other* `udm=`
   value (e.g. `udm=2` for "Images", `udm=7` for "Videos"), leave it alone.
   This prevents the extension from fighting Google's own search tabs and
   avoids re-processing a URL that already has `udm=14` applied. It's
   lower priority than rule 1, so `udm=50` is still caught by that rule
   first even though it also matches this one.
3. **Redirect rule** (priority 1, lowest) — for any other `google.com/search`
   request (i.e. no `udm` param at all), add `udm=14` via a query transform.

`host_permissions` for `*://*.google.com/*` is required in the manifest —
without it, Chrome silently refuses to apply a `redirect` action to a
`main_frame` (top-level navigation) request, even though the same
static-ruleset-based `declarativeNetRequest` permission is enough on its
own for actions like `block` or `allow`.

A debug-only `service-worker.js` logs every rule match via
`onRuleMatchedDebug` (only active for unpacked/dev-mode extensions — it's
inert once published to the Chrome Web Store). Useful for confirming
whether a request is matching, and which rule won, without guessing from
the visible URL alone.

## Install (unpacked, for development)

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select this directory
   (`extensions/ai-blocker-extension`)
4. Search on Google — the results page should load with `udm=14` in the
   address bar and no AI Overview panel

If you change `manifest.json` (e.g. permissions) or `rules/rules.json`,
prefer removing and re-loading the extension over clicking "Reload" —
reload doesn't always pick up permission changes reliably.

## Debugging

Open the extension's service worker console from its card on
`chrome://extensions` (click "service worker"), then:

```js
chrome.declarativeNetRequest.testMatchOutcome(
  { url: "https://www.google.com/search?q=test123", type: "main_frame" },
  (result) => console.log(JSON.stringify(result))
)
```

This asks the compiled ruleset directly whether/which rule matches a given
URL, independent of any real navigation.

## Status

- [x] Suppress "AI Overview" via `udm=14` query rewrite
- [ ] Suppress "AI Mode" (likely needs DOM removal via a content script,
      since AI Mode is a separate tab/experience rather than a URL
      parameter toggle)

## Notes

- Only scoped to `google.com/search` requests — other Google TLDs (e.g.
  `google.co.uk`) aren't covered yet.
- If Google changes how the AI Overview is gated, the fix is in
  `rules/rules.json` only.
