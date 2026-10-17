dofile("data/lib/extoutfit_lib.lua")
local json = dofile("data/lib/json.lua")

local SHADER_SELECTOR_OPCODE = 248

local SHADERS = {
  { id = 1,  shadername = "outfit_rainbow",          name = "Rainbow" },
  { id = 2,  shadername = "ShaderChargeBlue",        name = "Blue Charge" },
  { id = 3,  shadername = "ShaderChargeGreen",       name = "Green Charge" },
  { id = 4,  shadername = "ShaderChargeYellow",      name = "Yellow Charge" },
  { id = 5,  shadername = "ShaderChargeRed",         name = "Red Charge" },
  { id = 6,  shadername = "ShaderOutBlack",          name = "Black Outline" },
  { id = 7,  shadername = "ShaderOutBlue",           name = "Blue Outline" },
  { id = 8,  shadername = "ShaderOutRed",            name = "Red Outline" },
  { id = 9,  shadername = "ShaderOutPurple",         name = "Purple Outline" },
  { id = 10, shadername = "ShaderOutMultiColors",    name = "Multicolor Outline" },
  { id = 11, shadername = "ShaderEstaticYellow",     name = "Yellow Static" },
  { id = 12, shadername = "upgrade",                 name = "Upgrade" },
  { id = 13, shadername = "lendario",                name = "Legendary" },
  { id = 14, shadername = "mitico",                  name = "Mythic" },
  { id = 15, shadername = "epico",                   name = "Epic" },
  { id = 16, shadername = "ShaderChargeLightPink",   name = "Light Pink Charge" },
  { id = 17, shadername = "ShaderChargeMultiColors", name = "Multicolor Charge" },
  { id = 18, shadername = "ShaderChargeObito",       name = "Obito Charge" },
  { id = 19, shadername = "especial",                name = "Special" },
  { id = 20, shadername = "fire_aura",               name = "Fire Aura" },
  { id = 21, shadername = "big_fire_aura",           name = "Big Fire Aura" },
}

function onUse(cid, item, fromPosition, itemEx, toPosition)
  if getPlayerStorageValue(cid, 81001) == 1 then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "You already have a shader selection open.")
    return true
  end

  setPlayerStorageValue(cid, 81000, item.uid)
  setPlayerStorageValue(cid, 81001, 1)

  local shadersJson = json.encode(SHADERS)
  doPlayerSendExtendedOpcode(cid, SHADER_SELECTOR_OPCODE, "open|" .. shadersJson)
  return true
end
