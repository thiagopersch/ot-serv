GameServerOpcodes.AutoLoot = 157
maxSlot = 30

listLoot = nil
itemSelected = nil
edtItemName = nil
lblItemList = nil
mouseGrabberWidget = nil

function init()
  connect(g_game, { onGameEnd = offline })
  ProtocolGame.registerExtendedOpcode(GameServerOpcodes.AutoLoot,
    function(protocol, opcode, buffer) createListLoot(buffer) end)

  btnAutoLoot = modules.client_topmenu.addRightGameToggleButton('lootButton', tr('Auto-Loot'), 'loot', toggle)
  windowAutoLoot = g_ui.displayUI('loot')
  windowAutoLoot:hide()

  itemSelected = windowAutoLoot:getChildById('itemSelected')
  lblItemList = windowAutoLoot:getChildById('lblItemList')
  edtItemName = windowAutoLoot:getChildById('edtItemName')
  listLoot = windowAutoLoot:getChildById('listLoot')
  connect(listLoot, {
    onChildFocusChange =
        function(self, focusedChild)
          if focusedChild == nil then return end
          local itemName = focusedChild:getChildById('rowItemName'):getText()
          if itemName ~= 'Empty Slot' then
            itemSelected:setItemId(focusedChild:getChildById('rowItem'):getItemId())
            edtItemName:setText(itemName)
          end
        end
  })

  mouseGrabberWidget = g_ui.createWidget('UIWidget')
  mouseGrabberWidget:setVisible(false)
  mouseGrabberWidget:setFocusable(false)
  mouseGrabberWidget.onMouseRelease = onChooseItemMouseRelease

  g_keyboard.bindKeyPress('Up', function() listLoot:focusPreviousChild(KeyboardFocusReason) end, windowAutoLoot)
  g_keyboard.bindKeyPress('Down', function() listLoot:focusNextChild(KeyboardFocusReason) end, windowAutoLoot)
end

function terminate()
  disconnect(g_game, { onGameEnd = offline })
  disconnect(listLoot, {
    onChildFocusChange =
        function(self, focusedChild)
          if focusedChild == nil then return end
          local itemName = focusedChild:getChildById('rowItemName'):getText()
          if itemName ~= 'Slot Item Name' then
            itemSelected:setItemId(focusedChild:getChildById('rowItem'):getItemId())
            edtItemName:setText(itemName)
          end
        end
  })
  ProtocolGame.unregisterExtendedOpcode(GameServerOpcodes.AutoLoot)
  windowAutoLoot:destroy()
  btnAutoLoot:destroy()
  listLoot:destroy()
  edtItemName:destroy()
  lblItemList:destroy()
  mouseGrabberWidget:destroy()
end

function offline()
  listLoot:destroyChildren()
  windowAutoLoot:hide()
  eraseLoot()
  listLoot:focusChild(nil)
end

function toggle()
  if windowAutoLoot:isVisible() then
    windowAutoLoot:hide()
  else
    onOpenAutoLoot()
  end
end

function onOpenAutoLoot()
  windowAutoLoot:show()
  windowAutoLoot:raise()
  windowAutoLoot:focus()
end

function createListLoot(buffer)
  local parts = buffer:split('|')
  if #parts >= 2 then
    maxSlot = tonumber(parts[1]) or 30
    buffer = parts[2]
  else
    maxSlot = tonumber(parts[1]) or 30
    buffer = ''
  end

  local _listloot = {}
  if buffer ~= '' then
    for i, v in ipairs(buffer:split('@')) do
      local itemData = v:split('-')
      if #itemData >= 2 then
        table.insert(_listloot, {
          itemId = itemData[1],
          itemName = itemData[2]
        })
      end
    end
  end
  for i, loot in ipairs(_listloot) do
    itemSelected:setItemId(tonumber(loot.itemId) or 0)
    edtItemName:setText(loot.itemName)
    addSlotLoot()
    addLoot(false)
  end
  countLootList()
end

function addLoot(sendLoot)
  selectedSlot = listLoot:getFocusedChild()
  if selectedSlot then
    local itemId = itemSelected:getItemId()
    if itemId == 0 then
      local itemType = g_things.findItemTypeByName(edtItemName:getText())
      if itemType then
        itemId = itemType:getClientId()
      end
    end

    if itemId == 0 then
      displayErrorBox('Item nao encontrado', 'Verifique o nome do item e digite novamente!')
      return
    end
    selectedSlot.itemId = itemId
    selectedSlot:getChildById('rowItemName'):setText(edtItemName:getText())
    selectedSlot:getChildById('rowItem'):setItemId(itemId)
    if sendLoot then g_game.talk('!autoloot add, ' .. edtItemName:getText()) end
    eraseLoot()
  else
    displayErrorBox('Auto-Loot', 'Selecione um Slot para adicionar um item!')
  end
end

function addSlotLoot()
  if listLoot:getChildCount() < maxSlot then
    local rowLoot = g_ui.createWidget('RowListLoot', listLoot)
    listLoot:focusChild(rowLoot, ActiveFocusReason)
    countLootList()
  end
end

function removeListLoot()
  g_game.talk('!autoloot clean')
  eraseLoot()
  listLoot:destroyChildren()
  countLootList()
end

function removeSlot()
  selectedSlot = listLoot:getFocusedChild()
  if selectedSlot then
    g_game.talk('!autoloot remove, ' .. selectedSlot:getChildById('rowItemName'):getText())
    eraseLoot()
    listLoot:focusPreviousChild(KeyboardFocusReason)
    listLoot:removeChild(selectedSlot)
    countLootList()
  else
    displayErrorBox('Auto-Loot', 'Selecione um Slot para ser removido!')
  end
end

function eraseLoot()
  itemSelected:setItem(nil)
  edtItemName:clearText()
end

function countLootList()
  lblItemList:setText('Itens na lista: ' .. listLoot:getChildCount() .. '/' .. maxSlot)
end

function startChooseItem()
  if g_ui.isMouseGrabbed() then return end
  mouseGrabberWidget:grabMouse()
  g_mouse.pushCursor('target')
  windowAutoLoot:hide()
end

function onChooseItemMouseRelease(self, mousePosition, mouseButton)
  local item = nil
  if mouseButton == MouseLeftButton then
    local clickedWidget = modules.game_interface.getRootPanel():recursiveGetChildByPos(mousePosition, false)
    if clickedWidget then
      if clickedWidget:getClassName() == 'UIMap' then
        local tile = clickedWidget:getTile(mousePosition)
        if tile then
          local thing = tile:getTopMoveThing()
          if thing and thing:isItem() then
            item = thing
          end
        end
      elseif clickedWidget:getClassName() == 'UIItem' and not clickedWidget:isVirtual() then
        item = clickedWidget:getItem()
      end
    end
  end

  if item then
    itemSelected:setItemId(item:getId())
    edtItemName:setText(item:getName())
  end

  onOpenAutoLoot()

  g_mouse.popCursor('target')
  self:ungrabMouse()
  return true
end
