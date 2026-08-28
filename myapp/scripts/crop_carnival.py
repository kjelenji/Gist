"""
Crop carnival puzzle icons from the Gemini reference sheet.
"""
from collections import deque
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

ASSETS = Path(
    r"C:\Users\kelen\.cursor\projects\c-Users-kelen-OneDrive-Desktop-Gist\assets"
)
SRC = (
    ASSETS
    / "c__Users_kelen_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_Gemini_Generated_Image_nchmqwnchmqwnchm-af57a709-2cc6-4c36-b1e7-e7c0fd3870e9.png"
)
OUT = Path(r"C:\Users\kelen\OneDrive\Desktop\Gist\myapp\static\icons")
DBG = Path(r"C:\Users\kelen\OneDrive\Desktop\Gist\myapp\scripts\debug_carnival")
OUT.mkdir(parents=True, exist_ok=True)
DBG.mkdir(parents=True, exist_ok=True)


def make_transparent(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba).copy()
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    white = (r > 242) & (g > 242) & (b > 242)
    cream = (r > 215) & (g > 205) & (b > 185)
    light = (r > 230) & (g > 230) & (b > 230)
    arr[white | cream | light, 3] = 0
    return Image.fromarray(arr, "RGBA")


def save_icon(img: Image.Image, name: str, keep_bg: bool = False):
    if keep_bg:
        out = img.convert("RGBA")
    else:
        out = make_transparent(img)
    bbox = out.getbbox()
    if not bbox:
        print("EMPTY", name)
        Image.new("RGBA", (64, 64), (0, 0, 0, 0)).save(OUT / f"{name}.png")
        return
    x0, y0, x1, y1 = bbox
    pad = max(8, int(min(x1 - x0, y1 - y0) * 0.08))
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(out.width, x1 + pad), min(out.height, y1 + pad)
    out = out.crop((x0, y0, x1, y1))
    side = max(out.width, out.height, 64)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(out, ((side - out.width) // 2, (side - out.height) // 2))
    if name == "neon":
        canvas = polish_neon(canvas)
    elif name == "x-ray":
        canvas = polish_xray(canvas)
    canvas.save(OUT / f"{name}.png")
    print("saved", name, canvas.size)


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


def to_square(img, pad=2):
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


def polish_neon(img: Image.Image) -> Image.Image:
    """Drop the gray anti-aliased ring left after knocking out the plate."""
    arr = np.asarray(img.convert("RGBA")).copy()
    H, W = arr.shape[:2]
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    a = arr[:, :, 3]
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    fringe = (a > 0) & (sat < 24)
    trans = a == 0
    seeds = []
    ys, xs = np.where(fringe)
    for y, x in zip(ys.tolist(), xs.tolist()):
        y0, y1 = max(0, y - 1), min(H, y + 2)
        x0, x1 = max(0, x - 1), min(W, x + 2)
        if trans[y0:y1, x0:x1].any() or y in (0, H - 1) or x in (0, W - 1):
            seeds.append((y, x))
    if seeds:
        arr[flood(fringe, seeds), 3] = 0
    return stylize_neon(to_square(Image.fromarray(arr, "RGBA"), pad=4))


def _dilate(mask: np.ndarray, size: int = 3) -> np.ndarray:
    img = Image.fromarray((mask.astype(np.uint8) * 255), "L")
    return np.asarray(img.filter(ImageFilter.MaxFilter(size))) > 128


def _glow(mask: np.ndarray, color, radius: float, strength: float) -> Image.Image:
    H, W = mask.shape
    layer = np.zeros((H, W, 4), np.float32)
    m = mask.astype(np.float32)
    layer[:, :, 0] = color[0] * m
    layer[:, :, 1] = color[1] * m
    layer[:, :, 2] = color[2] * m
    layer[:, :, 3] = 255.0 * m * strength
    im = Image.fromarray(np.clip(layer, 0, 255).astype(np.uint8), "RGBA")
    return im.filter(ImageFilter.GaussianBlur(radius=radius))


def _screen_onto(base: np.ndarray, glow: Image.Image, amount: float = 1.0) -> None:
    """Light the opaque plate with a neon bloom (glow otherwise sits underneath)."""
    g = np.asarray(glow).astype(np.float32)
    ga = (g[:, :, 3:4] / 255.0) * amount
    screened = 255.0 - (255.0 - base[:, :, :3]) * (255.0 - g[:, :, :3]) / 255.0
    base[:, :, :3] = np.clip(base[:, :, :3] * (1.0 - ga) + screened * ga, 0, 255)


def _scale_mask(mask: np.ndarray, scale_x: float, scale_y: float | None = None) -> np.ndarray:
    if scale_y is None:
        scale_y = scale_x
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return np.zeros((1, 1), dtype=bool)
    y0, x0 = int(ys.min()), int(xs.min())
    crop = mask[y0 : int(ys.max()) + 1, x0 : int(xs.max()) + 1]
    im = Image.fromarray((crop.astype(np.uint8) * 255), "L")
    nw = max(1, round(crop.shape[1] * scale_x))
    nh = max(1, round(crop.shape[0] * scale_y))
    return np.asarray(im.resize((nw, nh), Image.Resampling.LANCZOS)) > 128


def _fit_masks(fill: np.ndarray, outline: np.ndarray, max_h: int, max_w: int):
    """Uniformly shrink digit masks so they fit in the plate band above/below Ne."""
    h, w = fill.shape
    if h <= 0 or w <= 0:
        return fill, outline
    scale = min(max_h / h, max_w / w, 1.0)
    if scale >= 0.999:
        return fill, outline

    def _sm(m: np.ndarray) -> np.ndarray:
        nh = max(1, round(m.shape[0] * scale))
        nw = max(1, round(m.shape[1] * scale))
        im = Image.fromarray((m.astype(np.uint8) * 255), "L")
        return np.asarray(im.resize((nw, nh), Image.Resampling.LANCZOS)) > 128

    return _sm(fill), _sm(outline)


def _in_round_rect(y, x, y0, x0, y1, x1, rad: float) -> bool:
    if y < y0 or y >= y1 or x < x0 or x >= x1:
        return False
    hh = y1 - y0
    ww = x1 - x0
    rad = max(0, min(int(rad), hh // 2, ww // 2))
    ly = y - y0
    lx = x - x0
    if rad <= 0:
        return True
    if rad <= ly < hh - rad or rad <= lx < ww - rad:
        return True
    cy = rad - 0.5 if ly < rad else hh - rad - 0.5
    cx = rad - 0.5 if lx < rad else ww - rad - 0.5
    return (ly - cy) ** 2 + (lx - cx) ** 2 <= (rad + 0.02) ** 2


def _make_zero(h: int, w: int) -> np.ndarray:
    """Symmetric rounded-rect 0 with a clean centered counter."""
    g = np.zeros((h, w), dtype=bool)
    if h < 5 or w < 5:
        g[:, :] = True
        return g
    t = max(2, round(min(h, w) * 0.24))
    rad = max(2, min(h, w) // 3)
    inner_rad = max(1, rad - 1)
    for y in range(h):
        for x in range(w):
            outer = _in_round_rect(y, x, 0, 0, h, w, rad)
            inner = _in_round_rect(y, x, t, t, h - t, w - t, inner_rad)
            g[y, x] = outer and not inner
    return g


def _polish_last_zero(fill: np.ndarray) -> np.ndarray:
    """Redraw the rightmost bottom 0 at the current pixel size so it stays even."""
    H, W = fill.shape
    labels, n = _label(fill)
    best = None
    best_x = -1
    for i in range(1, n + 1):
        comp = labels == i
        ys, xs = np.where(comp)
        if int(ys.min()) < H * 0.45:
            continue
        if _has_hole(comp) and int(xs.max()) > best_x:
            best_x = int(xs.max())
            best = i
    if best is None:
        return fill
    comp = labels == best
    y0, y1, x0, x1 = _bbox(comp)
    out = fill.copy()
    out[comp] = False
    out[y0:y1, x0:x1] |= _make_zero(y1 - y0, x1 - x0)
    return out


def _assemble_digits(parts, scale_x: float, scale_y: float | None = None, polish_last_zero: bool = False):
    """Scale each digit, leave a gap, and stroke only the outside (holes stay open).

    Short blobs (the decimal) keep a square scale and sit on the baseline so they
    don't stretch into a vertically centered block.
    """
    if scale_y is None:
        scale_y = scale_x
    raw = []
    for part in sorted(parts, key=lambda p: int(np.where(p)[1].min())):
        ys = np.where(part)[0]
        raw.append((part, int(ys.max()) - int(ys.min()) + 1))
    max_h = max((h for _, h in raw), default=1)

    glyphs = []
    is_dot = []
    for part, h in raw:
        short = h <= max_h * 0.5
        g = _scale_mask(part, scale_x, scale_x if short else scale_y)
        if not g.any():
            continue
        glyphs.append(g)
        is_dot.append(short)
    if not glyphs:
        z = np.zeros((1, 1), dtype=bool)
        return z, z

    H = max(g.shape[0] for g in glyphs)
    # Keep the period a small square on the baseline (~1/5 cap height).
    target = max(4, round(H * 0.20))
    sized = []
    for g, short in zip(glyphs, is_dot):
        if short and g.shape[0] > target:
            im = Image.fromarray((g.astype(np.uint8) * 255), "L")
            ratio = target / g.shape[0]
            nw = max(3, round(g.shape[1] * ratio))
            g = np.asarray(im.resize((nw, target), Image.Resampling.NEAREST)) > 90
        sized.append(g)
    glyphs = sized

    last_zero = None
    if polish_last_zero:
        for i in range(len(glyphs) - 1, -1, -1):
            if not is_dot[i]:
                last_zero = i
                break

    def _median(g):
        if g.shape[0] < 3 or g.shape[1] < 3:
            return g
        return np.asarray(
            Image.fromarray((g.astype(np.uint8) * 255), "L").filter(ImageFilter.MedianFilter(3))
        ) > 128

    cleaned = []
    for i, g in enumerate(glyphs):
        if i == last_zero:
            gh, gw = g.shape
            cleaned.append(_make_zero(gh, gw))
        else:
            cleaned.append(_median(g))
    glyphs = cleaned

    gap = 3
    widths = [g.shape[1] for g in glyphs]
    H = max(g.shape[0] for g in glyphs)
    W = int(sum(widths) + gap * (len(glyphs) - 1))
    fill = np.zeros((H, W), dtype=bool)
    x = 0
    for g in glyphs:
        gy = H - g.shape[0]
        fill[gy : gy + g.shape[0], x : x + g.shape[1]] |= g
        x += g.shape[1] + gap
    outline = _dilate(fill, 3) & ~fill
    return fill, outline


def _paste_bool(dst: np.ndarray, src: np.ndarray, top: int, left: int) -> None:
    h, w = src.shape
    H, W = dst.shape
    y0, x0 = max(0, top), max(0, left)
    y1, x1 = min(H, top + h), min(W, left + w)
    if y1 <= y0 or x1 <= x0:
        return
    dst[y0:y1, x0:x1] |= src[y0 - top : y0 - top + (y1 - y0), x0 - left : x0 - left + (x1 - x0)]


def _label(mask: np.ndarray):
    H, W = mask.shape
    labels = np.zeros(mask.shape, np.int32)
    n = 0

    for y, x in zip(*np.where(mask)):
        if labels[y, x]:
            continue
        n += 1
        q = deque([(y, x)])
        labels[y, x] = n
        while q:
            cy, cx = q.popleft()
            for ny in range(cy - 1, cy + 2):
                for nx in range(cx - 1, cx + 2):
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and labels[ny, nx] == 0:
                        labels[ny, nx] = n
                        q.append((ny, nx))
    return labels, n


def _digit_parts(mask: np.ndarray, max_w: int = 12):
    """Connected components, split wide blobs (e.g. touching 8 and 0)."""
    labels, n = _label(mask)
    parts = []
    for i in range(1, n + 1):
        comp = labels == i
        ys, xs = np.where(comp)
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        if x1 - x0 <= max_w:
            parts.append(comp)
            continue
        col = comp[:, x0:x1].sum(axis=0)
        interior = col[2:-2]
        if len(interior) == 0:
            parts.append(comp)
            continue
        split_x = x0 + int(np.argmin(interior)) + 2
        left = comp.copy()
        left[:, split_x:] = False
        right = comp.copy()
        right[:, :split_x] = False
        for side in (left, right):
            if not side.any():
                continue
            sxs = np.where(side)[1]
            if int(sxs.max()) - int(sxs.min()) + 1 > max_w:
                parts.extend(_digit_parts(side, max_w))
            else:
                parts.append(side)
    return _merge_hole_halves(parts)


def _bbox(mask: np.ndarray):
    ys, xs = np.where(mask)
    return int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1


def _has_hole(mask: np.ndarray) -> bool:
    """True if the glyph has an enclosed counter (0, 8, 4, ...)."""
    if not mask.any():
        return False
    y0, y1, x0, x1 = _bbox(mask)
    pad = np.pad(mask[y0:y1, x0:x1], 1, constant_values=False)
    vis = np.zeros(pad.shape, dtype=bool)
    q = deque()
    ph, pw = pad.shape
    for y, x in ((0, 0), (0, pw - 1), (ph - 1, 0), (ph - 1, pw - 1)):
        if not pad[y, x] and not vis[y, x]:
            vis[y, x] = True
            q.append((y, x))
    while q:
        cy, cx = q.popleft()
        for ny in range(max(0, cy - 1), min(ph, cy + 2)):
            for nx in range(max(0, cx - 1), min(pw, cx + 2)):
                if not pad[ny, nx] and not vis[ny, nx]:
                    vis[ny, nx] = True
                    q.append((ny, nx))
    return bool((~pad & ~vis).any())


def _merge_hole_halves(parts):
    """Rejoin 0/8 halves that the hole split into two components."""
    ordered = sorted(parts, key=lambda p: int(np.where(p)[1].min()))
    merged = []
    i = 0
    while i < len(ordered):
        if i + 1 < len(ordered):
            a, b = ordered[i], ordered[i + 1]
            ya0, ya1, xa0, xa1 = _bbox(a)
            yb0, yb1, xb0, xb1 = _bbox(b)
            y_overlap = min(ya1, yb1) - max(ya0, yb0)
            min_h = min(ya1 - ya0, yb1 - yb0)
            gap = xb0 - xa1
            comb = a | b
            if (
                min_h > 0
                and y_overlap > 0.6 * min_h
                and gap <= 2
                and not _has_hole(a)
                and not _has_hole(b)
                and _has_hole(comb)
            ):
                merged.append(comb)
                i += 2
                continue
        merged.append(ordered[i])
        i += 1
    return merged


def stylize_neon(img: Image.Image) -> Image.Image:
    """Bigger glowing-white 10 / 20.180 with a thin outer black outline."""
    arr = np.asarray(img.convert("RGBA")).astype(np.float32)
    H, W = arr.shape[:2]
    r, g, b, a = [arr[:, :, i] for i in range(4)]
    op = a > 20

    gold = op & (r > 155) & (g > 95) & (b < 140) & (r > g) & (g > b + 15)
    cover = _dilate(gold, 5)
    pink = op & (r > 190) & (g > 125) & (b > 150) & ~cover
    out = arr.copy()
    if pink.any():
        plate = np.median(out[pink], axis=0)
        out[cover] = plate

    fill = np.zeros((H, W), dtype=bool)
    outline = np.zeros((H, W), dtype=bool)
    ys_op = np.where(op.any(axis=1))[0]
    inner_top, inner_bot = int(ys_op[0]) + 8, int(ys_op[-1]) - 8

    lum = 0.299 * r + 0.587 * g + 0.114 * b
    ne = pink & (lum > (float(np.median(lum[pink])) + 20 if pink.any() else 200))
    if ne.any():
        ne_ys = np.where(ne.any(axis=1))[0]
        ne_top, ne_bot = int(ne_ys[0]), int(ne_ys[-1])
    else:
        ne_top, ne_bot = H // 2 - 24, H // 2 + 24
    gap = 8
    xs_op = np.where(op.any(axis=0))[0]
    plate_w = int(xs_op[-1] - xs_op[0]) - 24

    for band, sx, sy, edge in (
        (gold.copy(), 1.35, 1.4, "top"),
        (gold.copy(), 1.85, 2.0, "bottom"),
    ):
        if edge == "top":
            band[H // 2 :, :] = False
            max_h = max(8, (ne_top - gap) - (inner_top + 1))
        else:
            band[: H // 2, :] = False
            max_h = max(8, (inner_bot - 1) - (ne_bot + gap))
        if not band.any():
            continue
        f, o = _assemble_digits(_digit_parts(band), sx, sy, polish_last_zero=(edge == "bottom"))
        f, o = _fit_masks(f, o, max_h, max(16, plate_w))
        fh, fw = f.shape
        left = (W - fw) // 2
        top = inner_top + 1 if edge == "top" else inner_bot - fh - 1
        _paste_bool(fill, f, top, left)
        _paste_bool(outline, o, top, left)
    outline &= ~fill

    glows = [
        _glow(fill, (255, 255, 255), 6, 0.7),
        _glow(fill, (255, 255, 255), 3, 0.8),
    ]
    for gl in glows:
        _screen_onto(out, gl, amount=0.85)
        g = np.asarray(gl).astype(np.float32)
        ga = g[:, :, 3:4] / 255.0
        out[:, :, :3] = np.clip(out[:, :, :3] + g[:, :, :3] * ga * 0.25, 0, 255)

    base = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
    canvas = Image.new("RGBA", base.size, (0, 0, 0, 0))
    for gl in glows:
        canvas = Image.alpha_composite(canvas, gl)
    plate = Image.alpha_composite(canvas, base)
    return _stamp_numbers(enlarge_neon(plate), fill, outline, plate)


def _stamp_numbers(enlarged: Image.Image, fill: np.ndarray, outline: np.ndarray, plate: Image.Image) -> Image.Image:
    """Scale number masks with nearest-neighbor and stamp after the plate is enlarged."""
    x0, y0, x1, y1, nw, nh, px, py, W, H = _tile_scale(plate)
    fill_s = _scale_bool(fill[y0:y1, x0:x1], nw, nh)
    out = np.zeros((H, W), dtype=bool)
    out[py : py + nh, px : px + nw] = fill_s
    out = _polish_last_zero(out)
    ring = _dilate(out, 3) & ~out
    arr = np.asarray(enlarged.convert("RGBA")).copy()
    arr[ring, 0] = 0
    arr[ring, 1] = 0
    arr[ring, 2] = 0
    arr[ring, 3] = 255
    arr[out, 0] = 255
    arr[out, 1] = 255
    arr[out, 2] = 255
    arr[out, 3] = 255
    return Image.fromarray(arr, "RGBA")


def _scale_bool(mask: np.ndarray, nw: int, nh: int) -> np.ndarray:
    if mask.size == 0:
        return np.zeros((nh, nw), dtype=bool)
    im = Image.fromarray((mask.astype(np.uint8) * 255), "L")
    return np.asarray(im.resize((nw, nh), Image.Resampling.NEAREST)) > 128


def _tile_scale(img: Image.Image, scale: float = 1.48):
    arr = np.asarray(img.convert("RGBA"))
    ys, xs = np.where(arr[:, :, 3] > 8)
    if len(xs) == 0:
        W, H = img.size
        return 0, 0, W, H, W, H, 0, 0, W, H
    x0, y0 = int(xs.min()), int(ys.min())
    x1, y1 = int(xs.max()) + 1, int(ys.max()) + 1
    nw = max(1, round((x1 - x0) * scale))
    nh = max(1, round((y1 - y0) * scale))
    W, H = img.size
    fit = min((W - 6) / nw, (H - 6) / nh, 1.0)
    if fit < 1:
        nw, nh = max(1, int(nw * fit)), max(1, int(nh * fit))
    px, py = (W - nw) // 2, (H - nh) // 2
    return x0, y0, x1, y1, nw, nh, px, py, W, H


def enlarge_neon(img: Image.Image, scale: float = 1.48) -> Image.Image:
    """Fill more of the square so the tile reads larger on the board."""
    x0, y0, x1, y1, nw, nh, px, py, W, H = _tile_scale(img, scale)
    tile = img.crop((x0, y0, x1, y1))
    scaled = tile.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(scaled, (px, py), scaled)
    return canvas


def polish_xray(img: Image.Image) -> Image.Image:
    """Crop to the black film; leave the white/gray bezel behind."""
    arr = np.asarray(img.convert("RGBA")).copy()
    H, W = arr.shape[:2]
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    a = arr[:, :, 3]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    opaque = a > 10
    dark = opaque & (lum < 90)
    if not dark.any():
        return img

    # Already cropped: leftover bright pixels are bone, not a film bezel.
    border = np.zeros((H, W), dtype=bool)
    border[:3, :] = True
    border[-3:, :] = True
    border[:, :3] = True
    border[:, -3:] = True
    edge_op = opaque & border
    if edge_op.any() and (lum[edge_op] > 180).mean() < 0.08:
        return to_square(img, pad=2)

    col_dark = dark.mean(axis=0)
    row_dark = dark.mean(axis=1)
    xs = np.where(col_dark > 0.12)[0]
    ys = np.where(row_dark > 0.12)[0]
    if len(xs) < 8 or len(ys) < 8:
        return img

    x0, x1 = int(xs[0]), int(xs[-1]) + 1
    y0, y1 = int(ys[0]), int(ys[-1]) + 1
    inset = 8
    x0, y0 = x0 + inset, y0 + inset
    x1, y1 = x1 - inset, y1 - inset
    if x1 - x0 < 32 or y1 - y0 < 32:
        return img
    cropped = Image.fromarray(arr, "RGBA").crop((x0, y0, x1, y1))
    return to_square(cropped, pad=2)


def polish_existing():
    neon_src = DBG / "neon_src.png"
    if not neon_src.exists():
        Image.open(OUT / "neon.png").save(neon_src)
    src = Image.open(neon_src)
    out = stylize_neon(src)
    out.save(OUT / "neon.png")
    print("polished neon", src.size, "->", out.size)


def split(img, rows, cols, inset=0.1):
    w, h = img.size
    cells = []
    for r in range(rows):
        for c in range(cols):
            L = int(c * w / cols)
            T = int(r * h / rows)
            R = int((c + 1) * w / cols)
            B = int((r + 1) * h / rows)
            dx, dy = int((R - L) * inset), int((B - T) * inset)
            cells.append(img.crop((L + dx, T + dy, R - dx, B - dy)))
    return cells


def trim_ink(img, thr=240):
    a = np.asarray(img.convert("L"), dtype=np.float32)
    col_ink = (a < thr).mean(axis=0)
    row_ink = (a < thr).mean(axis=1)
    ink_cols = np.where(col_ink > 0.01)[0]
    ink_rows = np.where(row_ink > 0.01)[0]
    return img.crop(
        (
            int(ink_cols[0]),
            int(ink_rows[0]),
            int(ink_cols[-1]) + 1,
            int(ink_rows[-1]) + 1,
        )
    )


def find_gaps(mask_1d, min_len=12):
    gaps = []
    i = 0
    n = len(mask_1d)
    while i < n:
        if mask_1d[i]:
            j = i
            while j < n and mask_1d[j]:
                j += 1
            if j - i >= min_len:
                gaps.append((i, j))
            i = j
        else:
            i += 1
    return gaps


def main():
    board = Image.open(SRC).convert("RGB")
    arr = np.asarray(board.convert("L"), dtype=np.float32)
    ys, xs = np.where(arr < 250)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    sheet = board.crop((x0, y0, x1, y1))
    g = np.asarray(sheet.convert("L"), dtype=np.float32)

    # Detect vertical gutter between main board and fill column
    col_ink = (g < 240).mean(axis=0)
    # Look for a low-ink band in the middle-right
    best = None
    for i in range(int(sheet.width * 0.45), int(sheet.width * 0.85)):
        window = col_ink[i : i + 20].mean()
        if best is None or window < best[0]:
            best = (window, i)
    gutter_x = best[1] + 10
    print("gutter_x", gutter_x, "ink", best[0])

    left = sheet.crop((0, 0, gutter_x, sheet.height))
    right = sheet.crop((gutter_x, 0, sheet.width, sheet.height))
    left = trim_ink(left)
    right = trim_ink(right)
    left.save(DBG / "left.png")
    right.save(DBG / "right.png")
    print("left", left.size, "right", right.size)

    # Split left into top strip + 3x3 via white gap
    la = np.asarray(left.convert("L"), dtype=np.float32)
    row_ink = (la < 240).mean(axis=1)
    white = row_ink < 0.02
    gaps = find_gaps(white, min_len=10)
    print("left row gaps", gaps)
    # Prefer a gap after the top strip (~20-40% down)
    split_y = None
    for a, b in gaps:
        mid = (a + b) // 2
        if 0.12 * left.height < mid < 0.45 * left.height:
            split_y = mid
            break
    if split_y is None and gaps:
        split_y = (gaps[0][0] + gaps[0][1]) // 2
    print("split_y", split_y)

    top = trim_ink(left.crop((0, 0, left.width, split_y)))
    grid = trim_ink(left.crop((0, split_y, left.width, left.height)))
    top.save(DBG / "top_trim.png")
    grid.save(DBG / "grid_trim.png")
    print("top", top.size, "grid", grid.size)

    for name, cell in zip(["car", "knee", "bull"], split(top, 1, 3, inset=0.12)):
        save_icon(cell, name)

    # Board cells — neon & bullseye keep dark/colorful backgrounds
    grid_names = [
        ("neon", True),
        ("bumper", False),
        ("minus", False),
        ("roller-coaster", False),
        ("clown", False),
        ("on", False),
        ("horn", False),
        ("red-cape", False),
        ("bullseye-target", False),
    ]
    for (name, keep_bg), cell in zip(grid_names, split(grid, 3, 3, inset=0.1)):
        save_icon(cell, name, keep_bg=keep_bg)

    # Fill column: 2 cols x 3 rows (bottom row empty)
    fill = trim_ink(right)
    fill.save(DBG / "fill_trim.png")
    # Only top 2 rows have icons
    fa = np.asarray(fill.convert("L"), dtype=np.float32)
    row_ink = (fa < 240).mean(axis=1)
    # find where content ends (before empty bottom cells)
    content_rows = np.where(row_ink > 0.02)[0]
    fill_content = fill.crop((0, 0, fill.width, int(content_rows[-1]) + 1))
    fill_content = trim_ink(fill_content)
    fill_content.save(DBG / "fill_content.png")
    print("fill_content", fill_content.size)

    fill_names = [
        ("x-ray", True),
        ("lamp", False),
        ("tusk", False),
        ("fingernail", False),
    ]
    # 2x2 of filled cells
    for (name, keep_bg), cell in zip(fill_names, split(fill_content, 2, 2, inset=0.08)):
        save_icon(cell, name, keep_bg=keep_bg)

    # Also save neon fill option (same as board neon) already done
    print("done ->", OUT)


if __name__ == "__main__":
    polish_existing()
