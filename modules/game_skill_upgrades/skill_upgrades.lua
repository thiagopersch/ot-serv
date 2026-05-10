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
    '/images/topbuttons/skills', toggle)

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
        formula = fields[5]
      }
    end
  end
  updateUI()
end

function updateUI()
  skillUpgradesWindow:getChildById('pointsLabel'):setText('Available Points: ' .. availablePoints)
  skillUpgradesWindow:getChildById('spentLabel'):setText('Spent Points: ' .. spentPoints)

  skillsList:destroyChildren()

  local sortedKeys = {}
  for key, _ in pairs(SKILL_INFO) do
    table.insert(sortedKeys, key)
  end
  table.sort(sortedKeys, function(a, b) return SKILL_INFO[a].name < SKILL_INFO[b].name end)

  for _, key in ipairs(sortedKeys) do
    local info = SKILL_INFO[key]
    local level = currentSkills[key] or 0
    local value = currentValues[key] or 0

    local widget = g_ui.createWidget('SkillRow', skillsList)
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

  if not selectedSkill and #sortedKeys > 0 then
    selectSkill(skillsList:getFirstChild())
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
