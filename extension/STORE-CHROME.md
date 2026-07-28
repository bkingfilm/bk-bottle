# Chrome Web Store 填表对照（逐字可抄）

Chrome 后台禁止任何扩展脚本化（`The extensions gallery cannot be scripted`），所以这份只能人工填。

Chrome 比 Edge 多两个必填项，而且审核最常在这两项上退回：**单一用途说明**和**每个权限的理由**。下面都写好了。

---

## Store listing 页

**Description（详细说明）**

```
算法喂给你的东西越来越像你已经点过的东西。这是一条手工的出路。

点一下工具栏那个瓶子，捞上来的是一个陌生人真实在看的几条视频，不是算法猜的「相似但不同」，是另一个人的一个晚上。看到有意思的按一下，不想看点「再捞一个」。

在 YouTube 或 B站 的播放页，会多出一个「装进瓶子」按钮。攒几条自己正在看的，在面板里一次扔进海里，等下一个路过的人捞走。

支持 YouTube（视频和播放列表）和 B站，一个瓶子里可以混着装。

【不做什么】

不读你的浏览记录。Chrome 插件确实有这个 API，这个插件没有申请，权限清单里没有 history，你可以在安装页自己核对。
不接管你的新标签页，不改你的主页和搜索引擎。
不要账号。没有注册、没有邮箱、没有密码。身份是你浏览器里的一串随机 id。
没有留言框。瓶子里只放链接，所以不会变成广告牌。
不投广告、不做第三方统计、不卖数据。

【它只在一个时刻读页面】

你主动点「装进瓶子」的那一刻，读当前这一个页面的视频编号、标题、封面和频道名。不点就什么都不读。

【源代码】

全部开源（MIT）：https://github.com/bkingfilm/bk-bottle
隐私说明：https://b.bking.film/privacy
网页版（不装插件也能用）：https://b.bking.film
```

**Category** → `Entertainment`

**Language** → `Chinese (Simplified)`

**Screenshots** → 传这张（1280×800）

```
G:\Desktop\bk漂流瓶_商店截图_1280x800.png
```

**Official URL / Homepage URL**

```
https://b.bking.film
```

**Support URL**

```
https://github.com/bkingfilm/bk-bottle/issues
```

---

## Privacy practices 页（Chrome 独有，审核重点）

### Single purpose（单一用途说明）

Chrome 要求一个扩展只能有一个明确用途。逐字抄：

```
让用户匿名交换彼此正在看的视频：把自己的视频链接装进一个「瓶子」扔出去，并随机捞取一个陌生人扔的瓶子来看。所有功能都服务于这一个用途。
```

英文版（如果要求英文）：

```
Anonymously exchange videos people are actually watching: users put their own video links into a "bottle" and receive a random bottle thrown by a stranger. Every feature serves this single purpose.
```

### Permission justification（每个权限的理由）

**storage**

```
Stores the user's anonymous local id and the list of videos they have queued up but not yet thrown. Both stay on the user's own machine and are never uploaded.
```

**Host permission: `https://b.bking.film/*`**

```
This is the extension's own backend. It is used to fetch a random bottle, to throw the user's queued videos, and to show the user how many people liked their bottles.
```

**Host permission: `https://www.youtube.com/*`**

```
Injects a single "add to bottle" button on YouTube watch pages. When and only when the user clicks that button, the extension reads the current video's public metadata (video id, title, channel name) so it can be put into a bottle. No other reading or modification happens on YouTube, and browsing history is never accessed.
```

**Host permission: `https://www.bilibili.com/video/*`**

```
Same as YouTube: injects a single "add to bottle" button on Bilibili video pages and, only on click, reads the current video's public metadata (video id, title, thumbnail URL, uploader name). The thumbnail must be read client-side because Bilibili blocks datacenter IP ranges, so the server cannot fetch it.
```

**Remote code** → 选「不使用远程代码」（No, I am not using remote code）。所有 JS 都在包里，没有 eval、没有外部脚本。

### Data usage（数据用途申报）

只勾一项：

| 项目 | 勾选 |
|---|---|
| Website content | **是** —— 用户点击「装进瓶子」时的视频标题与链接 |
| Personally identifiable information | 否 |
| Health information | 否 |
| Financial and payment information | 否 |
| Authentication information | 否 |
| Personal communications | 否 |
| Location | 否 |
| Web history | **否**（没有申请 history 权限） |
| User activity | 否 |

下面三个声明全部勾上（都符合事实）：

- 不将数据出售或转让给第三方（除批准用途外）
- 不将数据用于与扩展核心功能无关的目的
- 不将数据用于判定信用度或放贷

**Privacy policy URL**

```
https://b.bking.film/privacy
```

---

## 提交前的备注（如果有 notes 栏）

```
This extension injects a single "add to bottle" button on YouTube and Bilibili video pages, and only reads the current video's public metadata when the user clicks that button. Bilibili thumbnails are read client-side because Bilibili blocks datacenter IPs. No browsing history is accessed; the history permission is not requested. Full source: https://github.com/bkingfilm/bk-bottle
```
