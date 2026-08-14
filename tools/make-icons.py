#!/usr/bin/env python3
"""生成扩展图标。纯标准库手写 PNG 编码，不依赖 PIL。

图形是一把锁：圆角方形底 + 白色锁体、锁梁和钥匙孔。
用 4 倍超采样做抗锯齿，小尺寸(16px)下边缘才不会毛糙。

改配色只需动 BG / FG。改完重跑本脚本即可。
"""

import os
import struct
import zlib

BG = (26, 115, 232)  # Google 蓝
FG = (255, 255, 255)
SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 4

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")


def rounded_rect(x, y, x0, y0, x1, y1, radius):
    """点 (x, y) 是否落在圆角矩形内。坐标都是 0~1 的相对值。"""
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    # 只有四个角需要按圆角判断，其余直接算命中
    cx = x0 + radius if x < x0 + radius else (x1 - radius if x > x1 - radius else x)
    cy = y0 + radius if y < y0 + radius else (y1 - radius if y > y1 - radius else y)
    if cx == x or cy == y:
        return True
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius**2


def is_foreground(x, y):
    """锁的形状。返回 True 表示这个点该画成前景色（白）。"""
    # 锁梁：上半个圆环
    shackle_cx, shackle_cy = 0.5, 0.47
    dist_sq = (x - shackle_cx) ** 2 + (y - shackle_cy) ** 2
    if y < 0.47 and 0.115**2 <= dist_sq <= 0.185**2:
        return True

    # 锁体
    if rounded_rect(x, y, 0.27, 0.46, 0.73, 0.80, 0.055):
        # 钥匙孔：圆孔 + 向下的细槽，挖空成底色
        if (x - 0.5) ** 2 + (y - 0.585) ** 2 <= 0.042**2:
            return False
        if 0.585 <= y <= 0.70 and abs(x - 0.5) <= 0.020:
            return False
        return True

    return False


def render(size):
    """返回 size×size 的 RGBA 像素行列表。"""
    rows = []
    step = 1.0 / (size * SUPERSAMPLE)
    for py in range(size):
        row = []
        for px in range(size):
            # 超采样：一个像素内取 SUPERSAMPLE² 个样本求平均
            hits = 0
            inside = 0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    x = (px * SUPERSAMPLE + sx + 0.5) * step
                    y = (py * SUPERSAMPLE + sy + 0.5) * step
                    if rounded_rect(x, y, 0.0, 0.0, 1.0, 1.0, 0.22):
                        inside += 1
                        if is_foreground(x, y):
                            hits += 1
            total = SUPERSAMPLE * SUPERSAMPLE
            alpha = int(round(255 * inside / total))
            if alpha == 0:
                row.append((0, 0, 0, 0))
                continue
            ratio = hits / inside
            color = tuple(
                int(round(BG[i] + (FG[i] - BG[i]) * ratio)) for i in range(3)
            )
            row.append((color[0], color[1], color[2], alpha))
        rows.append(row)
    return rows


def write_png(path, rows):
    height = len(rows)
    width = len(rows[0])
    raw = b"".join(
        b"\x00" + bytes(value for pixel in row for value in pixel) for row in rows
    )

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(png)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        path = os.path.join(OUT_DIR, f"icon{size}.png")
        write_png(path, render(size))
        print(f"生成 {os.path.relpath(path)} ({os.path.getsize(path)} 字节)")


if __name__ == "__main__":
    main()
