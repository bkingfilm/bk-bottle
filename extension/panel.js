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

var box, pbox, btnThrow, elWho, elReceipt;

document.addEventListener("DOMContentLoaded", function () {
  box = document.getElementById("box");
  pbox = document.getElementById("pending");
  btnThrow = document.getElementById("btnThrow");
  elWho = document.getElementById("who");
  elReceipt = document.getElementById("receipt");

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

  load(["device", "seen", "follow", "liked", "pending", "lastGood"]).then(function (d) {
    state.device = d.device || "";
    state.seen = Array.isArray(d.seen) ? d.seen : [];
    state.follow = Array.isArray(d.follow) ? d.follow : [];
    state.liked = Array.isArray(d.liked) ? d.liked : [];
    state.pending = Array.isArray(d.pending) ? d.pending : [];
    drawPending();
    fish();
    if (state.device) receipt(d.lastGood || 0);
    else hintBind();
  });
});

// 没跟网页对接过就还没有身份,提示一句。瓶子照样能捞,只是不算在他名下
function hintBind() {
  elWho.innerHTML = '<a id="bindLink" href="#" style="color:var(--amber)">未连接身份</a>';
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
      box.innerHTML = '<div class="empty">捞网断了，再试一次</div>';
    });
}

function render(d) {
  if (d.empty) {
    box.innerHTML = '<div class="empty">'
      + (d.exhausted ? "🏆 你把整片海都捞完了<br>扔一瓶进去，等新瓶漂来"
                     : "这片海还没有瓶子<br>先扔一个，等下一个路过的人")
      + "</div>" + likedHtml();
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
    html += '<div class="by">🧭 这瓶来自 <b>' + esc(d.by) + "</b>"
      + (state.follow.indexOf(d.by) >= 0 ? " · 你记住过的瓶主" : "") + "</div>";
  }
  html += '<div class="vlist cap">' + (d.videos || []).map(cardHtml).join("") + "</div>";
  box.innerHTML = html;
  showGood();
}

// 「有意思」跟「再捞一个」并排在 box 外面的那一排里,所以换瓶时要把它重置回可点状态
function showGood() {
  var w = document.getElementById("goodWrap");
  if (!w) return;
  w.innerHTML = '<button class="ghost" id="goodBtn">🌟 有意思</button>';
  document.getElementById("goodBtn").onclick = good;
}

function cardHtml(v) {
  var badge = v.bvid ? '<span class="pf-b">B站</span>' : (v.list ? "📃 " : "");
  var host = v.bvid ? "bilibili.com" : "youtube.com";
  return '<a class="vcard" href="' + esc(itemUrl(v)) + '" target="_blank" rel="noopener">'
    + '<img loading="lazy" referrerpolicy="no-referrer" src="' + esc(itemThumb(v)) + '" alt="">'
    + '<div><div class="t">' + badge + esc(v.title || "打开看看是什么") + "</div>"
    + '<div class="u">' + host + "</div></div></a>";
}

// 和网页一样只发正信号,没有「一般」:想走的人直接点「再捞一个」
function good() {
  var w = document.getElementById("goodWrap");
  if (w) w.innerHTML = '<span class="done">🌟 已记下</span>';
  if (!state.lastBottle || !state.lastId) return;
  fetch(API + "/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bottle: state.lastId, verdict: "good", device: state.device }),
  }).catch(function () {});
  state.liked.push({ by: state.lastBy, v: state.lastBottle });
  if (state.liked.length > 20) state.liked = state.liked.slice(-20);
  save({ liked: state.liked });
}

// 捞空之后不能是死胡同,把说过有意思的几瓶留着当收藏夹(纯本地)
function likedHtml() {
  if (!state.liked.length) return "";
  return '<div class="by" style="margin-top:16px">你说过有意思的这几瓶：</div>'
    + '<div class="vlist">'
    + state.liked.slice().reverse().slice(0, 4)
        .map(function (x) { return (x.v || []).map(cardHtml).join(""); }).join("")
    + "</div>";
}

function drawPending() {
  var n = state.pending.length;
  var grp = document.getElementById("pgroup");
  document.getElementById("pcount").innerHTML = n ? "<b>" + n + "</b> / 10" : "";
  // 空清单收成一行,但按钮始终可点 —— 禁用或藏起来的话,面板里就没有扔瓶的
  // 入口了,想扔的人只看到一行说明文字,不知道该点哪(2026-07-28 BK 反馈)
  if (grp) grp.classList.toggle("lean", !n);
  btnThrow.textContent = n ? "扔进海里" : "🍾 去网页扔一瓶";
  btnThrow.disabled = false;
  if (!n) {
    document.getElementById("psec").firstElementChild.innerHTML =
      "在 YouTube 或 B站 点「装进瓶子」可以攒着一起扔";
    pbox.innerHTML = "";
    pbox.classList.add("hide");
    return;
  }
  document.getElementById("psec").firstElementChild.innerHTML =
    '🍾 待扔的瓶子 <span class="arrow">▾</span>';
  pbox.innerHTML = "";
  state.pending.forEach(function (v, i) {
    var row = document.createElement("div");
    row.className = "prow";
    row.innerHTML = '<span class="pf">' + (v.bvid ? "B站" : "YT") + "</span>"
      + '<span class="t">' + esc(v.title || itemKey(v)) + "</span>";
    var del = document.createElement("button");
    del.className = "del";
    del.title = "拿出来";
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

  var payload = { device: state.device, videos: [], lists: [], bilis: [] };
  state.pending.forEach(function (v) {
    if (v.bvid) {
      // B站 元数据只能由浏览器带上来:服务端那边机房 IP 调 B站 接口被 -412 全封
      payload.bilis.push({
        id: v.bvid, title: v.title || "", author: v.author || "", thumb: v.thumb || "",
      });
    } else if (v.list) payload.lists.push(v.list);
    else if (v.vid) payload.videos.push(v.vid);
  });

  btnThrow.disabled = true;
  btnThrow.textContent = "正在扔…";
  fetch(API + "/api/throw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) throw new Error(d.error || "扔失败了");
      state.pending = [];
      save({ pending: [] });
      drawPending();
      note("🍾 装了 " + d.count + " 个视频的瓶子已经飘进海里", "ok");
    })
    .catch(function (e) {
      btnThrow.disabled = false;
      btnThrow.textContent = "扔进海里";
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


// 回执:自己的瓶子被人说有意思。插件对回访真正的作用在这句话 ——
// 网页版得等他自己想起来回来才看得到
function receipt(lastGood) {
  fetch(API + "/api/mine?device=" + encodeURIComponent(state.device))
    .then(function (r) { return r.json(); })
    .then(function (m) {
      var g = m.good || 0;
      if (g > lastGood) {
        elReceipt.textContent = "🌟 又有 " + (g - lastGood) + " 个人说你的瓶子有意思";
        elReceipt.classList.add("on");
      }
      state.myName = m.name || "";
      if (state.myName) elWho.innerHTML = "你是 <b>" + esc(state.myName) + "</b>";
      save({ lastGood: g });
    })
    .catch(function () {});
}
