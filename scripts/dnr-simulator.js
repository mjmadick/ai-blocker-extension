'use strict';

// A minimal re-implementation of the subset of Chrome's declarativeNetRequest
// matching/redirect semantics this extension actually relies on. This is NOT
// a full DNR engine and is not guaranteed to match Chrome's real behavior in
// every edge case (regex handling in particular uses JS RegExp, not RE2) -
// it exists to catch regressions in our own rules.json when we edit it, not
// to replace manually verifying real changes in Chrome via
// chrome.declarativeNetRequest.testMatchOutcome().

function urlFilterToRegExp(urlFilter) {
  // Supports the subset of DNR's urlFilter syntax this project uses:
  // '*' (any characters), '^' (separator: non [A-Za-z0-9_.%-] char or end of
  // string), and literal characters (escaped). No '|'/'||' anchors are used
  // in the shipped rules, so none are implemented here - if a `||` domain
  // anchor combined with a wildcard is ever reintroduced, don't trust this
  // simulator for it; that exact combination didn't match in real Chrome
  // despite looking correct (see README "How it works" for the story).
  let pattern = '';
  for (const ch of urlFilter) {
    if (ch === '*') pattern += '.*';
    else if (ch === '^') pattern += '(?:[^A-Za-z0-9_.%-]|$)';
    else pattern += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(pattern);
}

function hostMatchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith('.' + domain);
}

function conditionMatches(condition, request) {
  const { url, type } = request;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (condition.resourceTypes && !condition.resourceTypes.includes(type)) {
    return false;
  }

  if (condition.requestDomains) {
    const ok = condition.requestDomains.some((d) => hostMatchesDomain(parsed.hostname, d));
    if (!ok) return false;
  }

  if (condition.urlFilter) {
    if (!urlFilterToRegExp(condition.urlFilter).test(url)) return false;
  }

  if (condition.regexFilter) {
    if (!new RegExp(condition.regexFilter).test(url)) return false;
  }

  return true;
}

// Chrome's real tie-break for equal priority is allow > allowAllRequests >
// block > upgradeScheme > redirect > modifyHeaders. We only ever use allow
// and redirect.
const ACTION_RANK = { allow: 0, redirect: 1 };

function pickWinningRule(rules, request) {
  const matches = rules.filter((r) => conditionMatches(r.condition, request));
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return ACTION_RANK[a.action.type] - ACTION_RANK[b.action.type];
  });
  return matches[0];
}

function applyAddOrReplaceParams(parsed, params) {
  for (const { key, value } of params) {
    parsed.searchParams.delete(key);
    parsed.searchParams.append(key, value);
  }
}

function applyRegexSubstitution(url, regexFilter, regexSubstitution) {
  const re = new RegExp(regexFilter);
  return url.replace(re, (...args) => {
    const groups = args.slice(1, -2); // drop offset & full string args
    return regexSubstitution.replace(/\\(\d)/g, (_, n) => groups[Number(n) - 1] ?? '');
  });
}

function computeRedirectUrl(rule, url) {
  const redirect = rule.action.redirect;
  if (redirect.regexSubstitution) {
    return applyRegexSubstitution(url, rule.condition.regexFilter, redirect.regexSubstitution);
  }
  const parsed = new URL(url);
  const transform = redirect.transform || {};
  if (transform.host) parsed.hostname = transform.host;
  if (transform.queryTransform && transform.queryTransform.addOrReplaceParams) {
    applyAddOrReplaceParams(parsed, transform.queryTransform.addOrReplaceParams);
  }
  return parsed.toString();
}

/**
 * Simulates one DNR evaluation pass for a single request.
 * Returns { url, changed, ruleId } - `url` is the (possibly redirected)
 * result, `changed` is false if no redirect happened (no matching rule, an
 * `allow` won, or the computed redirect target equals the input - which
 * Chrome treats as a no-op, never an actual redirect).
 */
function simulateOnce(rules, request) {
  const winner = pickWinningRule(rules, request);
  if (!winner || winner.action.type !== 'redirect') {
    return { url: request.url, changed: false, ruleId: winner ? winner.id : null };
  }
  const newUrl = computeRedirectUrl(winner, request.url);
  return { url: newUrl, changed: newUrl !== request.url, ruleId: winner.id };
}

/**
 * Repeatedly applies simulateOnce until the URL stabilizes (matching how a
 * real redirect chain plays out across multiple requests), or maxHops is
 * exceeded (treated as a bug - an infinite/non-converging redirect loop).
 */
function simulateToStable(rules, request, maxHops = 5) {
  let current = { ...request };
  const hops = [];
  for (let i = 0; i < maxHops; i++) {
    const result = simulateOnce(rules, current);
    hops.push(result);
    if (!result.changed) {
      return { finalUrl: result.url, hops };
    }
    current = { ...current, url: result.url };
  }
  throw new Error(
    `Did not converge within ${maxHops} hops starting from ${request.url}. Hops: ${JSON.stringify(hops, null, 2)}`
  );
}

module.exports = { simulateOnce, simulateToStable, urlFilterToRegExp };
