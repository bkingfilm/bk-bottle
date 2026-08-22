// 捞瓶面板的全部逻辑。入口只有一个:点工具栏图标弹出的 popup。
//
// 这里不接管新标签页。2026-07-28 曾经加过 chrome_url_overrides,当天被 BK 否掉:
// 改别人的新标签页等于把人家主页换了,是浏览器插件里最招人恨的一类行为,而且跟
// 这个产品「不读你的记录、不要你的账号、不给你算法」的立意直接冲突 —— 为了回访
// 指标去动用户的领地,正是它该反对的事。check.py 里有一条硬检查守着,别再加回来。
var state = {
  device: "", seen: [], follow: [], liked: [], pending: [],
  hist: [], histIdx: -1,
  lastBottle: null, lastBy: "", lastId: "", myName: "",
  myBottles: null, nudgedAt: 0,
};

// 界面文案全走 _locales。HTML 里写的中文只是没加载完之前的兜底,
// 真正显示的是 M() 取回来的那一份 —— 改文案改 _locales,别改这里
function M(k, a) { return chrome.i18n.getMessage(k, a) || ""; }

var box, pbox, btnThrow, elWho, elReceipt;

document.addEventListener("DOMContentLoaded", function () {
  box = document.getElementById("box");
  pbox = document.getElementById("pending");
  btnThrow = document.getElementById("btnThrow");
  elWho = document.getElementById("who");
  elReceipt = document.getElementById("receipt");

  [["brand", "brand"], ["btnAgain", "btnAgain"],
   ["footPrivacy", "footNoHistory"], ["footStar", "footStar"]].forEach(function (p) {
    var el = document.getElementById(p[0]);
    if (el) el.textContent = M(p[1]);
  });

  // 版本号从 manifest 读,别在 HTML 里写死 —— 写死了每次升版本要改两个地方,
  // 迟早忘一个
  var ver = document.getElementById("ver");
  if (ver && chrome.runtime && chrome.runtime.getManifest) {
    ver.textContent = "v" + chrome.runtime.getManifest().version;
  }

  btnThrow.onclick = throwPending;
  document.getElementById("btnAgain").onclick = fish;

  // popup 高度有限,清单默认收起
  var sec = document.getElementById("psec");
  if (sec) {
    pbox.classList.add("hide");
    sec.onclick = function () {
      sec.classList.toggle("open");
      pbox.classList.toggle("hide");
    };
  }

  // 收藏组同样默认收起,交互与上面那组一致
  var lsec = document.getElementById("lsec");
  var lbox = document.getElementById("likedBox");
  if (lsec && lbox) {
    lsec.onclick = function () {
      lsec.classList.toggle("open");
      lbox.classList.toggle("hide");
    };
  }

  load(["device", "seen", "follow", "liked", "pending", "lastGood", "fishes", "rated", "hist",
        "nudgedAt"]).then(function (d) {
    state.fishes = d.fishes || 0;
    state.nudgedAt = d.nudgedAt || 0;
    state.rated = !!d.rated;
    state.device = d.device || "";
    state.seen = Array.isArray(d.seen) ? d.seen : [];
    state.follow = Array.isArray(d.follow) ? d.follow : [];
    state.liked = Array.isArray(d.liked) ? d.liked : [];
    state.pending = Array.isArray(d.pending) ? d.pending : [];
    state.hist = Array.isArray(d.hist) ? d.hist : [];
    state.histIdx = state.hist.length - 1;
    drawPending();
    drawLiked();
    fish();
    if (state.device) receipt(d.lastGood || 0);
    else hintBind();
  });
});

// 没跟网页对接过就还没有身份,提示一句。瓶子照样能捞,只是不算在他名下
function hintBind() {
  elWho.innerHTML = '<a id="bindLink" href="#" style="color:var(--amber)">' + esc(M("notBound")) + "</a>";
  var a = document.getElementById("bindLink");
  if (a) a.onclick = function (e) { e.preventDefault(); openSite("/"); };
}

function fish() {
  box.innerHTML = '<div class="wave">🎣🌊</div>';
  fetch(API + "/api/fish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device: state.device, seen: state.seen, follow: state.follow, src: "chrome-ext",
    }),
  })
    .then(function (r) { return r.json(); })
    .then(render)
    .catch(function () {
      box.innerHTML = '<div class="empty">' + esc(M("netDown")) + "</div>";
    });
}

function render(d) {
  if (d.empty) {
    // 这里不再铺一份收藏 —— 下面那个常驻的收藏组已经有了,铺两遍是同一批卡片
    box.innerHTML = '<div class="empty">'
      + M(d.exhausted ? "seaEmptyAll" : "seaEmpty") + "</div>";
    var w = document.getElementById("goodWrap");
    if (w) w.innerHTML = "";   // 没瓶子可评,这一格空着,让「再捞一个」占满
    updateNav();   // 捞空了照样能往回翻,入口不能跟着消失
    return;
  }
  if (d.id && state.seen.indexOf(d.id) < 0) {
    state.seen.push(d.id);
    if (state.seen.length > 500) state.seen = state.seen.slice(-500);
    save({ seen: state.seen });
  }
  pushHist(d);
  draw(d);
  bumpFish();      // 捞瓶计数，两条引导都靠它
  maybeNudge();    // 扔瓶引导排在评分前面：一个对这片海有用，一个只对商店排名有用
  maybeRate();
}

// 只管画。进不进历史由调用方决定 —— 真捞的走 render,往回翻的走 goHist
function draw(d) {
  state.lastBottle = d.videos || [];
  state.lastBy = d.by || "";
  state.lastId = d.id || "";

  var html = "";
  if (d.by) {
    html += '<div class="by">' + esc(M("fromWho")) + " <b>" + esc(d.by) + "</b>"
      + (state.follow.indexOf(d.by) >= 0 ? esc(M("followedMark")) : "") + "</div>";
  }
  html += '<div class="vlist cap">'
    + (d.videos || []).map(function (v) { return cardHtml(v); }).join("") + "</div>";
  box.innerHTML = html;
  showGood();
  updateNav();
}

// 「上一瓶」的回看历史。捞过的瓶原本划走就再也找不回来,而人常常是没看清、
// 或者犹豫了一下才想回头,所以本地留最近 20 瓶。跟收藏是两回事:收藏得点一下
// 才存,历史是捞了就自动进。只落 chrome.storage.local,不上报服务端。
// 网页那边是同一套做法(yb_hist),但两边各存各的 —— bridge.js 只对身份和
// 「捞过」,不同步历史:popup 和整页尺寸差太多,合成一条反而两头别扭
function pushHist(d) {
  state.hist.push({ id: d.id || "", by: d.by || "", videos: d.videos || [] });
  if (state.hist.length > 20) state.hist = state.hist.slice(-20);
  state.histIdx = state.hist.length - 1;
  save({ hist: state.hist });
}

// 往回翻不重新请求,整瓶都在本地,所以既不会给这瓶多记一次「被捞」,
// 也不会因为翻两下就把海里没捞过的瓶白白消耗掉(seen 一个字都不动)
function goHist(step) {
  var i = state.histIdx + step;
  if (i < 0 || i >= state.hist.length) return;
  state.histIdx = i;
  draw(state.hist[i]);
}

// 两个入口按需出现。popup 就那么高,没得翻的时候整行收掉,不留空档。
// 用 createElement + textContent 而不是拼 innerHTML:文案来自 _locales,
// 带 emoji 和箭头,拼字符串迟早在转义上出岔子
function updateNav() {
  var nav = document.getElementById("histNav");
  var pw = document.getElementById("prevWrap");
  var nw = document.getElementById("nextWrap");
  if (!nav || !pw || !nw) return;
  var canPrev = state.histIdx > 0;
  var canNext = state.histIdx >= 0 && state.histIdx < state.hist.length - 1;
  pw.innerHTML = "";
  nw.innerHTML = "";
  if (canPrev) pw.appendChild(navBtn("btnPrev", -1));
  if (canNext) nw.appendChild(navBtn("btnNext", 1));
  nav.style.display = (canPrev || canNext) ? "flex" : "none";
}

function navBtn(key, step) {
  var b = document.createElement("button");
  b.className = "ghost";
  b.id = key;
  b.textContent = M(key);
  b.onclick = function () { goHist(step); };
  return b;
}

// 捞够 5 次才问一句评分,问过一次就不再问。放在捞到瓶子之后 ——
// 还没见到东西就被要五星,是插件最讨人厌的那种行为
function bumpFish() {
  state.fishes = (state.fishes || 0) + 1;
  save({ fishes: state.fishes });
}

function maybeRate() {
  // nudgeShown 在这里挡一下：两条引导同时弹就是在吵，
  // 而这两条里要是只能留一条，留叫人扔瓶那条
  if (state.rated || state.fishes < 5 || nudgeShown) return;
  var el = document.getElementById("rate");
  if (!el) return;
  el.innerHTML = "<span>" + esc(M("rateAsk")) + "</span>"
    + '<button class="go" id="rateGo">' + esc(M("rateGo")) + "</button>"
    + '<button id="rateNo">' + esc(M("rateLater")) + "</button>";
  el.classList.add("on");
  var done = function () {
    state.rated = true;
    save({ rated: true });
    el.classList.remove("on");
  };
  document.getElementById("rateGo").onclick = function () {
    chrome.tabs.create({ url: STORE_URL + "/reviews" });
    done();
    window.close();
  };
  document.getElementById("rateNo").onclick = done;
}

// 扔瓶引导：捞够 3 瓶、而自己一瓶都没扔过的人，才提这一句。
// 网页那边 2026-07 就有这条（public/index.html 的 #nudge），插件一直没有，
// 而插件的卖点正是「捞一瓶就是点一下工具栏，不用先开那一页」，
// 所以装了插件的人反而永远碰不到它。2026-08-22 的数：1022 个捞过瓶的设备
// 里只有 167 个扔过，插件装机 116 而当天新瓶 0 条。
//
// 跟网页版有两处不同，都是故意的：
// 一、网页那条一辈子只弹一次（yb_nudged 写下就永不再弹），这里改成 7 天一次。
//    第一次捞满 3 瓶时人还没觉得「这海里该有我一份」，那一下弹早了，弹早了就废了。
// 二、瓶子数走 /api/mine 的 bottles，拿不到（没绑身份、接口挂了）就不弹。
//    对一个已经扔过瓶的人说「海里还没有你的」，比不说更糟。
var NUDGE_AT = 3;
var NUDGE_COOLDOWN = 7 * 24 * 3600 * 1000;
var nudgeShown = false;

function maybeNudge() {
  if (nudgeShown) return;
  if ((state.fishes || 0) < NUDGE_AT) return;
  if (state.myBottles !== 0) return;   // null（还没问到）也在这里挡掉
  if (Date.now() - (state.nudgedAt || 0) < NUDGE_COOLDOWN) return;
  var el = document.getElementById("nudge");
  if (!el) return;
  nudgeShown = true;
  state.nudgedAt = Date.now();
  save({ nudgedAt: state.nudgedAt });
  el.innerHTML = esc(M("nudge", [String(state.fishes)]))
    + '<div class="row">'
    + '<button class="go" id="nudgeGo">' + esc(M("nudgeGo")) + "</button>"
    + '<button id="nudgeNo">' + esc(M("nudgeLater")) + "</button>"
    + "</div>";
  el.classList.add("on");
  document.getElementById("nudgeGo").onclick = function () { hideNudge(); goThrow(); };
  document.getElementById("nudgeNo").onclick = hideNudge;
}

function hideNudge() {
  var el = document.getElementById("nudge");
  if (el) el.classList.remove("on");
}

// 「去扔一瓶」落到哪：清单里有货就把那一组展开滑过去，让他自己看一眼再扔，
// 不替他按下发送；空清单就去网页那条手动贴链接的路，跟 btnThrowEmpty 同一个去处
function goThrow() {
  if (!state.pending.length) { openSite("/#throw"); return; }
  var sec = document.getElementById("psec");
  if (sec && !sec.classList.contains("open")) sec.click();
  var grp = document.getElementById("pgroup");
  if (grp && grp.scrollIntoView) grp.scrollIntoView({ behavior: "smooth", block: "center" });
}

// 「收藏」跟「再捞一个」并排在 box 外面的那一排里,所以换瓶时要把它重置回可点状态
function showGood() {
  var w = document.getElementById("goodWrap");
  if (!w) return;
  w.innerHTML = '<button class="ghost" id="goodBtn">' + esc(M("btnGood")) + "</button>";
  document.getElementById("goodBtn").onclick = good;
}

function cardHtml(v) {
  // 游戏卡片和网页同一条红线:只有封面+名字,点开跳 Steam,零促销元素
  var badge = v.appid ? '<span class="pf-s">Steam</span>'
    : v.bvid ? '<span class="pf-b">B站</span>'
    : (v.list ? '<span class="pf-y">YouTube</span>📃 ' : '<span class="pf-y">YouTube</span>');
  var host = v.appid ? "store.steampowered.com" : v.bvid ? "bilibili.com" : "youtube.com";
  return '<a class="vcard" href="' + esc(itemUrl(v)) + '" target="_blank" rel="noopener">'
    + '<img loading="lazy" referrerpolicy="no-referrer" src="' + esc(itemThumb(v)) + '" alt="">'
    + '<div><div class="t">' + badge + esc(v.title || M("openIt")) + "</div>"
    + '<div class="u">' + host + "</div></div></a>";
}

// 和网页一样只发正信号,没有「一般」:想走的人直接点「再捞一个」
function good() {
  var w = document.getElementById("goodWrap");
  if (w) w.innerHTML = '<span class="done">' + esc(M("goodDone")) + "</span>";
  if (!state.lastBottle || !state.lastId) return;
  fetch(API + "/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bottle: state.lastId, verdict: "good", device: state.device }),
  }).catch(function () {});
  state.liked.push({ by: state.lastBy, v: state.lastBottle });
  if (state.liked.length > 20) state.liked = state.liked.slice(-20);
  save({ liked: state.liked });
  drawLiked();   // 刚收的这瓶要立刻出现在下面那组里
}

// 收藏的卡片列表(纯本地)。倒序 —— 最近收的排最上面
function likedCards(limit) {
  return state.liked.slice().reverse().slice(0, limit)
    .map(function (x) {
      return (x.v || []).map(function (v) { return cardHtml(v); }).join("");
    }).join("");
}

// 常驻收藏组:折叠头挂数量,展开给全部 20 瓶(本地存量上限就是 20)。
// 一瓶没收藏就整组不存在 —— popup 只有 600px 高,空组不配占位置
function drawLiked() {
  var grp = document.getElementById("lgroup");
  var box = document.getElementById("likedBox");
  var cnt = document.getElementById("lcount");
  if (!grp || !box) return;
  var n = state.liked.length;
  grp.classList.toggle("empty", !n);
  if (!n) { box.innerHTML = ""; return; }
  if (cnt) cnt.innerHTML = "<b>" + n + "</b>";
  document.getElementById("lsecTitle").innerHTML =
    esc(M("likedSec")) + ' <span class="arrow">▾</span>';
  box.innerHTML = likedCards(20);
}

function drawPending() {
  var n = state.pending.length;
  var grp = document.getElementById("pgroup");
  document.getElementById("pcount").innerHTML = n ? "<b>" + n + "</b> / 10" : "";
  // 空清单收成一行,但按钮始终可点 —— 禁用或藏起来的话,面板里就没有扔瓶的
  // 入口了,想扔的人只看到一行说明文字,不知道该点哪(2026-07-28 BK 反馈)
  if (grp) grp.classList.toggle("lean", !n);
  btnThrow.textContent = M(n ? "btnThrow" : "btnThrowEmpty");
  btnThrow.disabled = false;
  if (!n) {
    document.getElementById("psec").firstElementChild.textContent = M("pendingEmpty");
    pbox.innerHTML = "";
    pbox.classList.add("hide");
    return;
  }
  document.getElementById("psec").firstElementChild.innerHTML =
    esc(M("pendingTitle")) + ' <span class="arrow">▾</span>';
  pbox.innerHTML = "";
  state.pending.forEach(function (v, i) {
    var row = document.createElement("div");
    row.className = "prow";
    row.innerHTML = '<span class="pf">' + (v.appid ? "Steam" : v.bvid ? "B站" : "YT") + "</span>"
      + '<span class="t">' + esc(v.title || itemKey(v)) + "</span>";
    var del = document.createElement("button");
    del.className = "del";
    del.title = M("removeTip");
    del.textContent = "✕";
    del.onclick = function () {
      state.pending.splice(i, 1);
      save({ pending: state.pending }).then(drawPending);
    };
    row.appendChild(del);
    pbox.appendChild(row);
  });
}

// 直接扔。身份用的是 bridge.js 从网页同步来的同一个 device,所以瓶主不会分裂,
// 回执也对得上。校验(视频是否真实存在、频道集中度、每 IP 日限、敏感词)全在服务端,
// 插件只负责把清单发上去、把结果显示出来。
//
// 清单空着时按钮变成「去网页扔一瓶」,那条路留给手动贴链接的场景。
function throwPending() {
  if (!state.pending.length) { openSite("/#throw"); return; }

  var payload = { device: state.device, videos: [], lists: [], bilis: [], steams: [] };
  state.pending.forEach(function (v) {
    if (v.bvid) {
      // B站 元数据只能由浏览器带上来:服务端那边机房 IP 调 B站 接口被 -412 全封
      payload.bilis.push({
        id: v.bvid, title: v.title || "", author: v.author || "", thumb: v.thumb || "",
      });
    } else if (v.appid) {
      // Steam 标题服务端会按 appid 自己取权威版,这里带上的只是回落
      payload.steams.push({ id: v.appid, title: v.title || "", thumb: v.thumb || "" });
    } else if (v.list) payload.lists.push(v.list);
    else if (v.vid) payload.videos.push(v.vid);
  });

  btnThrow.disabled = true;
  btnThrow.textContent = M("throwing");
  fetch(API + "/api/throw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) throw new Error(d.error || M("throwFail"));
      state.pending = [];
      save({ pending: [] });
      drawPending();
      note(M("throwOk", [String(d.count)]), "ok");
    })
    .catch(function (e) {
      btnThrow.disabled = false;
      btnThrow.textContent = M("btnThrow");
      note(String(e.message || e), "err");
    });
}

// 一行提示,压在待扔那一组下面。成功和失败都用它,免得再开弹窗
function note(text, kind) {
  var el = document.getElementById("pnote");
  if (!el) return;
  el.textContent = text;
  el.className = "pnote " + kind;
  if (kind === "ok") setTimeout(function () { el.className = "pnote"; }, 6000);
}

function openSite(path) {
  chrome.tabs.create({ url: API + path });
  window.close();
}


// 回执:自己的瓶子被人收藏。插件对回访真正的作用在这句话 ——
// 网页版得等他自己想起来回来才看得到
function receipt(lastGood) {
  fetch(API + "/api/mine?device=" + encodeURIComponent(state.device))
    .then(function (r) { return r.json(); })
    .then(function (m) {
      var g = m.good || 0;
      if (g > lastGood) {
        elReceipt.textContent = M("receiptGood", [String(g - lastGood)]);
        elReceipt.classList.add("on");
      }
      state.myBottles = m.bottles || 0;
      maybeNudge();   // 这个接口是异步的，第一次捞到瓶时它多半还没回来，所以这里补一次
      state.myName = m.name || "";
      if (state.myName) {
        var yys = m.yys || (m.good || 0) * 2;
        // 代号默认打码,点一下才显示:截图是这个产品的主要传播方式,常驻明文
        // 等于每张截图都把「谁截的图」和「瓶子署名」绑死,发得越多烧得越快。
        // 星号定长三颗,不按代号长度来,免得长度本身漏信息
        var whoFull = esc(M("whoIs")) + " <b>" + esc(state.myName) + "</b>"
          + (yys ? " · <b>" + yys + "</b> yys" : "");
        var whoShown = false;
        var drawWho = function () {
          elWho.innerHTML = whoShown ? whoFull : M("whoMasked");
          elWho.title = M(whoShown ? "whoHide" : "whoShow");
        };
        elWho.style.cursor = "pointer";
        elWho.onclick = function () { whoShown = !whoShown; drawWho(); };
        drawWho();
      }
      save({ lastGood: g });
    })
    .catch(function () {});
}
