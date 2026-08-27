#!/usr/bin/env python3
# artgen.py - generate the mammoth-hunt art (gfx + map) and splice it into
# game.p8.  the art is hand-authored as palette-index grids in python, no
# external image libs.
#
# usage:
#   python3 tools/artgen.py            # splice art into ../game.p8
#   python3 tools/artgen.py --preview  # write ../preview.p8 (art + a static
#                                     #   _draw that shows the scene, for a
#                                     #   headless canvas screenshot)
#
# formats (verified against the installed pico-8 0.2.7 app):
#   __gfx__:   up to 128 lines x 128 hex chars.  within a byte the LEFT pixel
#              is the LOW nibble, so for pixel pair (p2k, p2k+1) the hex is
#              hex(p2k+1) hex(p2k).  trailing all-zero lines may be trimmed.
#   __map__:   20 tiles per line, 2 hex chars per tile (1 byte), one line per
#              row.  16 rows are visible on a 128x128 screen.
#   __label__: required for the cli to export; 128 lines x 128 chars.
#
# palette:
#  0 black  1 dark blue 2 dark purple 3 dark green 4 brown 5 dark gray
#  6 light gray 7 white 8 red 9 orange 10 yellow 11 green 12 blue 13 indigo
# 14 pink 15 peach

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CART = os.path.normpath(os.path.join(HERE, "..", "game.p8"))

# ------------------------------------------------------------------ drawing
def blank(w=8, h=8):
    return [[0] * w for _ in range(h)]

def px(g, x, y, c):
    if 0 <= x < len(g[0]) and 0 <= y < len(g):
        g[y][x] = c

def hline(g, x0, x1, y, c):
    for x in range(x0, x1 + 1):
        px(g, x, y, c)

def vline(g, x, y0, y1, c):
    for y in range(y0, y1 + 1):
        px(g, x, y, c)

def rect(g, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        hline(g, x0, x1, y, c)

def fill_ellipse(g, cx, cy, rx, ry, c):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if rx and ry and ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry) <= 1:
                px(g, x, y, c)

def mirror(g):
    # horizontal flip in place (for 2-frame walk cycles)
    for y in range(len(g)):
        g[y] = g[y][::-1]

def compose(dst, src, ox, oy):
    # blit src onto dst at offset (ox, oy); 0 = transparent
    for y, row in enumerate(src):
        for x, c in enumerate(row):
            if c:
                px(dst, ox + x, oy + y, c)

# ------------------------------------------------------------------ sprites
# slot layout in the 128x128 sheet (each slot is 8x8; slot n lives at
# sheet (n%16, n//16)).  keep everything in the TOP half of the sheet so it
# does not collide with the map's bottom half.
T_SKY   = 0
T_GROUND= 1
T_HILL  = 2
T_ROCK  = 3
T_STAR  = 4
M0, M1, M2, M3 = 5, 6, 7, 8      # mammoth 16x16 (4 slots)
SP_CAVE = 9
SP_BOT  = 10
SP_MEAT = 11
SP_TUSK = 12
SP_HIDE = 13
SP_FIRE0= 14
SP_FIRE1= 15
SP_TENT = 16
SP_BONE = 17
SP_STONE= 18
SP_FOOD = 19
SP_TOOL = 20
SP_DIE  = 21
SP_EYE  = 22

def make_sky():
    g = blank()
    rect(g, 0, 0, 7, 7, 1)              # dark blue
    for x in (2, 5, 7):                  # faint cloud flecks
        px(g, x, 3, 2)
    px(g, 6, 5, 2)
    return g

def make_star():
    g = make_sky()
    px(g, 3, 2, 7)
    px(g, 4, 2, 6)
    px(g, 3, 3, 6)
    return g

def make_ground():
    g = blank()
    rect(g, 0, 0, 7, 7, 4)              # brown
    for x in range(8):                   # darker mottling
        if (x * 3 + 1) % 4 == 0:
            px(g, x, 5, 5)
        if (x * 5 + 2) % 4 == 0:
            px(g, x, 2, 3)
    hline(g, 0, 7, 0, 3)                 # grassy top edge
    for x in (1, 4, 6):
        px(g, x, 1, 3)
    return g

def make_hill():
    g = blank()
    rect(g, 0, 0, 7, 7, 2)              # dark purple ridge
    fill_ellipse(g, 3, 7, 4, 5, 2)
    fill_ellipse(g, 6, 7, 3, 4, 5)
    hline(g, 0, 7, 7, 5)
    return g

def make_rock():
    g = blank()
    rect(g, 0, 0, 7, 7, 5)
    fill_ellipse(g, 3, 4, 3, 3, 6)
    rect(g, 4, 5, 6, 6, 5)
    return g

def make_mammoth():
    # 16x16, facing left.  body 5 (dark gray), wool 6, tusks 7, legs 4.
    g = blank(16, 16)
    # body
    fill_ellipse(g, 10, 7, 6, 5, 5)
    # woolly back
    fill_ellipse(g, 10, 5, 6, 3, 6)
    hline(g, 4, 15, 3, 6)
    # head (left)
    fill_ellipse(g, 3, 8, 3, 3, 5)
    # trunk
    vline(g, 1, 8, 12, 5)
    vline(g, 2, 9, 13, 5)
    px(g, 2, 13, 6)
    # tusk (white, curving up/forward)
    hline(g, 1, 3, 7, 7)
    px(g, 1, 6, 7)
    px(g, 3, 8, 7)
    # eye
    px(g, 4, 7, 0)
    # legs (4)
    for lx in (5, 8, 11, 14):
        vline(g, lx, 11, 15, 4)
        px(g, lx, 15, 5)
    # tail
    vline(g, 15, 5, 8, 6)
    px(g, 15, 8, 5)
    return g

def make_caveman(tunic=9, skin=15):
    g = blank()
    # head
    rect(g, 2, 0, 5, 2, skin)
    px(g, 3, 1, 0)                       # eye
    px(g, 5, 1, 0)
    # body (tunic)
    rect(g, 2, 3, 5, 5, tunic)
    # arms
    px(g, 1, 4, skin)
    px(g, 6, 4, skin)
    # club in right hand
    vline(g, 7, 2, 5, 4)
    # legs
    px(g, 3, 6, 4)
    px(g, 4, 6, 4)
    px(g, 3, 7, 4)
    px(g, 4, 7, 4)
    return g

def make_meat():
    g = blank()
    fill_ellipse(g, 4, 4, 3, 3, 8)       # red chunk
    fill_ellipse(g, 3, 3, 2, 2, 14)
    # bone end
    px(g, 6, 6, 7)
    px(g, 7, 7, 7)
    px(g, 7, 6, 7)
    px(g, 6, 7, 7)
    return g

def make_tusk():
    g = blank()
    # curved white tusk
    vline(g, 2, 4, 7, 7)
    vline(g, 3, 3, 7, 7)
    hline(g, 3, 5, 2, 7)
    px(g, 5, 1, 7)
    px(g, 4, 1, 6)
    px(g, 3, 2, 6)
    # base
    rect(g, 1, 6, 4, 7, 6)
    return g

def make_hide():
    g = blank()
    # draped animal hide
    fill_ellipse(g, 3, 3, 3, 2, 4)
    fill_ellipse(g, 5, 5, 3, 2, 5)
    hline(g, 1, 6, 6, 5)
    px(g, 2, 2, 6)
    # nail/peg
    px(g, 7, 1, 6)
    return g

def make_fire(frame):
    g = blank()
    # logs
    hline(g, 1, 6, 7, 4)
    hline(g, 2, 5, 6, 4)
    if frame == 0:
        fill_ellipse(g, 3, 4, 2, 3, 9)   # orange
        fill_ellipse(g, 4, 4, 1, 2, 10)  # yellow core
        px(g, 4, 2, 10)
    else:
        fill_ellipse(g, 4, 4, 2, 3, 9)
        fill_ellipse(g, 3, 4, 1, 2, 10)
        px(g, 3, 2, 10)
    return g

def make_tent():
    g = blank()
    # triangular hide tent
    for y in range(2, 8):
        w = 1 + (y - 2)
        hline(g, 4 - w, 4 + w, y, 3)
    # opening
    rect(g, 3, 5, 5, 7, 0)
    rect(g, 3, 5, 5, 5, 11)
    return g

def make_bone():
    g = blank()
    hline(g, 1, 6, 4, 7)
    px(g, 0, 3, 7); px(g, 0, 5, 7)
    px(g, 1, 3, 6); px(g, 1, 5, 6)
    px(g, 6, 3, 7); px(g, 7, 5, 7)
    px(g, 6, 3, 6); px(g, 7, 5, 6)
    return g

def make_stone():
    g = blank()
    fill_ellipse(g, 3, 4, 3, 3, 5)
    fill_ellipse(g, 2, 3, 2, 2, 6)
    return g

def make_food():
    g = blank()
    # small meat icon
    fill_ellipse(g, 3, 4, 2, 2, 8)
    px(g, 2, 3, 14)
    px(g, 5, 5, 7); px(g, 6, 6, 7)
    return g

def make_tool():
    g = blank()
    # stone tool / pick
    vline(g, 2, 2, 6, 4)                 # handle
    hline(g, 2, 6, 1, 6)                 # head
    px(g, 1, 2, 6); px(g, 7, 2, 6)
    return g

def make_die():
    g = blank()
    rect(g, 0, 0, 7, 7, 5)
    rect(g, 1, 1, 6, 6, 7)
    for (x, y) in ((2, 2), (5, 5), (3, 3)):
        px(g, x, y, 0)
    return g

def make_eye():
    g = blank()
    fill_ellipse(g, 3, 3, 3, 2, 7)
    fill_ellipse(g, 3, 3, 1, 1, 0)
    return g

# ------------------------------------------------------------------ sheet
def build_sheet():
    sheet = [[0] * 128 for _ in range(128)]
    def put(slot, img):
        ox, oy = (slot % 16) * 8, (slot // 16) * 8
        for y in range(len(img)):
            for x in range(len(img[0])):
                c = img[y][x]
                if c:
                    sheet[oy + y][ox + x] = c
    put(T_SKY, make_sky())
    put(T_GROUND, make_ground())
    put(T_HILL, make_hill())
    put(T_ROCK, make_rock())
    put(T_STAR, make_star())
    # mammoth 16x16 across slots M0..M3
    mam = make_mammoth()
    put(M0, [r[0:8] for r in mam[0:8]])
    put(M1, [r[8:16] for r in mam[0:8]])
    put(M2, [r[0:8] for r in mam[8:16]])
    put(M3, [r[8:16] for r in mam[8:16]])
    put(SP_CAVE, make_caveman(9, 15))
    put(SP_BOT, make_caveman(11, 15))
    put(SP_MEAT, make_meat())
    put(SP_TUSK, make_tusk())
    put(SP_HIDE, make_hide())
    put(SP_FIRE0, make_fire(0))
    put(SP_FIRE1, make_fire(1))
    put(SP_TENT, make_tent())
    put(SP_BONE, make_bone())
    put(SP_STONE, make_stone())
    put(SP_FOOD, make_food())
    put(SP_TOOL, make_tool())
    put(SP_DIE, make_die())
    put(SP_EYE, make_eye())
    return sheet

def build_map():
    # 20 wide x 18 tall
    W, H = 20, 18
    m = [[T_SKY] * W for _ in range(H)]
    import random
    rnd = random.Random(7)
    # stars scattered in the sky (rows 0-4)
    for _ in range(14):
        x = rnd.randrange(W)
        y = rnd.randrange(5)
        m[y][x] = T_STAR
    # hill band (rows 6-8)
    for x in range(W):
        for y in range(6, 9):
            m[y][x] = T_HILL
    # a couple of rock outcroppings on the hills
    for (rx, ry) in ((3, 6), (12, 6), (17, 7)):
        m[ry][rx] = T_ROCK
    # ground (rows 9-17)
    for y in range(9, H):
        for x in range(W):
            m[y][x] = T_GROUND
    return m

# ------------------------------------------------------------------ encode
def sheet_to_lines(sheet):
    lines = []
    for y in range(128):
        row = sheet[y]
        s = ""
        for k in range(64):
            s += "%x" % row[2 * k + 1]
            s += "%x" % row[2 * k]
        lines.append(s)
    while lines and set(lines[-1]) == {"0"}:
        lines.pop()
    return lines

def map_to_lines(m):
    return ["".join("%02x" % t for t in row) for row in m]

# ------------------------------------------------------------------ sfx
# each sfx is one line of 168 hex chars (32 steps).  the exact nibble packing
# is not documented in this build; the patterns below were verified to produce
# audible output through a headless web-export + wav capture.  sfx are sparse
# (a couple of steps each) so they read as short blips.
def sfx_line(head):
    assert 0 < len(head) <= 168 and set(head) <= set("0123456789abcdef")
    return head + "0" * (168 - len(head))

# reference blip: two active steps (step 0 and step 4)
BLIP = "8a8886" + "0" * 16 + "c6"
def build_sfx():
    # game.lua triggers sfx 16..21; the rest stay silent.
    slots = {
        16: sfx_line(BLIP),          # roll  (rising blip)
        17: sfx_line("10000"),        # settle (low tone)
        18: sfx_line(BLIP),          # mammoth hit / death
        19: sfx_line("10000"),        # claim reward
        20: sfx_line("20000"),        # reset hunt
        21: sfx_line("10000"),        # invalid action
    }
    lines = ["0" * 168 for _ in range(32)]
    for i, ln in slots.items():
        lines[i] = ln
    return lines

LABEL = ["d" * 128] * 128

PREVIEW_LUA = """function _draw()
  cls(0)
  map(0, 0)
  -- mammoth
  spr(5, 44, 40)
  spr(6, 52, 40)
  spr(7, 44, 48)
  spr(8, 52, 48)
  -- player camp (left)
  spr(16, 8, 96)
  spr(14, 24, 104)
  spr(9, 20, 104)
  -- bots (right)
  spr(10, 88, 104)
  spr(10, 104, 104)
  spr(14, 96, 104)
  -- rewards
  spr(11, 44, 112)
  spr(12, 60, 112)
  spr(13, 76, 112)
  print("mammoth hunt preview", 2, 2, 7)
end
"""

KNOWN = {"__lua__", "__gfx__", "__map__", "__sfx__", "__music__", "__label__"}

def _is_section(ln):
    return ln.strip() in KNOWN

def splice(cart_path, gfx_lines, map_lines, sfx_lines):
    with open(cart_path) as f:
        lines = f.read().split("\n")
    # find existing gfx/map/sfx section ranges and remove them (idempotent)
    ranges = {}
    cur = None
    for i, ln in enumerate(lines):
        if _is_section(ln):
            cur = ln.strip()
            ranges[cur] = [i, i]
        elif cur:
            ranges[cur][1] = i
    # delete existing data sections, last-to-first so earlier deletions do
    # not invalidate the remaining (original-index) ranges.
    to_remove = [(ranges[n][0], ranges[n][1])
                 for n in ("__gfx__", "__map__", "__sfx__") if n in ranges]
    for s, e in sorted(to_remove, reverse=True):
        del lines[s:e + 1]
    # locate end of the __lua__ section and insert gfx/map/sfx after it
    lua_idx = next(i for i, ln in enumerate(lines) if ln.strip() == "__lua__")
    j = lua_idx + 1
    while j < len(lines) and not _is_section(lines[j]):
        j += 1
    block = (["__gfx__"] + gfx_lines + ["__map__"] + map_lines
             + ["__sfx__"] + sfx_lines)
    lines[j:j] = block
    result = "\n".join(lines)
    # the cli refuses to export without a __label__ section
    if "__label__" not in result:
        result = result.rstrip("\n") + "\n__label__\n" + "\n".join(LABEL) + "\n"
    with open(cart_path, "w") as f:
        f.write(result)

def main():
    preview = "--preview" in sys.argv
    sheet = build_sheet()
    m = build_map()
    gfx = sheet_to_lines(sheet)
    mp = map_to_lines(m)
    sfx = build_sfx()
    print("gfx lines: %d, map lines: %d, sfx lines: %d" % (len(gfx), len(mp), len(sfx)))
    if preview:
        # build a standalone preview cart
        header = "pico-8 cartridge // http://www.pico-8.com\nversion 43\n__lua__\n" + PREVIEW_LUA
        cart = (header + "__gfx__\n" + "\n".join(gfx) + "\n__map__\n" + "\n".join(mp)
                + "\n__sfx__\n" + "\n".join(sfx) + "\n__label__\n" + "\n".join(LABEL) + "\n")
        path = os.path.normpath(os.path.join(HERE, "..", "preview.p8"))
        with open(path, "w") as f:
            f.write(cart)
        print("wrote", path)
    else:
        splice(CART, gfx, mp, sfx)
        print("spliced art into", CART)

if __name__ == "__main__":
    main()
