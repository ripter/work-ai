-- game.lua -- mammoth hunt (pico-8 presentation slice)
-- the player's camp and three bot camps hunt a shared mammoth by rolling
-- dice.  when it falls it drops rewards; claim them for food / tools.
--
-- controls:
--   a   start / roll dice / claim selected reward
--   < > move the reward cursor
--   b   reset the hunt (new mammoth)
--   c   toggle debug readout
--
-- pico-8 api only (no lua stdlib) -- see agents.md for the quirks of this
-- build (no floor/fade/cam, rnd returns a float, sin takes 0..1).

-- map tiles
local T_SKY, T_GROUND, T_HILL, T_ROCK, T_STAR = 0, 1, 2, 3, 4
-- sprite slots
local M0, M1, M2, M3 = 5, 6, 7, 8
local SP_CAVE, SP_BOT = 9, 10
local SP_MEAT, SP_TUSK, SP_HIDE = 11, 12, 13
local SP_FIRE0, SP_FIRE1, SP_TENT = 14, 15, 16
local SP_BONE, SP_FOOD, SP_TOOL = 17, 19, 20

local MHP = 24
local NDICE = 4

local state = "title"       -- title | hunt
local frames = 0
local debug = false

-- mammoth
local mhp = MHP
local mstate = "alive"       -- alive | dying | dead
local mflash = 0
local mx, my = 56, 56        -- mammoth top-left (16x16); feet land on the ground line

-- player
local food = 0
local tools = 0
local dice = {}
local total = 0
local rolling = false
local rt = 0

-- rewards: 3 slots, each {kind, claimed}
local R_MEAT, R_TUSK, R_HIDE = 1, 2, 3
local rewards = {}
local cursor = 0

-- camps: player first, then 3 bots
local camps = {
  { kind = "you",  x = 8,   y = 100, t = 0, flash = 0 },
  { kind = "bot",  x = 112, y = 100, t = 40, flash = 0 },
  { kind = "bot",  x = 2,   y = 84, t = 90, flash = 0 },
  { kind = "bot",  x = 110, y = 84, t = 140, flash = 0 },
}

function d6()
  return ceil(rnd(6))
end

function new_mammoth()
  mhp = MHP
  mstate = "alive"
  mflash = 0
end

function roll_for(c)
  -- returns the total a camp deals this turn
  local n = (c.kind == "you") and NDICE or 3
  local s = 0
  for i = 1, n do
    s = s + d6()
  end
  return s
end

function start_roll()
  if rolling or mstate ~= "alive" then
    return
  end
  rolling = true
  rt = 0
  total = 0
  for i = 1, NDICE do
    dice[i] = d6()
  end
  sfx(16)
end

function settle_roll()
  rolling = false
  total = 0
  for i = 1, NDICE do
    total = total + dice[i]
  end
  hit_mammoth(total)
  sfx(17)
end

function hit_mammoth(dmg)
  if mstate ~= "alive" then
    return
  end
  mhp = mhp - dmg
  mflash = 6
  if mhp <= 0 then
    mhp = 0
    mstate = "dying"
    rt = 0
    sfx(18)
  end
end

function drop_rewards()
  rewards = {}
  for i = 1, 3 do
    rewards[i] = { kind = ceil(rnd(3)), claimed = false }
  end
  cursor = 0
end

function claim(i)
  local r = rewards[i]
  if not r or r.claimed then
    sfx(21)
    return
  end
  r.claimed = true
  if r.kind == R_MEAT then
    food = food + 4
  elseif r.kind == R_TUSK then
    tools = tools + 3
  else
    food = food + 2
    tools = tools + 2
  end
  sfx(19)
  -- all claimed?  a new mammoth comes
  local left = false
  for k = 1, 3 do
    if not rewards[k].claimed then
      left = true
    end
  end
  if not left then
    new_mammoth()
    drop_none()
  end
end

function drop_none()
  rewards = {}
end

function reset_hunt()
  new_mammoth()
  drop_none()
  rolling = false
  sfx(20)
end

function _update()
  frames = frames + 1
  if frames >= 30000 then
    frames = 0
  end

  if state == "title" then
    if btnp(4) then
      state = "hunt"
      new_mammoth()
      music(0)
    end
    return
  end

  -- hunt
  if mflash > 0 then
    mflash = mflash - 1
  end

  if mstate == "dying" then
    rt = rt + 1
    if rt >= 24 then
      mstate = "dead"
      drop_rewards()
      sfx(18)
    end
  end

  -- player roll animation
  if rolling then
    rt = rt + 1
    if rt % 3 == 0 then
      for i = 1, NDICE do
        dice[i] = d6()
      end
    end
    if rt >= 28 then
      settle_roll()
    end
  end

  -- bots roll on a timer while the mammoth lives
  if mstate == "alive" then
    for i = 2, 4 do
      local c = camps[i]
      c.t = c.t - 1
      if c.t <= 0 then
        local dmg = roll_for(c)
        hit_mammoth(dmg)
        c.flash = 8
        c.t = 70 + ceil(rnd(60))
      end
    end
  end
  for i = 1, 4 do
    if camps[i].flash > 0 then
      camps[i].flash = camps[i].flash - 1
    end
  end

  if btnp(0) then
    cursor = cursor - 1
    if cursor < 0 then
      cursor = 2
    end
  end
  if btnp(1) then
    cursor = cursor + 1
    if cursor > 2 then
      cursor = 0
    end
  end
  if btnp(4) then
    if #rewards > 0 then
      claim(cursor + 1)
    else
      start_roll()
    end
  end
  if btnp(5) then
    reset_hunt()
  end
  if btnp(6) then
    debug = not debug
  end
end

-- 8x8 die at (x, y) with value v
function draw_die(x, y, v)
  rect(x, y, x + 7, y + 7, 5)
  rect(x + 1, y + 1, x + 6, y + 6, 7)
  local function pip(cx, cy)
    rect(x + cx, y + cy, x + cx, y + cy, 0)
  end
  if v == 1 then
    pip(4, 4)
  elseif v == 2 then
    pip(2, 2); pip(5, 5)
  elseif v == 3 then
    pip(2, 2); pip(4, 4); pip(5, 5)
  elseif v == 4 then
    pip(2, 2); pip(5, 2); pip(2, 5); pip(5, 5)
  elseif v == 5 then
    pip(2, 2); pip(5, 2); pip(4, 4); pip(2, 5); pip(5, 5)
  else
    pip(2, 2); pip(5, 2); pip(2, 4); pip(5, 4); pip(2, 6); pip(5, 6)
  end
end

function draw_mammoth()
  local fl = (mflash > 0 and mflash % 2 == 0)
  if mstate == "dead" then
    -- fallen: bones on the ground
    spr(SP_BONE, mx + 2, my + 12)
    spr(SP_BONE, mx + 8, my + 14)
    return
  end
  if fl then
    pal(5, 7); pal(6, 7)
  end
  spr(M0, mx, my)
  spr(M1, mx + 8, my)
  spr(M2, mx, my + 8)
  spr(M3, mx + 8, my + 8)
  if fl then
    pal()
  end
  -- hp bar above
  local bw = 24
  local bx = mx + (16 - bw) / 2
  local by = my - 8
  rect(bx, by, bx + bw, by + 3, 0)
  rect(bx + 1, by + 1, bx + bw - 1, by + 2, 8)
  local w = (bw - 2) * mhp / MHP
  rect(bx + 1, by + 1, bx + w, by + 2, 11)
end

function draw_camp(c)
  local spr_id = (c.kind == "you") and SP_CAVE or SP_BOT
  if c.kind == "you" then
    spr(SP_TENT, c.x - 8, c.y - 8)
    local f = (frames % 8 < 4) and SP_FIRE0 or SP_FIRE1
    spr(f, c.x + 8, c.y)
  else
    local f = (frames % 8 < 4) and SP_FIRE0 or SP_FIRE1
    spr(f, c.x + 8, c.y)
  end
  spr(spr_id, c.x, c.y)
  if c.flash > 0 then
    -- a little damage puff over a bot that just rolled
    print("!", c.x + 2, c.y - 6, 10)
  end
end

function draw_rewards()
  if #rewards == 0 then
    return
  end
  local base_x = 40
  for i = 1, 3 do
    local r = rewards[i]
    local x = base_x + (i - 1) * 20
    local y = 108
    if r.claimed then
      print("claimed", x - 4, y + 10, 5)
    else
      local id = (r.kind == R_MEAT) and SP_MEAT
        or (r.kind == R_TUSK) and SP_TUSK or SP_HIDE
      spr(id, x, y)
      if i - 1 == cursor then
        -- cursor
        local t = (frames % 12 < 6) and 10 or 7
        print("^", x + 3, y - 6, t)
        rect(x - 1, y - 1, x + 8, y + 8, 0)
      end
    end
  end
end

function draw_dice_row()
  if rolling or (state == "hunt" and mstate == "alive" and total > 0 and not rolling) then
    local x = 40
    local y = 90
    for i = 1, NDICE do
      local v = dice[i] or 1
      draw_die(x + (i - 1) * 10, y, v)
    end
    if not rolling and total > 0 then
      print("+" .. tostr(total), x + NDICE * 10, y + 2, 10)
    end
  end
end

function draw_hud()
  rect(0, 0, 127, 11, 0)
  print("mammoth hunt", 2, 2, 7)
  -- score
  spr(SP_FOOD, 96, 2)
  print(tostr(food), 105, 3, 15)
  spr(SP_TOOL, 96, 8)
  print(tostr(tools), 105, 9, 6)
  -- status line
  if mstate == "alive" then
    local s = "a : roll   < > : pick   b : reset"
    print(s, 2, 9, 6)
  elseif mstate == "dead" then
    if #rewards > 0 then
      local any = false
      for i = 1, 3 do
        if not rewards[i].claimed then
          any = true
        end
      end
      if any then
        print("a : claim   < > : pick", 2, 9, 10)
      else
        print("a new mammoth approaches...", 2, 9, 6)
      end
    end
  else
    print("the mammoth falls...", 2, 9, 8)
  end
end

function draw_debug()
  if not debug then
    return
  end
  local s = "hp " .. tostr(mhp) .. "/" .. tostr(MHP) .. " st " .. mstate
  print(s, 2, 60, 10)
  s = "food " .. tostr(food) .. " tools " .. tostr(tools)
  print(s, 2, 64, 10)
  s = "cur " .. tostr(cursor) .. " dice " .. tostr(total)
  print(s, 2, 68, 10)
end

function _draw()
  cls(0)
  map(0, 0)

  if state == "title" then
    draw_mammoth()
    for i = 1, 4 do
      draw_camp(camps[i])
    end
    -- top title bar
    rect(0, 0, 127, 13, 0)
    local t = "mammoth hunt"
    print(t, (128 - (#t * 3 - #t % 2)) / 2, 2, 7)
    -- bottom prompt (blinks)
    if frames % 30 < 18 then
      local p = "press a to start"
      print(p, (128 - (#p * 3 - #p % 2)) / 2, 118, 10)
    end
    return
  end

  draw_mammoth()
  for i = 1, 4 do
    draw_camp(camps[i])
  end
  draw_rewards()
  draw_dice_row()
  draw_hud()
  draw_debug()
end
