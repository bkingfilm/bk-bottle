# -*- coding: utf-8 -*-
"""把种子瓶从统一的 seed 拆成若干虚拟瓶主(seed-a01 …),每人 3 到 6 瓶。
这样捞到的每一瓶都挂着不同的代号,「记住这个瓶主」对它们也成立。
按瓶子创建时间顺序分配,同一个虚拟人的瓶子主题会自然接近。
"""
import json
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
WORKER = os.path.join(BASE, "worker")
SEA = ["灯塔", "浮标", "罗盘", "鲸落", "暗流", "礁石", "贝壳", "海星", "水母", "珊瑚",
       "潮汐", "海雾", "桅杆", "渔火", "涛声", "海沟", "洋流", "信天翁", "海豚", "旗鱼",
       "玳瑁", "沉锚", "海图", "月光", "汽笛", "北斗", "远帆", "夜航", "冰山", "季风"]


def nickname(dev):
    h = 5381
    for c in dev:
        h = ((h * 33) ^ ord(c)) & 0xFFFFFFFF
    return SEA[h % 30] + " " + str(((h >> 5) % 900) + 100)


def wr(args):
    return subprocess.run(args, capture_output=True, text=True, encoding="utf-8",
                          shell=True, cwd=WORKER)


# 拉线上索引
out = wr(["wrangler", "kv", "key", "list", "--binding", "BOTTLES", "--remote", "--prefix", "b:"])
raw = out.stdout
keys = json.loads(raw[raw.index("["):])
seeds = [k for k in keys if (k.get("metadata") or {}).get("d") == "seed"]
seeds.sort(key=lambda k: k["name"])
print("待改造的种子瓶:", len(seeds))

# 每个虚拟瓶主 3 到 6 瓶,循环取长度,保证代号互不重复
sizes = [4, 6, 3, 5, 4, 6, 5, 3, 4, 5, 6, 4]
groups, i, gi = [], 0, 0
while i < len(seeds):
    n = sizes[gi % len(sizes)]
    groups.append(seeds[i:i + n])
    i += n
    gi += 1

# 设备名必须随机,seed-a01 这种连号会哈希出一串相同数字(灯塔521/浮标521…)一眼假
import random
random.seed(20260726)
ALPH = "abcdefghijklmnopqrstuvwxyz0123456789"

# 线上真人代号一并排重,避免虚拟人和真人撞号
used_nick = set()
for k in keys:
    d = (k.get("metadata") or {}).get("d")
    if d and d != "seed":
        used_nick.add(nickname(d))

plan = []
for idx, g in enumerate(groups, 1):
    while True:
        dev = "seed-" + "".join(random.choice(ALPH) for _ in range(10))
        nk = nickname(dev)
        if nk not in used_nick:
            break
    used_nick.add(nk)
    plan.append((dev, nk, g))
    print("%s -> %s (%d 瓶)" % (dev, nk, len(g)))

if "--dry" in sys.argv:
    sys.exit(0)

# 逐瓶改写 device 与 metadata.d
done = 0
for dev, nk, g in plan:
    for k in g:
        got = wr(["wrangler", "kv", "key", "get", k["name"], "--binding", "BOTTLES", "--remote"])
        s = got.stdout
        try:
            b = json.loads(s[s.index("{"):])
        except Exception:
            print("读取失败", k["name"])
            continue
        b["device"] = dev
        md = dict(k.get("metadata") or {})
        md["d"] = dev
        tmp = os.path.join(WORKER, "tmp-seed.json")
        open(tmp, "w", encoding="utf-8").write(json.dumps(b, ensure_ascii=False))
        wr(["wrangler", "kv", "key", "put", k["name"], "--binding", "BOTTLES", "--remote",
            "--path", "tmp-seed.json", "--metadata", json.dumps(md)])
        done += 1
        if done % 10 == 0:
            print("已改写", done)
os.path.exists(os.path.join(WORKER, "tmp-seed.json")) and os.remove(os.path.join(WORKER, "tmp-seed.json"))

# 本地 bottles.json 同步
local = os.path.join(BASE, "bottles.json")
bs = json.load(open(local, encoding="utf-8"))
name_map = {}
for dev, nk, g in plan:
    for k in g:
        name_map[k["name"][2:]] = dev
for b in bs:
    if b.get("device") == "seed" and b["id"] in name_map:
        b["device"] = name_map[b["id"]]
json.dump(bs, open(local, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("完成,共改写", done, "个瓶子,虚拟瓶主", len(plan), "人")
