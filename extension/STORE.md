# 上架材料（Edge / Chrome 商店）

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

| 商店 | 状态 | 时间 |
|---|---|---|
| **Edge Add-ons** | **🔄 0.2.0 已重新提交**（2026-08-15 01:2x，BK 本人在 Partner Center 提交，Product ID `916b02f4-2a76-4b09-9740-2ced2a5dcc66`）。本次改动：`_locales` 两份 `extName` 改名（`BK漂流瓶 - 视频与游戏交换` / `BK Bottle - Video & Game Swap`）、版本 0.1.9→0.2.0、Store listing 中英双份 description 补齐 Steam、logo 300×300、截图加一张含 Steam 的、审核备注加 v0.2.0 重提说明。**代码与权限零改动。** 上架状态往后由 `bk-bottle-growth` 晚班自动查（见该线 SKILL.md 第四步），不再靠人工登后台。<br><br>**上一版 ⛔ Review failed（0.1.3）**：certification report 只有一条退回项，08-15 BK 截图确认：<br>**`1.1.2 Distinct Function & Value; Accurate Representation`** — Notes to publisher 原话：`Please provide a quality title that is informative and accurate for users.`<br>**就是商店标题不合格，与代码、权限、隐私政策、语言设置全部无关**（08-15 曾怀疑 Languages 填 English (US) 与中文内容不符，报告里没有这一项，**该猜测作废**）。现标题「BK漂流瓶 · 和陌生人交换正在看的视频」= 品牌前缀 ＋ `·` ＋ 一句宣传式副标题，Edge 的 1.1.2 要的是一个直接说明功能的干净名字 | 0.1.1 于 2026-07-29 提交；**Review completed: 2026-08-12**（结果 08-12 就出了，08-15 才发现，中间空了 3 天）；**0.1.3 的提交时间未采集到**——此前本表一直记着「0.1.1 In review」，说明中途 BK 提过 0.1.3 没回记 |
| **Chrome Web Store** | **0.1.7 已过审上架**（08-11 确认，商店公开页版本已更新）。**0.1.8 已打包待提交** = Steam 支持：商店页「装进瓶子」+ 资料页一键装最近在玩 + 面板扔游戏瓶；新增 3 条 host permission（store.steampowered.com/app、steamcommunity.com/id、/profiles），会触发人工审核。审核备注 CERT-NOTES.txt 已更新（1822 字符），提交时整段替换后台的测试说明 | 0.1.7: 2026-08-10 提交、08-11 过审；0.1.8: 待 BK 提交 |

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
