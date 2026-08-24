-- game.lua -- workai pico-8 dice roller
-- this file is the game. game.p8 includes it via #include game.lua.
-- edit here. keep to the pico-8 api (no lua stdlib) -- see agents.md.

local state = "title"
local ndice = 3
local dice = {}
local total = 0
local rt = 0

function _init()
  srand(1)
end

-- pico-8 rnd(n) returns a float in [0,n); ceil makes it a 1-6 roll
function d6()
  return ceil(rnd(6))
end

function roll_values()
  total = 0
  for i = 1, ndice do
    dice[i] = d6()
    total = total + dice[i]
  end
end

-- during the roll anim, unsettled dice show a random face each frame
function die_value(i)
  if state == "roll" and rt < 20 + i * 3 then
    return d6()
  end
  return dice[i]
end

function _update()
  if state == "title" then
    if btnp(4) then
      state = "setup"
    end

  elseif state == "setup" then
    if btnp(0) or btnp(5) then ndice = ndice - 1 end
    if btnp(1) then ndice = ndice + 1 end
    if ndice < 3 then ndice = 3 end
    if ndice > 9 then ndice = 9 end
    if btnp(4) then
      roll_values()
      rt = 0
      state = "roll"
    end

  elseif state == "roll" then
    rt = rt + 1
    if rt >= 20 + ndice * 3 then
      state = "result"
    end

  elseif state == "result" then
    if btnp(4) then
      roll_values()
      rt = 0
      state = "roll"
    elseif btnp(5) then
      state = "setup"
    end
  end
end

function pip(cx, cy)
  rect(cx - 1, cy - 1, cx + 1, cy + 1, 0)
end

function draw_die(x, y, v)
  rect(x - 1, y - 1, x + 16, y + 16, 5)
  rect(x, y, x + 15, y + 15, 7)
  if v == 1 then
    pip(x + 8, y + 8)
  elseif v == 2 then
    pip(x + 4, y + 4)
    pip(x + 12, y + 12)
  elseif v == 3 then
    pip(x + 4, y + 4)
    pip(x + 8, y + 8)
    pip(x + 12, y + 12)
  elseif v == 4 then
    pip(x + 4, y + 4)
    pip(x + 12, y + 4)
    pip(x + 4, y + 12)
    pip(x + 12, y + 12)
  elseif v == 5 then
    pip(x + 4, y + 4)
    pip(x + 12, y + 4)
    pip(x + 8, y + 8)
    pip(x + 4, y + 12)
    pip(x + 12, y + 12)
  else
    pip(x + 4, y + 4)
    pip(x + 4, y + 8)
    pip(x + 4, y + 12)
    pip(x + 12, y + 4)
    pip(x + 12, y + 8)
    pip(x + 12, y + 12)
  end
end

-- draw the dice in centered rows of 3, returns y just below the grid
function draw_dices()
  local y = 16
  local i = 1
  while i <= ndice do
    local inrow = ndice - i + 1
    if inrow > 3 then inrow = 3 end
    local x = 64 - (inrow * 16 + (inrow - 1) * 4) / 2
    for j = 0, inrow - 1 do
      draw_die(x + j * 20, y, die_value(i))
      i = i + 1
    end
    y = y + 22
  end
  return y - 22 + 17
end

-- default font is 3px per char; integer math because this build has no
-- floor() or txt_metric()
function center(s, y, c)
  local w = #s * 3
  print(s, 64 - (w - w % 2) / 2, y, c)
end

function _draw()
  cls(1)
  center("workai dice", 6, 8)

  if state == "title" then
    center("press a to start", 60, 7)

  elseif state == "setup" then
    center("dice: " .. ndice, 36, 7)
    center("left / right : count", 60, 6)
    center("a : roll", 70, 6)

  elseif state == "roll" or state == "result" then
    local bottom = draw_dices()
    if state == "roll" then
      center("rolling...", bottom + 10, 6)
    else
      center("total " .. total, bottom + 10, 10)
      center("a : roll again   b : count", 118, 5)
    end
  end
end
