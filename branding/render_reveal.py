import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

OLD_LOGO = "/Users/smiley/Claude/Projects/School/studystacks/branding/old-logo.jpeg"
NEW_LOGO = "/Users/smiley/Claude/Projects/School/studystacks/public/logo-full.png"
OUT_DIR = "/Users/smiley/Claude/Projects/School/studystacks/branding/frames"

W = H = 1080
FPS = 30

SHATTER_FRAMES = 55       # ~1.83s
FLASH_FRAMES = 26         # ~0.87s
REVEAL_FRAMES = 60        # ~2.0s
TOTAL_FRAMES = SHATTER_FRAMES + FLASH_FRAMES + REVEAL_FRAMES

OLD_BG = (250, 240, 225)
WHITE_BG = (255, 255, 255)

N_SECTORS = 14
RINGS_PER_SECTOR = 3
BG_MATCH_THRESHOLD = 14  # color distance to treat a pixel as background

random.seed(7)


# ---------- easing ----------

def ease_in_cubic(t):
    t = max(0.0, min(1.0, t))
    return t * t * t


def ease_out_cubic(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def ease_out_back(t, overshoot=1.7):
    t = max(0.0, min(1.0, t))
    t -= 1
    return 1 + (overshoot + 1) * (t ** 3) + overshoot * (t ** 2)


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_color(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


def load_fit(path, box):
    img = Image.open(path).convert("RGBA")
    ratio = min(box[0] / img.width, box[1] / img.height)
    new_size = (max(1, int(img.width * ratio)), max(1, int(img.height * ratio)))
    return img.resize(new_size, Image.LANCZOS)


# ---------- foreground extraction ----------

def make_foreground(img, bg_color, threshold=BG_MATCH_THRESHOLD):
    """Return an RGBA image where near-bg_color pixels become transparent,
    isolating the actual artwork (books + wordmark) from its flat backdrop."""
    img = img.convert("RGB")
    out = Image.new("RGBA", img.size)
    px_in = img.load()
    px_out = out.load()
    bw, bh = img.size
    for y in range(bh):
        for x in range(bw):
            r, g, b = px_in[x, y]
            dist = math.sqrt((r - bg_color[0]) ** 2 + (g - bg_color[1]) ** 2 + (b - bg_color[2]) ** 2)
            if dist <= threshold:
                px_out[x, y] = (r, g, b, 0)
            else:
                px_out[x, y] = (r, g, b, 255)
    return out


# ---------- radial "glass crack" shard generation ----------

def build_shards(fg_img):
    """Partition fg_img into irregular radial/ring wedges (a glass-shatter
    pattern), keep only wedges that actually contain visible artwork."""
    w, h = fg_img.size
    cx, cy = w / 2, h / 2
    r_max = math.hypot(max(cx, w - cx), max(cy, h - cy)) + 4

    base_angles = sorted(
        (2 * math.pi * i / N_SECTORS) + random.uniform(-0.18, 0.18)
        for i in range(N_SECTORS)
    )

    crack_lines = []  # for the initial flash-crack overlay
    shards = []

    alpha = fg_img.split()[-1]

    for i in range(N_SECTORS):
        a0 = base_angles[i]
        a1 = base_angles[(i + 1) % N_SECTORS]
        if a1 <= a0:
            a1 += 2 * math.pi

        crack_lines.append((cx, cy, cx + r_max * math.cos(a0), cy + r_max * math.sin(a0)))

        ring_fracs = sorted(random.uniform(0.18, 0.9) for _ in range(RINGS_PER_SECTOR))
        rings = [0.0] + ring_fracs + [1.0]

        for j in range(len(rings) - 1):
            r0 = rings[j] * r_max
            r1 = rings[j + 1] * r_max

            arc_steps = 5
            poly = []
            for k in range(arc_steps + 1):
                a = a0 + (a1 - a0) * k / arc_steps
                jitter = random.uniform(-3, 3) if 0 < r0 else 0
                poly.append((cx + (r0 + jitter) * math.cos(a), cy + (r0 + jitter) * math.sin(a)))
            for k in range(arc_steps, -1, -1):
                a = a0 + (a1 - a0) * k / arc_steps
                jitter = random.uniform(-3, 3)
                poly.append((cx + (r1 + jitter) * math.cos(a), cy + (r1 + jitter) * math.sin(a)))

            xs = [p[0] for p in poly]
            ys = [p[1] for p in poly]
            bx0, by0 = max(0, int(min(xs))), max(0, int(min(ys)))
            bx1, by1 = min(w, int(max(xs)) + 1), min(h, int(max(ys)) + 1)
            if bx1 <= bx0 or by1 <= by0:
                continue

            mask = Image.new("L", (bx1 - bx0, by1 - by0), 0)
            mdraw = ImageDraw.Draw(mask)
            local_poly = [(px - bx0, py - by0) for px, py in poly]
            mdraw.polygon(local_poly, fill=255)

            region_alpha = alpha.crop((bx0, by0, bx1, by1))
            # intersect shard-polygon mask with artwork alpha
            final_mask = Image.new("L", mask.size, 0)
            fm = final_mask.load()
            mm = mask.load()
            am = region_alpha.load()
            visible = 0
            for yy in range(mask.size[1]):
                for xx in range(mask.size[0]):
                    v = 255 if (mm[xx, yy] > 10 and am[xx, yy] > 10) else 0
                    fm[xx, yy] = v
                    if v:
                        visible += 1

            if visible < 25:
                continue  # empty/near-empty shard, nothing to fly

            tile_rgba = fg_img.crop((bx0, by0, bx1, by1)).copy()
            r, g, b, _ = tile_rgba.split()
            tile_rgba = Image.merge("RGBA", (r, g, b, final_mask))

            tile_cx = (bx0 + bx1) / 2
            tile_cy = (by0 + by1) / 2
            dx, dy = tile_cx - cx, tile_cy - cy
            dist = math.hypot(dx, dy) or 1.0
            dir_x, dir_y = dx / dist, dy / dist

            shards.append({
                "tile": tile_rgba,
                "origin": (bx0, by0),
                "dir": (dir_x, dir_y),
                "dist_norm": min(1.0, dist / r_max),
                "rot_speed": random.uniform(-200, 200),
                "travel": random.uniform(260, 560),
                "stagger": min(0.4, (dist / r_max) * 0.3),
                "scale_end": random.uniform(0.72, 0.9),
            })

    return shards, crack_lines


# ---------- frame renderers ----------

def render_shatter_frame(shards, crack_lines, canvas_origin, t, frame_idx):
    canvas = Image.new("RGBA", (W, H), OLD_BG + (255,))
    ox, oy = canvas_origin

    if frame_idx < 6:
        crack_alpha = int(220 * (1 - frame_idx / 6))
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        cdraw = ImageDraw.Draw(overlay)
        for (x0, y0, x1, y1) in crack_lines:
            cdraw.line((ox + x0, oy + y0, ox + x1, oy + y1), fill=(255, 255, 255, crack_alpha), width=2)
        canvas.alpha_composite(overlay)

    for shard in shards:
        local_t = (t - shard["stagger"]) / max(1e-6, (1.0 - shard["stagger"]))
        local_t = max(0.0, min(1.0, local_t))
        eased = ease_in_cubic(local_t)

        travel = eased * shard["travel"]
        dir_x, dir_y = shard["dir"]
        gravity = 0.5 * (eased ** 2) * 90
        offset_x = dir_x * travel
        offset_y = dir_y * travel + gravity

        alpha_mult = 1.0 if local_t <= 0 else max(0.0, 1.0 - max(0.0, (local_t - 0.45) / 0.55))
        scale = 1.0 - (1.0 - shard["scale_end"]) * eased

        tile = shard["tile"]
        tw, th = tile.size
        if scale != 1.0:
            new_size = (max(1, int(tw * scale)), max(1, int(th * scale)))
            tile_t = tile.resize(new_size, Image.LANCZOS)
        else:
            tile_t = tile

        rot_angle = eased * shard["rot_speed"]
        if abs(rot_angle) > 0.5:
            tile_t = tile_t.rotate(rot_angle, resample=Image.BICUBIC, expand=True)

        if alpha_mult < 0.999:
            r, g, b, a = tile_t.split()
            a = a.point(lambda p, m=alpha_mult: int(p * m))
            tile_t = Image.merge("RGBA", (r, g, b, a))

        px = ox + shard["origin"][0] + offset_x - (tile_t.width - tw) / 2
        py = oy + shard["origin"][1] + offset_y - (tile_t.height - th) / 2

        canvas.alpha_composite(tile_t, (int(px), int(py)))

    return canvas


def render_flash_frame(t):
    bg = lerp_color(OLD_BG, WHITE_BG, ease_out_cubic(t))
    canvas = Image.new("RGB", (W, H), bg)

    glow_strength = math.sin(min(1.0, t * 1.15) * math.pi)
    if glow_strength > 0.01:
        glow_layer = Image.new("L", (W, H), 0)
        gdraw = ImageDraw.Draw(glow_layer)
        max_r = int(W * 0.7)
        radius = int(max_r * (0.25 + 0.85 * t))
        cx, cy = W // 2, H // 2
        gdraw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=int(255 * glow_strength))
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=70))
        white_layer = Image.new("RGB", (W, H), (255, 255, 255))
        canvas = Image.composite(white_layer, canvas, glow_layer)

    return canvas.convert("RGBA")


def render_reveal_frame(new_img, t):
    canvas = Image.new("RGBA", (W, H), WHITE_BG + (255,))

    fade_t = ease_out_cubic(min(1.0, t / 0.6))
    scale_t = ease_out_back(t)
    scale = max(0.0, lerp(0.7, 1.0, scale_t))
    drift_y = lerp(18, 0, ease_out_cubic(min(1.0, t / 0.7)))

    nw, nh = new_img.size
    new_size = (max(1, int(nw * scale)), max(1, int(nh * scale)))
    scaled = new_img.resize(new_size, Image.LANCZOS)

    if fade_t < 0.999:
        r, g, b, a = scaled.split()
        a = a.point(lambda p, m=fade_t: int(p * m))
        scaled = Image.merge("RGBA", (r, g, b, a))

    shadow_alpha = int(45 * fade_t)
    if shadow_alpha > 1:
        sh_w = int(scaled.width * 0.8)
        sh_h = max(10, int(scaled.height * 0.12))
        shadow = Image.new("RGBA", (sh_w, sh_h), (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(shadow)
        sdraw.ellipse((0, 0, sh_w, sh_h), fill=(20, 20, 20, shadow_alpha))
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=14))
        sx = (W - sh_w) // 2
        sy = (H + scaled.height) // 2 - sh_h // 3 + int(drift_y)
        canvas.alpha_composite(shadow, (sx, sy))

    px = (W - scaled.width) // 2
    py = (H - scaled.height) // 2 + int(drift_y)
    canvas.alpha_composite(scaled, (px, py))

    return canvas


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    raw_old = load_fit(OLD_LOGO, (int(W * 0.62), int(H * 0.62)))
    fg = make_foreground(raw_old, OLD_BG)
    shards, crack_lines = build_shards(fg)
    print(f"built {len(shards)} visible shards")

    canvas_origin = ((W - fg.width) // 2, (H - fg.height) // 2)

    new_img = load_fit(NEW_LOGO, (int(W * 0.6), int(H * 0.6)))

    for i in range(TOTAL_FRAMES):
        if i < SHATTER_FRAMES:
            t = i / (SHATTER_FRAMES - 1)
            frame = render_shatter_frame(shards, crack_lines, canvas_origin, t, i)
        elif i < SHATTER_FRAMES + FLASH_FRAMES:
            t = (i - SHATTER_FRAMES) / (FLASH_FRAMES - 1)
            frame = render_flash_frame(t)
        else:
            t = (i - SHATTER_FRAMES - FLASH_FRAMES) / (REVEAL_FRAMES - 1)
            frame = render_reveal_frame(new_img, t)

        frame.convert("RGB").save(os.path.join(OUT_DIR, f"frame_{i:04d}.png"))

        if i % 20 == 0:
            print(f"rendered frame {i}/{TOTAL_FRAMES}")

    print(f"done: {TOTAL_FRAMES} frames written to {OUT_DIR}")


if __name__ == "__main__":
    main()
