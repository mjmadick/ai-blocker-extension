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
   `q` param, append `-ai` to it **and** add `webscp=1`, which forces the
   "Web" results tab (rather than "All"). This uses `redirect.regexSubstitution`
   rather than `redirect.transform.queryTransform` (what the Google rules
   use): `queryTransform.addOrReplaceParams` can only set a param to a
   fixed literal value, it can't read and extend the existing value.
   `regexFilter: "([?&]q=)([^&]*)"` matches just the `q=value` part of the
   URL, and `regexSubstitution: "\1\2+-ai&webscp=1"` replaces only that
   matched span with itself plus the suffix and the extra param —
   everything else in the URL is left untouched automatically, the same
   way a normal find-and-replace only touches the matched text.

   `webscp=1` is bundled into this *same* rule/substitution rather than
   given its own guard+redirect pair, deliberately: two independent
   unconditional redirect rules (one for `-ai`, one for `webscp`) can end
   up starving each other depending on rule priority and on whether a
   same-URL redirect causes Chrome to fall through to the next rule or
   just stop — that fallthrough behavior isn't clearly documented, and
   isn't worth relying on. Adding both params in one hop means the
   existing "already has `-ai`" allow rule (rule 4) is a reliable guard
   for both, since they're always added together. The only downside is a
   harmless duplicate `webscp=1` if it was already present without `-ai`
   (e.g. an in-progress URL Bing itself constructed) — not a real-world
   concern.

   Forcing the Web tab means Images/Videos/Shopping/Maps results are no
   longer reachable through Bing's own tab UI (a `-ai`+`webscp=1` search
   only ever returns Web results) — accepted tradeoff, unlike the Google
   rules, which specifically preserve those tabs.

   The regex intentionally has **no unbounded `.*` wildcards**. An earlier
   version wrapped the whole thing in `^(.*[?&]q=)([^&]*)(.*)$` to capture
   "everything before" and "everything after", which matched fine in
   isolated tests with a short URL but silently failed to match real Bing
   search URLs — those run 200+ characters once Bing's own tracking params
   (`qs`, `form`, `sp`, `ghc`, `lq`, `pq`, `sc`, `sk`, `cvid`, …) are
   attached. The suspicion was that Chrome's DNR treats regexes with
   multiple unbounded wildcards as "unsafe" and only evaluates unsafe
   regexes against short URLs — but `chrome.declarativeNetRequest.isRegexSupported()`
   reported the old pattern as supported too, so that specific mechanism
   isn't confirmed. What's confirmed is that dropping the unbounded
   wildcards (since `regexSubstitution` only needs to replace the matched
   span, not reconstruct the whole URL) fixed the real failure.

6. **`sub_frame` resource type.** Editing the query in Bing's own on-page
   search box (while already on a results page) and hitting Enter doesn't
   do a normal top-level navigation — Chrome DevTools shows it firing a
   `document`-type request to a URL with extra params like
   `ajaxnorecss=1&format=snrjson&jsoncbid=0`, which is Bing's internal
   AJAX/partial-refresh mechanism: the new results are loaded into a
   hidden iframe (`sub_frame` in extension terms, not `main_frame`) and
   swapped into the visible page via JS, with the address bar updated
   separately via `history.pushState`. Rules 4 and 5 both list
   `resourceTypes: ["main_frame", "sub_frame"]` to also catch this path —
   typing a fresh URL into the address bar is unaffected either way since
   that's always `main_frame`.

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
- [x] Suppress Bing's "ask a follow-up" AI prompt (shown at the bottom of
      the "All" tab) by forcing `webscp=1` (the "Web" tab) on every search

## Notes

- Only scoped to `google.com` and `bing.com` — other TLDs (e.g.
  `google.co.uk`) aren't covered yet.
- A query that legitimately ends in `-ai` (e.g. a company name like
  "x-ai") would be misread by the Bing loop guard as already suppressed
  and passed through unmodified — a rare edge case, not worth the added
  complexity of distinguishing it.
- Forcing `webscp=1` means Bing's Images/Videos/Shopping/Maps tabs are no
  longer reachable — accepted tradeoff for fully closing off the AI
  follow-up prompt.
- If either search engine changes how its AI answer is gated, the fix is
  in `rules/rules.json` only.
