local SpelllistProfile = 'Default'

spelllistWindow        = nil
spelllistButton        = nil
spellList              = nil
nameValueLabel         = nil
formulaValueLabel      = nil
vocationValueLabel     = nil
groupValueLabel        = nil
typeValueLabel         = nil
cooldownValueLabel     = nil
levelValueLabel        = nil
manaValueLabel         = nil
premiumValueLabel      = nil
descriptionValueLabel  = nil

groupBoxAny            = nil
groupBoxAttacks        = nil
groupBoxDefenses       = nil
groupBoxHealings       = nil
groupBoxBuffs          = nil
groupBoxSuporte        = nil
groupBoxEspecial       = nil
groupBoxCombos         = nil

groupRadioGroup        = nil


FILTER_GROUP_ANY      = 0
FILTER_GROUP_ATTACKS  = 1
FILTER_GROUP_DEFENSES = 2
FILTER_GROUP_HEALINGS = 3
FILTER_GROUP_BUFFS    = 4
FILTER_GROUP_SUPORTE  = 5
FILTER_GROUP_ESPECIAL = 6
FILTER_GROUP_COMBOS   = 7

-- Filter Settings
local filters         = {
  level   = false,
  groupId = FILTER_GROUP_ANY
}



function copySpellWords(spellId)
  local info = SpellInfo[SpelllistProfile][spellId]
  if info and info.words then
    g_window.setClipboardText(info.words)
    modules.game_textmessage.displayGameMessage('Spell -> ' .. info.words .. ' <- copiada!')
  end
end

function loadSpellsFromXML()
  local xmlPath = "c:\\Users\\thiag\\Projetos\\server-tibia\\data\\spells\\spells.xml"
  local file = io.open(xmlPath, "r")
  if not file then
    perror("game_spelllist: Could not open spells.xml at " .. xmlPath)
    return
  end
  local content = file:read("*a")
  file:close()

  -- Remove comments safely
  content = string.gsub(content, "<!%-%-.-%-%->", "")

  local newSpellInfo = {}
  local newSpellOrder = {}

  local i = 1
  while true do
    local s, e = string.find(content, "<instant", i)
    if not s then break end

    local attrEnd = string.find(content, ">", e)
    if not attrEnd then break end

    local attributes = string.sub(content, e + 1, attrEnd - 1)
    local isSelfClosing = string.match(attributes, "/%s*$")

    local body = ""
    if isSelfClosing then
      attributes = string.gsub(attributes, "/%s*$", "")
      i = attrEnd + 1
    else
      local bodyEndStart, bodyEndEnd = string.find(content, "</%s*instant%s*>", attrEnd)
      if bodyEndStart then
        body = string.sub(content, attrEnd + 1, bodyEndStart - 1)
        i = bodyEndEnd + 1
      else
        break
      end
    end

    local spellName = string.match(attributes, 'name="(.-)"')
    local spellWords = string.match(attributes, 'words="(.-)"')
    local spellLevel = tonumber(string.match(attributes, 'lvl="(%d+)"')) or
        tonumber(string.match(attributes, 'level="(%d+)"')) or 0
    local spellMana = tonumber(string.match(attributes, 'mana="(%d+)"')) or 0
    local spellPrem = (string.match(attributes, 'prem="(%d+)"') == "1") and true or false
    local spellExhaustion = tonumber(string.match(attributes, 'exhaustion="(%d+)"')) or 2000
    local spellDescription = string.match(attributes, 'description="(.-)"')

    local vocations = {}
    for vocIdStr in string.gmatch(body, '<vocation%s+id="(.-)"') do
      if string.find(vocIdStr, "-") then
        local startVoc, endVoc = string.match(vocIdStr, "(%d+)-(%d+)")
        if startVoc and endVoc then
          for j = tonumber(startVoc), tonumber(endVoc) do
            table.insert(vocations, j)
          end
        end
      else
        local num = tonumber(vocIdStr)
        if num then table.insert(vocations, num) end
      end
    end

    local assignedGroups = {}
    local groupStr = string.match(attributes, 'group="(.-)"')
    local valueStr = string.match(attributes, 'value="(.-)"')
    if groupStr then
      for gl in string.gmatch(groupStr:lower(), "%a+") do
        if gl == "attack" or gl == "attacks" then
          assignedGroups[1] = spellExhaustion
        elseif gl == "defense" or gl == "defenses" then
          assignedGroups[2] = spellExhaustion
        elseif gl == "healing" or gl == "healings" then
          assignedGroups[3] = spellExhaustion
        elseif gl == "buffs" or gl == "buff" then
          assignedGroups[4] = spellExhaustion
        elseif gl == "support" or gl == "suporte" then
          assignedGroups[5] = spellExhaustion
        elseif gl == "especial" or gl == "special" or gl == "specials" then
          assignedGroups[6] = spellExhaustion
        elseif gl == "combo" or gl == "combos" then
          assignedGroups[7] = spellExhaustion
        end
      end
    elseif valueStr then
      local folder = string.match(valueStr, "^(.-)/")
      if folder then
        folder = folder:lower()
        if folder == "support" or folder == "buffs" then
          assignedGroups[4] = spellExhaustion
        elseif folder == "healing" then
          assignedGroups[3] = spellExhaustion
        elseif folder == "monsters" or folder == "cannons" then
          assignedGroups[5] = spellExhaustion
        else
          assignedGroups[1] = spellExhaustion
        end
      end
    end

    if not next(assignedGroups) then
      assignedGroups[1] = spellExhaustion
    end

    if spellName and spellWords then
      local oldInfo = SpellInfo['Default'] and SpellInfo['Default'][spellName]
      local iconStr = oldInfo and oldInfo.icon or 'energystrike'

      newSpellInfo[spellName] = {
        id = oldInfo and oldInfo.id or 0,
        words = spellWords,
        level = spellLevel,
        mana = spellMana,
        prem = spellPrem,
        soul = oldInfo and oldInfo.soul or 0,
        parameter = false,
        exhaustion = spellExhaustion,
        description = spellDescription,
        type = 'Instant',
        icon = iconStr,
        group = assignedGroups,
        vocations = vocations
      }
      table.insert(newSpellOrder, spellName)
    end
  end

  if next(newSpellInfo) then
    SpellInfo['Default'] = newSpellInfo
    SpelllistSettings['Default'].spellOrder = newSpellOrder
  end
end

function getSpelllistProfile()
  return SpelllistProfile
end

function setSpelllistProfile(name)
  if SpelllistProfile == name then return end

  if SpelllistSettings[name] and SpellInfo[name] then
    local oldProfile = SpelllistProfile
    SpelllistProfile = name
    changeSpelllistProfile(oldProfile)
  else
    perror('Spelllist profile \'' .. name .. '\' could not be set.')
  end
end

function online()
  if g_game.getFeature(GameSpellList) then
    spelllistButton:show()
  else
    spelllistButton:hide()
  end
end

function offline()
  resetWindow()
end

local serverVocation = nil

function init()
  connect(g_game, {
    onGameStart = online,
    onGameEnd   = offline
  })

  ProtocolGame.registerExtendedOpcode(123, function(protocol, opcode, buffer)
    if buffer and buffer ~= "" then
      serverVocation = tonumber(buffer)
    end

    loadSpellsFromXML()

    if spellList then
      changeSpelllistProfile(SpelllistProfile)
      updateSpelllist()
    end

    if not spelllistButton:isOn() then
      toggle()
    end
  end)



  local function requestSpelllist()
    if spelllistButton:isOn() then
      toggle()
    else
      g_game.talk("!spells")
    end
  end

  spelllistWindow = g_ui.displayUI('spelllist', modules.game_interface.getRightPanel())
  spelllistWindow:hide()

  spelllistButton = modules.client_topmenu.addRightGameToggleButton('spelllistButton', tr('Spell List'),
    '/images/topbuttons/spelllist', requestSpelllist, false, 4)
  spelllistButton:setOn(false)

  nameValueLabel        = spelllistWindow:getChildById('labelNameValue')
  formulaValueLabel     = spelllistWindow:getChildById('labelFormulaValue')
  vocationValueLabel    = spelllistWindow:getChildById('labelVocationValue')
  groupValueLabel       = spelllistWindow:getChildById('labelGroupValue')
  typeValueLabel        = spelllistWindow:getChildById('labelTypeValue')
  cooldownValueLabel    = spelllistWindow:getChildById('labelCooldownValue')
  levelValueLabel       = spelllistWindow:getChildById('labelLevelValue')
  manaValueLabel        = spelllistWindow:getChildById('labelManaValue')
  premiumValueLabel     = spelllistWindow:getChildById('labelPremiumValue')
  descriptionValueLabel = spelllistWindow:getChildById('labelDescriptionValue')

  groupBoxAny           = spelllistWindow:getChildById('groupBoxAny')
  groupBoxAttacks       = spelllistWindow:getChildById('groupBoxAttacks')
  groupBoxDefenses      = spelllistWindow:getChildById('groupBoxDefenses')
  groupBoxHealings      = spelllistWindow:getChildById('groupBoxHealings')
  groupBoxBuffs         = spelllistWindow:getChildById('groupBoxBuffs')
  groupBoxSuporte       = spelllistWindow:getChildById('groupBoxSuporte')
  groupBoxEspecial      = spelllistWindow:getChildById('groupBoxEspecial')
  groupBoxCombos        = spelllistWindow:getChildById('groupBoxCombos')

  groupRadioGroup       = UIRadioGroup.create()
  groupRadioGroup:addWidget(groupBoxAny)
  groupRadioGroup:addWidget(groupBoxAttacks)
  groupRadioGroup:addWidget(groupBoxDefenses)
  groupRadioGroup:addWidget(groupBoxHealings)
  groupRadioGroup:addWidget(groupBoxBuffs)
  groupRadioGroup:addWidget(groupBoxSuporte)
  groupRadioGroup:addWidget(groupBoxEspecial)
  groupRadioGroup:addWidget(groupBoxCombos)

  groupRadioGroup:selectWidget(groupBoxAny)

  groupRadioGroup.onSelectionChange = toggleFilter

  spellList                         = spelllistWindow:getChildById('spellList')

  g_keyboard.bindKeyPress('Down', function() spellList:focusNextChild(KeyboardFocusReason) end, spelllistWindow)
  g_keyboard.bindKeyPress('Up', function() spellList:focusPreviousChild(KeyboardFocusReason) end, spelllistWindow)

  initializeSpelllist()
  resizeWindow()

  if g_game.isOnline() then
    online()
  end
end

function terminate()
  ProtocolGame.unregisterExtendedOpcode(123)
  disconnect(g_game, {
    onGameStart = online,
    onGameEnd   = offline
  })

  disconnect(spellList, {
    onChildFocusChange = function(self, focusedChild)
      if focusedChild == nil then return end
      updateSpellInformation(focusedChild)
    end
  })

  spelllistWindow:destroy()
  spelllistButton:destroy()

  groupRadioGroup:destroy()
end

function initializeSpelllist()
  for i = 1, #SpelllistSettings[SpelllistProfile].spellOrder do
    local spell = SpelllistSettings[SpelllistProfile].spellOrder[i]
    local info = SpellInfo[SpelllistProfile][spell]

    local tmpLabel = g_ui.createWidget('SpellListLabel', spellList)
    tmpLabel:setId(spell)
    tmpLabel:setText(spell .. '\n\'' .. info.words .. '\'')
    tmpLabel:setPhantom(false)

    local iconId = tonumber(info.icon)
    if not iconId and SpellIcons[info.icon] then
      iconId = SpellIcons[info.icon][1]
    end

    if not (iconId) then
      perror('Spell icon \'' .. info.icon .. '\' not found.')
    end

    tmpLabel:setHeight(SpelllistSettings[SpelllistProfile].iconSize.height + 4)
    tmpLabel:setTextOffset(topoint((SpelllistSettings[SpelllistProfile].iconSize.width + 10) ..
      ' ' .. (SpelllistSettings[SpelllistProfile].iconSize.height - 32) / 2 + 3))
    tmpLabel:setImageSource(SpelllistSettings[SpelllistProfile].iconFile)
    tmpLabel:setImageClip(Spells.getImageClip(iconId, SpelllistProfile))
    tmpLabel:setImageSize(tosize(SpelllistSettings[SpelllistProfile].iconSize.width ..
      ' ' .. SpelllistSettings[SpelllistProfile].iconSize.height))
    tmpLabel.onClick = updateSpellInformation
  end

  connect(spellList, {
    onChildFocusChange = function(self, focusedChild)
      if focusedChild == nil then return end
      updateSpellInformation(focusedChild)
    end
  })
end

function changeSpelllistProfile(oldProfile)
  -- Delete old labels
  for _, child in ipairs(spellList:getChildren()) do
    child:destroy()
  end

  -- Create new spelllist and ajust window
  initializeSpelllist()
  resizeWindow()
  resetWindow()
end

function updateSpelllist()
  for i = 1, #SpelllistSettings[SpelllistProfile].spellOrder do
    local spell = SpelllistSettings[SpelllistProfile].spellOrder[i]
    local info = SpellInfo[SpelllistProfile][spell]
    local tmpLabel = spellList:getChildById(spell)

    local localPlayer = g_game.getLocalPlayer()
    local playerVoc = serverVocation or localPlayer:getVocation()

    local isVocationCorrect = false
    if #info.vocations == 0 then
      isVocationCorrect = true
    elseif table.find(info.vocations, playerVoc) then
      isVocationCorrect = true
    end

    if (not (filters.level) or info.level <= localPlayer:getLevel()) and isVocationCorrect and (filters.groupId == FILTER_GROUP_ANY or info.group[filters.groupId]) then
      tmpLabel:setVisible(true)
    else
      tmpLabel:setVisible(false)
    end
  end
end

function updateSpellInformation(widget)
  local spell       = widget:getId()

  local name        = ''
  local formula     = ''
  local vocation    = ''
  local group       = ''
  local type        = ''
  local cooldown    = ''
  local level       = ''
  local mana        = ''
  local premium     = ''
  local description = ''

  if SpellInfo[SpelllistProfile][spell] then
    local info = SpellInfo[SpelllistProfile][spell]

    name       = spell
    formula    = info.words

    for i = 1, #info.vocations do
      local vocationId = info.vocations[i]
      if vocationId <= 4 or not (table.find(info.vocations, (vocationId - 4))) then
        local vname = (VocationNames and VocationNames[vocationId]) and VocationNames[vocationId] or
            "Voc " .. tostring(vocationId)
        vocation = vocation .. (vocation:len() == 0 and '' or ', ') .. vname
      end
    end

    cooldown = (info.exhaustion / 1000) .. 's'
    local groupNames = { 'Attacks', 'Defenses', 'Healings', 'Buffs', 'Suporte', 'Especial', 'Combos' }
    for groupId, groupName in ipairs(groupNames) do
      if info.group[groupId] then
        group    = group .. (group:len() == 0 and '' or ' / ') .. groupName
        cooldown = cooldown .. ' / ' .. (info.group[groupId] / 1000) .. 's'
      end
    end

    type        = info.type
    level       = info.level
    mana        = info.mana .. ' / ' .. info.soul
    premium     = (info.premium and 'yes' or 'no')
    description = info.description or '-'
  end

  nameValueLabel:setText(name)
  formulaValueLabel:setText(formula)
  vocationValueLabel:setText(vocation)
  groupValueLabel:setText(group)
  typeValueLabel:setText(type)
  cooldownValueLabel:setText(cooldown)
  levelValueLabel:setText(level)
  manaValueLabel:setText(mana)
  premiumValueLabel:setText(premium)
  descriptionValueLabel:setText(description)
end

function toggle()
  if spelllistButton:isOn() then
    spelllistButton:setOn(false)
    spelllistWindow:hide()
  else
    spelllistButton:setOn(true)
    spelllistWindow:show()
    spelllistWindow:raise()
    spelllistWindow:focus()
  end
end

function open()
  if not spelllistButton:isOn() then
    g_game.talk("!spells")
  else
    spelllistWindow:raise()
    spelllistWindow:focus()
  end
end

function toggleFilter(widget, selectedWidget)
  if widget == groupRadioGroup then
    local boxId = selectedWidget:getId()
    if boxId == 'groupBoxAny' then
      filters.groupId = FILTER_GROUP_ANY
    elseif boxId == 'groupBoxAttacks' then
      filters.groupId = FILTER_GROUP_ATTACKS
    elseif boxId == 'groupBoxDefenses' then
      filters.groupId = FILTER_GROUP_DEFENSES
    elseif boxId == 'groupBoxHealings' then
      filters.groupId = FILTER_GROUP_HEALINGS
    elseif boxId == 'groupBoxBuffs' then
      filters.groupId = FILTER_GROUP_BUFFS
    elseif boxId == 'groupBoxSuporte' then
      filters.groupId = FILTER_GROUP_SUPORTE
    elseif boxId == 'groupBoxEspecial' then
      filters.groupId = FILTER_GROUP_ESPECIAL
    elseif boxId == 'groupBoxCombos' then
      filters.groupId = FILTER_GROUP_COMBOS
    end
  else
    local id = widget:getId()
    if id == 'buttonFilterLevel' then
      filters.level = not (filters.level)
      widget:setOn(filters.level)
    end
  end

  updateSpelllist()
end

function resizeWindow()
  spelllistWindow:setWidth(SpelllistSettings['Default'].spellWindowWidth +
    SpelllistSettings[SpelllistProfile].iconSize.width - 32)
  spellList:setWidth(SpelllistSettings['Default'].spellListWidth + SpelllistSettings[SpelllistProfile].iconSize.width -
    32)
end

function resetWindow()
  spelllistWindow:hide()
  spelllistButton:setOn(false)

  -- Resetting filters
  filters.level = false

  local buttonFilterLevel = spelllistWindow:getChildById('buttonFilterLevel')
  if buttonFilterLevel then buttonFilterLevel:setOn(filters.level) end

  groupRadioGroup:selectWidget(groupBoxAny)

  updateSpelllist()
end
