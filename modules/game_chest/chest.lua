-- Chest selection window: portal (/admin/chests) configures up to 3 chests (name, key item,
-- up to 3 randomized rewards). Server contract (data/creaturescripts/scripts/chest.lua):
--   -> {action='list'}                    <- {action='list', chests=[{id,name,keyItemId,hasKey}]}
--   -> {action='open', chestId=N}         <- {action='result', success, message, chestId, itemId, count, name}
local OPCODE = 252

local window = nil
local rewardPopup = nil
local topButton = nil
local chests = {}     -- last list received from the server
local centerIndex = 1 -- index (in `chests`) currently shown in the center slot

function init()
  connect(g_game, { onGameEnd = offline })
  ProtocolGame.registerExtendedOpcode(OPCODE, onOpcode)
  topButton = modules.client_topmenu.addRightGameToggleButton('chestButton', tr('Chests'),
    '/images/topbuttons/chest', toggle)
end

function terminate()
  disconnect(g_game, { onGameEnd = offline })
  ProtocolGame.unregisterExtendedOpcode(OPCODE)
  destroyWindow()
  closeRewardPopup()
  if topButton then topButton:destroy() end
end

function offline()
  chests = {}
  destroyWindow()
  closeRewardPopup()
end

function destroyWindow()
  if window then
    window:destroy()
    window = nil
  end
end

function toggle()
  if window then
    destroyWindow()
    return
  end
  window = g_ui.displayUI('chest')
  requestList()
end

function requestList()
  local pg = g_game.getProtocolGame()
  if not pg then return end
  pg:sendExtendedOpcode(OPCODE, json.encode({ action = 'list' }))
end

function openCenterChest()
  local chest = chests[centerIndex]
  if not chest then return end

  local pg = g_game.getProtocolGame()
  if not pg then return end
  pg:sendExtendedOpcode(OPCODE, json.encode({ action = 'open', chestId = chest.id }))
end

function onOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then return end
  if not buffer or buffer == '' then return end

  local ok, data = pcall(json.decode, buffer)
  if not ok or type(data) ~= 'table' then return end

  if data.action == 'list' then
    chests = data.chests or {}
    if centerIndex > #chests then centerIndex = 1 end
    updateWindow()
  elseif data.action == 'result' then
    if data.success then
      showRewardPopup(data.itemId, data.count, data.name)
    elseif window then
      window:getChildById('hintLabel'):setText(data.message or tr('Could not open the chest.'))
    end
    -- Key item counts may have changed (consumed) — refresh the "hasKey" flags.
    requestList()
  end
end

-- Renders `chests[index]` into the given slot panel (id: chestIcon / nameLabel children).
local function renderSlot(slot, chest)
  local icon = slot:getChildById('chestIcon')
  local nameLabel = slot:getChildById('nameLabel')

  if not chest then
    slot:setVisible(false)
    return
  end

  slot:setVisible(true)
  nameLabel:setText(chest.name or '')
  icon:getChildById('keyIcon'):setItemId(chest.keyItemId or 0)
end

function updateWindow()
  if not window then return end

  local leftSlot = window:getChildById('slotLeft')
  local centerSlot = window:getChildById('slotCenter')
  local rightSlot = window:getChildById('slotRight')

  local centerChest = chests[centerIndex]
  local sideChests = {}
  for i, chest in ipairs(chests) do
    if i ~= centerIndex then table.insert(sideChests, chest) end
  end

  renderSlot(centerSlot, centerChest)
  renderSlot(leftSlot, sideChests[1])
  renderSlot(rightSlot, sideChests[2])

  -- Side slots swap into the center on click; the center slot has no click behavior of its own.
  local function makeSelectHandler(chest)
    if not chest then return nil end
    return function()
      for i, c in ipairs(chests) do
        if c.id == chest.id then
          centerIndex = i
          break
        end
      end
      updateWindow()
    end
  end

  leftSlot:getChildById('chestIcon').onClick = makeSelectHandler(sideChests[1])
  rightSlot:getChildById('chestIcon').onClick = makeSelectHandler(sideChests[2])

  local openButton = window:getChildById('openButton')
  local hintLabel = window:getChildById('hintLabel')
  if not centerChest then
    openButton:setEnabled(false)
    hintLabel:setText(tr('No chests available.'))
  elseif not centerChest.hasKey then
    openButton:setEnabled(false)
    hintLabel:setText(tr('You need the key item for this chest.'))
  else
    openButton:setEnabled(true)
    hintLabel:setText('')
  end
end

function closeRewardPopup()
  if rewardPopup then
    rewardPopup:destroy()
    rewardPopup = nil
  end
end

function showRewardPopup(itemId, count, name)
  closeRewardPopup()
  rewardPopup = g_ui.displayUI('chest_reward')
  rewardPopup:getChildById('rewardLabel'):setText(string.format(tr('You received\n%dx %s'), count or 1, name or ''))
  rewardPopup:getChildById('rewardIcon'):setItemId(itemId or 0)

  scheduleEvent(closeRewardPopup, 6000)
end
