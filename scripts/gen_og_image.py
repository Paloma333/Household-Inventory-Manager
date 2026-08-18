#!/usr/bin/env python3
"""生成 public/og.png — 社交分享大图 1200x630（设计 tokens 同款）"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (246, 241, 231)          # --bg-canvas #F6F1E7
INK = (42, 38, 32)            # --ink-primary #2A2620
SECONDARY = (110, 102, 85)    # --ink-secondary #6E6655
SAGE = (122, 148, 113)        # --accent-sage #7A9471
SAGE_SOFT = (228, 236, 221)   # --accent-sage-soft #E4ECDD

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

pf = "/System/Library/Fonts/PingFang.ttc"
def font(size, index=0):
    return ImageFont.truetype(pf, size, index=index)

# 小字眉
d.text((80, 84), "him · household inventory manager", font=font(30, 1), fill=SAGE)

# 主标题（两行）
d.text((80, 170), "记住家里有什么，", font=font(76, 2), fill=INK)
d.text((80, 290), "就不用记了。", font=font(76, 2), fill=INK)

# 副标题
d.text((80, 430), "拍照入库 · 低库存提醒 · 购物清单分享", font=font(36, 1), fill=SECONDARY)

# 底部 chip：品牌色块 + 文字
chip_x, chip_y, chip_w, chip_h = 80, 500, 250, 58
d.rounded_rectangle([chip_x, chip_y, chip_x + chip_w, chip_y + chip_h], radius=29, fill=SAGE)
d.text((chip_x + 20, chip_y + 8), "小家 · him", font=font(34, 2), fill=(255, 252, 244))

# 右侧装饰：三个圆点（克制）
d.ellipse([1030, 84, 1062, 116], fill=SAGE_SOFT)
d.ellipse([1080, 84, 1112, 116], fill=SAGE_SOFT)

img.save("/Users/liuyushan/Desktop/小屋/him/public/og.png")
print("og.png written")
