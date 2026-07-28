// 在 YouTube / B站 的播放页上挂一个「装进瓶子」。
//
// 这里读的只有当前这一个页面的视频 id 和标题,而且是你主动点了才读。
// 插件没有 history 权限,拿不到也不想拿你的浏览记录 — 那是这个产品的底线,
// 不是省事。see README「不做什么」。
(function collector() {
  var BTN_ID = "ybottle-add";

  function currentItem() {
    var host = location.hostname;
    if (host.indexOf("youtube.com") >= 0) {
      var m = location.search.match(/[?&]v=([A-Za-z0-9_-]{11})/);
      if (!m) return null;
      var t = document.querySelector("h1.ytd-watch-metadata yt-formatted-string")
        || document.querySelector("h1.title yt-formatted-string")
        || document.querySelector("h1");
      return { vid: m[1], title: (t ? t.textContent : document.title).trim().slice(0, 120) };
    }
    if (host.indexOf("bilibili.com") >= 0) {
      var b = location.pathname.match(/\/video\/(BV[A-Za-z0-9]{10})/);
      if (!b) return null;
      // B站把 Cloudflare 机房 IP 整段封了,服务端取不到元数据。
      // 在页面上直接读 DOM 反而是最稳的一条路,顺手把封面也带走
      var h = document.querySelector("h1.video-title, .video-title, h1");
      var cover = document.querySelector('meta[itemprop="image"], meta[property="og:image"]');
      return {
        bvid: b[1],
        title: (h ? (h.getAttribute("title") || h.textContent) : document.title)
          .trim().replace(/_哔哩哔哩.*$/, "").slice(0, 120),
        thumb: cover ? cover.getAttribute("content") || "" : "",
      };
    }
    return null;
  }

  function anchor() {
    if (location.hostname.indexOf("youtube.com") >= 0) {
      return document.querySelector("#top-level-buttons-computed")
        || document.querySelector("#actions-inner #menu");
    }
    return document.querySelector(".video-toolbar-left, .toolbar-left, .video-toolbar");
  }

  function mount() {
    var item = currentItem();
    var old = document.getElementById(BTN_ID);
    if (!item) { if (old) old.remove(); return; }
    if (old) return;
    var host = anchor();
    if (!host) return;

    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.className = "ybottle-btn";
    btn.type = "button";
    btn.textContent = "🍾 装进瓶子";
    btn.onclick = function () { add(item, btn); };
    host.appendChild(btn);
  }

  function add(item, btn) {
    chrome.storage.local.get(["pending"], function (d) {
      var pending = Array.isArray(d.pending) ? d.pending : [];
      var key = item.bvid || item.vid;
      if (pending.some(function (p) { return (p.bvid || p.vid) === key; })) {
        flash(btn, "✅ 已经装过了");
        return;
      }
      // 网页那边一瓶最多 10 条,这里保持一致,满了就提示先扔出去
      if (pending.length >= 10) {
        flash(btn, "🍾 瓶子满了，先扔出去");
        return;
      }
      pending.push(item);
      chrome.storage.local.set({ pending: pending }, function () {
        flash(btn, "🍾 装进瓶子（" + pending.length + "）");
      });
    });
  }

  function flash(btn, text) {
    btn.textContent = text;
    btn.classList.add("ybottle-ok");
    setTimeout(function () {
      btn.textContent = "🍾 装进瓶子";
      btn.classList.remove("ybottle-ok");
    }, 1800);
  }

  // YouTube 和 B站 都是单页应用,换视频不重新加载文档,所以得盯着 url 变化
  var lastUrl = location.href;
  setInterval(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      var old = document.getElementById(BTN_ID);
      if (old) old.remove();
      setTimeout(mount, 900);
    } else if (!document.getElementById(BTN_ID)) {
      mount();
    }
  }, 1200);

  mount();
})();
