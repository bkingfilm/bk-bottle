// Service worker 只干一件事:把待扔清单的条数显示在图标角标上。
// 没有定时器、没有后台请求、不监听网页 — MV3 的 worker 会被随时回收,
// 靠 storage.onChanged 唤醒就够了。
importScripts("lib.js");

function refresh() {
  chrome.storage.local.get(["pending"], function (d) {
    setBadge(Array.isArray(d.pending) ? d.pending.length : 0);
  });
}

// 装完不开一次网页,插件其实是「没有身份」的:device 存在网页的 localStorage 里,
// 靠 bridge.js 在 b.bking.film 上抄过来。没抄到的人面板上只显示一行「还没有身份」,
// 扔的瓶子也对不上回执。2026-08-10 实测装机 82、打开过面板的只有 15,
// 装完就再没想起来的占八成 —— 首次安装直接开一次首页,既是提醒,也顺手把身份绑上。
// 更新时不打扰。chrome.tabs.create 不需要 tabs 权限,所以这条不影响审核。
chrome.runtime.onInstalled.addListener(function (details) {
  refresh();
  if (details && details.reason === "install") {
    try { chrome.tabs.create({ url: API + "/?from=ext-install" }); } catch (e) {}
  }
});
chrome.runtime.onStartup.addListener(refresh);

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local" && changes.pending) refresh();
});
