console.log('[ai-blocker] service worker loaded');

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  console.log('[ai-blocker] rule matched', {
    ruleId: info.rule.ruleId,
    rulesetId: info.rule.rulesetId,
    url: info.request.url,
    method: info.request.method,
    type: info.request.type,
  });
});
