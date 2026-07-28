"""装载前自查:把 Chrome 会拒绝加载的问题一次性找出来。

用法:python check.py

Chrome 的报错一次只给一条,不查一遍就得反复「重试」。这里覆盖已经踩过的坑
和常见的引用错误。
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
errs = []
warns = []


def exists(rel):
    return os.path.exists(os.path.join(HERE, rel))


with open(os.path.join(HERE, "manifest.json"), encoding="utf-8") as f:
    m = json.load(f)

# 坑一:下划线开头的文件名是系统保留的,目录里有一个就整个加载失败
for root, dirs, files in os.walk(HERE):
    rel_root = os.path.relpath(root, HERE)
    if rel_root.split(os.sep)[0] in ("dist", "__pycache__"):
        continue
    for name in list(dirs) + files:
        # _locales 和 _metadata 是 Chrome 官方允许的例外
        if name.startswith("_") and name not in ("_locales", "_metadata"):
            errs.append("文件名以下划线开头(系统保留):%s" %
                        os.path.join(rel_root, name).lstrip(".\\/"))

# 坑二:声明了 default_locale 就必须有 _locales/<locale>/messages.json
loc = m.get("default_locale")
if loc:
    need = os.path.join("_locales", loc, "messages.json")
    if not exists(need):
        errs.append("manifest 写了 default_locale=%s,但缺 %s"
                    "(不做多语言就把 default_locale 删掉)" % (loc, need))

# manifest 里引用的每个文件都得真实存在
for size, path in (m.get("icons") or {}).items():
    if not exists(path):
        errs.append("icons[%s] 指向的文件不存在:%s" % (size, path))

sw = (m.get("background") or {}).get("service_worker")
if sw and not exists(sw):
    errs.append("background.service_worker 不存在:%s" % sw)

popup = (m.get("action") or {}).get("default_popup")
if popup and not exists(popup):
    errs.append("action.default_popup 不存在:%s" % popup)

for key, path in (m.get("chrome_url_overrides") or {}).items():
    if not exists(path):
        errs.append("chrome_url_overrides.%s 不存在:%s" % (key, path))

for i, cs in enumerate(m.get("content_scripts") or []):
    for f in cs.get("js", []) + cs.get("css", []):
        if not exists(f):
            errs.append("content_scripts[%d] 引用的文件不存在:%s" % (i, f))
    if not cs.get("matches"):
        errs.append("content_scripts[%d] 没有 matches" % i)

# HTML 里 <script src> / <link href> 引的本地文件也要在
import re
for page in [p for p in (popup, *(m.get("chrome_url_overrides") or {}).values()) if p]:
    html = open(os.path.join(HERE, page), encoding="utf-8").read()
    for ref in re.findall(r'(?:src|href)="([^"]+)"', html):
        if ref.startswith(("http", "//", "data:", "#")):
            continue
        if not exists(ref):
            errs.append("%s 里引用的 %s 不存在" % (page, ref))

# MV3 的 CSP 不许内联事件,onclick= 写在 HTML 里会静默失效
for page in [p for p in (popup, *(m.get("chrome_url_overrides") or {}).values()) if p]:
    html = open(os.path.join(HERE, page), encoding="utf-8").read()
    if re.search(r'\son[a-z]+="', html):
        errs.append("%s 里有内联事件处理器(MV3 的 CSP 会拦),改用 addEventListener" % page)

if m.get("manifest_version") != 3:
    errs.append("manifest_version 不是 3")

# 不许接管用户的新标签页/主页。2026-07-28 加过一次,当天被 BK 否掉:
# 改别人的新标签页等于把人家主页换了,是浏览器插件里最招人恨的一类行为,而且跟
# 「不读你的记录、不要你的账号、不给你算法」这套立意直接冲突。为回访指标去动
# 用户的领地,正是这个产品该反对的事。这条是硬红线,不是可以再权衡的取舍。
if m.get("chrome_url_overrides"):
    errs.append("manifest 里有 chrome_url_overrides(%s)—— 不许接管用户的新标签页"
                "或主页,这是硬红线" % ",".join(m["chrome_url_overrides"].keys()))

# 权限越少越好:history 一旦申请,商店安装页会显示「读取浏览记录」
for p in m.get("permissions", []):
    if p in ("history", "tabs", "browsingData", "cookies"):
        errs.append("申请了敏感权限 %s —— 本项目的隐私承诺不允许" % p)
for h in m.get("host_permissions", []):
    if h in ("<all_urls>", "*://*/*"):
        errs.append("host_permissions 里有 %s,范围过宽" % h)

print("扩展目录:%s" % HERE)
print("权限:%s" % (m.get("permissions") or []))
print("主机:%s" % (m.get("host_permissions") or []))
print()
if errs:
    print("发现 %d 个会导致加载失败的问题:" % len(errs))
    for e in errs:
        print("  [X] " + e)
if warns:
    for w in warns:
        print("  [!] " + w)
if not errs and not warns:
    print("自查通过,可以加载")
sys.exit(1 if errs else 0)
