"""把 extension/ 打成可上传商店的 zip。

用法:python pack.py
输出:dist/bk-bottle-<版本号>.zip

这个目录里只放真正要发布的文件 —— Chrome 加载未打包扩展时会把整个目录读进去,
多余的东西不但没用,名字以下划线开头还会直接让加载失败(系统保留前缀)。
开发用的那个壳子因此放在仓库的 dev/ 下,不在这里。
"""
import json
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SKIP_EXT = {".zip", ".py", ".md", ".txt"}


def should_skip(rel):
    name = os.path.basename(rel)
    # _locales 是下划线前缀里唯一的例外:Chrome 规定多语言文案必须放在这个名字下。
    # 漏掉它,manifest 里的 __MSG_extName__ 就查不到词条,插件直接加载失败
    if rel.split(os.sep)[0] == "_locales":
        return False
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
