# AI Blocker for Search Engines

A Chrome extension that suppresses AI-generated overviews in Google and
Bing search results.

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

### Bing

Bing's "Copilot Search" answer box goes away when `-ai` is appended to the
query text (e.g. `how to golf` → `how to golf -ai`) — Bing treats it as an
explicit exclusion term rather than a UI toggle, so there's no `udm`-style
query parameter to set here. Two more rules handle this:

4. **Allow rule** (priority 2) — if the `q` value already ends in `-ai`
   (checked via `regexFilter`, since we need to match right at the end of
   the value, not just anywhere in the URL), leave the request alone. This
   is the loop guard: rule 5 always appends `-ai`, so without this, a
   second pass would append it again, compounding into `-ai -ai -ai...`
   forever.
5. **Redirect rule** (priority 1) — for any other `bing.com` request with a
   `q` param, append `-ai` to it. This uses `redirect.regexSubstitution`
   rather than `redirect.transform.queryTransform` (what the Google rules
   use): `queryTransform.addOrReplaceParams` can only set a param to a
   fixed literal value, it can't read and extend the existing value. The
   `regexFilter` on the condition captures the URL into three groups
   (everything up to and including `q=`, the existing value, everything
   after), and `regexSubstitution` reassembles them with `-ai` spliced in
   after the captured value.

Not scoped to a specific path (just `bing.com` + a `q` param present) since
Bing doesn't put web search under a single consistent path the way Google
uses `/search`.

### Permissions

`host_permissions` for both `*://*.google.com/*` and `*://*.bing.com/*` is
required in the manifest — without it, Chrome silently refuses to apply a
`redirect` action to a `main_frame` (top-level navigation) request, even
though the same static-ruleset-based `declarativeNetRequest` permission is
enough on its own for actions like `block` or `allow`.

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
5. Search on Bing — the address bar should show `-ai` appended to your
   query and no "Copilot Search" panel

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

- [x] Suppress Google's "AI Overview" via `udm=14` query rewrite
- [x] Suppress Google's "AI Mode" — turned out to share the `udm=50` signal
      with AI Overview, so the same redirect rule handles it. Tapping the
      "AI Mode" tab is effectively a no-op.
- [x] Suppress Bing's "Copilot Search" via appending `-ai` to the query

## Notes

- Only scoped to `google.com` and `bing.com` — other TLDs (e.g.
  `google.co.uk`) aren't covered yet.
- A query that legitimately ends in `-ai` (e.g. a company name like
  "x-ai") would be misread by the Bing loop guard as already suppressed
  and passed through unmodified — a rare edge case, not worth the added
  complexity of distinguishing it.
- If either search engine changes how its AI answer is gated, the fix is
  in `rules/rules.json` only.
