# -*- coding: utf-8 -*-
"""种子瓶批量采集 v2:冷门垂直领域 x 高播放 x 中文为主 x 零政治。
搜索页抓候选(带播放量) -> 阈值筛选 -> oEmbed 终验 -> 敏感词过滤 -> 去重 -> 组瓶(瓶内频道各异)。
产物: 追加 bottles.json + 生成 worker/kv-seeds2.json 供 bulk put。
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
import server  # 复用 fetch_meta / too_concentrated

QUERIES = [
    "红白机 卡带 修复", "游戏机 维修 翻新 主机", "速通 世界纪录 讲解", "街机 摇杆 制作",
    "怀旧游戏厅 街机厅 探访", "独立游戏 开发日志", "游戏 MOD 制作", "GBA 掌机 改装",
    "老游戏 考古 冷知识", "俄罗斯方块 高手 对决", "游戏音乐 交响乐 音乐会", "扫雷 世界纪录",
    "DOS游戏 怀旧 盘点", "游戏 汉化组 幕后", "世嘉 土星 冷门", "格斗游戏 街霸 高手",
]

SENSITIVE = ["习近平", "江泽民", "毛泽东", "邓小平", "六四", "天安门", "法轮功", "达赖",
             "台独", "港独", "民运", "反送中", "国安法", "共产党", "中共", "文革",
             "刘晓波", "翻墙", "白纸运动", "政治"]

MIN_VIEWS = 30000
PER_QUERY = 3
BOTTLE_SIZE = 5

def parse_views(s):
    if not s:
        return 0
    s = s.replace(",", "")
    m = re.search(r"([\d.]+)\s*万", s)
    if m:
        return int(float(m.group(1)) * 10000)
    m = re.search(r"([\d.]+)\s*M", s)
    if m:
        return int(float(m.group(1)) * 1000000)
    m = re.search(r"(\d+)", s)
    return int(m.group(1)) if m else 0

def search(q):
    url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(q)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0",
                                               "Accept-Language": "zh-CN,zh"})
    html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
    out = []
    for chunk in html.split('"videoRenderer":{')[1:10]:
        vid = re.search(r'"videoId":"([A-Za-z0-9_-]{11})"', chunk)
        views = re.search(r'"viewCountText":\{"simpleText":"(.*?)"', chunk)
        if vid:
            out.append((vid.group(1), parse_views(views.group(1) if views else "")))
    out = [x for x in out if x[1] >= MIN_VIEWS]
    out.sort(key=lambda x: -x[1])
    return out[:PER_QUERY]

# 已在海里/本地的视频不再用
existing = set()
bottles_now = json.load(open(os.path.join(BASE, "bottles.json"), encoding="utf-8"))
for b in bottles_now:
    for v in b["videos"]:
        existing.add(v.get("vid"))

candidates = []   # (vid, views, title, author)
seen_vid, author_count = set(existing), {}
for q in QUERIES:
    try:
        found = search(q)
    except Exception as e:
        print("搜索失败:", q, e)
        continue
    for vid, views in found:
        if vid in seen_vid:
            continue
        t, a = server.fetch_meta(vid)
        if not t:
            continue
        text = t + (a or "")
        if any(w in text for w in SENSITIVE):
            print("敏感剔除:", t[:30])
            continue
        # 单个频道全局最多 2 条,防止候选池被大频道垄断
        key = (a or "?").lower()
        if author_count.get(key, 0) >= 2:
            continue
        author_count[key] = author_count.get(key, 0) + 1
        seen_vid.add(vid)
        candidates.append({"vid": vid, "views": views, "title": t, "author": a or ""})
        print("收:", vid, views, "|", t[:34], "||", a)

# 组瓶:按候选顺序轮转,保证瓶内频道各异
bottles_new = []
pool = list(candidates)
idx = 1
while len(pool) >= 4:
    bottle_vids, used_authors, rest = [], set(), []
    for c in pool:
        if len(bottle_vids) < BOTTLE_SIZE and c["author"].lower() not in used_authors:
            bottle_vids.append(c)
            used_authors.add(c["author"].lower())
        else:
            rest.append(c)
    pool = rest
    if len(bottle_vids) < 4:
        break
    videos = [{"vid": c["vid"], "title": c["title"], "author": c["author"]} for c in bottle_vids]
    assert not server.too_concentrated([v["author"] for v in videos])
    bottles_new.append({
        "id": "seed-v5-%02d" % idx, "device": "seed",
        "videos": videos, "votes": {}, "fished": 0,
        "ts": 1753330000 + idx * 100,
    })
    idx += 1

bottles_now = [b for b in bottles_now if not b["id"].startswith("seed-v5-")] + bottles_new
json.dump(bottles_now, open(os.path.join(BASE, "bottles.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

rows = []
for b in bottles_new:
    b2 = dict(b)
    b2["id"] = "b:" + b2["id"]
    rows.append({"key": b2["id"], "value": json.dumps(b2, ensure_ascii=False),
                 "metadata": {"d": "seed", "g": 0, "b": 0, "p": "yt"}})
json.dump(rows, open(os.path.join(BASE, "worker", "kv-seeds2.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("\n新组瓶数:", len(bottles_new), "| 候选总数:", len(candidates))
