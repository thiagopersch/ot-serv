dofile("data/lib/extoutfit_lib.lua")

local SHADER_SELECTOR_OPCODE = 248

function onExtendedOpcode(cid, opcode, buffer)
  if opcode ~= SHADER_SELECTOR_OPCODE then return false end
  if not isPlayer(cid) then return false end

  local parts = string.explode(buffer, "|")
  local action = parts[1]

  if action == "cleanup" then
    setPlayerStorageValue(cid, 81000, -1)
    setPlayerStorageValue(cid, 81001, -1)
    return true
  end

  if action == "cancel" then
    setPlayerStorageValue(cid, 81000, -1)
    setPlayerStorageValue(cid, 81001, -1)
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Shader selection cancelled.")
    return true
  end

  if action == "pick" then
    local shaderId = tonumber(parts[2])
    if not shaderId then return false end

    local itemUid = getPlayerStorageValue(cid, 81000)
    if itemUid <= 0 then return false end

    if extoutfit.hasShader(cid, shaderId) then
      doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "You already have this shader unlocked!")
      setPlayerStorageValue(cid, 81000, -1)
      setPlayerStorageValue(cid, 81001, -1)
      return true
    end

    extoutfit.addShader(cid, shaderId)
    doPlayerSave(cid)
    doRemoveItem(itemUid, 1)

    setPlayerStorageValue(cid, 81000, -1)
    setPlayerStorageValue(cid, 81001, -1)

    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Shader unlocked! Select it in the outfit window.")
    doPlayerSendOutfitWindow(cid)
    return true
  end

  return false
end
