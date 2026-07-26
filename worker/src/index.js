// 漂流瓶 Cloudflare Worker 版。与本地 server.py 同一套规则:
// 无留言字段 / oEmbed 验证视频真实存在 / 频道集中度拒收 / 每 IP 每日限扔 / 质量加权捞瓶。
// 存储: KV。每个瓶子一个 key(b:开头),metadata 里存 {d:设备, g:好评数, b:差评数} 供捞瓶加权。
import HTML from "./index.html";
import ICON192 from "./icon-192.png";
import ICON512 from "./icon-512.png";

// 装到手机桌面后,YouTube 分享菜单里会出现本站,分享的链接落到 /?share=...
const MANIFEST = {
  name: "BK漂流瓶",
  short_name: "漂流瓶",
  description: "匿名交换陌生人正在看的视频，看看信息茧房外面长什么样",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#071a2b",
  theme_color: "#0d2c46",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  ],
  share_target: {
    action: "/",
    method: "GET",
    params: { title: "title", text: "text", url: "share" },
  },
};

// 最小 service worker:只为满足「可安装」条件,不做离线缓存(内容本来就要联网)
const SW = "self.addEventListener('install',function(){self.skipWaiting()});"
  + "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});"
  + "self.addEventListener('fetch',function(){});";

const VID_RE = /^[A-Za-z0-9_-]{11}$/;
const LIST_RE = /^[A-Za-z0-9_-]{12,50}$/;
const BILI_RE = /^(BV[A-Za-z0-9]{10}|av\d{1,12})$/;
const THROWS_PER_DAY = 5;
const MAX_BODY = 16384;

// 命中即影子删除:扔瓶人看到正常成功,瓶子存进 q: 隔离区,永不出现在捞瓶池。
// 简繁双版本;宁可误伤不可漏放。
const SENSITIVE = [
  "习近平", "習近平", "江泽民", "江澤民", "毛泽东", "毛澤東", "邓小平", "鄧小平",
  "胡锦涛", "胡錦濤", "温家宝", "溫家寶", "李克强", "李克強", "彭丽媛",
  "六四", "天安门", "天安門", "坦克人", "法轮功", "法輪功", "达赖", "達賴",
  "台独", "台獨", "港独", "港獨", "藏独", "藏獨", "疆独", "疆獨",
  "民运", "民運", "反送中", "国安法", "國安法", "颠覆国家", "顛覆國家",
  "共产党", "共產黨", "中共", "文革", "大跃进", "大躍進", "刘晓波", "劉曉波",
  "四通桥", "四通橋", "白纸运动", "白紙運動", "翻墙", "翻牆", "润学", "潤學",
  "政治庇护", "政治庇護", "政治犯", "维权", "維權", "异见", "異見",
];

function hitsSensitive(items) {
  return items.some((x) => {
    const text = (x.title || "") + (x.author || "");
    return SENSITIVE.some((w) => text.includes(w));
  });
}

// KV 免费额度每天只有 1000 次写和 1000 次 list(读有 10 万)。原本每次捞瓶都 list+put、
// 每次开首页都 list,几百次访问就烧掉一半额度。索引改走 isolate 内存缓存,
// 被捞计数改抽样写入(1/10 概率写、每次记 10,总量统计无偏,单瓶数字变成估算)。
const INDEX_TTL = 60000;
const FISH_SAMPLE = 10;
let INDEX_CACHE = { keys: null, at: 0 };

async function getIndex(env) {
  if (INDEX_CACHE.keys && Date.now() - INDEX_CACHE.at < INDEX_TTL) return INDEX_CACHE.keys;
  const list = await env.BOTTLES.list({ prefix: "b:", limit: 1000 });
  INDEX_CACHE = { keys: list.keys, at: Date.now() };
  return list.keys;
}

function invalidateIndex() {
  INDEX_CACHE = { keys: null, at: 0 };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// 匿名但稳定的瓶主代号:同一设备永远是同一个代号,不暴露 device 本身。
// 建立「我信任这个陌生人的品味」的复利关系,也是将来「记住这个瓶主」的接口。
const SEA_WORDS = [
  "灯塔", "浮标", "罗盘", "鲸落", "暗流", "礁石", "贝壳", "海星", "水母", "珊瑚",
  "潮汐", "海雾", "桅杆", "渔火", "涛声", "海沟", "洋流", "信天翁", "海豚", "旗鱼",
  "玳瑁", "沉锚", "海图", "月光", "汽笛", "北斗", "远帆", "夜航", "冰山", "季风",
];

function nickname(device) {
  if (!device) return "海雾 500";
  let h = 5381;
  for (let i = 0; i < device.length; i++) h = ((h * 33) ^ device.charCodeAt(i)) >>> 0;
  // 三位数把代号空间放到 27000 种,「记住这个瓶主」按代号匹配才不容易串号
  return SEA_WORDS[h % SEA_WORDS.length] + " " + ((h >>> 5) % 900 + 100);
}

function weight(meta) {
  const g = (meta && meta.g) || 0;
  const b = (meta && meta.b) || 0;
  // 差评降权 0.2:「一般」多为翻页式随手点,降太狠会把小池子里的瓶子误杀沉底
  return Math.max(0.1, 1.0 + 0.5 * g - 0.2 * b);
}

function tooConcentrated(authors) {
  const known = authors.filter(Boolean).map((a) => a.trim().toLowerCase());
  if (known.length < 3) return false;
  const counts = {};
  for (const a of known) counts[a] = (counts[a] || 0) + 1;
  return Math.max(...Object.values(counts)) > known.length / 2;
}

async function fetchMeta(vid) {
  const url =
    "https://www.youtube.com/oembed?format=json&url=" +
    encodeURIComponent("https://www.youtube.com/watch?v=" + vid);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return [null, null];
    const d = await r.json();
    return [d.title || null, d.author_name || null];
  } catch (e) {
    return [null, null];
  }
}

async function fetchListMeta(lid) {
  const url =
    "https://www.youtube.com/oembed?format=json&url=" +
    encodeURIComponent("https://www.youtube.com/playlist?list=" + lid);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return [null, null, null];
    const d = await r.json();
    return [d.title || null, d.author_name || null, d.thumbnail_url || null];
  } catch (e) {
    return [null, null, null];
  }
}

// B站接口整段封禁 Cloudflare 机房 IP(-412),存在性验证改由扔瓶人浏览器 JSONP 完成,
// 服务端只做 ID 格式、字段长度与封面域名白名单清洗。
function sanitizeBilis(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .filter((x) => x && typeof x === "object" && typeof x.id === "string" && BILI_RE.test(x.id))
    .map((x) => ({
      bvid: x.id,
      title: String(x.title || "").slice(0, 100),
      author: String(x.author || "").slice(0, 50),
      thumb: /^https:\/\/[a-z0-9.-]+\.(hdslb|biliimg)\.com\//.test(x.thumb) ? String(x.thumb).slice(0, 300) : "",
    }))
    .filter((x) => x.title && !seen.has(x.bvid) && seen.add(x.bvid));
}

// 瓶子平台标签: 纯B站 bili / 纯YouTube yt / 混装 mix。存进 KV metadata 供捞瓶筛选。
function bottlePlatform(videos) {
  const hasBili = videos.some((v) => v.bvid);
  const hasYt = videos.some((v) => v.vid || v.list);
  return hasBili && hasYt ? "mix" : hasBili ? "bili" : "yt";
}

async function readBody(req, reqUrl) {
  const origin = req.headers.get("Origin");
  if (origin && new URL(origin).host !== reqUrl.host) return { err: json({ error: "来源不允许" }, 403) };
  const text = await req.text();
  if (text.length > MAX_BODY) return { err: json({ error: "请求太大" }, 413) };
  try {
    return { data: JSON.parse(text) };
  } catch (e) {
    return { err: json({ error: "请求体不是合法 JSON" }, 400) };
  }
}

async function handleThrow(req, reqUrl, env) {
  const body = await readBody(req, reqUrl);
  if (body.err) return body.err;

  const ip = req.headers.get("CF-Connecting-IP") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const rlKey = `rl:${ip}:${day}`;
  const used = parseInt((await env.BOTTLES.get(rlKey)) || "0", 10);
  if (used >= THROWS_PER_DAY) return json({ error: "今天扔得够多了，明天再来" }, 429);
  await env.BOTTLES.put(rlKey, String(used + 1), { expirationTtl: 90000 });

  let vids = Array.isArray(body.data.videos) ? body.data.videos : [];
  vids = [...new Set(vids)].filter((v) => typeof v === "string" && VID_RE.test(v));
  let lists = Array.isArray(body.data.lists) ? body.data.lists : [];
  lists = [...new Set(lists)].filter((x) => typeof x === "string" && LIST_RE.test(x));
  const bilis = sanitizeBilis(body.data.bilis);
  const total = vids.length + lists.length + bilis.length;
  if (total < 1 || total > 10) {
    return json({ error: "需要 1 到 10 个有效的 YouTube 或 B站 链接" }, 400);
  }
  // B站 元数据由扔瓶人浏览器 JSONP 拿到后带上来(机房 IP 调 B站 接口被 -412 全封)
  const device = String(body.data.device || "").slice(0, 64);

  const [vmetas, lmetas] = await Promise.all([
    Promise.all(vids.map(fetchMeta)),
    Promise.all(lists.map(fetchListMeta)),
  ]);
  const valid = vids
    .map((v, i) => ({ vid: v, title: vmetas[i][0], author: vmetas[i][1] || "" }))
    .filter((x) => x.title)
    .concat(
      lists
        .map((x, i) => ({ list: x, title: lmetas[i][0], author: lmetas[i][1] || "", thumb: lmetas[i][2] || "" }))
        .filter((x) => x.title)
    )
    .concat(bilis);
  if (!valid.length) return json({ error: "这些链接在 YouTube/B站 上都找不到对应内容" }, 400);
  if (tooConcentrated(valid.map((x) => x.author))) {
    return json({ error: "同一个频道的视频太多了，换着装点别的" }, 400);
  }

  const p = bottlePlatform(valid);

  const stamp = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  // 涉政/违规内容影子删除:对扔瓶人返回正常成功,实际存入 q: 隔离区
  const quarantine = hitsSensitive(valid);
  const id = (quarantine ? "q:" : "b:") + stamp;
  const bottle = { id, device, videos: valid, votes: {}, fished: 0, ts: Math.floor(Date.now() / 1000) };
  await env.BOTTLES.put(id, JSON.stringify(bottle), { metadata: { d: device, g: 0, b: 0, p } });
  invalidateIndex();  // 新瓶必须马上能被别人捞到
  return json({ ok: true, count: valid.length });
}

async function handleFish(req, reqUrl, env) {
  let device = "", seen = new Set(), follow = new Set();
  if (req.method === "POST") {
    const body = await readBody(req, reqUrl);
    if (body.err) return body.err;
    device = String(body.data.device || "").slice(0, 64);
    const arr = Array.isArray(body.data.seen) ? body.data.seen : [];
    seen = new Set(arr.filter((s) => typeof s === "string"));
    const fol = Array.isArray(body.data.follow) ? body.data.follow : [];
    follow = new Set(fol.filter((s) => typeof s === "string").slice(0, 50));
  } else {
    device = reqUrl.searchParams.get("device") || "";
  }
  const keys = await getIndex(env);
  // 不分池:B站和 YouTube 混在同一片海里,metadata 的 p 只留作后台统计
  const allOthers = keys.filter((k) => !k.metadata || k.metadata.d !== device);
  const others = allOthers.filter((k) => !seen.has(k.name));
  if (!others.length) return json({ empty: true, exhausted: allOthers.length > 0 });

  // 记住过的瓶主有新瓶时,七成概率先给他的;剩下三成留给陌生人,别把海变成关注流
  const fromFollowed = follow.size
    ? others.filter((k) => follow.has(nickname((k.metadata || {}).d)))
    : [];
  const pool = fromFollowed.length && Math.random() < 0.7 ? fromFollowed : others;

  const weights = pool.map((k) => weight(k.metadata));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  let picked = pool[0];
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) { picked = pool[i]; break; }
  }

  // 访客登记:只捞不扔的人原本完全隐形。天数存进 metadata,list 时零额外读取就能统计回访。
  // 同一设备同一天只写一次,写失败不能影响捞瓶本身
  if (device) {
    try {
      const vkey = "v:" + device;
      const today = new Date().toISOString().slice(0, 10);
      const got = await env.BOTTLES.getWithMetadata(vkey);
      if (got.value === null && !got.metadata) {
        await env.BOTTLES.put(vkey, "1", { metadata: { f: today, l: today, d: 1 } });
      } else {
        const m = got.metadata || {};
        if (m.l !== today) {
          await env.BOTTLES.put(vkey, "1", {
            metadata: { f: m.f || today, l: today, d: (m.d || 1) + 1 },
          });
        }
      }
    } catch (e) { /* 额度用尽就先不记 */ }
  }

  const raw = await env.BOTTLES.get(picked.name);
  if (!raw) return json({ empty: true });
  const bottle = JSON.parse(raw);
  if (Math.random() < 1 / FISH_SAMPLE) {
    bottle.fished = (bottle.fished || 0) + FISH_SAMPLE;
    // 被捞数同步进 metadata,回执接口才能不读正文就统计
    const md = Object.assign({}, picked.metadata, { f: bottle.fished });
    await env.BOTTLES.put(picked.name, JSON.stringify(bottle), { metadata: md });
  }
  const by = nickname(bottle.device);
  return json({
    empty: false, id: bottle.id, videos: bottle.videos, by,
    followed: follow.has(by),
    followable: bottle.device !== device,
  });
}

async function handleFeedback(req, reqUrl, env) {
  const body = await readBody(req, reqUrl);
  if (body.err) return body.err;
  const bid = String(body.data.bottle || "").slice(0, 32);
  const verdict = body.data.verdict;
  const device = String(body.data.device || "").slice(0, 64);
  if (!["good", "bad"].includes(verdict) || !bid.startsWith("b:") || !device) {
    return json({ error: "参数不对" }, 400);
  }
  const got = await env.BOTTLES.getWithMetadata(bid);
  if (!got.value) return json({ error: "瓶子不存在" }, 404);
  const bottle = JSON.parse(got.value);
  bottle.votes = bottle.votes || {};
  bottle.votes[device] = verdict;
  const g = Object.values(bottle.votes).filter((v) => v === "good").length;
  const b = Object.values(bottle.votes).filter((v) => v === "bad").length;
  await env.BOTTLES.put(bid, JSON.stringify(bottle), {
    metadata: {
      d: (got.metadata && got.metadata.d) || bottle.device || "",
      g, b,
      p: (got.metadata && got.metadata.p) || bottlePlatform(bottle.videos || []),
      f: bottle.fished || (got.metadata && got.metadata.f) || 0,
    },
  });
  invalidateIndex();  // 让回执立刻反映新的好评
  return json({ ok: true });
}

async function collectStats(env) {
  const keys = await getIndex(env);
  const devices = new Set();
  let real = 0, fishedTotal = 0, good = 0, bad = 0;
  const rows = [];
  for (const k of keys) {
    const raw = await env.BOTTLES.get(k.name);
    if (!raw) continue;
    const b = JSON.parse(raw);
    const isSeed = (b.device || "").indexOf("seed") === 0;
    if (!isSeed) { real++; devices.add(b.device); }
    const g = Object.values(b.votes || {}).filter((v) => v === "good").length;
    const bd = Object.values(b.votes || {}).filter((v) => v === "bad").length;
    fishedTotal += b.fished || 0; good += g; bad += bd;
    rows.push({
      id: b.id, seed: isSeed, n: (b.videos || []).length,
      p: bottlePlatform(b.videos || []),
      fished: b.fished || 0, g, b: bd,
      first: ((b.videos && b.videos[0] && b.videos[0].title) || "").slice(0, 32),
      ts: b.ts || 0,
    });
  }
  rows.sort((a, b2) => b2.ts - a.ts);
  const vl = await env.BOTTLES.list({ prefix: "v:", limit: 1000 });
  const visitors = vl.keys.length;
  // 回访 = 在不同的日子来过两天以上
  const returning = vl.keys.filter((k) => ((k.metadata || {}).d || 1) >= 2).length;
  return {
    total: keys.length, real, devices: devices.size,
    visitors, returning, visitorsCapped: !vl.list_complete,
    fishedTotal, good, bad, rows,
  };
}

async function handleAdmin(url, env) {
  if (url.searchParams.get("key") !== env.ADMIN_KEY) {
    return new Response("not found", { status: 404 });
  }
  const s = await collectStats(env);
  const hist = await env.BOTTLES.list({ prefix: "stat:", limit: 90 });
  const days = [];
  for (const k of hist.keys) {
    const v = await env.BOTTLES.get(k.name);
    if (v) days.push({ day: k.name.slice(5), ...JSON.parse(v) });
  }
  const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  let html = "<!DOCTYPE html><html lang=zh-CN><head><meta charset=utf-8>"
    + "<meta name=viewport content='width=device-width, initial-scale=1'><title>BK漂流瓶后台</title>"
    + "<style>body{font-family:sans-serif;background:#071a2b;color:#e8f2fa;padding:20px;max-width:860px;margin:0 auto}"
    + "h1{font-size:20px}h2{font-size:16px;margin-top:26px;color:#4dd0e1}"
    + ".kpi{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px}"
    + ".kpi div{background:#10344f;border:1px solid #1e4a6d;border-radius:10px;padding:12px 18px;font-size:13px;color:#8fb3cc}"
    + ".kpi b{display:block;font-size:24px;color:#e8f2fa;margin-top:4px}"
    + "table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}"
    + "td,th{padding:7px 8px;border-bottom:1px solid #1e4a6d;text-align:left}"
    + "th{color:#8fb3cc}.s{color:#ffcf6e}.overflow{overflow-x:auto}</style></head><body>"
    + "<h1>🌊 BK漂流瓶后台</h1><div class=kpi>"
    + "<div>海里瓶子<b>" + s.total + "</b></div>"
    + "<div>真人瓶<b>" + s.real + "</b></div>"
    + "<div>扔过瓶的设备<b>" + s.devices + "</b></div>"
    + "<div>捞过瓶的设备" + (s.visitorsCapped ? "（超1000）" : "") + "<b>" + s.visitors + "</b></div>"
    + "<div>扔瓶转化率<b>"
    + (s.visitors ? Math.round((s.devices / s.visitors) * 100) + "%" : "—")
    + "</b></div>"
    + "<div>回来过的人<b>" + s.returning + "</b></div>"
    + "<div>回访率<b>"
    + (s.visitors ? Math.round((s.returning / s.visitors) * 100) + "%" : "—")
    + "</b></div>"
    + "<div>累计被捞（抽样估算）<b>" + s.fishedTotal + "</b></div>"
    + "<div>🌟 有意思<b>" + s.good + "</b></div>"
    + "<div>🫧 一般<b>" + s.bad + "</b></div></div>";
  if (days.length) {
    html += "<h2>每日快照（北京时间每早 9 点存档）</h2><div class=overflow><table>"
      + "<tr><th>日期</th><th>总瓶</th><th>真人瓶</th><th>设备</th><th>累计被捞</th></tr>";
    for (const d of days.reverse()) {
      html += "<tr><td>" + esc(d.day) + "</td><td>" + d.total + "</td><td>" + d.real
        + "</td><td>" + d.devices + "</td><td>" + d.fishedTotal + "</td></tr>";
    }
    html += "</table></div>";
  }
  html += "<h2>全部瓶子（新在前）</h2><div class=overflow><table>"
    + "<tr><th>来源</th><th>平台</th><th>条数</th><th>被捞</th><th>🌟</th><th>🫧</th><th>第一条视频</th></tr>";
  for (const r of s.rows) {
    const pTag = r.p === "bili" ? "B站" : r.p === "mix" ? "混装" : "YT";
    html += "<tr><td>" + (r.seed ? "<span class=s>种子</span>" : "真人") + "</td><td>" + pTag
      + "</td><td>" + r.n
      + "</td><td>" + r.fished + "</td><td>" + r.g + "</td><td>" + r.b
      + "</td><td>" + esc(r.first) + "</td></tr>";
  }
  html += "</table></div></body></html>";
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export default {
  async scheduled(event, env) {
    // 兜底扫描:老瓶命中敏感词的静默迁入 q: 隔离区(敏感词表更新后也会追溯生效)
    const list = await env.BOTTLES.list({ prefix: "b:", limit: 1000 });
    for (const k of list.keys) {
      const raw = await env.BOTTLES.get(k.name);
      if (!raw) continue;
      const b = JSON.parse(raw);
      if (hitsSensitive(b.videos || [])) {
        await env.BOTTLES.put("q:" + k.name.slice(2), raw, { metadata: k.metadata || {} });
        await env.BOTTLES.delete(k.name);
      }
    }
    const s = await collectStats(env);
    const day = new Date().toISOString().slice(0, 10);
    await env.BOTTLES.put("stat:" + day, JSON.stringify({
      total: s.total, real: s.real, devices: s.devices,
      fishedTotal: s.fishedTotal, good: s.good, bad: s.bad,
    }));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === "GET") {
      if (p === "/" || p === "/index.html") {
        return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      if (p === "/manifest.webmanifest") {
        return new Response(JSON.stringify(MANIFEST), {
          headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
        });
      }
      if (p === "/sw.js") {
        return new Response(SW, {
          headers: { "Content-Type": "application/javascript; charset=utf-8" },
        });
      }
      if (p === "/icon-192.png" || p === "/icon-512.png") {
        return new Response(p === "/icon-192.png" ? ICON192 : ICON512, {
          headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
        });
      }
      if (p === "/admin") return handleAdmin(url, env);
      if (p === "/api/stats") {
        const keys = await getIndex(env);
        return json({ count: keys.length });
      }
      if (p === "/api/preview") {
        // 装瓶前的预览:只调 oEmbed 拿标题,不碰 KV。B站由前端 JSONP 自己取
        const vs = (url.searchParams.get("v") || "").split(",")
          .filter((x) => VID_RE.test(x)).slice(0, 10);
        const ls = (url.searchParams.get("l") || "").split(",")
          .filter((x) => LIST_RE.test(x)).slice(0, 10);
        if (!vs.length && !ls.length) return json({ items: [] });
        const [vm, lm] = await Promise.all([
          Promise.all(vs.map(fetchMeta)),
          Promise.all(ls.map(fetchListMeta)),
        ]);
        const items = vs.map((v, i) => ({ vid: v, title: vm[i][0] || "", author: vm[i][1] || "" }))
          .concat(ls.map((x, i) => ({
            list: x, title: lm[i][0] || "", author: lm[i][1] || "", thumb: lm[i][2] || "",
          })));
        return json({ items });
      }
      if (p === "/api/mine") {
        // 回执:让扔瓶人看到自己的瓶子被谁喜欢。全程走缓存索引,不额外消耗 KV
        const dev = url.searchParams.get("device") || "";
        if (!dev) return json({ bottles: 0 });
        const keys = await getIndex(env);
        let bottles = 0, good = 0, fished = 0;
        for (const k of keys) {
          const m = k.metadata || {};
          if (m.d !== dev) continue;
          bottles++;
          good += m.g || 0;
          fished += m.f || 0;
        }
        return json({ bottles, good, fished, name: nickname(dev) });
      }
      if (p === "/api/fish") return handleFish(req, url, env);
    }
    if (req.method === "POST") {
      if (p === "/api/throw") return handleThrow(req, url, env);
      if (p === "/api/feedback") return handleFeedback(req, url, env);
      if (p === "/api/fish") return handleFish(req, url, env);
    }
    return new Response("not found", { status: 404 });
  },
};
