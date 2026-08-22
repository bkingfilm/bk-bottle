# BK漂流瓶 Steam 新功能更新通知 · 发布记录

任务：bottle-steam-update-broadcast（一次性，正式档 2026-08-12 20:58）
成稿：BK 已确认，一字不改，只允许平台机械性适配
配图：G:\claude code\yt-bottle\dev\shot-steam.png（474.2KB，2026-08-12 16:53 重出）
⚠️ 08-12 16:53 BK 令改按钮：面板里「🌟 有意思」改名「🌟 收藏」，配图已跟着重出
⚠️ 08-12 16:12 BK 令改图：瓶内第一款游戏由「戴森球计划」换成「影之刃零」
（Steam appid 4115450，S-GAME Studio，2026-10-28 发售；Steam API 实查确认，
另有一条 3910040《明末：渊虚之域》影之刃零是蹭名 DLC，未采用）。
源文件 dev\shot-steam.html 已同步改，版式与其余内容一字未动。
**20:58 班一律用这版新图，别用任何缓存的旧版。**

## 发布状态表

| 渠道 | 状态 | 直链 | 发布时间 |
| --- | --- | --- | --- |
| X 主帖 @bkingfilm | 发布成功 | https://x.com/bkingfilm/status/2087536264988012674 | 2026-08-12 21:46:44 |
| X 评论补链 | 发布成功 | https://x.com/bkingfilm/status/2087537800593957186 | 2026-08-12 21:52:50 |
| Threads 主贴 @bkfilm（简体，BK 特批） | 发布成功 | https://www.threads.com/@bkfilm/post/Db8O2RpmKr8 | 2026-08-12 21:06:31 |
| Threads 回复补链 | 发布成功 | https://www.threads.com/@bkfilm/post/Db8PH51mO6A | 2026-08-12 21:10 |
| B站动态 | 发布成功（BK 本人手发） | https://www.bilibili.com/opus/1235671428333830152 | 2026-08-12 21:16 |
| B站动态评论补链 | 发布成功（BK 本人手发） | 同上动态评论区 | 2026-08-12 21:16 |
| 知乎想法 | 发布成功 | https://www.zhihu.com/pin/2070985969076015829 | 2026-08-12 21:36:38 |
| 知乎想法评论补链 | 发布成功 | 同上想法评论区 | 2026-08-12 21:50 |
| Discord 夜草（#BK漂流瓶） | 发布成功 | https://discord.com/channels/958164961270591508/1532327462954860586/1537092925001965568 | 2026-08-12 21:41 |

## 运行日志

### 2026-08-12 15:16-15:30 · 提前触发班（未发布）

本次运行是在正式档 20:58 之前被提前触发的（任务 fireAt=2026-08-12T12:58:00Z，触发时本机时间 15:16，尚未到点）。
按 publish-fixed-exact-time「档位是死的」与任务书「目标 21:00」，**本班一条不发**，只做零风险准备：

- 配图核对：G:\claude code\yt-bottle\dev\shot-steam.png 存在，500.7KB，今天 14:55:21 生成 ✓
- 发布记录：本文件此前不存在，即五渠道零发布，20:58 班需全量执行
- X 登录态：x.com 左栏显示「导演BK｜游戏行业幕后 @bkingfilm」，不是 @pdbking ✓
- Threads 熔断：THREADS-CIRCUIT-BREAKER.md 状态 NORMAL（2026-07-25 BK 点头恢复），Threads 线可发 ✓
- 20:00 档预判：独游雷达线今天 09:45 产出 G:\Desktop\独游雷达\X稿0812_Approximately Up.txt，
  文件内「建议档位：20:00」。**是否已排进 X 队列未最终确认**，20:58 班必须现场看 @bkingfilm profile 复核：
  20:00±20 分钟内有已发主帖 → 本条改 21:30 发；没有 → 21:00 发。
- 浏览器标签已关闭。
- 任务档位复核：list_scheduled_tasks 复查 bottle-steam-update-broadcast 仍为
  enabled=true / nextRunAt=2026-08-12T12:58:00Z（北京 20:58）/ lastRunAt 空，
  本次提前触发未消耗正式档，无需重建任务。

### 2026-08-12 16:50-17:50 · 产品侧改动（BK 令，非本次发布任务范围）

1. 「🌟 有意思」全线改名「🌟 收藏」，连带点完态/收藏夹标题/回执/提示语。
   覆盖插件简体+英文语言包、网页版简体+繁体、后台统计、隐私说明。
   代码标识符（btnGood/voteGood/good/yys/API）未动，纯文案层。
2. 新增收藏入口（BK 反馈「收藏似乎要捞完了才能看到」）：
   - 网页版：捞瓶页「下网」下方常驻一行「⭐ 我的收藏（N）」，点开就地展开全部 20 瓶，无收藏时整行不出现
   - 插件版：面板底部新增折叠组「⭐ 我的收藏」，形态照搬「待扔的瓶子」，无收藏时整组 display:none
   - 同时清掉捞空分支里那份重复的收藏列表（实测会与新入口同屏显示两遍同一批卡片）
3. 网页版已部署上线两次：Version d930bf56（改名）→ b54fd8dd（收藏入口），
   线上 https://b.bking.film 真实点击验证通过（展开 11 张卡片）。
4. 插件已重新打包 dist\bk-bottle-0.1.9.zip（30.3KB，含收藏入口）。
   ⚠️ 旧包 bk-bottle-0.1.8.zip（17:12 打，含改名但不含收藏入口）已被 0.1.9 取代，勿提审旧包。
   **插件商店尚未提交，仍需 BK 决定何时提审。**

**20:58 班开工须知：本文件的发布状态表全是「未发」，五渠道九条动作要全量执行。**


### 2026-08-12 20:59- · 正式发布班（实时追加）

- 20:59 开工。X 账号核实＝@bkingfilm ✓；Threads 熔断＝NORMAL ✓；配图 shot-steam.png 485,615 字节 / 16:53:54（收藏版新图）✓
- 21:02 X profile 复核：今天 20:14:02（UTC 12:14:02）已发主帖【游戏圈在吵什么】影之刃零，落在 20:00±20 分钟内。按主帖间隔≥90 分钟，本条 X 主帖顺延到 21:45（任务书写的 21:30 是按 20:00 推的，实际 20:14 用 21:30 只隔 76 分钟，不够）
- 21:06:31 Threads 主贴已发（简体，BK 特批）：https://www.threads.com/@bkfilm/post/Db8O2RpmKr8 正文逐字比对 exact=true，配图 1 张
- 21:10 Threads 补链回复已发（单段无换行）：https://www.threads.com/@bkfilm/post/Db8PH51mO6A
- 21:16 【撞车】BK 本人在我上一个 B站标签页里手动点了发布，并自己补了评论「网页版 https://b.bking.film」。动态直链 https://www.bilibili.com/opus/1235671428333830152（21:16，1675 浏览 / 20 赞）
- 21:25 我这边不知情，重跑一遍又发了一条一模一样的（1235673833563750406）。**该重复条已删除**（21:27 复查 opus 页已 404，动态列表只剩 21:16 那条）。B站渠道按「已完成·BK 本人手发」记，评论补链也由 BK 本人完成，引擎不再补第二条
- 21:27 已 PushNotification 提醒 BK 撞车，并说明我继续跑知乎/X/Discord
- B站图片上传通道记录：t.bilibili.com 的动态编辑器**不吃剪贴板粘图**（CF_HDROP 与 Clipboard::SetImage 两种都只往正文塞空格），也不吃合成 drop 事件。可行解＝①本地起 CORS+PNA 图床（scratchpad\imgserver.py，127.0.0.1:8899）②页面 fetch 成 File ③patch HTMLInputElement.prototype.click 截获 B站临时创建的 file input ④inp.files=DataTransfer.files + dispatchEvent('change')。另：粘贴正文后编辑器会自己多加 1 个尾部空格，需退格删掉
- 21:36:38 知乎想法已发（带图）：https://www.zhihu.com/pin/2070985969076015829 正文三段结构与配图回读确认
- 21:41 Discord 夜草「BK漂流瓶」频道已发（带图，含链接，不需评论补链）：https://discord.com/channels/958164961270591508/1532327462954860586/1537092925001965568
- 知乎图片上传通道记录：点「图片」开的是知乎自己的上传弹窗，点「本地图片上传」才会走 input.click()，配合同一套 patch 截获 + inp.files 注入 + change 事件，再点「插入图片」即可
- ⚠️ 本班全程 BK 在电脑前同时操作 Chrome，我开的 B站/知乎标签被关掉过三次（PushNotification 因 mobile push 关闭未送达，BK 不知道引擎在跑）
- 21:46:44 X 主帖已发（studio.x.com 路径，带图带 #Steam）：https://x.com/bkingfilm/status/2087536264988012674 正文逐字全等、加权 261/280、nullcast=false、账号 @bkingfilm、图 1200x750 已挂
- 21:52:50 X 补链评论已发（按任务书授权的「补链单段化」并成一段）：https://x.com/bkingfilm/status/2087537800593957186 已回读帖子页标题确认全文含 t.co 短链
  ⚠️ X 回复框 execCommand('insertText') 今晚**两次都稳定写两遍**（整页刷新重来也复现）。修法：先只插中文段→用 getSelection().modify('extend','backward','character') 逐字删回中文段末→再单独 insertText 那条 URL（URL 单独插不会重复）。注意 URL 在 DraftJS 里是一个 link 实体，按「字符」扩选时不等于 20 次，必须每删一次回读长度
- 21:50 知乎想法补链评论已发（单行，URL 被知乎转成链接 chip）
- 全部 9 条动作收口，无渠道放弃、无二次报错

## 收尾结论（2026-08-12 21:55）

九条动作全部完成：X 主帖+补链、Threads 主贴+补链、B站动态+补链（BK 本人手发）、知乎想法+补链、Discord。
唯一异常＝B站撞车，多发的那条已删除，线上只剩 BK 手发的一条。
朋友圈那条不在本任务渠道清单里，稿已在对话里给 BK，等他手发。

## 2026-08-23 · 阮一峰周刊自荐

| 渠道 | 状态 | 直链 | 发布时间 |
| --- | --- | --- | --- |
| ruanyf/weekly 自荐 issue（【网站自荐】，带 ?from=ruanyf） | 发布成功 | https://github.com/ruanyf/weekly/issues/11311 | 2026-08-23 03:4x |

同班：README 补 Steam 瓶与三语说明（commit 48ca03d）、仓库 homepage 填 b.bking.film。周刊周五发刊，选没选中看第 410 期；渠道表看 `ruanyf` 来源人数。HelloGitHub 等这期结果再决定。
