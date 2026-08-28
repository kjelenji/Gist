"""Process friendship puzzle icon assets — strip white backgrounds."""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ASSETS = Path(
    r"C:\Users\kelen\.cursor\projects\c-Users-kelen-OneDrive-Desktop-Gist\assets"
)
OUT = Path(r"C:\Users\kelen\OneDrive\Desktop\Gist\myapp\static\icons")

# Source files are named ..._images_image-<uuid>.png
FILES = {
    "image-7d5a66ec-e2a0-41a1-86f5-3df0da02827d.png": "fur.png",
    "image-fc56c031-bff9-4344-9728-376c72ec9695.png": "ant.png",
    "image-675da72d-353c-4786-b28a-ad569568c16b.png": "ship.png",
    "image-e12aacf1-f051-4ae6-86f0-4317f438dd20.png": "mink.png",
    "image-eda91750-c0a0-4869-ac77-065c5a16e547.png": "rabbit.png",
    "image-b8eace1f-db56-42eb-9f16-37024a525aa4.png": "anthill.png",
    "image-93f09f54-738f-4ab2-81d1-ad9d3e68631a.png": "she.png",
    "image-eb36bc9d-bf19-4a52-ae07-8978f9b7f846.png": "shh.png",
    "image-33867207-b20f-4809-a864-32c85e3d3fa6.png": "ant-colony.png",
    "image-0b4f956d-2b8e-4218-b7de-17a63bb829d6.png": "hip.png",
    "image-5c8983f1-c51f-4408-b38c-7148baad1981.png": "fox.png",
    "image-ca97523a-4f3a-45e2-a5d2-c3f68c40026c.png": "queen.png",
    "image-e3fbb68f-c0b3-4bd6-9303-47a0ffb25036.png": "lamb.png",
    "image-1cc73ee8-f111-402b-88a8-3bd51ce45a63.png": "goat.png",
    "image-431a2755-dd25-4c6d-a8f9-48b0f95b68c3.png": "rabbit-hole.png",
    "image-e35f5589-e454-4286-b760-9fbae4e2ac42.png": "nest.png",
    "image-19697852-5f3e-4e77-bcb2-5a2a07048864.png": "friendship.png",
}


def is_background_plate(r, g, b, thr=230):
    """White, off-white, and gray rounded-tile leftover around icons."""
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    white = (r > thr) & (g > thr) & (b > thr)
    gray_plate = (mx > 160) & ((mx.astype(np.int16) - mn.astype(np.int16)) < 22)
    return white | gray_plate


def flood_clear_white(img, thr=230):
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba).copy()
    H, W = arr.shape[:2]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    is_bg = is_background_plate(r, g, b, thr=thr)
    visited = np.zeros((H, W), dtype=bool)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if is_bg[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if is_bg[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        arr[y, x, 3] = 0
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and not visited[ny, nx] and is_bg[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    return Image.fromarray(arr, "RGBA")


def trim_square(img, pad=10):
    bbox = img.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(img.width, x1 + pad), min(img.height, y1 + pad)
    cropped = img.crop((x0, y0, x1, y1))
    side = max(cropped.width, cropped.height, 64)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cropped.width) // 2, (side - cropped.height) // 2), cropped)
    return canvas


def find_src(suffix: str) -> Path | None:
    matches = list(ASSETS.glob(f"*{suffix}"))
    return matches[0] if matches else None


def clear_she_halo(img: Image.Image) -> Image.Image:
    """Remove the yellow/peach glow behind the girl icon."""
    arr = np.asarray(img.convert("RGBA")).copy()
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    a = arr[:, :, 3]
    warm = (a > 10) & (r >= g) & (r > b + 12) & (g >= b - 8) & (r > 150)
    arr[warm, 3] = 0
    return Image.fromarray(arr, "RGBA")


def clear_bracelet_hole(img, thr=242):
    """Knock out the enclosed white oval inside the friendship bracelet."""
    arr = np.asarray(img.convert("RGBA")).copy()
    H, W = arr.shape[:2]
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    hole = (a > 10) & (r >= thr) & (g >= thr) & (b >= thr)
    cy, cx = H // 2, W // 2
    visited = np.zeros((H, W), dtype=bool)
    q = deque()
    for dy in range(-8, 9):
        for dx in range(-8, 9):
            y, x = cy + dy, cx + dx
            if 0 <= y < H and 0 <= x < W and hole[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        arr[y, x, 3] = 0
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and not visited[ny, nx] and hole[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    return Image.fromarray(arr, "RGBA")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for src_name, out_name in FILES.items():
        src = find_src(src_name)
        if src is None:
            print("MISSING", src_name)
            continue
        out = flood_clear_white(Image.open(src))
        if out_name == "she.png":
            out = clear_she_halo(out)
        if out_name == "friendship.png":
            out = clear_bracelet_hole(out)
        out = trim_square(out)
        out.thumbnail((256, 256), Image.Resampling.LANCZOS)
        out.save(OUT / out_name)
        print("saved", out_name, out.size)
    print("done ->", OUT)


if __name__ == "__main__":
    main()
