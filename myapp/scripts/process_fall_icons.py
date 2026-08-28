"""Crop fall-puzzle icons and knock out white frames, captions, and paper."""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ASSETS = Path(
    r"C:\Users\kelen\.cursor\projects\c-Users-kelen-OneDrive-Desktop-Gist\assets"
)
OUT = Path(r"C:\Users\kelen\OneDrive\Desktop\Gist\myapp\static\icons")
DBG = Path(r"C:\Users\kelen\OneDrive\Desktop\Gist\myapp\scripts\debug_fall")

LEAVES = (
    ASSETS
    / "c__Users_kelen_AppData_Roaming_Cursor_User_workspaceStorage_94d0bad682b1d7264da0add2b9495efb_images_image-90b54fad-abba-44fc-80c3-4a79bb921bb8.png"
)
DANDELION = (
    ASSETS
    / "c__Users_kelen_AppData_Roaming_Cursor_User_workspaceStorage_94d0bad682b1d7264da0add2b9495efb_images_image-d5a9e0f0-fe5b-4ea1-80fb-a1cc9d94bc73.png"
)
CHAR = (
    ASSETS
    / "c__Users_kelen_AppData_Roaming_Cursor_User_workspaceStorage_94d0bad682b1d7264da0add2b9495efb_images_image-276bcb58-7d71-4240-ab72-f3e5f4c569b2.png"
)


def to_arr(img):
    return np.asarray(img.convert("RGBA")).copy()


def lum_sat(arr):
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    sat = np.divide(mx - mn, mx, out=np.zeros_like(mx), where=mx > 1)
    return lum, sat, mn, mx


def local_std(lum, k=2):
    pad = np.pad(lum.astype(np.float32), k, mode="edge")
    win = np.lib.stride_tricks.sliding_window_view(pad, (2 * k + 1, 2 * k + 1))
    return win.std(axis=(-1, -2))


def flood(mask, seeds):
    H, W = mask.shape
    visited = np.zeros((H, W), dtype=bool)
    q = deque()
    for y, x in seeds:
        if 0 <= y < H and 0 <= x < W and mask[y, x] and not visited[y, x]:
            visited[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    return visited


def edge_seeds(H, W):
    seeds = []
    for x in range(W):
        seeds.append((0, x))
        seeds.append((H - 1, x))
    for y in range(H):
        seeds.append((y, 0))
        seeds.append((y, W - 1))
    return seeds


def split_three(img):
    w, h = img.size
    cw = w // 3
    return [img.crop((i * cw, 0, (i + 1) * cw if i < 2 else w, h)) for i in range(3)]


def crop_inside_frame(img, pad=5):
    """Crop to the interior of the gray rounded-rect, past the stroke and caption."""
    arr = to_arr(img)
    H, W = arr.shape[:2]
    lum, sat, _, _ = lum_sat(arr)
    gray = (sat < 0.12) & (lum >= 140) & (lum < 230)
    hi_r = np.where(gray.mean(axis=1) > 0.35)[0]
    hi_c = np.where(gray.mean(axis=0) > 0.35)[0]
    top = hi_r[hi_r < H / 2]
    bot = hi_r[hi_r > H / 2]
    left = hi_c[hi_c < W / 2]
    right = hi_c[hi_c > W / 2]
    if not (len(top) and len(bot) and len(left) and len(right)):
        raise RuntimeError(f"could not find gray frame in {img.size}")
    x0 = int(left.max()) + pad
    y0 = int(top.max()) + pad
    x1 = int(right.min()) - pad
    y1 = int(bot.min()) - pad
    if x1 - x0 < 16 or y1 - y0 < 16:
        raise RuntimeError(f"frame crop too small: {(x0, y0, x1, y1)}")
    return img.crop((x0, y0, x1, y1))


def rounded_rect_mask(h, w, radius):
    yy, xx = np.mgrid[:h, :w]
    r = float(radius)
    inside = np.ones((h, w), dtype=bool)
    corners = (
        ((yy < r) & (xx < r), r, r),
        ((yy < r) & (xx > w - 1 - r), r, w - 1 - r),
        ((yy > h - 1 - r) & (xx < r), h - 1 - r, r),
        ((yy > h - 1 - r) & (xx > w - 1 - r), h - 1 - r, w - 1 - r),
    )
    for quad, cy, cx in corners:
        inside[quad] = (xx[quad] - cx) ** 2 + (yy[quad] - cy) ** 2 <= r * r
    return inside


def dilate(mask, n=2):
    out = mask.copy()
    for _ in range(n):
        p = np.pad(out, 1, mode="constant")
        out = out | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return out


def knockout_paper(img, protect_textured=False):
    """Clear flat paper from the edges. Keep textured whites (bark, puff)."""
    arr = to_arr(img)
    H, W = arr.shape[:2]
    radius = max(14, int(min(H, W) * 0.16))
    arr[~rounded_rect_mask(H, W, radius=radius), 3] = 0

    lum, sat, mn, _ = lum_sat(arr)
    std = local_std(lum, k=2)

    paper = (arr[:, :, 3] > 0) & (lum >= 246) & (sat < 0.10)
    if protect_textured:
        paper = paper & (std < 9)

    hit = flood(paper, edge_seeds(H, W))
    arr[hit, 3] = 0

    lum, sat, mn, _ = lum_sat(arr)
    std = local_std(lum, k=2)
    alpha = arr[:, :, 3] > 8
    colored = alpha & ((sat >= 0.12) | (lum < 205))
    textured = alpha & (std >= 9) & (lum >= 190)
    smoke = alpha & (sat < 0.20) & (lum >= 150) & (lum < 246) & (std >= 6)
    art = colored | smoke | (textured if protect_textured else np.zeros_like(alpha))
    paperish = alpha & (lum >= 228) & (sat < 0.14)
    drop = paperish & ~dilate(art, 2)
    arr[drop, 3] = 0

    trans = arr[:, :, 3] == 0
    kernel = np.zeros((H, W), dtype=bool)
    kernel[1:, :] |= trans[:-1, :]
    kernel[:-1, :] |= trans[1:, :]
    kernel[:, 1:] |= trans[:, :-1]
    kernel[:, :-1] |= trans[:, 1:]
    lum, sat, mn, _ = lum_sat(arr)
    std = local_std(lum, k=2)
    fringe = kernel & (arr[:, :, 3] > 0) & (mn > 210) & (sat < 0.16)
    if protect_textured:
        fringe = fringe & (std < 10)
    if fringe.any():
        fade = np.clip((255 - mn[fringe]) / 40.0, 0, 1)
        arr[fringe, 3] = (arr[fringe, 3].astype(np.float32) * fade).astype(np.uint8)

    return Image.fromarray(arr, "RGBA")


def trim_square(img, pad_ratio=0.08, min_side=64):
    bbox = img.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    pad = max(6, int(min(x1 - x0, y1 - y0) * pad_ratio))
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(img.width, x1 + pad), min(img.height, y1 + pad)
    cropped = img.crop((x0, y0, x1, y1))
    side = max(cropped.width, cropped.height, min_side)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(
        cropped,
        ((side - cropped.width) // 2, (side - cropped.height) // 2),
        cropped,
    )
    return canvas


def process(img, protect_textured=False, name=""):
    inner = crop_inside_frame(img)
    knocked = knockout_paper(inner, protect_textured=protect_textured)
    out = trim_square(knocked)
    out.thumbnail((256, 256), Image.Resampling.LANCZOS)
    if name:
        DBG.mkdir(parents=True, exist_ok=True)
        inner.save(DBG / f"{name}_inner.png")
        knocked.save(DBG / f"{name}_knock.png")
        bg = Image.new("RGBA", out.size, (70, 120, 165, 255))
        bg.alpha_composite(out)
        bg.convert("RGB").save(DBG / f"{name}_on_blue.jpg", quality=92)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    DBG.mkdir(parents=True, exist_ok=True)

    leaves = Image.open(LEAVES)
    maple_src, oak_src, birch_src = split_three(leaves)
    jobs = [
        (maple_src, "maple.png", False),
        (oak_src, "oak.png", False),
        (birch_src, "birch.png", True),
        (Image.open(DANDELION), "dandelion.png", True),
        (Image.open(CHAR), "char.png", False),
    ]
    for src, out_name, protect in jobs:
        stem = out_name.replace(".png", "")
        out = process(src, protect_textured=protect, name=stem)
        dest = OUT / out_name
        out.save(dest)
        arr = np.asarray(out)
        opaque = int((arr[:, :, 3] > 8).mean() * 100)
        print(f"saved {out_name} {out.size} opaque={opaque}%")


if __name__ == "__main__":
    main()
