function init()
  --print("Initializing game_itemtooltip module")
  ProtocolGame.registerExtendedOpcode(150, onExtendedOpcode)
end

function terminate()
  ProtocolGame.unregisterExtendedOpcode(150)
end

function onExtendedOpcode(protocol, opcode, buffer)
  if opcode ~= 150 then return end
  --print("Received tooltip response: " .. buffer)

  local parts = buffer:split('|')
  if #parts < 2 then return end

  local itemData = parts[1]:split(';')
  local description = parts[2]

  if #itemData < 6 then return end

  local itemId = tonumber(itemData[1])

  -- Check if user is still hovering something
  local hoveredWidget = g_ui.getRootWidget():recursiveGetChildByPos(g_window.getMousePosition())
  if hoveredWidget and hoveredWidget.getItem then
    local item = hoveredWidget:getItem()
    if item and (item:getServerId() == itemId or item:getId() == itemId) then
      --print("Updating tooltip for item " .. itemId)
      item:setTooltip(description)
      hoveredWidget:onItemChange()
      g_tooltip.display(description)
    end
  end

  -- Also find all other visible items with this ID and position if needed?
  -- For now, updating the hovered one is enough.
end
