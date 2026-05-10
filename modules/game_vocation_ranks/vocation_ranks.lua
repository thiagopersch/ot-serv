-- Vocation Ranks Client Module
local window = nil
local topButton = nil
local choiceWindow = nil
local cachedRankData = nil

VOCATION_RANK_OPCODE = 235

local RANK_NAMES = { [0] = "None", [1] = "Bronze", [2] = "Silver", [3] = "Gold", [4] = "Diamond" }
local RANK_COLORS = { [0] = "#aaaaaa", [1] = "#cd7f32", [2] = "#c0c0c0", [3] = "#ffd700", [4] = "#b9f2ff" }
local RANK_STAR_IMAGES = {
  [1] = "bronze_star.png",
  [2] = "silver_star.png",
  [3] = "gold_star.png",
  [4] = "diamond_star.png"
}

function init()
  connect(g_game, {
    onGameStart = onGameStart,
    onGameEnd = onGameEnd
  })
  ProtocolGame.registerExtendedOpcode(VOCATION_RANK_OPCODE, onOpcode)
  topButton = modules.client_topmenu.addRightGameToggleButton("vocationRanksBtn", tr("Vocation Ranks"),
    "/images/topbuttons/skills", toggleWindow)
end

function terminate()
  disconnect(g_game, {
    onGameStart = onGameStart,
    onGameEnd = onGameEnd
  })
  ProtocolGame.unregisterExtendedOpcode(VOCATION_RANK_OPCODE)
  destroyWindow()
  if topButton then topButton:destroy() end
end

function onGameStart()
  -- Request fresh data on start with a small delay to ensure player is ready
  scheduleEvent(sendRequest, 100)
end

function onGameEnd()
  cachedRankData = nil
  if window then
    destroyWindow()
  end
end

function onOpcode(protocol, opcode, buffer)
  if opcode ~= VOCATION_RANK_OPCODE then return end
  local t = string.split(buffer, "|")

  -- Protocol 3: Update overhead stars for any creature
  if t[1] == "3" then
    local cid = tonumber(t[2])
    local rank = tonumber(t[3])
    local stars = tonumber(t[4])
    local creature = g_map.getCreatureById(cid)
    if creature then
      creature:setVocationStars(rank, stars)
    end
    return
  end

  if t[1] ~= "2" then return end

  -- Protocol 2: Update local player full rank data
  cachedRankData = {
    rankLvl    = tonumber(t[2]) or 0,
    stars      = tonumber(t[3]) or 0,
    totalStars = tonumber(t[4]) or 0,
    univCount  = t[5] or "0",
    univNeed   = t[6] or "0",
    specCount  = t[7] or "0",
    specNeed   = t[8] or "0",
    bHp        = t[9] or "0",
    bMana      = t[10] or "0",
    bMelee     = t[11] or "0",
    bShield    = t[12] or "0",
    bMagic     = t[13] or "0",
    vocName    = t[14] or "None"
  }

  if window then
    updateWindowData()
  end

  local function applyToLocal()
    local player = g_game.getLocalPlayer()
    if player then
      player:setVocationStars(cachedRankData.rankLvl, cachedRankData.stars)
    end
  end

  applyToLocal()
  -- Retry after 500ms and 2000ms to ensure it sticks (map loading etc)
  scheduleEvent(applyToLocal, 500)
  scheduleEvent(applyToLocal, 2000)

  updateRankStarInterface(cachedRankData.rankLvl)
end

function updateWindowData()
  if not window or not cachedRankData then return end
  local left = window:getChildById('leftPanel')
  local right = window:getChildById('rightPanel')

  -- Local Player Data
  local player = g_game.getLocalPlayer()
  if player then
    left:getChildById('nameLabel'):setText(player:getName())
  end

  left:getChildById('vocNameLabel'):setText(cachedRankData.vocName)
  local rawVocName = string.gsub(cachedRankData.vocName, "%s*%([^%)]+%)", "")
  local formattedVocName = string.gsub(string.lower(rawVocName), " ", "_")
  local vocationImageSrc = '/images/vocations/' .. formattedVocName .. '.png'
  if not g_resources.fileExists(vocationImageSrc) then
    vocationImageSrc = '/images/vocations/not_found.png'
  end
  left:getChildById('vocImage'):setImageSource(vocationImageSrc)

  -- Update Stars Panel
  local starsPanel = left:getChildById('currentStarsPanel')
  starsPanel:destroyChildren()
  local starImg = RANK_STAR_IMAGES[cachedRankData.rankLvl] or "bronze_star.png"
  for i = 1, 5 do
    local s = g_ui.createWidget('UIWidget', starsPanel)
    s:setImageSource('/images/ranks/' .. starImg)
    s:setImageColor(i <= cachedRankData.stars and '#ffffff' or '#444444')
    s:setMarginLeft(i == 1 and 0 or 4)
    s:setSize({ width = 16, height = 16 })
    s:addAnchor(AnchorLeft, i == 1 and 'parent' or 'prev', i == 1 and AnchorLeft or AnchorRight)
    s:addAnchor(AnchorTop, 'parent', AnchorTop)
  end
  starsPanel:updateLayout()

  -- Right Panel (Texts and Costs)
  right:getChildById('statusLabel'):setText('')
  right:getChildById('rankLabel'):setText('Current Rank: ' .. RANK_NAMES[cachedRankData.rankLvl])
  right:getChildById('rankLabel'):setColor(RANK_COLORS[cachedRankData.rankLvl])

  -- Next Rank Progress
  local nextStars = cachedRankData.stars + 1
  local nextRankName = RANK_NAMES[cachedRankData.rankLvl]
  if nextStars > 5 then
    nextStars = 0
    nextRankName = RANK_NAMES[cachedRankData.rankLvl + 1] or nextRankName
  end

  local progressText = string.format("Next: %s (%d/5 stars)", nextRankName, nextStars)
  if cachedRankData.rankLvl == 4 and cachedRankData.stars == 5 then
    progressText = "Maximum Rank Reached"
  end
  right:getChildById('nextRankLabel'):setText(progressText)

  -- Fragment Counts
  local univNeed = tonumber(cachedRankData.univNeed) or 0
  local specNeed = tonumber(cachedRankData.specNeed) or 0
  local univCount = tonumber(cachedRankData.univCount) or 0
  local specCount = tonumber(cachedRankData.specCount) or 0

  local univColor = univCount >= univNeed and '#00ff00' or '#ff5555'
  local specColor = specCount >= specNeed and '#00ff00' or '#ff5555'

  right:getChildById('fragUnivLabel'):setText(string.format('Universal Fragments: %d / %d', univCount, univNeed))
  right:getChildById('fragUnivLabel'):setColor(univColor)

  right:getChildById('fragSpecLabel'):setText(string.format('Specific Fragments: %d / %d', specCount, specNeed))
  right:getChildById('fragSpecLabel'):setColor(specColor)

  local bonusText = string.format("HP: +%s\nMana: +%s\nAtk: +%s\nDef: +%s\nMag: +%s",
    cachedRankData.bHp, cachedRankData.bMana, cachedRankData.bMelee, cachedRankData.bShield, cachedRankData.bMagic)
  right:getChildById('bonusValueLabel'):setText(bonusText)
end

function toggleWindow()
  if window then
    destroyWindow()
    return
  end
  window = g_ui.loadUI("vocation_ranks", modules.game_interface.getRootPanel())
  if topButton then topButton:setOn(true) end

  if cachedRankData then
    updateWindowData()
  end

  sendRequest()
end

function sendRequest()
  local p = g_game.getProtocolGame()
  if p then
    p:sendExtendedOpcode(VOCATION_RANK_OPCODE, "request")
  end
end

function sendUpgrade(source)
  local p = g_game.getProtocolGame()
  if p then
    p:sendExtendedOpcode(VOCATION_RANK_OPCODE, "upgrade|" .. source)
  end
end

function onUpgrade()
  if not cachedRankData then return end

  local univCount = tonumber(cachedRankData.univCount) or 0
  local univNeed = tonumber(cachedRankData.univNeed) or 0
  local specCount = tonumber(cachedRankData.specCount) or 0
  local specNeed = tonumber(cachedRankData.specNeed) or 0

  if univCount >= univNeed and specCount >= specNeed then
    choiceWindow = displayGeneralBox(tr("Upgrade"), tr("You have both types of fragments. Which one do you want to use?"),
      {
        {
          text = tr("Universal"),
          callback = function()
            sendUpgrade("universal")
            choiceWindow:destroy()
          end
        },
        {
          text = tr("Specific"),
          callback = function()
            sendUpgrade("specific")
            choiceWindow:destroy()
          end
        },
        { text = tr("Cancel"), callback = function() choiceWindow:destroy() end }
      })
  elseif univCount >= univNeed then
    sendUpgrade("universal")
  elseif specCount >= specNeed then
    sendUpgrade("specific")
  else
    displayInfoBox(tr("Error"), tr("You do not have enough fragments to perform the upgrade."))
  end
end

function sendUpgrade(source)
  local p = g_game.getProtocolGame()
  if p then p:sendExtendedOpcode(VOCATION_RANK_OPCODE, "upgrade|" .. source) end
end

function updateRankStarInterface(rankLvl)
  local rootPanel = modules.game_interface.getRootPanel()
  if not rootPanel then return end

  -- Usa recursiveGetChildById para achar a estrela se estiver dentro do painel de Vida/Mana
  local starWidget = rootPanel:recursiveGetChildById('rankStarWidget')
  if not starWidget then return end

  if rankLvl > 0 then
    starWidget:setImageSource('/images/ranks/' .. RANK_STAR_IMAGES[rankLvl])
    starWidget:show()
  else
    starWidget:hide() -- Sem rank, sem estrela na tela
  end
end

function open()
  if not window then toggleWindow() end
end

function destroyWindow()
  if window then
    window:destroy()
    window = nil
  end
  if choiceWindow then
    choiceWindow:destroy()
    choiceWindow = nil
  end
  if topButton then topButton:setOn(false) end
end

-- Exportando as funções para o game_interface reconhecer
modules.game_vocation_ranks.onUpgrade = onUpgrade
modules.game_vocation_ranks.destroyWindow = destroyWindow
modules.game_vocation_ranks.toggleWindow = toggleWindow
modules.game_vocation_ranks.open = open
