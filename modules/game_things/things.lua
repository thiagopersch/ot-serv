filename = nil
loaded = false
local loadedSprPath = nil

function setFileName(name) filename = name end

function isLoaded() return loaded end

function load()
  local version = g_game.getClientVersion()
  local things = g_settings.getNode('things')

  local datPath, sprPath
  if things and things["data"] ~= nil and things["sprites"] ~= nil then
    datPath = resolvepath('/things/' .. things["data"])
    sprPath = resolvepath('/things/' .. things["sprites"])
  else
    if filename then
      datPath = resolvepath('/things/' .. filename)
      sprPath = resolvepath('/things/' .. filename)
    else
      datPath = resolvepath('/things/' .. version .. '/Tibia')
      sprPath = resolvepath('/things/' .. version .. '/Tibia')
    end
  end

  local errorMessage = ''
  if not g_things.loadDat(datPath) then
    if not g_game.getFeature(GameSpritesU32) then
      -- g_game.enableFeature(GameSpritesU32)

      if not g_things.loadDat(datPath) then
        errorMessage = errorMessage ..
            tr(
              "Unable to load dat file, please place a valid dat in '%s'",
              datPath) .. '\n'
      end
    else
      errorMessage = errorMessage ..
          tr(
            "Unable to load dat file, please place a valid dat in '%s'",
            datPath) .. '\n'
    end
  end
  -- HD mode: .spr sprites are upscaled with xBRZ 2x (64x64). Applied on sprite load.
  g_sprites.setUpscale(g_settings.getBoolean('hdSprites', true))
  local sprSuccess, sprResult = pcall(function()
    return g_sprites.loadSpr(sprPath)
  end)
  if not sprSuccess or not sprResult then
    errorMessage = errorMessage ..
        tr(
          "Unable to load spr file, please place a valid spr in '%s'",
          sprPath)
  end

  loaded = (errorMessage:len() == 0)
  if sprSuccess and sprResult then
    loadedSprPath = sprPath
  end

  if errorMessage:len() > 0 then
    local messageBox = displayErrorBox(tr('Error'), errorMessage)
    addEvent(function()
      messageBox:raise()
      messageBox:focus()
    end)

    g_game.setClientVersion(0)
    g_game.setProtocolVersion(0)
  end

  g_things.loadOtb('/items/items.otb')
  -- g_things.loadXml('/items/items.xml')
end

-- Toggles the xBRZ HD mode at runtime: reloads the .spr and drops cached textures
function setHdMode(enabled)
  if not loaded or not loadedSprPath then return end -- applied by load() on next login
  if g_sprites.isHdMod() then return end -- .cwm pack is already HD
  if g_sprites.isUpscale() == enabled and g_sprites.isLoaded() then return end

  g_sprites.setUpscale(enabled)
  local ok, result = pcall(function() return g_sprites.loadSpr(loadedSprPath) end)
  if not ok or not result then
    g_logger.error('Failed to reload sprites for HD mode: ' .. tostring(result))
  end
  g_things.unloadTextures()
end
