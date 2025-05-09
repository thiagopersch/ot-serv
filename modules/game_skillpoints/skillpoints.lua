local pointsWindow

function init()
  connect(g_game, {
    onGameStart = online,
    onGameEnd = offline,
    onExtendedOpcode = onExtendedOpcode
  })
  pointsWindow = g_ui.loadUI('skills', modules.game_interface.getRootPanel())
  pointsWindow:hide()
end

function terminate()
  disconnect(g_game, {
    onGameStart = online,
    onGameEnd = offline,
    onExtendedOpcode = onExtendedOpcode
  })
  pointsWindow:destroy()
end

function online()
  -- Pode ser usado para inicializações adicionais no login
end

function offline()
  pointsWindow:hide()
end

function onExtendedOpcode(opcode, buffer)
  if opcode == 50 then
    local data = {}
    for i, v in ipairs(split(buffer, "|")) do
      data[i] = v
    end
    local action = data[1]
    if action == "openSkillsWindow" then
      pointsWindow:show()
      pointsWindow:raise()
      pointsWindow:focus()
      pointsWindow:getChildById('pointsLabel'):setText("Pontos Disponíveis: " .. data[2])
    elseif action == "updatePoints" then
      if pointsWindow then
        pointsWindow:getChildById('pointsLabel'):setText("Pontos Disponíveis: " .. data[2])
      end
    end
  end
end

function addPoint(skill)
  g_game.talkChannel(0, 0, "addPoint|" .. skill)
end

function split(str, sep)
  local result = {}
  local regex = ("([^%s]+)"):format(sep)
  for each in str:gmatch(regex) do
    table.insert(result, each)
  end
  return result
end
