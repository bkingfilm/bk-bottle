# -*- coding: utf-8 -*-
"""把本地 bottles.json 转成 wrangler kv bulk put 的批量格式,种子/存量瓶一键搬进 KV。
用法: python make_kv_bulk.py 然后 wrangler kv bulk put kv-bulk.json --binding BOTTLES --remote
"""
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "..", "bottles.json")
OUT = os.path.join(BASE, "kv-bulk.json")

bottles = json.load(open(SRC, encoding="utf-8"))
rows = []
for b in bottles:
    key = b["id"] if b["id"].startswith("b:") else "b:" + b["id"]
    b["id"] = key
    votes = b.get("votes", {})
    good = sum(1 for v in votes.values() if v == "good")
    bad = sum(1 for v in votes.values() if v == "bad")
    rows.append({
        "key": key,
        "value": json.dumps(b, ensure_ascii=False),
        "metadata": {"d": b.get("device", ""), "g": good, "b": bad},
    })

json.dump(rows, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("已生成 %s,共 %d 个瓶子" % (OUT, len(rows)))
