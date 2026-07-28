"""把 extension/ 打成可上传商店的 zip。

用法:python pack.py
输出:dist/bk-bottle-<版本号>.zip

下划线开头的文件不进包(_harness.html 是开发用的壳子),pack.py 自己也不进。
"""
import json
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SKIP_EXT = {".zip", ".py"}


def should_skip(rel):
    name = os.path.basename(rel)
    if name.startswith("_") or name.startswith("."):
        return True
    if os.path.splitext(name)[1] in SKIP_EXT:
        return True
    return rel.split(os.sep)[0] in ("dist", "__pycache__")


def main():
    with open(os.path.join(HERE, "manifest.json"), encoding="utf-8") as f:
        version = json.load(f)["version"]

    out_dir = os.path.join(HERE, "dist")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "bk-bottle-%s.zip" % version)

    packed = []
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(HERE):
            dirs[:] = [d for d in dirs if not should_skip(
                os.path.relpath(os.path.join(root, d), HERE))]
            for name in files:
                full = os.path.join(root, name)
                rel = os.path.relpath(full, HERE)
                if should_skip(rel):
                    continue
                z.write(full, rel.replace(os.sep, "/"))
                packed.append(rel.replace(os.sep, "/"))

    print("打包完成:%s" % out)
    print("共 %d 个文件:" % len(packed))
    for p in sorted(packed):
        print("  " + p)
    print("\n大小:%.1f KB" % (os.path.getsize(out) / 1024))


if __name__ == "__main__":
    main()
