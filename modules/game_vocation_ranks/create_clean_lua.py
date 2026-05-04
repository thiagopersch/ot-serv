# create_clean_lua.py
# This script creates a clean vocation_ranks.lua file with correct syntax

lua_content = '''-- Vocation Ranks Client Module
local window = nil
local topButton = nil
local confirmWindow = nil
local choiceWindow = nil
local localData = {}
local requestTimer = nil

VOCATION_RANK_OPCODE = 235

local RANK_NAMES = { [0] = "None", [1] = "Bronze", [2] = "Silver", [3] = "Gold", [4] = "Diamond" }
local RANK_COLORS = {
  [0] = "#aaaaaa",
  [1] = "#cd7f32",
  [2] = "#c0c0c0",
  [3] = "#ffd700",
  [4] = "#b9f2ff",
}

function init()
  ProtocolGame.registerExtendedOpcode(VOCATION_RANK_OPCODE, onOpcode)
  topButton = modules.client_topmenu.addRightGameToggleButton(
    "vocationRanksBtn",
    tr("Vocation Ranks"),
    "/images/topbuttons/skills",
    toggleWindow
  )
end

function terminate()
  destroyWindow()
  if topButton then
    topButton:destroy()
    topButton = nil
  end
  ProtocolGame.unregisterExtendedOpcode(VOCATION_RANK_OPCODE)
end

function onOpcode(protocol, opcode, buffer)
  local t = string.split(buffer, "|")
  local action = t[1]

  if action == "1" then
    local bonusCount = tonumber(t[11]) or 0
    local bonuses = {}

    for i = 1, bonusCount do
      local kv = t[11 + i] or ""
      local sep = string.find(kv, ":")
      if sep then
        local key = string.sub(kv, 1, sep - 1)
        local val = tonumber(string.sub(kv, sep + 1)) or 0
        bonuses[key] = val
      end
    end

    local nameIdx = 12 + bonusCount
    local vocIdx = 13 + bonusCount

    localData = {
      vocationId = tonumber(t[2]) or 0,
      rank = tonumber(t[3]) or 0,
      stars = tonumber(t[4]) or 0,
      totalStars = tonumber(t[5]) or 0,
      univFrag = tonumber(t[6]) or 0,
      specFrag = tonumber(t[7]) or 0,
      cost = tonumber(t[8]) or 9999,
      maxRank = tonumber(t[9]) or 0,
      specItemId = tonumber(t[10]) or 0,
      bonuses = bonuses,
      playerName = t[nameIdx] or "Unknown",
      vocationName = t[vocIdx] or "Unknown",
    }

    if window then refreshUI() end;

  elseif action == "2" then
    local creatureId = tonumber(t[2])
    local pRank = tonumber(t[3])
    local pStars = tonumber(t[4])
    local creature = g_map.getCreatureById(creatureId)
    if creature then
      if pRank > 0 then
        local rankName = RANK_NAMES[pRank] or "None"
        local starsStr = string.rep("*", pStars)
        creature:setName(creature:getName() .. " [" .. rankName .. " " .. starsStr .. "]")
      end
    end

  elseif action == "ok" then
    displayInfoBox(tr("Success"), t[2] or "Upgrade successful!")
    sendRequest()
  elseif action == "err" then
    displayErrorBox(tr("Upgrade Failed"), t[2] or "Upgrade failed.")
  end
end

function refreshUI()
  if not window then return end

  local rank = localData.rank or 0
  local stars = localData.stars or 0
  local maxRank = localData.maxRank or 0
  local maxStars = 5

  local vocImage = window:getChildById("vocImage")
  if vocImage then
    local vocLower = (localData.vocationName or "unknown"):lower():gsub(" ", "_")
    local path = "/images/vocations/" .. vocLower .. ".png"
    if g_resources.fileExists(path) then
      vocImage:setImageSource(path)
    else
      vocImage:setImageSource("/images/vocations/not_found.png")
    end
  end

  local nameLabel = window:getChildById("nameLabel")
  if nameLabel then nameLabel:setText(localData.playerName or "") end

  local vocNameLabel = window:getChildById("vocNameLabel")
  if vocNameLabel then vocNameLabel:setText(localData.vocationName or "") end

  for i = 1, 5 do
    local starWidget = window:getChildById("star" .. i)
    if starWidget then
      if i <= stars and rank > 0 then
        local rankName = string.lower(RANK_NAMES[rank] or "bronze")
        local rankImage = "/images/ranks/" .. rankName .. "_star.png"
        if g_resources.fileExists(rankImage) then
          starWidget:setImageSource(rankImage)
        else
          starWidget:setImageSource("/images/ranks/empty_star.png")
        end
      else
        starWidget:setImageSource("/images/ranks/empty_star.png")
      end
      starWidget:setVisible(true)
    end
  end

  local rankLabel = window:getChildById("rankLabel")
  if rankLabel then
    if rank == 0 then
      rankLabel:setText("Rank: None  (0/" .. maxStars .. ")")
    else
      rankLabel:setText("Rank: " .. RANK_NAMES[rank] .. "  " .. stars .. "/" .. maxStars)
    end
    rankLabel:setColor(RANK_COLORS[rank] or "#aaaaaa")
  end

  local nextRankLabel = window:getChildById("nextRankLabel")
  if nextRankLabel then
    if rank < maxRank and rank > 0 then
      local nextRank = rank + 1
      nextRankLabel:setText("Next: " .. RANK_NAMES[nextRank] .. "  0/" .. maxStars)
      nextRankLabel:setColor(RANK_COLORS[nextRank] or "#aaaaaa")
      nextRankLabel:setVisible(true)
    elseif rank == 0 and maxRank > 0 then
      nextRankLabel:setText("Next: Bronze  0/" .. maxStars)
      nextRankLabel:setColor(RANK_COLORS[1] or "#cd7f32")
      nextRankLabel:setVisible(true)
    else
      nextRankLabel:setText("MAX RANK REACHED!")
      nextRankLabel:setColor("#ffd700")
      nextRankLabel:setVisible(true)
    end
  end

  local labelMap = {
    attack = "Attack",
    defense = "Defense",
    health = "HP",
    mana = "Mana",
    magic = "Magic Lvl",
    distance = "Distance",
    shield = "Shielding",
  }

  local bonusTitleLabel = window:getChildById("bonusTitleLabel")
  if bonusTitleLabel then bonusTitleLabel:setText("Bonus Per Star:") end

  local bonusValueLabel = window:getChildById("bonusValueLabel")
  if bonusValueLabel then
    local entries = {}
    for key, val in pairs(localData.bonuses or {}) do
      entries[#entries + 1] = "+" .. val .. " " .. (labelMap[key] or key)
    end
    if #entries == 0 then
      bonusValueLabel:setText("(not configured for this vocation)")
    else
      bonusValueLabel:setText(table.concat(entries, "   "))
    end
  end

  local univFrag = localData.univFrag or 0
  local specFrag = localData.specFrag or 0
  local cost = localData.cost or 9999

  local fragTitleLabel = window:getChildById("fragTitleLabel")
  if fragTitleLabel then fragTitleLabel:setText("Fragments in Bag:") end

  local fragUnivLabel = window:getChildById("fragUnivLabel")
  if fragUnivLabel then
    fragUnivLabel:setText("Universal:  " .. univFrag .. "  (need " .. cost .. ")")
    fragUnivLabel:setColor(univFrag >= cost and "#55ff55" or "#ff5555")
  end

  local fragSpecLabel = window:getChildById("fragSpecLabel")
  if fragSpecLabel then
    fragSpecLabel:setText("Specific:   " .. specFrag .. "  (need " .. cost .. ")")
    fragSpecLabel:setColor(specFrag >= cost and "#55ff55" or "#ff5555")
  end

  local statusLabel = window:getChildById("statusLabel")
  if statusLabel then
    local atMax = (maxRank > 0 and rank >= maxRank and stars >= maxStars)
    if atMax then
      statusLabel:setText("MAX RANK REACHED!")
      statusLabel:setColor("#ffd700")
    elseif univFrag >= cost or specFrag >= cost then
      statusLabel:setText("Ready to Upgrade!")
      statusLabel:setColor("#55ff55")
    else
      statusLabel:setText("Insufficient Fragments!")
      statusLabel:setColor("#ff5555")
    end
  end
end

function sendRequest()
  local protocol = g_game.getProtocolGame()
  if protocol then
    protocol:sendExtendedOpcode(VOCATION_RANK_OPCODE, "request")
  end
end

function onUpgrade()
  if not localData.vocationId or localData.vocationId == 0 then
    sendRequest()
    displayErrorBox(tr("Please Wait"), tr("Loading vocation data, please try again in a moment."))
    return
  end

  local univFrag = localData.univFrag or 0
  local specFrag = localData.specFrag or 0
  local cost = localData.cost or 9999
  local rank = localData.rank or 0
  local maxRank = localData.maxRank or 0
  local stars = localData.stars or 0

  if maxRank > 0 and rank >= maxRank and stars >= 5 then
    displayErrorBox(tr("Max Rank"), tr("You have already reached the maximum rank for your vocation!"))
    return
  end

  local canUniv = univFrag >= cost
  local canSpec = specFrag >= cost

  if not canUniv and not canSpec then
    displayErrorBox(
      tr("Insufficient Fragments"),
      "You need " .. cost .. " fragments to upgrade.\n\n" ..
      "Universal:  " .. univFrag .. "  (missing " .. math.max(0, cost - univFrag) .. ")\n" ..
      "Specific:   " .. specFrag .. "  (missing " .. math.max(0, cost - specFrag) .. ")"
    )
    return
  end

  if choiceWindow then
    choiceWindow:destroy()
    choiceWindow = nil
  end
  if confirmWindow then
    confirmWindow:destroy()
    confirmWindow = nil
  end

  if canUniv and canSpec then
    local vocName = localData.vocationName or "Vocation"
    choiceWindow = displayGeneralBox(
      tr("Choose Fragment Type"),
      "You have enough of both fragment types.\n" ..
      "Which would you like to spend? (need " .. cost .. ")\n\n" ..
      "Universal:  " .. univFrag .. "\n" ..
      "Specific (" .. vocName .. "):  " .. specFrag,
      {
        {
          text = tr("Universal"),
          callback = function()
            if choiceWindow then
              choiceWindow:destroy()
              choiceWindow = nil
            end
            askConfirmUpgrade("universal")
          end
        },
        {
          text = tr("Specific"),
          callback = function()
            if choiceWindow then
              choiceWindow:destroy()
              choiceWindow = nil
            end
            askConfirmUpgrade("specific")
          end
        },
        {
          text = tr("Cancel"),
          callback = function()
            if choiceWindow then
              choiceWindow:destroy()
              choiceWindow = nil
            end
          end
        },
        anchor = AnchorHorizontalCenter
      }
    )
  elseif canUniv then
    askConfirmUpgrade("universal")
  else
    askConfirmUpgrade("specific")
  end
end

function askConfirmUpgrade(source)
  local cost = localData.cost or 9999
  local vocName = localData.vocationName or "Vocation"
  local srcText = (source == "universal") and "Universal" or ("Specific (" .. vocName .. ")")
  local rankName = RANK_NAMES[localData.rank or 0] or "None"
  local stars = localData.stars or 0

  confirmWindow = displayGeneralBox(
    tr("Confirm Upgrade"),
    "Spend " .. cost .. " " .. srcText .. " fragments to gain 1 star?\n\n" ..
    "Current: " .. rankName .. "  " .. stars .. "/5\n" ..
    "This cannot be undone.",
    {
      {
        text = tr("Confirm"),
        callback = function()
          if confirmWindow then
            confirmWindow:destroy()
            confirmWindow = nil
          end
          sendUpgrade(source)
        end
      },
      {
        text = tr("Cancel"),
        callback = function()
          if confirmWindow then
            confirmWindow:destroy()
            confirmWindow = nil
          end
        end
      },
      anchor = AnchorHorizontalCenter
    }
  )
end

function sendUpgrade(source)
  local protocol = g_game.getProtocolGame()
  if protocol then
    protocol:sendExtendedOpcode(VOCATION_RANK_OPCODE, "upgrade|" .. source)
  end
end

function open()
  if not window then toggleWindow() end
end

function toggleWindow()
  if window then
    destroyWindow()
    return
  end

  window = g_ui.loadUI("vocation_ranks", modules.game_interface.getRootPanel())
  if topButton then topButton:setOn(true) end

  scheduleEvent(function()
    sendRequest()
  end, 100)

  scheduleEvent(function()
    if window then
      sendRequest()
    end
  end, 600)
end

function destroyWindow()
  if window then
    window:destroy()
    window = nil
  end
  if confirmWindow then
    confirmWindow:destroy()
    confirmWindow = nil
  end
  if choiceWindow then
    choiceWindow:destroy()
    choiceWindow = nil
  end
  if topButton then topButton:setOn(false) end
end

modules.game_vocation_ranks.onUpgrade = onUpgrade
modules.game_vocation_ranks.destroyWindow = destroyWindow
modules.game_vocation_ranks.open = open
modules.game_vocation_ranks.toggleWindow = toggleWindow
'''

filepath = r'C:\Users\thiag\Projetos\client\modules\game_vocation_ranks\vocation_ranks.lua'
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(lua_content)

print('Clean Lua file created successfully!')
