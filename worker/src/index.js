// 漂流瓶 Cloudflare Worker 版。与本地 server.py 同一套规则:
// 无留言字段 / oEmbed 验证视频真实存在 / 频道集中度拒收 / 每 IP 每日限扔 / 质量加权捞瓶。
// 存储: KV。每个瓶子一个 key(b:开头),metadata 里存 {d:设备, g:好评数, b:差评数} 供捞瓶加权。
import HTML from "./index.html";
import ICON192 from "./icon-192.png";
import ICON512 from "./icon-512.png";
import OGIMG from "./og.png";

// 装到手机桌面后,YouTube 分享菜单里会出现本站,分享的链接落到 /?share=...
const MANIFEST = {
  name: "BK漂流瓶",
  short_name: "漂流瓶",
  description: "和陌生人交换正在看的视频，看看信息茧房外面长什么样",
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

// 隐私政策。Chrome / Edge 商店都要求一个公开地址,但这页不是为上架凑的:
// 这产品全部说服力都建立在「我不越界」上,那就得把边界写清楚,而且写成人话。
const PRIVACY = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>隐私说明 · BK漂流瓶</title>
<meta name="description" content="BK漂流瓶收集什么、不收集什么、存在哪里、怎么删掉。">
<link rel="canonical" href="__ORIGIN__/privacy">
<style>
:root{--deep:#071a2b;--mid:#0d2c46;--card:#10344f;--line:#1e4a6d;--ink:#e8f2fa;--dim:#8fb3cc;--glow:#4dd0e1;--amber:#ffcf6e}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;background:linear-gradient(180deg,#04101d,var(--deep) 40%,#0a2438);color:var(--ink);line-height:1.9;min-height:100vh}
.wrap{max-width:680px;margin:0 auto;padding:44px 20px 70px}
h1{font-size:24px;letter-spacing:1px;margin-bottom:6px}
.sub{color:var(--dim);font-size:14px;margin-bottom:30px}
h2{font-size:17px;margin:30px 0 10px;color:var(--glow)}
p{margin-bottom:12px;font-size:15px}
ul{margin:0 0 14px 20px}
li{margin-bottom:8px;font-size:15px}
b{color:var(--amber)}
code{background:var(--card);border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:13.5px}
a{color:var(--glow)}
.box{background:var(--mid);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:18px 0}
.foot{margin-top:36px;padding-top:18px;border-top:1px solid var(--line);color:var(--dim);font-size:13px}
</style>
</head>
<body>
<div class="wrap">
<h1>隐私说明</h1>
<div class="sub">BK漂流瓶 · 网站与 Chrome / Edge 插件</div>

<div class="box">
<p><b>一句话：</b> 我们不知道你是谁，也不知道你平时看什么。只知道你亲手贴进来的那几条链接。</p>
</div>

<h2>不收集什么</h2>
<ul>
<li><b>不读你的浏览记录。</b> 网页版根本没有这个能力；插件版确实有（<code>chrome.history</code>），但没有申请这个权限，打开商店的安装页可以自己核对权限清单。完整的观看历史能反推出的东西远超一个人愿意分享的范围。</li>
<li><b>不要账号。</b> 没有注册、没有邮箱、没有手机号、没有密码，也没有第三方登录。</li>
<li><b>没有留言框。</b> 瓶子里只放链接，所以也不存在需要审核的自由文本。</li>
<li><b>不用第三方统计、不投广告、不卖数据。</b> 页面上没有 Google Analytics 之类的脚本。</li>
</ul>

<h2>收集什么</h2>
<ul>
<li><b>你扔进来的视频链接</b>，以及从 YouTube / B站 公开接口取回的标题、作者、封面地址。这些是公开的，也是别人捞瓶时要看的内容。</li>
<li><b>一串随机 id</b>（存在你浏览器的 localStorage 里），用来把瓶子记在你名下、给你回执、以及不把同一个瓶子重复给你。它由你的浏览器生成，不含任何个人信息，清掉浏览器数据就没了。</li>
<li><b>你捞过哪些瓶子、收藏过哪些</b>，用来避免重复和做质量排序。</li>
<li><b>访问日期和 IP</b>：IP 只用于「每个 IP 每天最多扔几瓶」这个限制，不落库、不做画像。</li>
</ul>

<h2>插件多要了什么</h2>
<p>插件的权限清单只有 <code>storage</code>，加上三个域名的访问权：<code>b.bking.film</code>、<code>www.youtube.com</code>、<code>www.bilibili.com</code>。</p>
<ul>
<li>没有 <code>history</code>、没有 <code>tabs</code>、没有 <code>&lt;all_urls&gt;</code>。</li>
<li>在 YouTube / B站 页面上，插件<b>只在你主动点「装进瓶子」的那一刻</b>读当前这一个页面的视频 id、标题、封面和频道名。不点就什么都不读。</li>
<li><b>不接管你的新标签页，也不改你的主页或搜索引擎。</b></li>
<li>攒着待扔的清单只存在你自己电脑上（<code>chrome.storage.local</code>），不上传。</li>
</ul>

<h2>存在哪里</h2>
<p>瓶子存在 Cloudflare Workers KV（全球边缘存储）。网站由 Cloudflare 托管，它作为基础设施会看到常规的访问日志。除此之外没有任何第三方能拿到这些数据。</p>

<h2>怎么删掉</h2>
<ul>
<li><b>删掉你的身份：</b> 清掉本站的浏览器数据（localStorage）就行，那串随机 id 一起消失。之后你就是个全新的陌生人。</li>
<li><b>删掉某个瓶子：</b> 因为没有账号体系，我无法验证一个瓶子是不是你的。想撤掉某一瓶，来 <a href="https://discord.com/invite/uT6xryB" target="_blank" rel="noopener">Discord</a> 说一声，把瓶子里的链接告诉我，我手动删。</li>
<li><b>看到不该出现的内容：</b> 同样来 Discord 说，我会处理。</li>
</ul>

<h2>会变吗</h2>
<p>会。但这页和<a href="https://github.com/bkingfilm/bk-bottle" target="_blank" rel="noopener">全部源代码</a>一起放在 GitHub 上，任何改动都有提交记录，你可以自己去看，而不是只能听我说。</p>

<div class="foot">
最后更新 2026-07-28 · <a href="__ORIGIN__/">回到漂流瓶</a> · <a href="https://github.com/bkingfilm/bk-bottle" target="_blank" rel="noopener">源码</a>
</div>
</div>
</body>
</html>
`;

// 最小 service worker:只为满足「可安装」条件,不做离线缓存(内容本来就要联网)
const SW = "self.addEventListener('install',function(){self.skipWaiting()});"
  + "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});"
  + "self.addEventListener('fetch',function(){});";

const VID_RE = /^[A-Za-z0-9_-]{11}$/;
const LIST_RE = /^[A-Za-z0-9_-]{12,50}$/;
const BILI_RE = /^(BV[A-Za-z0-9]{10}|av\d{1,12})$/;
const STEAM_RE = /^\d{1,7}$/;
// Steam 官方图 CDN 都在 steamstatic.com 下(shared.akamai / shared.cloudflare / cdn.* 等)
const STEAM_IMG_RE = /^https:\/\/[a-z0-9.-]+\.steamstatic\.com\//;
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
  // 涉黄(2026-08-12 BK 令扩充)
  "色情", "情色", "无码", "無碼", "里番", "裏番", "黄片", "黃片", "三级片", "三級片",
  "卖淫", "賣淫", "嫖娼", "援交", "约炮", "約炮", "工口", "18禁", "成人影片", "成人向",
  // 违法
  "赌博", "賭博", "博彩", "网赌", "網賭", "洗钱", "洗錢", "毒品", "大麻", "冰毒",
  "枪支", "槍支", "传销", "傳銷",
];

// 拉丁词单独一张表,小写比对,标题大小写混写逃不掉。
// 别加太短的词:jav 会命中 javascript 这种,加之前先想想会不会误伤正常词
const SENSITIVE_LATIN = ["porn", "pornhub", "onlyfans", "hentai", "xvideos", "r18"];

// 时政类频道黑名单(2026-08-12 BK 令):这些号无论发什么,整瓶隔离。
// 按 author 子串匹配,简繁双版本;名单可随时续补
const BLOCK_AUTHORS = [
  "文昭", "江峰时刻", "江峰時刻", "石涛", "石濤", "王剑每日观察", "王劍每日觀察",
  "路德社", "天亮时光", "天亮時光", "大康有话说", "大康有話說", "公子时评", "公子時評",
  "明镜", "明鏡", "新唐人", "大纪元", "大紀元", "美国之音", "美國之音",
  "自由亚洲", "自由亞洲", "新闻拍案惊奇", "新聞拍案驚奇", "章天亮",
  "郭文贵", "郭文貴", "王局拍案", "李老师不是你老师", "李老師不是你老師",
  "德国之声", "德國之聲",
];
const BLOCK_AUTHORS_LATIN = ["voa", "rfa chinese", "bbc news 中文", "dw中文"];

function hitsSensitive(items) {
  return items.some((x) => {
    const text = (x.title || "") + (x.author || "");
    if (SENSITIVE.some((w) => text.includes(w))) return true;
    const lower = text.toLowerCase();
    if (SENSITIVE_LATIN.some((w) => lower.includes(w))) return true;
    const author = String(x.author || "");
    if (!author) return false;
    return BLOCK_AUTHORS.some((w) => author.includes(w))
      || BLOCK_AUTHORS_LATIN.some((w) => author.toLowerCase().includes(w));
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

const FRESH_WINDOW = 86400;   // 新瓶保护期,秒

function weight(meta, now) {
  const m = meta || {};
  const g = m.g || 0;
  // 只用正信号。原来的「一般」按钮 2026-07-28 撤了:它实际是被当翻页键在点
  // (33 次有意思对 70 次一般),拿它当差评是在给自己灌噪声。现在想走的人直接
  // 点「再捞一个」,不必先给陌生人打个差评才能离开。
  // 加权只按好评升,不按任何信号降,所以没人会被埋掉,只有被更多人看见的先后。
  let w = 1.0 + 0.5 * g;
  // 刚扔进来的头一天翻倍:扔瓶人贡献了就该被看见,否则一半的新瓶没人捞到过
  if (m.t && now - m.t < FRESH_WINDOW) w *= 2;
  // 种子瓶降权:真人瓶已经反超,站方内容该退居二线
  if ((m.d || "").indexOf("seed") === 0) w *= 0.6;
  return w;
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

// 手机 B站 App 分享出来的是 b23.tv/随机短码,不带 BV 号。浏览器跨域读不到重定向地址,
// 只能在这里跟一次 302 把真实 BV 号挖出来(b23.tv 是纯短链服务,不在 -412 封锁范围)
const B23_CODE_RE = /^[A-Za-z0-9]{4,16}$/;

async function resolveB23(code) {
  let target = "https://b23.tv/" + code;
  for (let i = 0; i < 3; i++) {
    let r;
    try {
      r = await fetch(target, {
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(4000),
      });
    } catch (e) {
      return null;
    }
    const loc = r.headers.get("Location") || "";
    const m = loc.match(/bilibili\.com\/video\/(BV[A-Za-z0-9]{10}|av\d{1,12})/i);
    if (m) return m[1];
    if (r.status >= 300 && r.status < 400 && /^https:\/\/([a-z0-9-]+\.)*(bilibili\.com|b23\.tv)\//.test(loc)) {
      target = loc;
      continue;
    }
    return null;
  }
  return null;
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

// Steam 元数据走服务端验证(appdetails 08-10 探针实测机房出口全绿),
// 拿不到时回落扔瓶人浏览器带上来的标题/封面(封面域名白名单清洗,同 B站 方案)
function sanitizeSteams(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .filter((x) => x && typeof x === "object" && STEAM_RE.test(String(x.id || "")))
    .map((x) => ({
      appid: String(x.id),
      title: String(x.title || "").slice(0, 100),
      thumb: STEAM_IMG_RE.test(x.thumb) ? String(x.thumb).slice(0, 300) : "",
    }))
    .filter((x) => !seen.has(x.appid) && seen.add(x.appid));
}

async function fetchSteamMeta(appid) {
  const url = "https://store.steampowered.com/api/appdetails?appids=" + appid
    + "&filters=basic,content_descriptors&l=schinese";
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return { fail: true };   // 限流/网络问题:回落客户端元数据
    const d = await r.json();
    const e = d && d[appid];
    if (!e || !e.success || !e.data || !e.data.name) return { missing: true };   // Steam 明确说没有,拒收
    // 成人内容判定用 Steam 官方描述符:3=纯成人性内容 4=频繁裸露,命中即黄油,整瓶隔离。
    // 1(轻度裸露,赛博朋克/巫师这类大作都带)不算,否则 3A 全军覆没
    const ids = (e.data.content_descriptors && e.data.content_descriptors.ids) || [];
    return {
      title: String(e.data.name).slice(0, 100),
      thumb: STEAM_IMG_RE.test(e.data.header_image) ? String(e.data.header_image).slice(0, 300) : "",
      adult: ids.indexOf(3) >= 0 || ids.indexOf(4) >= 0,
    };
  } catch (e) {
    return { fail: true };
  }
}

// 瓶子平台标签: 单一来源用各自标签,跨来源混装一律 mix。存进 KV metadata 供后台统计。
function bottlePlatform(videos) {
  const hasBili = videos.some((v) => v.bvid);
  const hasYt = videos.some((v) => v.vid || v.list);
  const hasSteam = videos.some((v) => v.appid);
  const kinds = (hasBili ? 1 : 0) + (hasYt ? 1 : 0) + (hasSteam ? 1 : 0);
  if (kinds > 1) return "mix";
  return hasBili ? "bili" : hasSteam ? "steam" : "yt";
}

async function readBody(req, reqUrl) {
  const origin = req.headers.get("Origin");
  // Chrome 插件的 Origin 是 chrome-extension://<插件id>,永远不等于本站 host,
  // 所以要单独放行。这里放宽不会掉进 CSRF:本站不发 cookie 也不认 session,
  // 身份(device)是请求体里自带的一串随机 id,拿别人的浏览器发请求也伪造不出
  // 别人的身份。扔瓶另有每 IP 日限兜着。
  // 插件上了商店拿到固定 id 之后,可以把这里收紧成只认那一个 id。
  const fromExt = origin && origin.indexOf("chrome-extension://") === 0;
  if (origin && !fromExt && new URL(origin).host !== reqUrl.host) {
    return { err: json({ error: "来源不允许" }, 403) };
  }
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

  let vids = Array.isArray(body.data.videos) ? body.data.videos : [];
  vids = [...new Set(vids)].filter((v) => typeof v === "string" && VID_RE.test(v));
  let lists = Array.isArray(body.data.lists) ? body.data.lists : [];
  lists = [...new Set(lists)].filter((x) => typeof x === "string" && LIST_RE.test(x));
  const bilis = sanitizeBilis(body.data.bilis);
  const steamsIn = sanitizeSteams(body.data.steams);
  const total = vids.length + lists.length + bilis.length + steamsIn.length;
  if (total < 1 || total > 10) {
    return json({ error: "需要 1 到 10 个有效的 YouTube、B站 或 Steam 链接" }, 400);
  }
  // B站 元数据由扔瓶人浏览器 JSONP 拿到后带上来(机房 IP 调 B站 接口被 -412 全封)
  const device = String(body.data.device || "").slice(0, 64);

  const [vmetas, lmetas, smetas] = await Promise.all([
    Promise.all(vids.map(fetchMeta)),
    Promise.all(lists.map(fetchListMeta)),
    Promise.all(steamsIn.map((s) => fetchSteamMeta(s.appid))),
  ]);
  const steams = steamsIn
    .map((s, i) => {
      const m = smetas[i];
      if (m.missing) return null;   // Steam 说这个 appid 不存在
      // 验证不了就不收(2026-08-12 BK 谨慎令):黄油判定全靠官方成人描述符,
      // 拿不到描述符还收客户端自报的标题,等于给投毒留了口子。宁可让正常用户重试
      if (m.fail) return null;
      return { appid: s.appid, title: m.title, author: "", thumb: m.thumb || s.thumb };
    })
    .filter(Boolean);
  const valid = vids
    .map((v, i) => ({ vid: v, title: vmetas[i][0], author: vmetas[i][1] || "" }))
    .filter((x) => x.title)
    .concat(
      lists
        .map((x, i) => ({ list: x, title: lmetas[i][0], author: lmetas[i][1] || "", thumb: lmetas[i][2] || "" }))
        .filter((x) => x.title)
    )
    .concat(bilis)
    .concat(steams);
  if (!valid.length) return json({ error: "这些链接在 YouTube/B站/Steam 上都找不到对应内容" }, 400);
  if (tooConcentrated(valid.map((x) => x.author))) {
    return json({ error: "同一个频道的视频太多了，换着装点别的" }, 400);
  }

  // 额度只在校验全过之后才扣:贴错链接、标题没拿到这类失败不烧当天次数
  // (隔离区的瓶子也扣,影子删除对扔瓶人必须和正常成功一模一样)
  await env.BOTTLES.put(rlKey, String(used + 1), { expirationTtl: 90000 });

  const p = bottlePlatform(valid);

  const stamp = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  // 涉政/涉黄/违法内容影子删除:对扔瓶人返回正常成功,实际存入 q: 隔离区。
  // Steam 黄油按官方成人描述符判(见 fetchSteamMeta),回落路径拿不到描述符,靠巡查兜底
  const quarantine = hitsSensitive(valid) || smetas.some((m) => m && m.adult);
  const id = (quarantine ? "q:" : "b:") + stamp;
  const nowSec = Math.floor(Date.now() / 1000);
  const bottle = { id, device, videos: valid, fans: [], fished: 0, ts: nowSec };
  // t 存进 metadata,捞瓶加权时不必读正文就能判断新旧
  await env.BOTTLES.put(id, JSON.stringify(bottle), { metadata: { d: device, g: 0, b: 0, p, t: nowSec } });
  invalidateIndex();  // 新瓶必须马上能被别人捞到
  return json({ ok: true, count: valid.length });
}

async function handleFish(req, reqUrl, env) {
  let device = "", seen = new Set(), follow = new Set(), src = "", pwa = false, demo = false;
  if (req.method === "POST") {
    const body = await readBody(req, reqUrl);
    if (body.err) return body.err;
    device = String(body.data.device || "").slice(0, 64);
    // 首访自动演示捞:不算捞瓶人、不算被捞数,免得跳出的路人污染指标
    demo = body.data.demo === true;
    // 装到桌面打开的标记,搭访客登记那次写入的车,不额外花写额度
    pwa = body.data.pwa === true;
    const arr = Array.isArray(body.data.seen) ? body.data.seen : [];
    seen = new Set(arr.filter((s) => typeof s === "string"));
    const fol = Array.isArray(body.data.follow) ? body.data.follow : [];
    follow = new Set(fol.filter((s) => typeof s === "string").slice(0, 50));
    src = String(body.data.src || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 12);
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

  const nowSec = Math.floor(Date.now() / 1000);
  const weights = pool.map((k) => weight(k.metadata, nowSec));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  let picked = pool[0];
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) { picked = pool[i]; break; }
  }

  // 访客登记:只捞不扔的人原本完全隐形。天数存进 metadata,list 时零额外读取就能统计回访。
  // 同一设备同一天只写一次,写失败不能影响捞瓶本身
  if (device && !demo) {
    try {
      const vkey = "v:" + device;
      const today = new Date().toISOString().slice(0, 10);
      const got = await env.BOTTLES.getWithMetadata(vkey);
      if (got.value === null && !got.metadata) {
        // s 记首次来源渠道,之后不再改写,用来分辨哪条推广真的带来了人
        const meta = { f: today, l: today, d: 1, s: src || "direct" };
        if (pwa) meta.w = 1;
        await env.BOTTLES.put(vkey, "1", { metadata: meta });
      } else {
        const m = got.metadata || {};
        // w 一旦置上就不回退:装了桌面的人偶尔从浏览器进,不该把他算回没装。
        // 当天已登记但这次是从桌面进来的,补写一次,不然要等到第二天才统计得到
        const newW = m.w || (pwa ? 1 : 0);
        if (m.l !== today || newW !== (m.w || 0)) {
          const meta = { f: m.f || today, l: today, s: m.s || src || "direct",
            d: m.l !== today ? (m.d || 1) + 1 : (m.d || 1) };
          if (newW) meta.w = 1;
          await env.BOTTLES.put(vkey, "1", { metadata: meta });
        }
      }
    } catch (e) { /* 额度用尽就先不记 */ }
  }

  let raw = await env.BOTTLES.get(picked.name);
  if (!raw) return json({ empty: true });
  let bottle = JSON.parse(raw);

  // 头三网别让人撞上只装 1 条的瓶子,第一印象就没了。
  // 多抽两个候选比一比,取内容最多的那个;读操作便宜,不碰写额度
  if (seen.size < 3 && pool.length >= 3 && (bottle.videos || []).length < 3) {
    const extra = pool.filter((k) => k.name !== picked.name)
      .sort(function () { return Math.random() - 0.5; }).slice(0, 2);
    const raws = await Promise.all(extra.map((k) => env.BOTTLES.get(k.name)));
    raws.forEach(function (r, i) {
      if (!r) return;
      const b = JSON.parse(r);
      if ((b.videos || []).length > (bottle.videos || []).length) {
        bottle = b; raw = r; picked = extra[i];
      }
    });
  }
  if (!demo && Math.random() < 1 / FISH_SAMPLE) {
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
  // 旧页面缓存里还留着「一般」按钮,收下但不入库:不计权重也不占 value 体积
  if (verdict === "bad") return json({ ok: true, ignored: true });
  const got = await env.BOTTLES.getWithMetadata(bid);
  if (!got.value) return json({ error: "瓶子不存在" }, 404);
  const bottle = JSON.parse(got.value);
  // 只留好评者名单,用来防同一台设备重复投。名单封顶 300,再往上只涨计数不记名
  // (加权只看数字),否则热门瓶的 votes 会跟着被捞次数一直长
  const old = bottle.votes || {};
  const fans = Array.isArray(bottle.fans) ? bottle.fans
    : Object.keys(old).filter((k) => old[k] === "good");
  const already = fans.indexOf(device) >= 0;
  let g = (got.metadata && got.metadata.g) || fans.length;
  if (!already) {
    g++;
    if (fans.length < 300) fans.push(device);
  }
  bottle.fans = fans;
  delete bottle.votes;   // 一次性换掉旧结构,不再回写 bad
  const b = (got.metadata && got.metadata.b) || 0;   // 历史数字留档,不再增长
  await env.BOTTLES.put(bid, JSON.stringify(bottle), {
    metadata: {
      d: (got.metadata && got.metadata.d) || bottle.device || "",
      g, b,
      p: (got.metadata && got.metadata.p) || bottlePlatform(bottle.videos || []),
      f: bottle.fished || (got.metadata && got.metadata.f) || 0,
      t: (got.metadata && got.metadata.t) || bottle.ts || 0,   // 别把新瓶保护期投没了
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
    // 新瓶只有 fans 数组,老瓶还是 votes 字典,两种都要认
    const g = Array.isArray(b.fans) ? b.fans.length
      : Object.values(b.votes || {}).filter((v) => v === "good").length;
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
  // 装到桌面 = 至少有一次是从主屏幕图标(standalone)进来的
  const installed = vl.keys.filter((k) => (k.metadata || {}).w).length;
  // 按来源渠道分组:哪条推广真的带来了人,又有多少人回来过
  const bySrc = {};
  vl.keys.forEach((k) => {
    const m = k.metadata || {};
    const s = m.s || "unknown";
    if (!bySrc[s]) bySrc[s] = { n: 0, back: 0 };
    bySrc[s].n++;
    if ((m.d || 1) >= 2) bySrc[s].back++;
  });
  return {
    total: keys.length, real, devices: devices.size,
    visitors, returning, installed, visitorsCapped: !vl.list_complete,
    bySrc, fishedTotal, good, bad, rows,
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
    + "<div>🌟 收藏<b>" + s.good + "</b></div>"
    + "<div>🫧 一般（07-28 已撤）<b>" + s.bad + "</b></div></div>";
  // 池子健康度:回头率是手段不是目标,海里有没有新鲜瓶子才是。
  // 全部从已拉取的 stat: 快照上算,不多花一次 KV 操作;快照不满 30 天就用最早那天当基线
  if (days.length) {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    let base = days[0];
    for (const d of days) { if (d.day <= cutoff) base = d; else break; }
    const span = Math.max(1, Math.round(
      (Date.now() - new Date(base.day + "T00:00:00Z").getTime()) / 86400000));
    const nb = s.total - base.total;
    const nr = s.real - (base.real || 0);
    // 早期快照没有 visitors 字段,当 0 减会把「近N天」算成「开站以来」,缺基线宁可不显示
    const nv = (s.visitorsCapped || base.visitors === undefined)
      ? null : s.visitors - base.visitors;
    html += "<h2>池子健康度（近" + span + "天）</h2><div class=kpi>"
      + "<div>新瓶<b>" + nb + "</b></div>"
      + "<div>其中真人瓶<b>" + nr + "</b></div>"
      + "<div>新捞瓶人<b>" + (nv === null ? "—" : nv) + "</b></div>"
      + "<div>人均摊到新瓶<b>"
      + (nv ? (nb / nv).toFixed(2) : "—")
      + "</b></div></div>";
  }
  const srcRows = Object.keys(s.bySrc).sort((a, b) => s.bySrc[b].n - s.bySrc[a].n);
  if (srcRows.length) {
    html += "<h2>来源渠道</h2><div class=overflow><table>"
      + "<tr><th>来源</th><th>捞过瓶的人</th><th>其中回来过</th></tr>";
    for (const k of srcRows) {
      html += "<tr><td>" + esc(k) + "</td><td>" + s.bySrc[k].n
        + "</td><td>" + s.bySrc[k].back + "</td></tr>";
    }
    html += "</table></div>";
  }
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
    const pTag = r.p === "bili" ? "B站" : r.p === "mix" ? "混装" : r.p === "steam" ? "Steam" : "YT";
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
      // 回访和装机是判断「有没有人愿意回来」的两个数,以前只在 admin 页当场算,
      // 没进快照就看不出趋势
      visitors: s.visitors, returning: s.returning, installed: s.installed,
    }));
  },
  // Chrome 插件版的新标签页要直接调 /api/fish。MV3 里 host_permissions 本来
  // 就允许扩展页跨域,这层 CORS 是保险:只回显 chrome-extension:// 的 Origin,
  // 不对普通网站开放,所以不会变成一个谁都能白用的公开 API
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const fromExt = origin.indexOf("chrome-extension://") === 0;
    if (fromExt && req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: extCors(origin) });
    }
    const res = await route(req, env);
    if (!fromExt) return res;
    const out = new Response(res.body, res);   // headers 可能是只读的,重新包一层
    const h = extCors(origin);
    for (const k of Object.keys(h)) out.headers.set(k, h[k]);
    return out;
  },
};

function extCors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

async function route(req, env) {
  {
    const url = new URL(req.url);
    const p = url.pathname;
    // 正式域名后 workers.dev 只留 API 和 PWA 资源,首页 301 集中搜索权重
    const CANON = "https://b.bking.film";
    if (req.method === "GET" && url.hostname.endsWith(".workers.dev") &&
        (p === "/" || p === "/index.html")) {
      return Response.redirect(CANON + "/" + url.search, 301);
    }
    if (req.method === "GET") {
      if (p === "/robots.txt") {
        return new Response(
          "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n" +
          "Sitemap: " + CANON + "/sitemap.xml\n",
          { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
      if (p === "/sitemap.xml") {
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          "  <url><loc>" + CANON + "/</loc><changefreq>weekly</changefreq></url>\n" +
          "  <url><loc>" + CANON + "/privacy</loc><changefreq>yearly</changefreq></url>\n" +
          "</urlset>\n",
          { headers: { "Content-Type": "application/xml; charset=utf-8" } });
      }
      // 插件上商店必须给一个公开的隐私政策地址。不套法律模板:这产品的隐私
      // 承诺本来就该说得让人看得懂,写成一页普通话反而更像真的
      if (p === "/privacy" || p === "/privacy.html") {
        return new Response(PRIVACY.split("__ORIGIN__").join(url.origin), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      if (p === "/" || p === "/index.html") {
        // 分享卡片的 og 标签要绝对地址,注入当前 origin,换域名不用改 HTML
        const html = HTML.split("__ORIGIN__").join(url.origin);
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
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
      // 分享卡片的缩略图。各平台的抓取器缓存很久,换域名重做图后记得让它们重新抓
      if (p === "/og.png") {
        return new Response(OGIMG, {
          headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
        });
      }
      if (p === "/admin") return handleAdmin(url, env);
      if (p === "/api/stats") {
        const keys = await getIndex(env);
        return json({ count: keys.length });
      }
      if (p === "/api/preview") {
        // 装瓶前的预览:只调 oEmbed / Steam appdetails 拿标题,不碰 KV。B站由前端 JSONP 自己取
        const vs = (url.searchParams.get("v") || "").split(",")
          .filter((x) => VID_RE.test(x)).slice(0, 10);
        const ls = (url.searchParams.get("l") || "").split(",")
          .filter((x) => LIST_RE.test(x)).slice(0, 10);
        const ss = (url.searchParams.get("s") || "").split(",")
          .filter((x) => STEAM_RE.test(x)).slice(0, 10);
        if (!vs.length && !ls.length && !ss.length) return json({ items: [] });
        const [vm, lm, sm] = await Promise.all([
          Promise.all(vs.map(fetchMeta)),
          Promise.all(ls.map(fetchListMeta)),
          Promise.all(ss.map(fetchSteamMeta)),
        ]);
        const items = vs.map((v, i) => ({ vid: v, title: vm[i][0] || "", author: vm[i][1] || "" }))
          .concat(ls.map((x, i) => ({
            list: x, title: lm[i][0] || "", author: lm[i][1] || "", thumb: lm[i][2] || "",
          })))
          .concat(ss.map((x, i) => ({
            appid: x, title: sm[i].title || "", thumb: sm[i].thumb || "",
          })));
        return json({ items });
      }
      if (p === "/api/b23") {
        // b23.tv 短码 → BV/av 号。不碰 KV,纯转发一次重定向查询
        const code = url.searchParams.get("c") || "";
        if (!B23_CODE_RE.test(code)) return json({ id: null });
        return json({ id: await resolveB23(code) });
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
        // yys(有意思值):账号贡献值,1 个 🌟 = 2 yys。纯派生不落库,规则只在这一处
        return json({ bottles, good, fished, yys: good * 2, name: nickname(dev) });
      }
      if (p === "/api/fish") return handleFish(req, url, env);
    }
    if (req.method === "POST") {
      if (p === "/api/throw") return handleThrow(req, url, env);
      if (p === "/api/feedback") return handleFeedback(req, url, env);
      if (p === "/api/fish") return handleFish(req, url, env);
    }
    return new Response("not found", { status: 404 });
  }
}
