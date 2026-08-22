# 上架材料（Edge / Chrome 商店）

## 0.2.3：插件里补上扔瓶引导（2026-08-23）

BK 08-22 晚问「捞3个 扔一个这个提示还在吗」。**查下来：网页还在，插件从来没有过。**

网页那条是 `public/index.html` 的 `#nudge`，2026-07 就在；而 `extension/` 整个目录搜 `nudge` 零命中。
偏偏插件的卖点就是「捞一瓶就是点一下工具栏，不用先开那一页」，
**所以装了插件的人反而是最碰不到这句话的那批**。

**为什么现在做**：08-22 晚班的数。海里 293 个瓶子、当天新瓶 **0 条**，
`throwers` 连续 3 天钉在 167 不动，同期访客还在 +11；1022 个捞过瓶的设备里只有 167 个扔过（16.3%），
而插件装机 116 、当天新增 0。捞的人在来，扔的人一个没有。

| 做了什么 | 细节 |
|---|---|
| 插件端 | `panel.js` 新增 `maybeNudge` / `hideNudge` / `goThrow`；捞瓶计数从 `maybeRate` 里拆出成 `bumpFish`，两条引导共用 |
| 判定 | 捞满 3 瓶 ＋ `/api/mine` 的 `bottles` 为 0 ＋ 距上次弹过超 7 天，三个同时满足才弹 |
| 布局 | `popup.html` 在结果区与评分条之间加 `#nudge`；`popup.css` 新增 `.nudge`（比 `.rate` 热一档、比 `.receipt` 轻一档） |
| 文案 | `_locales` 两份各加 `nudge` / `nudgeGo` / `nudgeLater`，照原文件对齐列宽插入；条数写成 `$N$` 占位符，改阀值不用改文案 |
| 网页端同步 | `public/index.html` ＋ `worker/src/index.html` 把「一辈子只弹一次」改成同口径的 7 天冷却（**已部署上线**，Version ID `149f0a95`） |

**三条设计上的取舍**：
① **7 天一次，不是一辈子一次**。网页老逻辑弹过就写死 `yb_nudged`，永不再弹；
可第一次捞满 3 瓶时人还没觉得「这海里该有我一份」，那一下弹早了就等于永久燄火。
老版本存的 `"1"` 经 `parseInt` 后距今远超 7 天，**那批已被燄火的人会重新收到一次，是故意的**。
② **瓶子数拿不到就不弹**。`myBottles` 初值 `null`，判定写成 `!== 0` 而不是 `> 0`；
没绑身份、`/api/mine` 挂了都不弹 —— 对一个已经扔过瓶的人说「海里还没有你的」，比不说更糟。
③ **跟评分条撞车时，评分让位**。评分只对商店排名有好处，扔瓶对这片海有用。

**回归测试**：`node dev/test-nudge.js`，10 项全过（捞不满 3 瓶不弹、扔过瓶不弹、
瓶子数 null 不弹、冷却期内不弹、8 天后再弹、同一次 popup 不重复弹、时间戳落盘、
评分条让位、文案填真实捞瓶数）。它把 chrome API 与 DOM 全 mock 掉，不需要浏览器。

**权限零改动**（`storage` ＋ 同样 6 条 host，与 0.2.2 逐条相同）。
产物 `dist/bk-bottle-0.2.3.zip`（33.7 KB，16 个文件），`node --check` 过、`check.py` 过、
zip 内 manifest／panel.js／两份 locale／popup.html／popup.css 已逐个回读核对。

**⚠：0.2.2 还在审**（今天 Edge 接口读到的仍是 0.2.0）。本包已含 0.2.2 全部内容，
**但别跟 0.2.2 撞在一起传** —— 等 0.2.2 过审上架了再传 0.2.3，否则两个包在审核队列里会互相作废。
判据就是晚班那个 Edge 接口的 `version` 字段：变成 0.2.2 了就可以传下一包。**待 BK 传商店。**

**想先看效果不用等审核**：chrome://extensions 开开发者模式 →「加载已解压的扩展程序」选 `extension/` 目录。
要看到那条提示得满足三个条件，最快的验法是：用一个没扔过瓶的浏览器连捞 3 次。


## 0.2.2：修 B站顶栏消失（2026-08-20）

**两位用户反馈 B站播放页顶栏（logo/搜索框那条）消失，且「插件开着就消失、关掉就恢复」。** 本机(64位、快机)复现不出,报告方之一是 32 位 Chrome 151、窗宽 2005。

**成因判断**：插件在 B站唯一动页面 DOM 的动作是往 .video-toolbar-left 里 appendChild 一个按钮,时机是 document_idle —— 而 B站整个播放页(顶栏在内)是页面脚本异步渲染的,顶栏最晚能到十几秒(本机实测)。在 B站框架接管完 DOM 之前塞入外来节点,会搅乱它的渲染,机器越慢窗口越大、越容易撞上。content script 的 JS 错误影响不了页面(隔离环境),DOM 注入是唯一交互面,故锁定此处。

**修法**：collect.js 加 biliSettled() 闸门 —— B站上等 #biliMainHeader 里出现搜索框(input)才挂按钮;判据不用「有子元素」是防渲染中途的骨架占位提前放行;45 秒兜底放行,防顶栏本身坏掉时按钮陪葬;轮询本来就每 1.2 秒重试,不会漏挂。SPA 软跳转时顶栏已在、立即放行,行为不变。

**权限零改动**。产物 dist/bk-bottle-0.2.2.zip(32.1 KB,16 文件),node --check 过、check.py 过、zip 内 manifest/collect.js 已回读核对,闸门两种状态在线上 B站页实测(渲染完=放行,冷加载空壳=拦住)。**本包已含 0.2.1 全部内容,提交时直接传 0.2.2、跳过 0.2.1。待 BK 传 Chrome Web Store。**

**遗留**：修复要等过审+用户自动更新才生效。两位反馈用户可先手动改本地(不现实)或等更新;回给用户的口径见 growth 线报告。

## 0.2.1：加「上一瓶」回看（2026-08-20）

BK 08-20 提的：「是否在捞完所有瓶之后，允许重新再捞一遍，因为有些人可能第一遍捞的时候没仔细看，或者犹豫了」。

**查下来他描述的痛点是真的，但位置不对，所以没按原提法做。** 捞完整片海会走 `exhausted` 分支，可现实里几乎没人到得了那一步：当天海里 290 个瓶，撞到 exhausted 要在同一个浏览器里连点 289 次，而 974 台设备累计才捞约 6923 次、**平均一台 7.1 次**，差 40 倍；974 台里 **880 台只来过 1 天（90.3%）**。改 exhausted 等于给一扇没人走的门装锁。而「没仔细看、犹豫了」在**第 2 次捞的时候就发生了**，跟捞没捞完无关。故改为做回看：给刚划走的那一瓶一条回头路。

| 做了什么 | 细节 |
|---|---|
| 网页端 | `public/index.html`：`yb_hist` 存最近 20 瓶（localStorage），第 2 瓶起出现「⬅ 上一瓶」，翻到中间出现「下一瓶 ➡」 |
| 插件端 | `panel.js` 把 `render()` 的渲染部分拆成 `draw()`，新增 `pushHist` / `goHist` / `updateNav` / `navBtn`；历史存 `chrome.storage.local` 的 `hist` |
| 文案 | `_locales` 两份各加 `btnPrev` / `btnNext`，照原文件的对齐列宽插入 |
| 布局 | `popup.html` 在结果区下加一行 `#histNav`，两个 `.half` 按需显隐，都没得翻就整行收掉 |

**三条设计上的取舍**：①往回翻**不重新请求**，整瓶数据都在本地，所以既不给那瓶多记一次「被捞」，也不动 `seen`（不会因为翻两下白白消耗掉海里没捞过的瓶）；②插件与网页**各存各的历史**，`bridge.js` 只同步身份和「捞过」，popup 与整页尺寸差太多，合成一条两头别扭；③跟已有的「我的收藏」是两回事，收藏要点一下才存，历史是捞了就自动进。

**权限零改动**（`storage` ＋ 原来那 6 条 host，与 0.1.9 逐条比对一致）。**但名字会变** —— 0.2.0 为修 Edge 1.1.2 改的那两个 `extName` 还没跟到 Chrome，这一版一并带上去，Chrome 侧等于同时改名＋加功能。

验证：网页端 32 项自动化断言全过，并在 b.bking.film 线上真点过（捞两瓶→翻回去→再翻回来，均正确）；插件端 22 项断言全过、`check.py` 自查通过、zip 内 manifest 与两份 locale 已回读核对。

**踩过一个坑记下来**：水印那行的 emoji 一度被写成字面的转义序列 `\U0001f30a`（六个字符,不是那个 emoji 本身）混进 JS，页面会渲染成乱码。`node --check` 语法检查通过、行为测试也全过 —— 它不是语法错是内容错，测试没断言渲染出来的字长什么样。发布前通读 `git diff` 才发现。此后两端测试都补了「渲染产物无裸转义」的断言。

产物：`distk-bottle-0.2.1.zip`（31.4 KB，16 个文件）。**待 BK 传 Chrome Web Store。**（Edge 侧 0.2.0 还在审，是否一并升 0.2.1 由 BK 定。）

## 0.2.0：为修 Edge 1.1.2 而改的标题（2026-08-15）

Edge 0.1.3 被退回的唯一原因是标题，**改标题必须改代码**——`manifest.json` 里写的是 `__MSG_extName__`，真正的名字在 `_locales/*/messages.json`，商店后台改不了。故升 0.2.0 重新打包，**代码逻辑一行没动，只动了三个文案词条**。

| 词条 | 旧 | 新 |
|---|---|---|
| `zh_CN.extName` | BK漂流瓶 · 和陌生人交换正在看的视频 | **BK漂流瓶 - 视频与游戏交换** |
| `en.extName` | Video Bottle · Random YouTube picks from strangers | **BK Bottle - Video & Game Swap** |
| `en.actionTitle` / `en.brand` | Video Bottle · Catch one ／ 🌊 Video Bottle | BK Bottle - Catch one ／ 🌊 BK Bottle |

英文侧多改 `actionTitle` 与 `brand` 的理由：extName 一旦改叫 BK Bottle，插件界面里还写 Video Bottle 就成了商店名与实际显示名不符，1.1.2 的 Accurate Representation 同样管这个。中文侧 brand 本来就是「BK漂流瓶」，不用动。

**审 0.1.3 时英文名踩的三点**（Languages 填的是 English (US)，审核看的是英文名）：① 标题里挂第三方商标 **YouTube**，暗示与 YouTube 官方有关，这是 1.1.2 最常见的触发点；② `Random ... picks from strangers` 是宣传句不是产品名；③ 0.1.9 已接 B站与 Steam，只说 YouTube 也不准确了。新名三点全避开。

产物：`dist\bk-bottle-0.2.0.zip`（30.3 KB，16 个文件），`check.py` 自查通过，zip 内 manifest 与两个 locale 已回读核对。**待 BK 传 Partner Center。**

## 当前状态

**（2026-08-20 23:0x 最新）0.2.2 已由 BK 在 Edge Partner Center 提交审核**（包校验 Complete → 填 No testers + 审核备注 → Publish），审核备注用的是按 0.2.2 更新后的 CERT-NOTES.txt。过审判据：晚班接口里 version 从 0.2.0 变 0.2.2。Chrome 侧 0.2.2 也已同步提交（BK 同晚确认），下表 Chrome 行的「0.2.1 待提交」已由 0.2.2 取代。两边包相同、权限零改动。


| 商店 | 状态 | 时间 |
|---|---|---|
| **Edge Add-ons** | **🔄 0.2.0 已重新提交**（2026-08-15 01:2x，BK 本人在 Partner Center 提交，Product ID `916b02f4-2a76-4b09-9740-2ced2a5dcc66`）。本次改动：`_locales` 两份 `extName` 改名（`BK漂流瓶 - 视频与游戏交换` / `BK Bottle - Video & Game Swap`）、版本 0.1.9→0.2.0、Store listing 中英双份 description 补齐 Steam、logo 300×300、截图加一张含 Steam 的、审核备注加 v0.2.0 重提说明。**代码与权限零改动。** 上架状态往后由 `bk-bottle-growth` 晚班自动查（见该线 SKILL.md 第四步），不再靠人工登后台。<br><br>**上一版 ⛔ Review failed（0.1.3）**：certification report 只有一条退回项，08-15 BK 截图确认：<br>**`1.1.2 Distinct Function & Value; Accurate Representation`** — Notes to publisher 原话：`Please provide a quality title that is informative and accurate for users.`<br>**就是商店标题不合格，与代码、权限、隐私政策、语言设置全部无关**（08-15 曾怀疑 Languages 填 English (US) 与中文内容不符，报告里没有这一项，**该猜测作废**）。现标题「BK漂流瓶 · 和陌生人交换正在看的视频」= 品牌前缀 ＋ `·` ＋ 一句宣传式副标题，Edge 的 1.1.2 要的是一个直接说明功能的干净名字 | 0.1.1 于 2026-07-29 提交；**Review completed: 2026-08-12**（结果 08-12 就出了，08-15 才发现，中间空了 3 天）；**0.1.3 的提交时间未采集到**——此前本表一直记着「0.1.1 In review」，说明中途 BK 提过 0.1.3 没回记 |
| **Chrome Web Store** | **0.1.9 已上架**（2026-08-20 12:5x 直接拉商店公开页实读到的版本号，⚠️ 本表此前一直记着「0.1.7 上架、0.1.8 待提交」，与实际差两个版本，说明 0.1.8／0.1.9 BK 提过但没回记，**以后以商店页实读为准**）。**0.2.1 已打包待提交** = 「上一瓶」回看（见上）。相对线上 0.1.9 **权限零变化**（`storage` ＋ 同样 6 条 host，逐条比对过），但会**同时把 0.2.0 那次改名带上去**（`BK漂流瓶 - 视频与游戏交换` / `BK Bottle - Video & Game Swap`），线上现名还是被 Edge 以 1.1.2 退回过的那个旧英文名 `Video Bottle · Random YouTube picks from strangers`。审核备注 CERT-NOTES.txt 未变 | 0.1.7: 2026-08-10 提交、08-11 过审；0.1.9: 提交时间未采集到，08-20 实读已在架；0.2.1: 待 BK 提交 |

0.1.6 = 首次安装自动打开 `b.bking.film/?from=ext-install` 绑定身份 + 网页端引导（网页侧 08-10 已先行上线）。Steam 功能按计划留 0.1.7 单独发版（要新增 steamcommunity.com host permission）；其中 worker + 网页侧（贴 Steam 链接扔瓶、游戏卡片、书签抓取）08-10 晚已独立上线，不依赖插件过审。

**08-10 22:48 版本顺延**：后台不认同号重传（0.1.6 已占用），修复包升为 **0.1.7**（`dist\bk-bottle-0.1.7.zip`）= 激活修复 + 面板 Steam 瓶渲染修复（原来会拼 `youtube.com/watch?v=undefined` 死链并错标 YouTube 胶囊），零权限变化，BK 当晚重传提交。**Steam 功能版（steamcommunity.com host permission）顺延为 0.1.8**。

Edge 侧已备案的身份信息（以后收紧 CORS、查商店页都要用）：

```
Store ID    0RDCKB732DDT
CRX ID      koekmdgnpbleaelfbkiinnhjdmbpmigg
Product ID  916b02f4-2a76-4b09-9740-2ced2a5dcc66
Publisher   导演BK（Individual 账号，Verification Status: Authorized）
提交版本    0.1.1
审核备注    extension/CERT-NOTES.txt（1932 字符，限 2000）
```

Chrome 侧已备案的身份信息（2026-07-29 提交，BK 手填 + Claude 看屏推剪贴板）：

```
CRX ID      ahbgoaaojaanogcampbekjmiocmnnbbk
开发者账号  chozuihei@gmail.com（$5 已付，联系邮箱已验证）
提交版本    0.1.1（与 Edge 同一个 zip）
类别/语言   娱乐 / 中文（中国）
数据申报    只勾「网站内容」+ 三条声明全勾；远程代码选「否」
测试说明    CERT-NOTES.txt 同款
官方网址    未选（bking.film 域名 07-29 已在 Search Console 验证，
            但提交时下拉尚未同步出来；下次更新版本时可补选）
```

**三个 CRX ID 已齐，可以收紧 worker 的 CORS 了**（等两边都过审再动手，
免得审核期间改后端节外生枝）：
开发版 kojnijdnomgpoebfnochpafnoncheilf / Edge koekmdgnpbleaelfbkiinnhjdmbpmigg /
Chrome ahbgoaaojaanogcampbekjmiocmnnbbk

---

照这份直接复制粘贴。**Edge 免费**，Chrome 要一次性 $5 开发者注册费，所以先上 Edge。

---

## 一、先做的（只有 BK 能做）

注册 Microsoft Partner Center 的扩展开发者账号：https://partner.microsoft.com/dashboard/microsoftedge

用现成的 Microsoft 账号登录就行，免费，不用交钱也不用填银行卡（扩展免费发布不涉及收款）。

---

## 二、上传的包

```bash
cd extension
python check.py     # 先自查，通过了再打包
python pack.py      # 输出 dist/bk-bottle-0.1.1.zip
```

传 `dist/bk-bottle-0.1.1.zip`。

---

## 三、文案（可直接粘）

**名称**

```
BK漂流瓶 · 和陌生人交换正在看的视频
```

**简短说明**（Edge 限 132 字符）

```
点一下，捞一个陌生人正在看的视频。不读浏览记录，不要账号，不碰你的新标签页。
```

**详细说明**

```
算法喂给你的东西越来越像你已经点过的东西。这是一条手工的出路。

点一下工具栏那个瓶子，捞上来的是一个陌生人真实在看的几条视频 —— 不是算法猜的「相似但不同」，是另一个人的一个晚上。看到有意思的按一下，不想看点「再捞一个」。

在 YouTube 或 B站 的播放页，会多出一个「装进瓶子」按钮。攒几条自己正在看的，在面板里一次扔进海里，等下一个路过的人捞走。

支持 YouTube（视频和播放列表）和 B站，一个瓶子里可以混着装。

【不做什么】

· 不读你的浏览记录。Chrome 插件确实有这个 API，这个插件没有申请 —— 权限清单里没有 history，你可以在安装页自己核对。
· 不接管你的新标签页，不改你的主页和搜索引擎。
· 不要账号。没有注册、没有邮箱、没有密码。身份是你浏览器里的一串随机 id。
· 没有留言框。瓶子里只放链接，所以不会变成广告牌。
· 不投广告、不做第三方统计、不卖数据。

【它只在一个时刻读页面】

你主动点「装进瓶子」的那一刻，读当前这一个页面的视频编号、标题、封面和频道名。不点就什么都不读。

【权限为什么是这三个】

· storage：把攒着待扔的清单和你的匿名 id 存在本地
· www.youtube.com / www.bilibili.com：只在播放页放那个「装进瓶子」按钮，并在你点它时读当前视频的公开信息
· b.bking.film：这个服务自己的接口，捞瓶和扔瓶

【源代码】

全部开源（MIT）：https://github.com/bkingfilm/bk-bottle
隐私说明：https://b.bking.film/privacy
网页版（不装插件也能用）：https://b.bking.film
```

**分类**：`社交与通讯`（或 `娱乐`）

**语言**：中文（简体）

**隐私政策 URL**

```
https://b.bking.film/privacy
```

**支持网址**

```
https://github.com/bkingfilm/bk-bottle/issues
```

---

## 四、数据申报（这一栏别填错，填错会被退回）

Edge 会问「这个扩展是否收集用户数据」。按实际情况：

| 问的 | 答 |
|---|---|
| 收集个人身份信息（姓名/邮箱/地址） | 否 |
| 收集健康、财务、认证信息 | 否 |
| 收集位置 | 否 |
| 收集浏览记录 | **否** |
| 收集用户活动（点击、鼠标位置等） | 否 |
| 收集网站内容 | **是** —— 用户主动点「装进瓶子」时的视频标题与链接 |

最后一项要勾是，别怕。它就是这个产品的功能本身，说清楚比藏着好；藏了被审出来才是麻烦。

---

## 五、截图

至少 1 张，规格 **1280×800** 或 **640×480**（PNG / JPG）。

最省事的做法：装好插件，点开面板，截图，然后把那张 380 宽的图摆在 1280×800 的画布中间。要我做的话说一声。

建议 2 到 3 张：
1. 面板捞到一瓶的样子（主图）
2. YouTube 或 B站 播放页上那个「装进瓶子」按钮
3. 面板里待扔清单攒了几条的样子

---

## 六、审核大概会问什么

Edge 和 Chrome 的审核都盯「权限是不是超出功能所需」。这个插件的清单本来就短，但两点最好在提交备注里先写清楚：

**为什么要 youtube.com 和 bilibili.com 的权限**
> 只用于在播放页注入一个「装进瓶子」按钮，并在用户点击它时读取当前视频的公开信息（编号、标题、封面、频道名）。不在这两个站做任何其他读取或修改。

**为什么 B站 的封面由客户端读取**
> B站 的图片和接口对机房 IP 有封锁，服务端取不到元数据，所以由用户浏览器在页面上读取公开的 og:image 后带上来。

---

## 七、Chrome 商店（以后要上再看）

同一个 zip 直接传，多一次性 $5 注册费，审核 1 到 3 天。文案通用。

要注意的是**国内打不开 Chrome 商店**，所以国内用户实际只能走 Edge 或者开发者模式加载。这也是先上 Edge 的原因。
