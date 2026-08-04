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
      showRewardPopup(data.rewards or {})
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
  icon:getChildById('keyIcon'):setItemId(chest.keyClientId or chest.keyItemId or 0)
end

local lastCenterChestId = nil

local REWARD_SLOT_SIZE = 30
local REWARD_SLOT_SPACING = 4
local REWARD_PREVIEW_MAX_WIDTH = 300

local function renderRewardsPreview(chest)
  local preview = window:getChildById('rewardsPreview')
  if not preview then return end
  preview:destroyChildren()

  local rewards = (chest and chest.rewards) or {}
  for _, reward in ipairs(rewards) do
    local slot = g_ui.createWidget('ChestRewardPreviewSlot', preview)
    slot:setItemId(reward.clientId or reward.itemId or 0)
    slot:setTooltip(string.format('%s (up to %d)', reward.name or '', reward.count or 1))
  end

  -- `horizontalBox` empacota os filhos a partir da borda esquerda do container — com menos
  -- slots do que o necessário pra preencher os 300px declarados no otui, eles ficavam visualmente
  -- à esquerda em vez de centralizados sob "Possible rewards". Encolhe o próprio container pra
  -- largura real do conteúdo; como `anchors.horizontalCenter` recalcula a partir da largura atual,
  -- isso recentraliza o grupo de slots sem precisar de layout customizado.
  local count = #rewards
  local contentWidth = count > 0 and (count * REWARD_SLOT_SIZE + (count - 1) * REWARD_SLOT_SPACING) or REWARD_PREVIEW_MAX_WIDTH
  preview:setWidth(math.min(contentWidth, REWARD_PREVIEW_MAX_WIDTH))
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
  renderRewardsPreview(centerChest)

  -- Transição visual ao trocar o baú central (clique num lateral) — sem isso a troca é
  -- instantânea e passa despercebida.
  local centerChestId = centerChest and centerChest.id or nil
  if centerChestId ~= lastCenterChestId then
    centerSlot:setOpacity(0)
    g_effects.fadeIn(centerSlot, 200)
  end
  lastCenterChestId = centerChestId

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

function showRewardPopup(rewards)
  if not rewards or #rewards == 0 then return end
  closeRewardPopup()
  rewardPopup = g_ui.displayUI('chest_reward')

  local parts = {}
  for _, item in ipairs(rewards) do
    table.insert(parts, string.format('%dx %s', item.count or 1, item.name or 'Unknown'))
  end

  rewardPopup:getChildById('rewardLabel'):setText(
    string.format('Congratulations!\nYou received %s', table.concat(parts, ', ')))
  rewardPopup:getChildById('rewardIcon'):setItemId(rewards[1].clientId or rewards[1].itemId or 0)

  scheduleEvent(closeRewardPopup, 6000)
end
