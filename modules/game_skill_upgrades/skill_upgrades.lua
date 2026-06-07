OPCODE_SKILLS = 240

skillUpgradesWindow = nil
skillUpgradesButton = nil
skillsList = nil
detailPanel = nil

local availablePoints = 0
local spentPoints = 0
local currentSkills = {}
local currentValues = {}
local selectedSkill = nil
SKILL_INFO = {}
SKILL_GROUPS = {}

local function getUpgradeCost(level)
  return math.floor(level / 5) + 1
end

function init()
  connect(g_game, {
    onGameStart = online,
    onGameEnd = offline
  })

  ProtocolGame.registerExtendedOpcode(OPCODE_SKILLS, onExtendedOpcode)

  skillUpgradesWindow = g_ui.displayUI('skill_upgrades')
  skillUpgradesWindow:hide()

  skillsList = skillUpgradesWindow:getChildById('skillsList')
  detailPanel = skillUpgradesWindow:getChildById('detailPanel')

  skillUpgradesButton = modules.client_topmenu.addRightGameToggleButton('skillUpgradesButton', tr('Skill Upgrades'),
    '/images/topbuttons/skill_upgrades', toggle)

  if g_game.isOnline() then
    online()
  end
end

function terminate()
  disconnect(g_game, {
    onGameStart = online,
    onGameEnd = offline
  })

  ProtocolGame.unregisterExtendedOpcode(OPCODE_SKILLS, onExtendedOpcode)

  skillUpgradesWindow:destroy()
  skillUpgradesButton:destroy()
end

function online()
  if g_game.getFeature(GameExtendedOpcode) then
    local protocolGame = g_game.getProtocolGame()
    if protocolGame then
      protocolGame:sendExtendedOpcode(OPCODE_SKILLS, "request")
    end
  end
end

function offline()
  skillUpgradesWindow:hide()
  skillUpgradesButton:setOn(false)
end

function toggle()
  if skillUpgradesWindow:isVisible() then
    skillUpgradesWindow:hide()
    skillUpgradesButton:setOn(false)
  else
    skillUpgradesWindow:show()
    skillUpgradesWindow:raise()
    skillUpgradesWindow:focus()
    skillUpgradesButton:setOn(true)
  end
end

function onExtendedOpcode(protocol, code, buffer)
  if code ~= OPCODE_SKILLS then return end

  if buffer:sub(1, 5) == "@meta" then
    parseMeta(buffer)
    return
  end

  if buffer:sub(1, 7) == "@groups" then
    parseGroups(buffer)
    return
  end

  local data = string.explode(buffer, "|")
  if #data < 2 then return end

  availablePoints = tonumber(data[1]) or 0
  spentPoints = tonumber(data[2]) or 0
  currentSkills = {}
  currentValues = {}

  for i = 3, #data do
    local parts = string.explode(data[i], ":")
    if #parts >= 2 then
      currentSkills[parts[1]] = tonumber(parts[2]) or 0
      currentValues[parts[1]] = tonumber(parts[3]) or 0
    end
  end

  updateUI()
end

function parseMeta(buffer)
  local parts = string.explode(buffer, "|")
  SKILL_INFO = {}
  for i = 2, #parts do
    local fields = string.explode(parts[i], ";")
    if #fields >= 5 then
      local key = fields[1]
      SKILL_INFO[key] = {
        name = fields[2],
        desc = fields[3],
        max = tonumber(fields[4]) or 100,
        formula = fields[5],
        group = fields[6] or "",
        groupOrder = tonumber(fields[7]) or 0
      }
    end
  end
  updateUI()
end

function parseGroups(buffer)
  local parts = string.explode(buffer, "|")
  SKILL_GROUPS = {}
  for i = 2, #parts do
    local fields = string.explode(parts[i], ";")
    if #fields >= 3 then
      SKILL_GROUPS[fields[1]] = {
        name = fields[2],
        order = tonumber(fields[3]) or 0
      }
    end
  end
  updateUI()
end

function updateUI()
  skillUpgradesWindow:getChildById('pointsLabel'):setText('Available Points: ' .. availablePoints)
  skillUpgradesWindow:getChildById('spentLabel'):setText('Spent Points: ' .. spentPoints)

  skillsList:destroyChildren()

  local resetBtn = detailPanel:getChildById('resetButton')
  if resetBtn then
    resetBtn:setEnabled(spentPoints > 0)
  end

  local sortedSkills = {}
  for key, info in pairs(SKILL_INFO) do
    table.insert(sortedSkills, { key = key, info = info })
  end

  table.sort(sortedSkills, function(a, b)
    local aGroupOrder = a.info.groupOrder or 999
    local bGroupOrder = b.info.groupOrder or 999
    if aGroupOrder ~= bGroupOrder then
      return aGroupOrder < bGroupOrder
    end
    return (a.info.id or 999) < (b.info.id or 999)
  end)

  local lastGroup = nil
  local firstSkillWidget = nil

  for _, entry in ipairs(sortedSkills) do
    local key = entry.key
    local info = entry.info
    local group = info.group or ""

    if group ~= lastGroup then
      lastGroup = group
      local displayName = group
      if group ~= "" and SKILL_GROUPS[group] then
        displayName = SKILL_GROUPS[group].name
      elseif group ~= "" then
        displayName = group:upper()
      end

      if displayName ~= "" then
        local header = g_ui.createWidget('GroupHeader', skillsList)
        header:getChildById('label'):setText(displayName)
      end
    end

    local level = currentSkills[key] or 0
    local value = currentValues[key] or 0

    local widget = g_ui.createWidget('SkillRow', skillsList)
    if not firstSkillWidget then firstSkillWidget = widget end
    widget.key = key
    widget:getChildById('name'):setText(info.name)

    if level > 0 then
      local displayValue = string.format(info.formula, value)
      widget:getChildById('value'):setText(displayValue)
      widget:getChildById('value'):setVisible(true)
    else
      widget:getChildById('value'):setVisible(false)
    end

    widget:getChildById('level'):setText('Lvl ' .. level .. '/' .. info.max)

    if level == info.max then
      widget:getChildById('level'):setColor('#55ff55')
    end

    widget.onClick = function()
      selectSkill(widget)
    end

    if selectedSkill == key then
      widget:focus()
      selectSkill(widget)
    end
  end

  if not selectedSkill and firstSkillWidget then
    selectSkill(firstSkillWidget)
  end
end

function selectSkill(widget)
  if not widget then return end
  local key = widget.key
  selectedSkill = key

  local info = SKILL_INFO[key]
  if not info then return end
  local level = currentSkills[key] or 0

  detailPanel:getChildById('skillTitle'):setText(info.name)

  detailPanel:getChildById('skillDesc'):setText(info.desc)

  local statsStr = "Rank: " .. level .. " / " .. info.max
  if level > 0 then
    local currentVal = currentValues[key] or 0
    statsStr = statsStr .. "\nCurrent Bonus: " .. string.format(info.formula, currentVal)
    if level < info.max then
      local nextCost = getUpgradeCost(level)
      statsStr = statsStr .. "\nNext upgrade cost: " .. nextCost .. " Point(s)"
    end
  end
  detailPanel:getChildById('skillStats'):setText(statsStr)

  if level < info.max then
    local cost = getUpgradeCost(level)
    detailPanel:getChildById('upgradeCost'):setText("Upgrade Cost: " .. cost .. " Point(s)")
    if availablePoints >= cost then
      detailPanel:getChildById('upgradeCost'):setColor('#55ff55')
      detailPanel:getChildById('upgradeButton'):setEnabled(true)
    else
      detailPanel:getChildById('upgradeCost'):setColor('#ff5555')
      detailPanel:getChildById('upgradeButton'):setEnabled(false)
    end
  else
    detailPanel:getChildById('upgradeCost'):setText("Skill MAXED!")
    detailPanel:getChildById('upgradeCost'):setColor('#55ff55')
    detailPanel:getChildById('upgradeButton'):setEnabled(false)
  end
end

function doUpgrade()
  if not selectedSkill then return end
  local msg = "upgrade|" .. selectedSkill
  if g_game.getFeature(GameExtendedOpcode) then
    local protocolGame = g_game.getProtocolGame()
    if protocolGame then
      protocolGame:sendExtendedOpcode(OPCODE_SKILLS, msg)
    end
  end
end

function doReset()
  confirmWindow = displayGeneralBox(tr('Reset Skills'),
    tr("Are you sure you want to reset all your skills?\nThis will refund your points but requires 1 Reset Item."), {
      {
        text = tr('Yes'),
        callback = function()
          local msg = "reset|"
          if g_game.getFeature(GameExtendedOpcode) then
            local protocolGame = g_game.getProtocolGame()
            if protocolGame then
              protocolGame:sendExtendedOpcode(OPCODE_SKILLS, msg)
            end
          end
          if confirmWindow then
            confirmWindow:destroy()
            confirmWindow = nil
          end
        end
      },
      {
        text = tr('No'),
        callback = function()
          if confirmWindow then
            confirmWindow:destroy()
            confirmWindow = nil
          end
        end
      } })
end
