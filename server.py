# -*- coding: utf-8 -*-
"""漂流瓶原型后端：零依赖，Python 标准库。
扔瓶子 = 提交一组 YouTube 链接，捞瓶子 = 按质量加权随机取一个别人的瓶子。
数据落盘 bottles.json,标题/频道通过 YouTube oEmbed 尽力抓取(失败不阻塞)。
反滥用:无留言字段/频道集中度拒收/每 IP 每日限扔/请求体上限/Origin 校验。
"""
import json
import os
import random
import re
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE, "bottles.json")
PUBLIC = os.path.join(BASE, "public")
PORT = 8765

MAX_BODY = 4096
MAX_BOTTLES = 5000
THROWS_PER_IP_PER_DAY = 5

VID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
LIST_RE = re.compile(r"^[A-Za-z0-9_-]{12,50}$")
BILI_RE = re.compile(r"^(BV[A-Za-z0-9]{10}|av\d{1,12})$")
LOCK = threading.Lock()
IP_THROWS = {}  # ip -> (day, count)


def load_bottles():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_bottles(bottles):
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(bottles, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DATA_FILE)


def fetch_meta(vid):
    """oEmbed 抓标题+频道名,3 秒超时,失败返回 (None, None)。urllib 自动读系统代理。"""
    url = ("https://www.youtube.com/oembed?format=json&url="
           + urllib.parse.quote("https://www.youtube.com/watch?v=" + vid, safe=""))
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=3) as r:
            data = json.loads(r.read().decode("utf-8"))
            return data.get("title"), data.get("author_name")
    except Exception:
        return None, None


def fetch_list_meta(lid):
    """oEmbed 验证播放列表,自动生成的电台(RD开头)会404被自然拒掉。"""
    url = ("https://www.youtube.com/oembed?format=json&url="
           + urllib.parse.quote("https://www.youtube.com/playlist?list=" + lid, safe=""))
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=3) as r:
            d = json.loads(r.read().decode("utf-8"))
            return d.get("title"), d.get("author_name"), d.get("thumbnail_url")
    except Exception:
        return None, None, None


def fetch_bili_meta(bid):
    """B站 view 接口验证视频真实存在,返回 (标题, UP主, 封面)。支持 BV 号和 av 号。"""
    param = ("bvid=" + bid) if bid.startswith("BV") else ("aid=" + bid[2:])
    url = "https://api.bilibili.com/x/web-interface/view?" + param
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": "https://www.bilibili.com/",
        })
        with urllib.request.urlopen(req, timeout=3) as r:
            d = json.loads(r.read().decode("utf-8"))
            if d.get("code") != 0 or not d.get("data"):
                return None, None, None
            data = d["data"]
            pic = (data.get("pic") or "").replace("http:", "https:", 1)
            owner = (data.get("owner") or {}).get("name")
            return data.get("title"), owner, pic
    except Exception:
        return None, None, None


def bottle_platform(videos):
    """瓶子平台标签: 纯B站 bili / 纯YouTube yt / 混装 mix。"""
    has_bili = any(v.get("bvid") for v in videos)
    has_yt = any(v.get("vid") or v.get("list") for v in videos)
    return "mix" if (has_bili and has_yt) else ("bili" if has_bili else "yt")


def too_concentrated(authors):
    """同一频道超过瓶内视频的一半(且瓶内>=3个视频)判为营销瓶。抓取失败的不计。"""
    known = [a.strip().lower() for a in authors if a]
    if len(known) < 3:
        return False
    counts = {}
    for a in known:
        counts[a] = counts.get(a, 0) + 1
    return max(counts.values()) > len(known) / 2


def bottle_weight(b):
    """质量加权:只按好评抬升,不按任何信号沉底。

    「一般」按钮 2026-07-28 撤掉了,它实际是在被当翻页键点(33 次有意思对
    70 次一般),当差评用就是给自己灌噪声。现在只有正信号,谁都不会被埋。
    """
    if isinstance(b.get("fans"), list):
        good = len(b["fans"])
    else:
        votes = b.get("votes", {})
        good = sum(1 for v in votes.values() if v == "good")
    return 1.0 + 0.5 * good


def allow_throw(ip):
    today = time.strftime("%Y-%m-%d")
    day, count = IP_THROWS.get(ip, (today, 0))
    if day != today:
        count = 0
    if count >= THROWS_PER_IP_PER_DAY:
        return False
    IP_THROWS[ip] = (today, count + 1)
    return True


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[%s] %s" % (time.strftime("%H:%M:%S"), fmt % args))

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path, ctype):
        try:
            with open(path, "rb") as f:
                body = f.read()
        except OSError:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length > MAX_BODY:
            self._json({"error": "请求太大"}, 413)
            return None
        origin = self.headers.get("Origin")
        if origin:
            host = urllib.parse.urlparse(origin).netloc.split(":")[0]
            if host not in ("localhost", "127.0.0.1", self.headers.get("Host", "").split(":")[0]):
                self._json({"error": "来源不允许"}, 403)
                return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._json({"error": "请求体不是合法 JSON"}, 400)
            return None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self._file(os.path.join(PUBLIC, "index.html"), "text/html; charset=utf-8")
        elif parsed.path == "/api/stats":
            with LOCK:
                bottles = load_bottles()
            self._json({"count": len(bottles)})
        elif parsed.path == "/api/fish":
            device = urllib.parse.parse_qs(parsed.query).get("device", [""])[0]
            with LOCK:
                bottles = load_bottles()
                others = [b for b in bottles if b.get("device") != device]
                if not others:
                    self._json({"empty": True})
                    return
                b = random.choices(others, weights=[bottle_weight(x) for x in others])[0]
                b["fished"] = b.get("fished", 0) + 1
                save_bottles(bottles)
            self._json({
                "empty": False,
                "id": b["id"],
                "videos": b.get("videos", []),
                "fished": b["fished"],
            })
        else:
            self.send_error(404)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/throw":
            self.handle_throw()
        elif path == "/api/feedback":
            self.handle_feedback()
        elif path == "/api/fish":
            self.handle_fish()
        else:
            self.send_error(404)

    def handle_fish(self):
        payload = self._read_body()
        if payload is None:
            return
        device = str(payload.get("device", ""))[:64]
        seen = payload.get("seen", [])
        seen = set(s for s in seen if isinstance(s, str))
        pf = payload.get("pf")
        pf = pf if pf in ("yt", "bili") else "any"
        with LOCK:
            bottles = load_bottles()
            others = [b for b in bottles if b.get("device") != device]
            # 混装瓶只出现在「都行」里
            if pf != "any":
                others = [b for b in others if bottle_platform(b.get("videos", [])) == pf]
            fresh = [b for b in others if b["id"] not in seen]
            if not fresh:
                self._json({"empty": True, "exhausted": bool(others)})
                return
            b = random.choices(fresh, weights=[bottle_weight(x) for x in fresh])[0]
            b["fished"] = b.get("fished", 0) + 1
            save_bottles(bottles)
        self._json({
            "empty": False,
            "id": b["id"],
            "videos": b.get("videos", []),
            "fished": b["fished"],
        })

    def handle_throw(self):
        payload = self._read_body()
        if payload is None:
            return
        ip = self.client_address[0]
        if not allow_throw(ip):
            self._json({"error": "今天扔得够多了，明天再来"}, 429)
            return

        vids = payload.get("videos", [])
        vids = [v for v in dict.fromkeys(vids) if isinstance(v, str) and VID_RE.match(v)]
        lists = payload.get("lists", [])
        lists = [x for x in dict.fromkeys(lists) if isinstance(x, str) and LIST_RE.match(x)]
        bilis = payload.get("bilis", [])
        bilis = [x for x in dict.fromkeys(bilis) if isinstance(x, str) and BILI_RE.match(x)]
        if not 1 <= len(vids) + len(lists) + len(bilis) <= 10:
            self._json({"error": "需要 1 到 10 个有效的 YouTube 或 B站 链接"}, 400)
            return
        device = str(payload.get("device", ""))[:64]

        # 查不到标题 = 不存在或不可访问,一律丢弃,防止编造 ID 塞死链
        with ThreadPoolExecutor(max_workers=5) as pool:
            vmetas = list(pool.map(fetch_meta, vids))
            lmetas = list(pool.map(fetch_list_meta, lists))
            bmetas = list(pool.map(fetch_bili_meta, bilis))
        videos = [{"vid": v, "title": t, "author": a or ""}
                  for v, (t, a) in zip(vids, vmetas) if t]
        videos += [{"list": x, "title": t, "author": a or "", "thumb": th or ""}
                   for x, (t, a, th) in zip(lists, lmetas) if t]
        videos += [{"bvid": x, "title": t, "author": a or "", "thumb": th or ""}
                   for x, (t, a, th) in zip(bilis, bmetas) if t]
        if not videos:
            self._json({"error": "这些链接在 YouTube/B站 上都找不到对应内容"}, 400)
            return
        if too_concentrated([x["author"] for x in videos]):
            self._json({"error": "同一个频道的视频太多了，换着装点别的"}, 400)
            return

        bottle = {
            "id": "b%d%04d" % (int(time.time()), random.randint(0, 9999)),
            "device": device,
            "videos": videos,
            "fans": [],
            "fished": 0,
            "ts": int(time.time()),
        }
        with LOCK:
            bottles = load_bottles()
            if len(bottles) >= MAX_BOTTLES:
                bottles.pop(0)
            bottles.append(bottle)
            save_bottles(bottles)
        self._json({"ok": True, "count": len(videos)})

    def handle_feedback(self):
        payload = self._read_body()
        if payload is None:
            return
        bid = str(payload.get("bottle", ""))[:32]
        verdict = payload.get("verdict")
        device = str(payload.get("device", ""))[:64]
        if verdict not in ("good", "bad") or not bid or not device:
            self._json({"error": "参数不对"}, 400)
            return
        # 旧页面缓存里还留着「一般」按钮,收下但不入库
        if verdict == "bad":
            self._json({"ok": True, "ignored": True})
            return
        with LOCK:
            bottles = load_bottles()
            for b in bottles:
                if b["id"] == bid:
                    old = b.get("votes", {})
                    fans = b["fans"] if isinstance(b.get("fans"), list) else [
                        k for k, v in old.items() if v == "good"]
                    if device not in fans and len(fans) < 300:
                        fans.append(device)
                    b["fans"] = fans
                    b.pop("votes", None)
                    save_bottles(bottles)
                    self._json({"ok": True})
                    return
        self._json({"error": "瓶子不存在"}, 404)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("yt-bottle listening on http://127.0.0.1:%d" % PORT)
    server.serve_forever()
