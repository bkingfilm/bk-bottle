// 只在 b.bking.film 上跑。作用是让插件和网页共用一个瓶主身份。
//
// 为什么必须这样:device 是网页存在 localStorage 里的随机 id,瓶子归谁、
// 「我的瓶子被谁喜欢」全靠它。插件要是自己生成一个,同一个人就变成两个瓶主,
// 回执永远对不上。所以插件不发明身份,只从网页抄过来。
//
// content script 跑在隔离世界,但 localStorage 是同源共享的,直接读写即可。
(function syncIdentity() {
  function readList(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string"; }) : [];
    } catch (e) { return []; }
  }

  var device = localStorage.getItem("yb_device") || "";
  if (!device) return;   // 网页还没生成 id,下次再说

  var pageSeen = readList("yb_seen");
  var follow = readList("yb_follow");

  chrome.storage.local.get(["seen"], function (d) {
    var extSeen = Array.isArray(d.seen) ? d.seen : [];

    // 两边的「捞过」并起来:插件里捞过的瓶子,网页不该再给一次,反之也一样
    var merged = pageSeen.slice();
    extSeen.forEach(function (s) { if (merged.indexOf(s) < 0) merged.push(s); });
    if (merged.length > 500) merged = merged.slice(-500);

    chrome.storage.local.set({ device: device, seen: merged, follow: follow });

    if (merged.length !== pageSeen.length) {
      try { localStorage.setItem("yb_seen", JSON.stringify(merged)); } catch (e) {}
    }
  });
})();
