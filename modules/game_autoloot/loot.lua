GameServerOpcodes.AutoLoot = 157
maxSlot = 30

listLoot = nil
itemSelected = nil
edtItemName = nil
lblItemList = nil
mouseGrabberWidget = nil
searchPopup = nil
searchTimer = nil
ignoreTextChange = false

function init()
  connect(g_game, { onGameEnd = offline })
  ProtocolGame.registerExtendedOpcode(GameServerOpcodes.AutoLoot, onServerOpcode)

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
            local itemId = focusedChild:getChildById('rowItem'):getItemId()
            if itemId and itemId > 0 then
              itemSelected:setItemId(itemId)
            end
            if focusedChild.serverId and focusedChild.serverId > 0 then
              itemSelected.serverId = focusedChild.serverId
            end
            ignoreTextChange = true
            edtItemName:setText(itemName)
          end
        end
  })

  connect(edtItemName, {
    onTextChange = function(self, text)
      g_logger.info('[AutoLoot] onTextChange fired: text="' .. tostring(text) .. '", len=' .. tostring(#(text or '')) .. ', ignore=' .. tostring(ignoreTextChange))
      if ignoreTextChange then
        ignoreTextChange = false
        return
      end
      closeSearchPopup()
      if searchTimer then
        removeEvent(searchTimer)
        searchTimer = nil
      end
      if text and #text >= 2 then
        searchTimer = scheduleEvent(function() sendSearchQuery(text) end, 400)
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
            local itemId = focusedChild:getChildById('rowItem'):getItemId()
            if itemId and itemId > 0 then
              itemSelected:setItemId(itemId)
            end
            edtItemName:setText(itemName)
          end
        end
  })
  if searchTimer then
    removeEvent(searchTimer)
    searchTimer = nil
  end
  ProtocolGame.unregisterExtendedOpcode(GameServerOpcodes.AutoLoot)
  closeSearchPopup()
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

function onServerOpcode(protocol, opcode, buffer)
  g_logger.info('[AutoLoot] Server opcode: ' .. tostring(buffer))

  if buffer:find("^searchresult") then
    parseSearchResults(buffer)
    return
  end

  createListLoot(buffer)
end

function sendSearchQuery(text)
  g_logger.info('[AutoLoot] sendSearchQuery called with: "' .. tostring(text) .. '"')
  local pg = g_game.getProtocolGame()
  if pg then
    g_logger.info('[AutoLoot] Sending search opcode: search, ' .. text)
    pg:sendExtendedOpcode(157, 'search, ' .. text)
  else
    g_logger.info('[AutoLoot] ERROR: pg is nil, cannot send search')
  end
end

function parseSearchResults(buffer)
  g_logger.info('[AutoLoot] parseSearchResults - buffer: ' .. tostring(buffer))
  local parts = buffer:split('|')
  g_logger.info('[AutoLoot] parseSearchResults - parts count: ' .. #parts)
  if #parts < 2 then g_logger.info('[AutoLoot] parseSearchResults - less than 2 parts, returning'); return end

  local results = {}
  for i = 2, #parts do
    local fields = parts[i]:split(';')
    g_logger.info('[AutoLoot] parseSearchResults - part ' .. i .. ' fields: ' .. #fields)
    if #fields >= 3 then
      table.insert(results, {
        id = tonumber(fields[1]),
        name = fields[2],
        clientId = tonumber(fields[3])
      })
      g_logger.info('[AutoLoot] Search result: id=' .. fields[1] .. ', name=' .. fields[2] .. ', clientId=' .. fields[3])
    end
  end

  g_logger.info('[AutoLoot] parseSearchResults - total results: ' .. #results)
  showSearchResultsPopup(results)
end

function showSearchResultsPopup(results)
  closeSearchPopup()
  if #results == 0 then return end

  searchPopup = g_ui.createWidget('UIWidget', windowAutoLoot)
  searchPopup:setId('searchPopup')
  local textEdit = edtItemName
  searchPopup:setX(textEdit:getX())
  searchPopup:setY(textEdit:getY() + textEdit:getHeight() + 2)
  searchPopup:setWidth(textEdit:getWidth())
  searchPopup:setHeight(math.min(#results * 32 + 4, 250))
  searchPopup:setBackgroundColor('#222222')
  searchPopup:setVisible(true)
  searchPopup:setFocusable(false)

  local yOffset = 2
  for _, item in ipairs(results) do
    local btn = g_ui.createWidget('UIButton', searchPopup)
    local btnServerId = item.id
    local btnName = item.name
    local btnClientId = item.clientId
    btn:setText(btnName)
    btn:setWidth(searchPopup:getWidth() - 4)
    btn:setHeight(28)
    btn:setX(2)
    btn:setY(yOffset)
    btn.onClick = function()
      ignoreTextChange = true
      edtItemName:setText(btnName)
      itemSelected:setItemId(btnClientId)
      itemSelected.serverId = btnServerId
      closeSearchPopup()
    end
    yOffset = yOffset + 30
  end
end

function closeSearchPopup()
  if searchPopup then
    searchPopup:destroy()
    searchPopup = nil
  end
end

function createListLoot(buffer)
  g_logger.info('[AutoLoot] createListLoot - Received buffer: ' .. tostring(buffer))
  listLoot:destroyChildren()
  countLootList()
  local parts = buffer:split('|')
  if #parts >= 2 then
    maxSlot = tonumber(parts[1]) or 30
    buffer = parts[2]
  else
    maxSlot = tonumber(parts[1]) or 30
    buffer = ''
  end

  if buffer ~= '' then
    local itemEntries = buffer:split('@')
    g_logger.info('[AutoLoot] createListLoot - Item entries count: ' .. #itemEntries)
    for i, v in ipairs(itemEntries) do
      local itemData = v:split('-')
      if #itemData >= 2 then
        local idPart = itemData[1]
        local serverId, clientId
        if idPart:find(';') then
          local idPair = idPart:split(';')
          serverId = tonumber(idPair[1]) or 0
          clientId = tonumber(idPair[2]) or serverId
        else
          serverId = tonumber(idPart) or 0
          clientId = serverId
        end
        local itemName = itemData[2]

        local rowLoot = g_ui.createWidget('RowListLoot', listLoot)
        rowLoot.serverId = serverId
        rowLoot:getChildById('rowItem'):setItemId(clientId)
        rowLoot:getChildById('rowItemName'):setText(itemName)
        g_logger.info('[AutoLoot] createListLoot - Item ' .. i .. ': serverId=' .. serverId .. ', clientId=' .. clientId .. ', Name=' .. itemName)
      end
    end
  end
  countLootList()
end

function addLoot(sendLoot)
  selectedSlot = listLoot:getFocusedChild()
  if selectedSlot then
    if sendLoot then
      local pg = g_game.getProtocolGame()
      if pg then
        local itemId = itemSelected:getItemId()
        local itemName = edtItemName:getText()
        if itemId > 0 then
          local serverId = itemSelected.serverId or itemId
          g_logger.info('[AutoLoot] Adding with serverId: ' .. serverId .. ', name: ' .. itemName)
          pg:sendExtendedOpcode(157, 'add, ' .. serverId .. '~' .. itemName)
        else
          g_logger.info('[AutoLoot] Adding with name only: ' .. itemName)
          pg:sendExtendedOpcode(157, 'add, ' .. itemName)
        end
      end
    end
    local itemId = itemSelected:getItemId()
    selectedSlot:getChildById('rowItemName'):setText(edtItemName:getText())
    selectedSlot:getChildById('rowItem'):setItemId(itemId)
    eraseLoot()
  else
    displayErrorBox('Auto-Loot', 'Selecione um Slot para adicionar um item!')
  end
end

function addSlotLoot()
  if listLoot:getChildCount() < maxSlot then
    local rowLoot = g_ui.createWidget('RowListLoot', listLoot)
    rowLoot.serverId = 0
    listLoot:focusChild(rowLoot, ActiveFocusReason)
    countLootList()
  end
end

function removeListLoot()
  local pg = g_game.getProtocolGame()
  if pg then
    g_logger.info('[AutoLoot] Cleaning list')
    pg:sendExtendedOpcode(157, 'clean')
  end
  eraseLoot()
  listLoot:destroyChildren()
  countLootList()
end

function removeSlot()
  selectedSlot = listLoot:getFocusedChild()
  if selectedSlot then
    local pg = g_game.getProtocolGame()
    if pg then
      if selectedSlot.serverId and selectedSlot.serverId > 0 then
        g_logger.info('[AutoLoot] Removing serverId: ' .. selectedSlot.serverId)
        pg:sendExtendedOpcode(157, 'remove, ' .. selectedSlot.serverId)
      else
        local itemName = selectedSlot:getChildById('rowItemName'):getText()
        g_logger.info('[AutoLoot] Removing name: ' .. itemName)
        pg:sendExtendedOpcode(157, 'remove, ' .. itemName)
      end
    end
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
  closeSearchPopup()
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
    itemSelected.serverId = item:getId()
    edtItemName:setText(item:getName())
  end

  onOpenAutoLoot()

  g_mouse.popCursor('target')
  self:ungrabMouse()
  return true
end
