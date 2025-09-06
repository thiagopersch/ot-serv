local outfitNames = nil
local questlogWindow = nil
local questlogButton = nil
local taskDescription = nil
local currentQuestId = nil

function init()
  questlogWindow = g_ui.displayUI('questlog')
  if not questlogWindow then
  else
  end
  questlogWindow:hide()
  questlogButton = modules.client_topmenu.addRightGameToggleButton('questlogButton', tr('Quests'), 'icon', onoff)
  if not questlogButton then
  else
  end
  questlogButton:setWidth(32)
  questlogButton:setOn(false)
  taskDescription = questlogWindow:getChildById('missionDescription1')
  connect(g_game, {
    onGameStart = loadQuestLog,
    onGameEnd = hideWindow
  })
  ProtocolGame.registerExtendedOpcode(135, onReceiveQuestData)
end

function terminate()
  disconnect(g_game, {
    onGameStart = loadQuestLog,
    onGameEnd = hideWindow
  })
  ProtocolGame.unregisterExtendedOpcode(135)
  questlogButton:setOn(false)
  questlogWindow:destroy()
end

function hideWindow()
  questlogWindow:hide()
  questlogButton:setOn(false)
  local markButton = questlogWindow:recursiveGetChildById("markButton")
  if markButton then
    markButton:setVisible(false)
  end
end

local quests = {}

function loadQuestList()
  local choiceList = questlogWindow:recursiveGetChildById('moduleList')
  if not choiceList then
    return
  end
  choiceList:destroyChildren()
  questlogWindow:recursiveGetChildById("nomedobixo"):setVisible(false)
  questlogWindow:recursiveGetChildById("fotodobixo"):setVisible(false)
  questlogWindow:recursiveGetChildById("xpdobixo1"):setVisible(false)
  questlogWindow:recursiveGetChildById("descricau"):setVisible(false)
  questlogWindow:recursiveGetChildById("missionListScrollBar1"):setVisible(false)
  taskDescription:setVisible(false)
  local markButton = questlogWindow:recursiveGetChildById("markButton")
  if markButton then
    markButton:setVisible(false)
  end
end

function showQuestDetails(questId)
  local quest = quests[questId]
  if not quest then
    return
  end
  currentQuestId = questId
  questlogWindow:recursiveGetChildById("nomedobixo"):setVisible(true)
  questlogWindow:recursiveGetChildById("fotodobixo"):setVisible(true)
  questlogWindow:recursiveGetChildById("xpdobixo1"):setVisible(true)
  questlogWindow:recursiveGetChildById("descricau"):setVisible(true)
  questlogWindow:recursiveGetChildById("missionListScrollBar1"):setVisible(true)
  taskDescription:setVisible(true)
  questlogWindow:recursiveGetChildById("nomedobixo"):setText(quest.name)
  -- Verifica se a imagem existe, senão usa padrao.png
  local imagePath = "/modules/game_questlog/imgs/" .. quest.name .. ".png"
  local defaultImagePath = "/modules/game_questlog/imgs/padrao.png"
  local imageWidget = questlogWindow:recursiveGetChildById("fotodobixo")
  if g_resources.fileExists(imagePath) then
    imageWidget:setImageSource(imagePath)
  else
    imageWidget:setImageSource(defaultImagePath)
  end
  imageWidget:setTooltip(tr(quest.name))
  imageWidget:setWidth(120)
  imageWidget:setHeight(120)
  taskDescription:setText(quest.description or "Sem descrição disponível")
  local markButton = questlogWindow:recursiveGetChildById("markButton")
  if markButton then
    markButton:setVisible(true)
  end
end

function markQuest()
  if currentQuestId then
    local quest = quests[currentQuestId]
    if quest then
      g_game.talk("!marcar " .. quest.name)
    else
    end
  end
end

function onReceiveQuestData(protocol, opcode, buffer)
  if opcode == 135 then
    loadQuestList()
    quests = {}
    local choiceList = questlogWindow:recursiveGetChildById('moduleList')
    if not choiceList then
      return
    end
    local data = buffer:split(",")
    if data[1] == "#questlog#" then
      for i = 2, #data - 1, 4 do -- Ajustado para 4 (id, name, description, completa)
        local questId = tonumber(data[i])
        local questName = data[i + 1]
        local questDescription = data[i + 2] or "Sem descrição disponível"
        local completa = tonumber(data[i + 3]) or 0
        if questId and questName then
          quests[questId] = { name = questName, description = questDescription }
          local label = g_ui.createWidget('ModuleListLabel', choiceList)
          local number = string.format("#%03d", questId)
          label:setText(number .. " - " .. questName)
          if completa == 1 then
            label:setColor("#00FF00") -- Verde se completa = 1
          end
          label.onDoubleClick = function() showQuestDetails(questId) end
        else
        end
      end
    else
    end
  end
end

function onoff()
  if questlogWindow:isVisible() then
    hideWindow()
  else
    questlogButton:setOn(true)
    questlogWindow:show()
    g_game.talk("!sendquestlog")
  end
end

function loadQuestLog()
  if questlogWindow:isVisible() then
    g_game.talk("!sendquestlog")
  end
end

function destroy()
  questlogWindow:destroy()
end