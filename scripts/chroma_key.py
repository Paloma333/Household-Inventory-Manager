"""Chroma-key 抠图：移除 JPG 中接近背景色的像素，输出带 alpha 的 PNG。
背景取四角均值做参考（避免 JPEG 压缩偏差），用软阈值（线性过渡）保留抗锯齿边缘。
"""
import sys
import numpy as np
from PIL import Image


def chroma_key(src_path: str, dst_path: str, samples: int = 8, threshold: float = 10.0, softness: float = 14.0) -> dict:
    img = Image.open(src_path).convert("RGB")
    w, h = img.size
    arr = np.asarray(img, dtype=np.float32)  # H, W, 3

    # 从四个角各采几个像素，取均值作为背景参考色
    corner_coords = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ][:samples]
    bg_pixels = np.array([img.getpixel(c) for c in corner_coords], dtype=np.float32)
    bg = bg_pixels.mean(axis=0)
    print(f"  src {w}x{h}  bg=({bg[0]:.0f},{bg[1]:.0f},{bg[2]:.0f})  threshold={threshold} softness={softness}")

    # 每个像素到 bg 的欧式距离
    diff = arr - bg
    dist = np.sqrt((diff * diff).sum(axis=2))  # H, W

    # 软阈值：dist <= threshold → 完全透明；dist >= threshold+softness → 完全不透明；中间线性
    alpha = np.clip((dist - threshold) / softness, 0.0, 1.0) * 255.0
    alpha = alpha.astype(np.uint8)

    # 合成 RGBA（保留原 RGB，仅替换 A）
    rgba = np.dstack([arr.astype(np.uint8), alpha])

    out = Image.fromarray(rgba, mode="RGBA")
    out.save(dst_path, optimize=True)
    transparent_ratio = float((alpha == 0).mean())
    opaque_ratio = float((alpha == 255).mean())
    return {
        "size": out.size,
        "transparent_ratio": transparent_ratio,
        "opaque_ratio": opaque_ratio,
    }


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    info = chroma_key(src, dst)
    print(f"  → {dst}  transparent={info['transparent_ratio']:.1%}  opaque={info['opaque_ratio']:.1%}")