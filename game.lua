-- game.lua -- workai pico-8 dice roller (multiplayer via pico-socket)
-- this file is the game. game.p8 includes it via #include game.lua.
-- edit here. keep to the pico-8 api (no lua stdlib) -- see agents.md.
--
-- multiplayer: up to 4 clients talk through pico-socket gpio pins.
-- each client pokes only its own block; the server syncs blocks between
-- clients in the same room. solo play in the pico-8 app works the same
-- (gpio is just local memory).
--
-- pin layout, offset from 0x5f80:
--   0 room id, 1 player id (0 = not joined, 1-4)
--   player p (1-4) owns 13 pins at (p-1)*13 + 2:
--     +0 joined, +1 status (0 waiting / 1 rolling / 2 rolled),
--     +2 dice count, +3 total, +4..+12 dice 1-9
--
-- flow: title -> setup (own count) -> join room -> board. on the board
-- each player presses a to (re)roll; the result shows when everyone
-- in the room has rolled. b leaves the room.

local state = "title" -- title | setup | board | spectate
local ndice = 3
local rt = 0
local frames = 0
local mydice = {}
local mytotal = 0

local BASE = 0x5f80
local ROOM_PIN = BASE
local PID_PIN = BASE + 1

function _init()
  poke(ROOM_PIN, 0)
  -- wipe stale pins (state can persist between runs in the app)
  for pin = 2, 53 do
    poke(BASE + pin, 0)
  end
end

-- pico-8 rnd(n) returns a float in [0,n); ceil makes it a 1-6 roll
function d6()
  return ceil(rnd(6))
end

-- pins 0 and 1 are room id / player id, so player blocks start at offset 2
function ppin(p, f)
  return BASE + 2 + (p - 1) * 13 + f
end

function my_id()
  return peek(PID_PIN)
end

function joined(p)
  return peek(ppin(p, 0)) == 1
end

function status_of(p)
  return peek(ppin(p, 1))
end

function count_of(p)
  return peek(ppin(p, 2))
end

function total_of(p)
  return peek(ppin(p, 3))
end

function die_of(p, i)
  return peek(ppin(p, 3 + i))
end

function all_rolled()
  for p = 1, 4 do
    if joined(p) and status_of(p) ~= 2 then
      return false
    end
  end
  return true
end

function join_room()
  for p = 1, 4 do
    if not joined(p) then
      poke(PID_PIN, p)
      poke(ppin(p, 0), 1)
      poke(ppin(p, 1), 0)
      poke(ppin(p, 2), ndice)
      poke(ppin(p, 3), 0)
      for d = 1, 9 do
        poke(ppin(p, 3 + d), 0)
      end
      -- reseed so clients do not roll identical dice (all start srand(1))
      srand((p * 9973 + frames) % 30000)
      state = "board"
      return
    end
  end
  state = "spectate"
end

function leave_room()
  local p = my_id()
  if p > 0 then
    poke(ppin(p, 3), 0)
    for d = 1, 9 do
      poke(ppin(p, 3 + d), 0)
    end
    poke(ppin(p, 1), 0)
    poke(ppin(p, 0), 0)
    poke(PID_PIN, 0)
  end
  state = "title"
end

function start_roll()
  local p = my_id()
  if p == 0 then
    return
  end
  rt = 0
  mytotal = 0
  for i = 1, ndice do
    mydice[i] = d6()
    mytotal = mytotal + mydice[i]
  end
  poke(ppin(p, 1), 1) -- rolling
  poke(ppin(p, 3), 0)
  for d = 1, 9 do
    poke(ppin(p, 3 + d), 0)
  end
end

function finish_roll()
  local p = my_id()
  if p == 0 then
    return
  end
  for i = 1, ndice do
    poke(ppin(p, 3 + i), mydice[i])
  end
  poke(ppin(p, 3), mytotal)
  poke(ppin(p, 1), 2) -- rolled
end

function _update()
  frames = frames + 1
  if frames >= 30000 then
    frames = 0
  end

  if state == "title" then
    if btnp(4) then
      state = "setup"
    end

  elseif state == "setup" then
    if btnp(0) or btnp(5) then
      ndice = ndice - 1
    end
    if btnp(1) then
      ndice = ndice + 1
    end
    if ndice < 3 then
      ndice = 3
    end
    if ndice > 9 then
      ndice = 9
    end
    if btnp(4) then
      join_room()
    elseif btnp(5) then
      state = "title"
    end

  elseif state == "board" then
    if status_of(my_id()) == 1 then
      rt = rt + 1
      if rt >= 20 + ndice * 3 then
        finish_roll()
      end
    end
    if btnp(4) then
      start_roll()
    elseif btnp(5) then
      leave_room()
    end

  elseif state == "spectate" then
    if btnp(5) then
      state = "title"
    end
  end
end

-- 8x8 die at (x, y)
function draw_die8(x, y, v)
  rect(x, y, x + 7, y + 7, 5)
  rect(x + 1, y + 1, x + 6, y + 6, 7)
  local function pip(cx, cy)
    rect(x + cx, y + cy, x + cx, y + cy, 0)
  end
  if v == 1 then
    pip(4, 4)
  elseif v == 2 then
    pip(2, 2)
    pip(5, 5)
  elseif v == 3 then
    pip(2, 2)
    pip(4, 4)
    pip(5, 5)
  elseif v == 4 then
    pip(2, 2)
    pip(5, 2)
    pip(2, 5)
    pip(5, 5)
  elseif v == 5 then
    pip(2, 2)
    pip(5, 2)
    pip(4, 4)
    pip(2, 5)
    pip(5, 5)
  else
    pip(2, 2)
    pip(5, 2)
    pip(2, 4)
    pip(5, 4)
    pip(2, 6)
    pip(5, 6)
  end
end

-- default font is 3px per char; integer math because this build has no
-- floor() or txt_metric()
function center(s, y, c)
  local w = #s * 3
  print(s, 64 - (w - w % 2) / 2, y, c)
end

function draw_board()
  local p = my_id()
  local winner = 0
  if all_rolled() then
    for i = 1, 4 do
      if joined(i) and total_of(i) > total_of(winner) then
        winner = i
      end
    end
  end

  local y = 20
  for i = 1, 4 do
    if joined(i) then
      local st = status_of(i)
      local cnt = count_of(i)
      local lbl = "p" .. i
      local lcolor = 7
      if i == p then
        lbl = lbl .. "*"
      end
      if i == winner then
        lcolor = 10
      end
      print(lbl, 2, y + 2, lcolor)
      if st == 2 then
        for d = 1, cnt do
          draw_die8(14 + (d - 1) * 10, y, die_of(i, d))
        end
        print(tostr(total_of(i)), 14 + cnt * 10 + 2, y + 2, lcolor)
      elseif st == 1 then
        for d = 1, cnt do
          draw_die8(14 + (d - 1) * 10, y, d6())
        end
      else
        if i == p then
          print("press a to roll", 14, y + 2, 6)
        else
          print("waiting", 14, y + 2, 6)
        end
      end
      y = y + 16
    end
  end

  if state == "spectate" then
    center("room full - spectating", 100, 6)
    center("b : back", 112, 5)
  elseif all_rolled() then
    if winner == p then
      center("you win!", 96, 10)
    else
      center("p" .. winner .. " wins!", 96, 10)
    end
    center("a : roll again   b : leave", 112, 5)
  else
    center("a : roll   b : leave", 112, 5)
  end
end

function _draw()
  cls(1)
  center("workai dice", 4, 8)

  if state == "title" then
    center("press a to start", 60, 7)

  elseif state == "setup" then
    center("dice: " .. ndice, 36, 7)
    center("left / right : count", 60, 6)
    center("a : join room   b : back", 70, 6)

  elseif state == "board" or state == "spectate" then
    draw_board()
  end
end
