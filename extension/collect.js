// 在 YouTube / B站 的播放页和 Steam 的商店页/资料页上挂一个「装进瓶子」。
//
// 这里读的只有当前这一个页面的内容 id 和标题,而且是你主动点了才读。
// 插件没有 history 权限,拿不到也不想拿你的浏览记录 — 那是这个产品的底线,
// 不是省事。see README「不做什么」。
(function collector() {
  var BTN_ID = "ybottle-add";

  function currentItem() {
    var host = location.hostname;
    if (host === "store.steampowered.com") {
      var s = location.pathname.match(/^\/app\/(\d{1,7})/);
      if (!s) return null;
      // 标题只是给待扔清单看的,服务端会按 appid 自己去 Steam 取权威元数据
      var sh = document.getElementById("appHubAppName") || document.querySelector(".apphub_AppName");
      return {
        appid: s[1],
        title: (sh ? sh.textContent : document.title).trim().slice(0, 120),
      };
    }
    if (host.indexOf("youtube.com") >= 0) {
      var m = location.search.match(/[?&]v=([A-Za-z0-9_-]{11})/);
      if (!m) return null;
      var t = document.querySelector("h1.ytd-watch-metadata yt-formatted-string")
        || document.querySelector("h1.title yt-formatted-string")
        || document.querySelector("h1");
      // 频道名要一起带走:服务端拿它判断一瓶里是不是同一个号占了一半以上
      var ch = document.querySelector("ytd-channel-name a, #owner #channel-name a");
      return {
        vid: m[1],
        title: (t ? t.textContent : document.title).trim().slice(0, 120),
        author: ch ? ch.textContent.trim().slice(0, 50) : "",
      };
    }
    if (host.indexOf("bilibili.com") >= 0) {
      var b = location.pathname.match(/\/video\/(BV[A-Za-z0-9]{10})/);
      if (!b) return null;
      // B站把 Cloudflare 机房 IP 整段封了,服务端取不到元数据。
      // 在页面上直接读 DOM 反而是最稳的一条路,顺手把封面也带走
      var h = document.querySelector("h1.video-title, .video-title, h1");
      var cover = document.querySelector('meta[itemprop="image"], meta[property="og:image"]');
      var up = document.querySelector(".up-name, a.up-name, .username");
      return {
        bvid: b[1],
        title: (h ? (h.getAttribute("title") || h.textContent) : document.title)
          .trim().replace(/_哔哩哔哩.*$/, "").slice(0, 120),
        thumb: cover ? cover.getAttribute("content") || "" : "",
        author: up ? up.textContent.trim().slice(0, 50) : "",
      };
    }
    return null;
  }

  function anchor() {
    if (location.hostname.indexOf("youtube.com") >= 0) {
      return document.querySelector("#top-level-buttons-computed")
        || document.querySelector("#actions-inner #menu");
    }
    if (location.hostname === "store.steampowered.com") {
      // 标题行右侧那块(社区中心按钮所在),没有就退到标题区。年龄门页两个都没有,不挂
      return document.querySelector(".apphub_OtherSiteInfo")
        || document.querySelector(".page_title_area");
    }
    return document.querySelector(".video-toolbar-left, .toolbar-left, .video-toolbar");
  }

  // Steam 资料页「最近活动」里的几个游戏,一键全装。只在点击时读当前页 DOM
  function steamRecentItems() {
    var out = [], seen = {};
    var blocks = document.querySelectorAll(".recent_games .recent_game");
    for (var i = 0; i < blocks.length; i++) {
      var a = blocks[i].querySelector('a[href*="/app/"]');
      var m = a && a.href.match(/\/app\/(\d{1,7})/);
      if (!m || seen[m[1]]) continue;
      seen[m[1]] = 1;
      var n = blocks[i].querySelector(".game_name a") || blocks[i].querySelector(".game_name");
      out.push({ appid: m[1], title: n ? n.textContent.trim().slice(0, 120) : "" });
    }
    return out;
  }

  function mountSteamProfile() {
    if (document.getElementById(BTN_ID)) return;
    var box = document.querySelector(".recent_games");
    if (!box || !steamRecentItems().length) return;
    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.className = "ybottle-btn";
    btn.type = "button";
    btn.style.marginBottom = "8px";
    btn.textContent = chrome.i18n.getMessage("collectSteam");
    btn.onclick = function () { addMany(steamRecentItems(), btn); };
    box.parentNode.insertBefore(btn, box);
  }

  // B站播放页(顶栏在内)是页面自己的脚本慢慢渲染出来的,顶栏能晚到十几秒。
  // 在它接管完 DOM 之前就往工具栏里塞按钮,会搅乱它的渲染 —— 2026-08-20 两位
  // 用户实测「插件开着顶栏就消失、关掉就恢复」,机器越慢越容易撞上。
  // 所以 B站上等顶栏渲染完(#biliMainHeader 有了内容)再挂按钮;轮询每 1.2 秒
  // 会一直重试,不会漏挂。万一顶栏本身坏了,45 秒后也放行,别让按钮跟着陪葬。
  var t0 = Date.now();
  function biliSettled() {
    if (location.hostname.indexOf("bilibili.com") < 0) return true;
    var h = document.getElementById("biliMainHeader");
    if (!h) return true;   // 没有这个容器的版式,没有可搅乱的东西,照旧
    // 判据用「顶栏里有搜索框」而不是「有子元素」:空壳期是 0 个子元素,
    // 但渲染中途可能先塞骨架占位,光数子元素会提前放行
    if (h.querySelector("input")) return true;
    return Date.now() - t0 > 45000;
  }

  function mount() {
    if (!biliSettled()) return;
    if (location.hostname === "steamcommunity.com") { mountSteamProfile(); return; }
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
    btn.textContent = chrome.i18n.getMessage("collectAdd");
    btn.onclick = function () { add(item, btn); };
    host.appendChild(btn);
  }

  function keyOf(x) { return x.appid || x.bvid || x.vid; }

  function add(item, btn) {
    chrome.storage.local.get(["pending"], function (d) {
      var pending = Array.isArray(d.pending) ? d.pending : [];
      var key = keyOf(item);
      if (pending.some(function (p) { return keyOf(p) === key; })) {
        flash(btn, chrome.i18n.getMessage("collectDup"));
        return;
      }
      // 网页那边一瓶最多 10 条,这里保持一致,满了就提示先扔出去
      if (pending.length >= 10) {
        flash(btn, chrome.i18n.getMessage("collectFull"));
        return;
      }
      pending.push(item);
      chrome.storage.local.set({ pending: pending }, function () {
        flash(btn, chrome.i18n.getMessage("collectAddN", [String(pending.length)]));
      });
    });
  }

  function addMany(items, btn) {
    chrome.storage.local.get(["pending"], function (d) {
      var pending = Array.isArray(d.pending) ? d.pending : [];
      var added = 0;
      items.forEach(function (item) {
        if (pending.length >= 10) return;
        if (pending.some(function (p) { return keyOf(p) === keyOf(item); })) return;
        pending.push(item);
        added++;
      });
      if (!added) {
        flash(btn, chrome.i18n.getMessage(pending.length >= 10 ? "collectFull" : "collectDup"), "collectSteam");
        return;
      }
      chrome.storage.local.set({ pending: pending }, function () {
        flash(btn, chrome.i18n.getMessage("collectGamesN", [String(added)]), "collectSteam");
      });
    });
  }

  function flash(btn, text, resetKey) {
    btn.textContent = text;
    btn.classList.add("ybottle-ok");
    setTimeout(function () {
      btn.textContent = chrome.i18n.getMessage(resetKey || "collectAdd");
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
