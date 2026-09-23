'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { simulateOnce, simulateToStable } = require('../scripts/dnr-simulator');

const EXT_ROOT = path.join(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, 'rules', 'rules.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, 'manifest.json'), 'utf8'));

function qs(url, key) {
  return new URL(url).searchParams.get(key);
}

describe('Google', () => {
  test('fresh search with no udm gets udm=14 added', () => {
    const { finalUrl } = simulateToStable(rules, {
      url: 'https://www.google.com/search?q=how+to+golf',
      type: 'main_frame',
    });
    assert.equal(qs(finalUrl, 'udm'), '14');
  });

  test('udm=50 gets rewritten to udm=14 (not just passed through)', () => {
    const { finalUrl } = simulateToStable(rules, {
      url: 'https://www.google.com/search?q=test&udm=50',
      type: 'main_frame',
    });
    assert.equal(qs(finalUrl, 'udm'), '14');
  });

  test('other tab codes (Images, Videos, ...) pass through unchanged', () => {
    for (const udm of ['2', '7', '15', '28']) {
      const url = `https://www.google.com/search?q=test&udm=${udm}`;
      const { finalUrl } = simulateToStable(rules, { url, type: 'main_frame' });
      assert.equal(finalUrl, url, `udm=${udm} should not be touched`);
    }
  });

  test('udm=14 is already stable (idempotent, no double-processing)', () => {
    const url = 'https://www.google.com/search?q=test&udm=14';
    const result = simulateOnce(rules, { url, type: 'main_frame' });
    assert.equal(result.changed, false);
  });

  test('non-search requests are left alone', () => {
    const url = 'https://www.google.com/';
    const result = simulateOnce(rules, { url, type: 'main_frame' });
    assert.equal(result.changed, false);
  });

  test('only main_frame is affected, not sub-resources', () => {
    const url = 'https://www.google.com/search?q=test';
    for (const type of ['sub_frame', 'xmlhttprequest', 'image', 'script']) {
      const result = simulateOnce(rules, { url, type });
      assert.equal(result.changed, false, `${type} requests should not be redirected`);
    }
  });

  test('converges within 2 hops from a fresh query', () => {
    const { hops } = simulateToStable(rules, {
      url: 'https://www.google.com/search?q=test',
      type: 'main_frame',
    });
    assert.ok(hops.length <= 2, `expected <=2 hops, got ${hops.length}`);
  });
});

describe('DuckDuckGo', () => {
  test('search on duckduckgo.com redirects to noai.duckduckgo.com, keeping query', () => {
    const { finalUrl } = simulateToStable(rules, {
      url: 'https://duckduckgo.com/?q=how+to+golf',
      type: 'main_frame',
    });
    const parsed = new URL(finalUrl);
    assert.equal(parsed.hostname, 'noai.duckduckgo.com');
    assert.equal(parsed.searchParams.get('q'), 'how to golf');
  });

  test('www.duckduckgo.com also redirects', () => {
    const { finalUrl } = simulateToStable(rules, {
      url: 'https://www.duckduckgo.com/?q=test',
      type: 'main_frame',
    });
    assert.equal(new URL(finalUrl).hostname, 'noai.duckduckgo.com');
  });

  test('already on noai.duckduckgo.com is stable (idempotent)', () => {
    const url = 'https://noai.duckduckgo.com/?q=test';
    const result = simulateOnce(rules, { url, type: 'main_frame' });
    assert.equal(result.changed, false);
  });

  test('non-main_frame requests (e.g. autocomplete) are left alone', () => {
    const url = 'https://duckduckgo.com/ac/?q=test';
    const result = simulateOnce(rules, { url, type: 'xmlhttprequest' });
    assert.equal(result.changed, false);
  });
});

describe('manifest / rules.json hygiene', () => {
  test('rule ids are unique', () => {
    const ids = rules.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate rule ids found');
  });

  test('manifest is Manifest V3', () => {
    assert.equal(manifest.manifest_version, 3);
  });

  test('every redirect rule touching main_frame/sub_frame has matching host_permissions', () => {
    // This is the exact bug that cost a lot of debugging time: a redirect
    // action on a main_frame/sub_frame request silently never fires without
    // host_permissions for that domain, even though declarativeNetRequest
    // alone is enough for actions like allow/block. Encode it as a check so
    // a future rule addition can't reintroduce it silently.
    const hostPermissions = manifest.host_permissions || [];
    const covered = (domain) =>
      hostPermissions.some((p) => p === `*://*.${domain}/*` || p === `*://${domain}/*`);

    for (const rule of rules) {
      const touchesFrame =
        rule.condition.resourceTypes &&
        rule.condition.resourceTypes.some((t) => t === 'main_frame' || t === 'sub_frame');
      if (rule.action.type === 'redirect' && touchesFrame) {
        for (const domain of rule.condition.requestDomains || []) {
          assert.ok(
            covered(domain),
            `rule id ${rule.id} redirects ${domain} on main_frame/sub_frame but host_permissions doesn't cover it`
          );
        }
      }
    }
  });

  test('no regexFilter uses multiple unbounded wildcards', () => {
    // Another expensive lesson: a regexFilter like ^(.*[?&]q=)([^&]*)(.*)$
    // matched fine in short-URL tests but silently stopped matching real
    // (200+ char) URLs once Chrome treated it as a memory-unsafe regex.
    // regexSubstitution only needs to replace the matched span, not
    // reconstruct the whole URL, so there's never a real need for leading
    // and trailing `.*` - flag it if one shows up again.
    for (const rule of rules) {
      if (!rule.condition.regexFilter) continue;
      const unboundedWildcardCount = (rule.condition.regexFilter.match(/\.\*/g) || []).length;
      assert.ok(
        unboundedWildcardCount <= 1,
        `rule id ${rule.id} regexFilter has ${unboundedWildcardCount} unbounded ".*" sections: ${rule.condition.regexFilter}`
      );
    }
  });
});
