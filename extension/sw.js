// Service worker 只干一件事:把待扔清单的条数显示在图标角标上。
// 没有定时器、没有后台请求、不监听网页 — MV3 的 worker 会被随时回收,
// 靠 storage.onChanged 唤醒就够了。
importScripts("lib.js");

function refresh() {
  chrome.storage.local.get(["pending"], function (d) {
    setBadge(Array.isArray(d.pending) ? d.pending.length : 0);
  });
}

chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local" && changes.pending) refresh();
});
