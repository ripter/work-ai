-- game.lua -- WorkAI PICO-8 starter
-- This file is the game. game.p8 includes it via #INCLUDE game.lua.
-- Edit here. Keep to the PICO-8 API (no Lua stdlib) -- see AGENTS.md.

local state = "title"
local px, py = 64, 64
local vx, vy = 1, 1
local score = 0

function _init()
  srand(1)
end

function _update()
  if state == "title" then
    if btnp(4) then
      state = "play"
      px, py, vx, vy = 64, 64, 1, 1
      score = 0
    end

  elseif state == "play" then
    if btn(0) then vx = -1 end
    if btn(1) then vx = 1 end
    if btn(2) then vy = -1 end
    if btn(3) then vy = 1 end
    px = px + vx
    py = py + vy
    if px < 0 or px > 127 then vx = -vx end
    if py < 0 or py > 127 then vy = -vy end
    score = score + 1
    if score > 32000 then score = 0 end
    if btnp(7) then state = "gameover" end

  elseif state == "gameover" then
    if btnp(4) then state = "title" end
  end
end

function _draw()
  cls(1)

  if state == "title" then
    print("WORKAI", 52, 48, 7)
    print("A PICO-8 DEMO", 38, 58, 6)
    print("PRESS A TO START", 32, 72, 11)

  elseif state == "play" then
    rect(0, 0, 127, 0, 8)
    rect(0, 127, 127, 127, 8)
    rect(px, py, px + 7, py + 7, 11)
    print("SCORE " .. score, 4, 4, 6)
    print("MENU TO END", 92, 120, 5)

  elseif state == "gameover" then
    print("GAME OVER", 40, 48, 8)
    print("SCORE " .. score, 40, 60, 6)
    print("PRESS A", 48, 74, 11)
  end
end
