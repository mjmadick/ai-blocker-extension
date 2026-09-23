console.log('[ai-blocker] service worker loaded');

// Only present when the manifest declares "declarativeNetRequestFeedback"
// (dev-only debugging permission, deliberately left out of the published
// manifest since it's inert outside unpacked/dev-mode extensions anyway -
// see README "Debugging"). Guarded so this file doesn't need to change
// depending on whether that permission is present.
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    console.log('[ai-blocker] rule matched', {
      ruleId: info.rule.ruleId,
      rulesetId: info.rule.rulesetId,
      url: info.request.url,
      method: info.request.method,
      type: info.request.type,
    });
  });
}
