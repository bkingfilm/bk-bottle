# Edge Store Listing 文案（0.2.0，2026-08-15 重提用）

传完 0.2.0 的包之后，Partner Center 的 **Store Listings** 页会列出 `Chinese (China)` 与 `English` 两行，两行都是 `Incomplete`——**Description 与 Extension logo 都是空的，必须各填一遍**才能点 Publish。Extension name 那一列不用管，商店直接从包里的 `_locales` 读，已经是新名字。

**Extension logo**：`dev\store-logo-300.png`（300×300 PNG，由 `extension/icons/icon-128.png` LANCZOS 放大生成，扁平色块无糊边）。两种语言可以传同一张。

**Screenshots**：`dev\store-shot-1280x800.png` 与 `dev\shot-steam.png`（都是 1280×800）。

---

## 为什么文案要重写（别直接抄旧的）

`STORE.md` 第三节那份中文文案和 `STORE-CHROME-EN.md` 那份英文文案都停在 0.1.1 时代，**只写了 YouTube 和 B站，没有 Steam**，权限说明也少三条 host permission。0.1.9 已经接了 Steam，照旧文案填等于描述与实际功能不符——这正好是把 0.1.3 顶回来的那条 `1.1.2 Distinct Function & Value; Accurate Representation` 的另一半。下面两份是补齐 Steam 的版本。

**另作废一条旧策略**：`STORE-CHROME-EN.md` 写着「英文名里不放 BK 前缀，品牌词对陌生人零搜索量」，并把 `Random YouTube picks from strangers` 当作命中搜索词的设计。这条在 Edge 侧行不通——标题里挂 YouTube 商标就是 1.1.2 的高频触发点，0.1.3 已经因此被退。**上架优先于搜索排名，搜不到总好过上不去。** 关键词改为往 Description 里放（Edge 商店搜索也吃描述正文）。

---

## Chinese (China)

### Short description（限 132 字符，实际 45）

```
点一下，捞一个陌生人正在看的视频、在玩的游戏。不读浏览记录，不要账号，不碰你的新标签页。
```

### Description

```
算法喂给你的东西越来越像你已经点过的东西。这是一条手工的出路。

点一下工具栏那个瓶子，捞上来的是一个陌生人真实在看的几条视频、在玩的几个游戏 —— 不是算法猜的「相似但不同」，是另一个人的一个晚上。看到有意思的按一下收藏，不想看点「再捞一个」。

在 YouTube、B站的播放页，或者 Steam 的游戏页，会多出一个「装进瓶子」按钮。攒几条自己正在看、正在玩的，在面板里一次扔进海里，等下一个路过的人捞走。在自己的 Steam 个人主页还可以一键把「最近在玩」装进瓶子。

支持 YouTube（视频和播放列表）、B站和 Steam，一个瓶子里可以混着装。

【不做什么】

· 不读你的浏览记录。浏览器确实有这个 API，这个插件没有申请 —— 权限清单里没有 history，你可以在安装页自己核对。
· 不接管你的新标签页，不改你的主页和搜索引擎。
· 不要账号。没有注册、没有邮箱、没有密码。身份是你浏览器里的一串随机 id。
· 没有留言框。瓶子里只放链接，所以不会变成广告牌。
· 不投广告、不做第三方统计、不卖数据。

【它只在一个时刻读页面】

你主动点「装进瓶子」的那一刻，读当前这一个页面的公开信息：视频编号或游戏编号、标题、封面、频道名。不点就什么都不读。

【权限为什么是这些】

· storage：把攒着待扔的清单和你的匿名 id 存在本地
· www.youtube.com / www.bilibili.com / store.steampowered.com / steamcommunity.com：只在这些页面放那个「装进瓶子」按钮，并在你点它时读当前条目的公开信息
· b.bking.film：这个服务自己的接口，捞瓶和扔瓶

【源代码】

全部开源（MIT）：https://github.com/bkingfilm/bk-bottle
隐私说明：https://b.bking.film/privacy
网页版（不装插件也能用）：https://b.bking.film
```

---

## English

### Short description（限 132 字符，实际 116）

```
Click the bottle for videos and games a real stranger is into. No history access, no account, no new tab takeover.
```

### Description

```
The algorithm keeps feeding you things that look like what you already clicked. This is a hand-made way out.

Click the bottle in your toolbar and you get what one real stranger is actually watching and playing right now. Not "similar but different" guessed by a model. One person's evening. Tap the star if it was good, hit "another one" if it wasn't.

On any YouTube or Bilibili watch page, or any Steam store page, you get a "Put in bottle" button. Collect a few things you are actually into, throw them into the sea from the panel, and wait for the next person to pick them up. On your own Steam profile you can add what you have been playing recently in one click.

Supports YouTube (videos and playlists), Bilibili and Steam. One bottle can mix all three.

WHAT IT DOES NOT DO

It does not read your browsing history. The browser does offer that API. This extension never asked for it - there is no "history" in the permission list, and you can check that yourself on the install page.
It does not take over your new tab page, your homepage, or your search engine.
It does not want an account. No signup, no email, no password. Your identity is a random id in your own browser.
There is no message box. Bottles hold links only, so this can never turn into a billboard.
No ads, no third-party analytics, no data selling.

IT READS A PAGE AT EXACTLY ONE MOMENT

When you click "Put in bottle" yourself, it reads the public info of that one page: the video or app id, title, thumbnail and channel name. If you never click, it never reads.

WHY THESE PERMISSIONS

storage: keeps your pending queue and your anonymous id on your own machine
www.youtube.com / www.bilibili.com / store.steampowered.com / steamcommunity.com: only to place the "Put in bottle" button on those pages and read the public info of the item when you click it
b.bking.film: this service's own API, for fishing and throwing bottles

SOURCE

Open source (MIT): https://github.com/bkingfilm/bk-bottle
Privacy: https://b.bking.film/privacy
Web version (works without the extension): https://b.bking.film
```

---

## 其余栏位（沿用旧档，未变）

- **隐私政策 URL**：`https://b.bking.film/privacy`
- **支持网址**：`https://github.com/bkingfilm/bk-bottle/issues`
- **分类**：Entertainment（0.1.3 报告里显示的就是这个，不用改）
- **数据申报**：照 `STORE.md` 第四节那张表，「收集网站内容」勾**是**，其余全否
- **审核备注**：整段替换成 `extension/CERT-NOTES.txt`（现 1956 字符，开头已加 v0.2.0 的重提说明）
