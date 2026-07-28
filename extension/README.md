# BK漂流瓶 · Chrome 插件

把「看看茧房外面」从一件要想起来才会做的事，变成一天二十次的顺手动作。

- **新标签页 = 一次捞瓶。** 每开一个新标签，就是一个陌生人正在看的片单。
- **YouTube / B站 播放页多一个「🍾 装进瓶子」。** 攒够几条，一次扔出去。
- **回执写在新标签页顶上。** 「又有 3 个人说你的瓶子有意思」，不用等你自己想起来回来看。

## 权限清单就是产品承诺

```
permissions:      storage
host_permissions: b.bking.film, www.youtube.com, www.bilibili.com
```

没有 `history`，没有 `tabs`，没有 `<all_urls>`。

插件**读得到的只有你主动点「装进瓶子」时当前那一个页面**的视频 id 和标题。浏览记录这件事，Chrome 插件确实有 API 能读，网页版没有 —— 但就算有也不该用，这是主 README「不做什么」里立的规矩，插件版一个字都不改。

## 身份只有一个

`device` 是网页存在 localStorage 里的随机 id，瓶子归谁、回执给谁全靠它。

插件**不发明身份**：`bridge.js` 只在 `b.bking.film` 上运行，把网页的 `yb_device` / `yb_seen` / `yb_follow` 抄进 `chrome.storage`，两边的「捞过」还会互相合并，所以插件里捞过的瓶子网页不会再给一次。

所以装完插件要**打开一次 b.bking.film** 完成对接。没对接之前也能捞，只是瓶子不算在你名下。

同理，**扔瓶不由插件完成**：popup 点「扔进海里」会打开 `b.bking.film/#vids=...&bvs=...`，由网页装填、你过一眼再提交。这样瓶主永远是网页那个身份，回执不会断。插件从不写后端，只读 `/api/fish` 和 `/api/mine`。

## 装到 Chrome（开发版）

改过 manifest 或增删文件之后，先跑一遍自查：

```bash
python check.py
```

Chrome 的加载报错一次只给一条，不自查就得反复点「重试」—— 这个脚本把踩过的坑
都收进去了：下划线开头的文件名（系统保留前缀）、`default_locale` 声明了却没有
`_locales/`、manifest 和 HTML 里引用了不存在的文件、内联事件处理器（MV3 的 CSP
会拦）、以及有没有误申请 `history` / `tabs` / `<all_urls>` 这类破坏隐私承诺的权限。

然后：

1. 打开 `chrome://extensions/`
2. 右上角开「开发者模式」
3. 点「加载已解压的扩展程序」，选这个 `extension` 目录
4. 打开一次 https://b.bking.film 完成身份对接
5. 开个新标签页试试

装完自检五项：

| 看什么 | 应该是 |
|---|---|
| 新标签页 | 自动捞出一瓶，两个按钮「🌟 有意思」「🎣 再捞一个」 |
| 新标签页右上 | 显示你的代号（对接后才有，形如「灯塔 280」） |
| YouTube 播放页 | 赞/踩/分享那一行末尾多一个「🍾 装进瓶子」 |
| B站 播放页 | 点赞/投币/收藏那一行末尾多一个同样的按钮 |
| 点过之后 | 工具栏图标右下角出现数字角标 |

## 打包上商店

```bash
python pack.py     # 输出 dist/bk-bottle-<版本>.zip
```

**这个目录里只放真正要发布的文件。** Chrome 加载未打包扩展时会把整个目录读进去，多余的东西不但没用，名字以下划线开头还会直接让加载失败（`_` 是系统保留前缀，报 `Filenames starting with "_" are reserved`）。

开发用的壳子因此放在仓库的 [dev/harness.html](../dev/harness.html)：它把 `chrome.*` 和 `fetch` 换成假的，双击就能在普通浏览器里改界面，不用每次重载插件。改完记得回到真 Chrome 里验一遍。

**Chrome Web Store**：一次性 $5 开发者注册费，审核 1 到 3 天。注意国内打不开商店。

**Edge Add-ons**：免费、国内直连、审核更松，同一个 zip 直接传，值得同时上。

上架文案就照上面那份权限清单写，那是这个插件最硬的卖点。

## 不想让它接管新标签页

新标签页被接管这件事有人反感，Chrome 也会弹一次「扩展程序已更改您的新标签页」。

要改成保守版：把 `manifest.json` 里的 `chrome_url_overrides` 整段删掉，捞瓶入口就只剩点图标弹出的 popup。代价是回访这件事基本没救了 —— 每天二十次的触达正是这个插件唯一比 PWA 强的地方。

## 后端配合

插件要跨域调 API，worker 那边做了两处放行（`worker/src/index.js`）：

- CORS 头只回显 `chrome-extension://` 的 Origin，普通网站拿不到
- `readBody` 的同源检查放行 `chrome-extension://` 前缀

放宽这两处不会掉进 CSRF：本站不发 cookie 也不认 session，身份是请求体里自带的随机 id，拿别人的浏览器发请求伪造不出别人的身份。扔瓶另有每 IP 日限兜着。

插件上商店拿到固定 id 之后，可以把这两处都收紧成只认那一个 id。
