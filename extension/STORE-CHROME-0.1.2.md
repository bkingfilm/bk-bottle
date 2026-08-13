# Chrome Web Store 0.1.2 更新提交（逐字可抄）

0.1.1 已于 2026-08-01 过审上架，这份是把 0.1.2 当**版本更新**提交。
后台禁止脚本化，只能人工操作。

商店直链 https://chromewebstore.google.com/detail/ahbgoaaojaanogcampbekjmiocmnnbbk

---

## 一、上传

后台 → 该扩展 → Package → **Upload new package**，选：

```
G:\claude code\yt-bottle\extension\dist\bk-bottle-0.1.2.zip
```

上传后 manifest 版本会自动从 0.1.1 变成 0.1.2。

---

## 二、这次改了什么

只有两个文件变：`manifest.json`（版本号）和 `panel.js`（多显示一行 yys）。

具体 diff：面板里原本只显示「你是 灯柱47」，现在显示「你是 灯柱47 · 6 yys」。yys 是好评数 ×2 的贡献值，服务端 `/api/mine` 纯派生返回，不落库。网页端已经上线，插件跟上，两边显示一致。

**关键：权限、host、数据用途、隐私申报全部没动。**
所以 Store listing / Privacy practices 两页**一个字都不用改**，直接沿用 0.1.1 的填法（见 `STORE-CHROME.md`）。没有新权限意味着不触发权限复审，这类更新一般过得比首次快。

---

## 三、如果有「What's new / 更新说明」栏

```
面板里显示你的 yys 贡献值（别人说你的瓶子有意思，一次算 2 yys），与网页版保持一致。
```

---

## 四、审核员备注栏（如果有 notes，可沿用旧的）

```
This is a minor UI update: the popup panel now displays a "yys" contribution number derived from the user's existing like count. No new permissions, no new host permissions, no change to data handling, no remote code. Full source: https://github.com/bkingfilm/bk-bottle
```

---

## 五、提交后

Submit for review。过审后再做两件事：

1. Edge 那边 0.1.1 若已过审，同样把 0.1.2 提上去
2. 两边都落地后收紧 worker CORS 白名单（见项目档）
