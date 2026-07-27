# 生成 og:image (1200x630),配色跟站点一致,不放任何营销话术
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
img = Image.new("RGB", (W, H), "#04101d")
d = ImageDraw.Draw(img)

# 垂直渐变:#04101d -> #071a2b -> #0a2438,跟 body 的 linear-gradient 对齐
stops = [(0.0, (4, 16, 29)), (0.4, (7, 26, 43)), (1.0, (10, 36, 56))]
for y in range(H):
    t = y / (H - 1)
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        if t0 <= t <= t1:
            k = (t - t0) / (t1 - t0)
            c = tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(3))
            d.line([(0, y), (W, y)], fill=c)
            break

emoji = ImageFont.truetype("C:/Windows/Fonts/seguiemj.ttf", 150)
bold = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 76)
reg = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 34)
small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 26)


def center(text, font, y, fill, color_emoji=False):
    box = d.textbbox((0, 0), text, font=font, embedded_color=color_emoji)
    d.text(((W - (box[2] - box[0])) / 2 - box[0], y), text, font=font,
           fill=fill, embedded_color=color_emoji)


center("🌊🍾", emoji, 88, None, True)
center("BK漂流瓶", bold, 268, "#e8f2fa")
center("匿名交换陌生人正在看的视频", reg, 382, "#8fb3cc")
center("看看信息茧房外面长什么样", reg, 436, "#8fb3cc")

# 细分隔线 + 站点标识
d.line([(430, 516), (770, 516)], fill="#1e4a6d", width=2)
center("yt-bottle.bkingfilm.workers.dev", small, 546, "#4dd0e1")

img.save("G:/claude code/yt-bottle/worker/src/og.png", optimize=True)
print("saved", img.size)
