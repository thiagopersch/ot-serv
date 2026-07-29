local OPCODE = 252
local popup = nil

function init()
  ProtocolGame.registerExtendedOpcode(OPCODE, onOpcode)
end

function terminate()
  ProtocolGame.unregisterExtendedOpcode(OPCODE)
  closePopup()
end

function closePopup()
  if popup then
    popup:destroy()
    popup = nil
  end
end

function onOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then return end
  if not buffer or buffer == '' then return end

  local ok, data = pcall(json.decode, buffer)
  if not ok or type(data) ~= 'table' then return end

  closePopup()
  popup = g_ui.displayUI('chest')
  popup:getChildById('rewardLabel'):setText(string.format('You received\n%dx %s', data.count or 1, data.name or ''))
  popup:getChildById('rewardIcon'):setItemId(data.itemId or 0)

  scheduleEvent(closePopup, 6000)
end
