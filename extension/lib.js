// 插件和网页共用同一片海。这里只有读 API 和本地存储,不写后端:
// 扔瓶一律交给网页完成(见 throwPending),这样瓶主身份只有一个,回执才对得上。
var API = "https://b.bking.film";

// 网页那边 localStorage 用 yb_ 前缀,插件这边 chrome.storage.local 用同名 key,
// bridge.js 负责在 b.bking.film 页面上把两边对起来
function load(keys) {
  return new Promise(function (r) { chrome.storage.local.get(keys, r); });
}

function save(obj) {
  return new Promise(function (r) { chrome.storage.local.set(obj, r); });
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

// 待扔清单的条目统一成 {vid|bvid, title},和网页的视频对象保持同一形状
function itemUrl(v) {
  if (v.bvid) return "https://www.bilibili.com/video/" + v.bvid;
  if (v.list) return "https://www.youtube.com/playlist?list=" + v.list;
  return "https://www.youtube.com/watch?v=" + v.vid;
}

function itemThumb(v) {
  if (v.vid) return "https://i.ytimg.com/vi/" + v.vid + "/mqdefault.jpg";
  var t = v.thumb || "";
  // B站 的图 CDN 支持 @ 后缀缩放。卡片最宽也就 132px,原图动辄 1500px 宽,
  // 一瓶五张就是好几兆,popup 打开会明显卡一下。480w 够 2x 屏用
  if (/\.(hdslb|biliimg)\.com\//.test(t)) t = t.split("@")[0] + "@480w_270h";
  return t;
}

function itemKey(v) {
  return v.bvid || v.list || v.vid || "";
}

// 攒够了就把清单交给网页装填。网页认 #vids= 和 #bvs= 这两个 hash 参数
// (public/index.html 的 autofillFromHash),所以这里零后端改动就能接上
function pendingHash(pending) {
  var vids = [], bvs = [];
  pending.forEach(function (v) {
    if (v.vid && vids.length < 10) vids.push(v.vid);
    else if (v.bvid && bvs.length < 10) bvs.push(v.bvid);
  });
  var q = [];
  if (vids.length) q.push("vids=" + vids.join(","));
  if (bvs.length) q.push("bvs=" + bvs.join(","));
  return q.length ? API + "/#" + q.join("&") : API + "/";
}

function setBadge(n) {
  if (!chrome.action) return;
  chrome.action.setBadgeText({ text: n > 0 ? String(n) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#4dd0e1" });
}
