// 捞瓶面板的全部逻辑。入口只有一个:点工具栏图标弹出的 popup。
//
// 这里不接管新标签页。2026-07-28 曾经加过 chrome_url_overrides,当天被 BK 否掉:
// 改别人的新标签页等于把人家主页换了,是浏览器插件里最招人恨的一类行为,而且跟
// 这个产品「不读你的记录、不要你的账号、不给你算法」的立意直接冲突 —— 为了回访
// 指标去动用户的领地,正是它该反对的事。check.py 里有一条硬检查守着,别再加回来。
var state = {
  device: "", seen: [], follow: [], liked: [], pending: [],
  lastBottle: null, lastBy: "", lastId: "", myName: "",
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

  load(["device", "seen", "follow", "liked", "pending", "lastGood", "fishes", "rated"]).then(function (d) {
    state.fishes = d.fishes || 0;
    state.rated = !!d.rated;
    state.device = d.device || "";
    state.seen = Array.isArray(d.seen) ? d.seen : [];
    state.follow = Array.isArray(d.follow) ? d.follow : [];
    state.liked = Array.isArray(d.liked) ? d.liked : [];
    state.pending = Array.isArray(d.pending) ? d.pending : [];
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
    return;
  }
  if (d.id && state.seen.indexOf(d.id) < 0) {
    state.seen.push(d.id);
    if (state.seen.length > 500) state.seen = state.seen.slice(-500);
    save({ seen: state.seen });
  }
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
  maybeRate();
}

// 捞够 5 次才问一句评分,问过一次就不再问。放在捞到瓶子之后 ——
// 还没见到东西就被要五星,是插件最讨人厌的那种行为
function maybeRate() {
  state.fishes = (state.fishes || 0) + 1;
  save({ fishes: state.fishes });
  if (state.rated || state.fishes < 5) return;
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
