# Chrome Web Store 英文 listing 填表对照（逐字可抄）

这一份只解决一件事：**让不说中文的人在商店里搜得到它**。

现在商店 listing 只有简体中文一份，语言也填的 Chinese (Simplified)。英文用户搜任何词都碰不到这个插件，而产品定位是「主要给国外的人用」。

后台禁止脚本化（`The extensions gallery cannot be scripted`），只能人工填。

---

## 在哪里填

Developer Dashboard → 选中这个 item → **商品详情 / Store listing** 页 → 顶部「当前的编辑语言」下拉 → 选 **英语 – en**。

切过去之后长这样（2026-08-08 实操核过）：

| 栏位 | 状态 | 要不要动 |
|---|---|---|
| 软件包中的标题 | 已经是英文 | **不用**。商店直接从包里 `_locales/en` 读，只读栏 |
| 软件包中的摘要 | 已经是英文 | **不用**。同上 |
| 说明 | **预填了中文**，不是空白 | **要**。全选删掉，粘贴下面的英文 Description |

说明这一栏商店不会跟着 `_locales` 走，它拿中文那份当默认值，必须手工替换。填完「保存草稿」。

中文那份**不要动**，两份共存，Chrome 按用户浏览器语言自动挑。

---

## 关键词的账（为什么这么写）

商店搜索排名吃的是：**名称和描述里的词** + 装机量 + 评价数 + 更新活跃度。

「漂流瓶 / bottle」几乎没有搜索量，没人会为了找视频工具去搜瓶子。真正有量的是用户描述自己问题的词：

| 用户会搜的 | 命中位置 |
|---|---|
| `random youtube` | 名称 |
| `discover videos` / `video discovery` | 描述首段 |
| `escape the algorithm` / `filter bubble` | 描述首句 |
| `youtube recommendations` | 描述正文 |

所以英文名里**不放 BK 前缀**——品牌词对陌生人零搜索量，占掉的是名称里最值钱的位置。

---

## Item name（英文）

```
Video Bottle · Random YouTube picks from strangers
```

## Summary / Short description（132 字符上限）

```
Escape the algorithm. Click the bottle for videos a real stranger is watching. No history access, no account, no new tab takeover.
```

## Description（详细说明）

```
The algorithm keeps feeding you things that look like what you already clicked. This is a hand-made way out.

Click the bottle in your toolbar and you get what one real stranger is actually watching right now. Not "similar but different" guessed by a model. One person's evening. Tap the star if it was good, hit "another one" if it wasn't.

On any YouTube or Bilibili watch page you get a "Put in bottle" button. Collect a few things you are actually watching, throw them into the sea from the panel, and wait for the next person to pick them up.

Supports YouTube (videos and playlists) and Bilibili. One bottle can mix both.

WHAT IT DOES NOT DO

It does not read your browsing history. Chrome does offer that API. This extension never asked for it — there is no "history" in the permission list, and you can check that yourself on the install page.
It does not take over your new tab page, your homepage, or your search engine.
It does not want an account. No signup, no email, no password. Your identity is a random id in your own browser.
There is no message box. Bottles hold links only, so this can never turn into a billboard.
No ads, no third-party analytics, no data selling.

IT READS A PAGE AT EXACTLY ONE MOMENT

The moment you click "Put in bottle", it reads that one page's video id, title, thumbnail and channel name. Click nothing and it reads nothing.

MOST OF THE SEA IS IN CHINESE RIGHT NOW

Being honest about this up front: this started with a Chinese-speaking audience, so a large share of the bottles are Chinese-language videos. If that is not interesting to you, this is not useful yet. It gets more mixed as more people throw bottles in.

SOURCE

Fully open source (MIT): https://github.com/bkingfilm/bk-bottle
Privacy: https://b.bking.film/privacy
Web version (works without the extension): https://b.bking.film
```

**Category** → `Entertainment`（跟中文那份保持一致）

Screenshots / Official URL / Support URL 三项两种语言共用，不用重填。

---

## Privacy practices 页

这一页**不分语言，只有一份**，已经填过英文了（见 [STORE-CHROME.md](STORE-CHROME.md) 的 Single purpose 和权限理由）。这次改动没有新增权限、没有改数据用途，**这一页一个字都不用动**。

---

## 提交前必看

1. **包要重传。** 这次改动动了 `manifest.json`（加 `default_locale`）和 `_locales/`，属于代码变更，必须上传新包才会生效：`extension/dist/bk-bottle-0.1.5.zip`。
2. **版本号是 0.1.5。** 后台实读（2026-08-08）：草稿和已发布**都是 0.1.4**，所以这一版必须是 0.1.5，同号包商店会直接拒收。以后每次提交前都去后台看一眼「已发布」那一栏的版本号，别照文档里的旧数字推。
3. **Edge 先别动。** Edge 的 0.1.1 还在队列里，这条老规矩没变：**Edge 0.1.1 过审之前不要向 Edge 提交新版本，会重置排队**。这一版只提交 Chrome。
4. **中文那份 listing 不要改。** 「漂流瓶」现在搜索排第 1，改名会把已有排名洗掉。中文名要不要改关键词是单独一件事，等这版英文的数据出来再谈。

---

## What's new 栏（如果有）

```
插件界面支持英文，会跟着浏览器语言自动切换。
```

## 这一版代码顺带改了什么

- `_locales/zh_CN` + `_locales/en`：界面文案两份，插件面板和 YouTube/B站 上的「装进瓶子」按钮都会跟着浏览器语言走
- `pack.py` 修了一个会直接炸的 bug：原来会把所有下划线开头的目录排除掉，`_locales` 正好中招，打出来的包缺文案表，插件加载直接失败
- 面板加了一句评分引导：捞满 5 瓶才出现一次，点任意一个按钮就永久不再出现
