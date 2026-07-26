# -*- coding: utf-8 -*-
"""B站种子采集:搜冷门垂直高播放视频 -> view 接口核验 -> 敏感词过滤 -> 与 YouTube 混装组瓶。
本机 IP 可以直连 B站 接口(Cloudflare 机房 IP 才被 -412 封),所以种子可以在本地生成。
产物: 追加 bottles.json + worker/kv-seeds-bili.json 供 bulk put。
"""
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
import server  # 复用 too_concentrated

KEYWORDS = [
    "老物件修复", "古法酿酒", "手艺人 竹编", "赶海 挖到", "钓鱼 野钓",
    "机械键盘 客制化", "老电脑 装机 怀旧", "红白机 修复", "街机 基板",
    "民乐 唢呐", "古琴 演奏", "戏曲 昆曲", "评书", "相声 小剧场",
    "考古 纪录片", "地质 科普", "航天 科普", "数学 科普", "解剖 科普",
    "美食 硬核", "预制菜 测评", "面点 手法", "卤味 做法",
    "越野 穿越", "摩旅 川藏", "货运 卡车司机", "远洋 船员",
    "宠物 救助", "养蜂", "养鱼 造景",
    "手办 涂装", "模型 拼装", "皮具 制作", "木工 榫卯",
    "格斗游戏 教学", "速通 记录", "独立游戏 开发", "MOD 制作",
    "老照片 修复", "字体 设计",
]

SENSITIVE = ["习近平", "江泽民", "毛泽东", "邓小平", "六四", "天安门", "法轮功", "达赖",
             "台独", "港独", "民运", "反送中", "国安法", "共产党", "中共", "文革",
             "刘晓波", "翻墙", "白纸运动", "政治", "西方专家", "坐不住了", "叫停",
             "真相让", "沉默", "中国为何", "厉害了"]

MIN_VIEW = 50000
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"


def api(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Referer": "https://www.bilibili.com/",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode("utf-8"))


def search(kw):
    """B站搜索接口需要 cookie,改用 web 搜索页解析 BV 号,再逐个走 view 核验。"""
    url = "https://search.bilibili.com/all?keyword=" + urllib.parse.quote(kw)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.bilibili.com/"})
    html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
    return list(dict.fromkeys(re.findall(r"/video/(BV[A-Za-z0-9]{10})", html)))[:6]


def view(bvid):
    d = api("https://api.bilibili.com/x/web-interface/view?bvid=" + bvid)
    if d.get("code") != 0 or not d.get("data"):
        return None
    x = d["data"]
    return {
        "bvid": bvid,
        "title": (x.get("title") or "")[:100],
        "author": ((x.get("owner") or {}).get("name") or "")[:50],
        "thumb": (x.get("pic") or "").replace("http:", "https:", 1)[:300],
        "views": (x.get("stat") or {}).get("view", 0),
    }


bottles_now = json.load(open(os.path.join(BASE, "bottles.json"), encoding="utf-8"))
used = set()
for b in bottles_now:
    for v in b["videos"]:
        used.add(v.get("bvid") or v.get("vid"))

picked, author_count = [], {}
for kw in KEYWORDS:
    if len(picked) >= 40:
        break
    try:
        cands = search(kw)
    except Exception as e:
        print("搜索失败", kw, e)
        continue
    for bv in cands:
        if len(picked) >= 40 or bv in used:
            continue
        try:
            m = view(bv)
        except Exception:
            continue
        if not m or m["views"] < MIN_VIEW:
            continue
        text = m["title"] + m["author"]
        if any(w in text for w in SENSITIVE):
            print("敏感剔除:", m["title"][:26])
            continue
        key = m["author"].lower()
        if author_count.get(key, 0) >= 2:
            continue
        author_count[key] = author_count.get(key, 0) + 1
        used.add(bv)
        picked.append(m)
        print("收 %2d | %8d | %s || %s" % (len(picked), m["views"], m["title"][:32], m["author"]))
        time.sleep(0.4)
    time.sleep(0.6)

# 取一批 YouTube 视频用于混装:从已有种子瓶里抽,每瓶抽 1 条,保证不重复
yt_pool = []
for b in bottles_now:
    if b.get("device") != "seed":
        continue
    for v in b["videos"]:
        if v.get("vid"):
            yt_pool.append({"vid": v["vid"], "title": v["title"], "author": v.get("author", "")})
            break
random.seed(20260726)
random.shuffle(yt_pool)

# 组瓶:每瓶 5 条 = 3 条 B站 + 2 条 YouTube,频道互不相同
bottles_new, idx = [], 1
bi, yi = 0, 0
while bi + 3 <= len(picked) and yi + 2 <= len(yt_pool):
    group = picked[bi:bi + 3] + yt_pool[yi:yi + 2]
    bi += 3
    yi += 2
    authors = [g.get("author", "") for g in group]
    if server.too_concentrated(authors):
        continue
    videos = []
    for g in group:
        if g.get("bvid"):
            videos.append({"bvid": g["bvid"], "title": g["title"], "author": g["author"], "thumb": g["thumb"]})
        else:
            videos.append({"vid": g["vid"], "title": g["title"], "author": g["author"]})
    bottles_new.append({
        "id": "seed-mix-%02d" % idx, "device": "seed",
        "videos": videos, "votes": {}, "fished": 0,
        "ts": 1753400000 + idx * 100,
    })
    idx += 1

bottles_now = [b for b in bottles_now if not b["id"].startswith("seed-mix-")] + bottles_new
json.dump(bottles_now, open(os.path.join(BASE, "bottles.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

rows = []
for b in bottles_new:
    b2 = dict(b)
    b2["id"] = "b:" + b2["id"]
    rows.append({"key": b2["id"], "value": json.dumps(b2, ensure_ascii=False),
                 "metadata": {"d": "seed", "g": 0, "b": 0, "p": "mix"}})
json.dump(rows, open(os.path.join(BASE, "worker", "kv-seeds-bili.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("\nB站视频:", len(picked), "| 混装瓶:", len(bottles_new))
