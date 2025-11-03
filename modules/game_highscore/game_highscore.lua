local HIGH_OPCODE = 73

-- Variáveis do módulo
local highscoreButton = nil
local worldTypeRadioGroup = nil
local currentPage = 1
local totalPages = 1
local ui = nil -- será carregado sob demanda

local tempFixworldType = {
  { 0, "Open PvP" },
  { 1, "Optional PvP" },
  { 2, "Hardcore PvP" },
  { 3, "Retro Open PvP" },
  { 4, "Retro Hardcore PvP" }
}

-- =============== INIT (chamado automaticamente) ===============
function init()
  connect(g_game, { onExtendedOpcode = onExtendedOpcode })

  highscoreButton = modules.client_topmenu.addRightGameToggleButton("highscoreButton", tr("Highscores"), "highscores.png",
    toggle)
  highscoreButton:setOn(true)
end

-- =============== TERMINATE (chamado automaticamente) ===============
function terminate()
  disconnect(g_game, { onExtendedOpcode = onExtendedOpcode })

  if highscoreButton then
    highscoreButton:destroy()
    highscoreButton = nil
  end

  if worldTypeRadioGroup then
    worldTypeRadioGroup:destroy()
    worldTypeRadioGroup = nil
  end

  if ui then
    ui:destroy()
    ui = nil
  end
end

-- =============== UI: Carregar sob demanda ===============
local function loadUI()
  if ui then return end
  ui = g_ui.loadUI('game_highscore', modules.game_ui.getRootPanel())
  ui:hide()
end

-- =============== TOGGLE ===============
function hide() if ui then ui:hide() end end

function show()
  loadUI()
  ui:show()
  ui:raise()
  ui:focus()
  requestHighscore()
end

function toggle()
  if ui and ui:isVisible() then
    hide()
  else
    show()
  end
end

-- =============== OPCODE ===============
function onExtendedOpcode(opcode, buffer)
  if opcode ~= HIGH_OPCODE then return end

  local ok, data = pcall(json.decode, buffer)
  if not ok or type(data) ~= "table" or data.action ~= "highscore" then return end

  loadUI() -- garante que UI existe
  local f = ui.filters

  -- Preenche filtros (1ª vez)
  if not f.vocationBox.isFilled then
    f.vocationBox:addOption("All Vocations")
    for i = 0, 8 do f.vocationBox:addOption(getVocationName(i)) end
    f.vocationBox.isFilled = true
  end

  if not f.categoryBox.isFilled then
    f.categoryBox:addOption("Level")
    f.categoryBox:addOption("Magic Level")
    f.categoryBox:addOption("Fist Fighting")
    f.categoryBox:addOption("Shielding")
    f.categoryBox.isFilled = true
  end

  if not f.gameWorldBox.isFilled then
    f.gameWorldBox:addOption(g_game.getWorldName())
    f.gameWorldBox.isFilled = true
  end

  if not f.BattlEyeBox.isFilled then
    f.BattlEyeBox:addOption("No Filter")
    f.BattlEyeBox:addOption("BattlEye Only")
    f.BattlEyeBox.isFilled = true
  end

  if not f.PanelWorld.isFilled then
    worldTypeRadioGroup = UIRadioGroup.create()
    for _, wt in ipairs(tempFixworldType) do
      local w = g_ui.createWidget("WorldType", f.PanelWorld)
      w.text:setText(wt[2])
      worldTypeRadioGroup:addWidget(w.enabled)
    end
    f.PanelWorld.isFilled = true
  end

  -- Paginação
  currentPage = data.page or 1
  totalPages = data.pages or 1
  ui.page:setText(currentPage .. " / " .. totalPages)
  ui.next:setEnabled(currentPage < totalPages)
  ui.nextLast:setEnabled(currentPage < totalPages)
  ui.prev:setEnabled(currentPage > 1)
  ui.prevLast:setEnabled(currentPage > 1)
  ui.ownRankButton:setEnabled(true)
  ui.last_update:setText("Last Update: Now")

  createHighscores(data.data or {})
end

-- =============== DADOS ===============
function createHighscores(list)
  local data = ui.data
  data:getLayout():disableUpdates()
  data:destroyChildren()

  local player = g_game.getCharacterName()
  for i, e in ipairs(list) do
    local row = g_ui.createWidget("HighScoreData", data)
    row:setBackgroundColor(i % 2 == 0 and "#ffffff12" or "#00000012")
    row.rank:setText(e.rank .. ".")
    row.name:setText(e.name)
    row.voc:setText(getVocationName(e.vocation))
    row.world:setText(g_game.getWorldName())
    row.level:setText(e.level)
    row.points:setText(comma_value(e.experience))

    if player and player:lower() == e.name:lower() then
      for _, w in pairs({ "rank", "name", "voc", "world", "level", "points" }) do
        row[w]:setColor("#60f860")
      end
    end
  end
  data:getLayout():enableUpdates()
  data:getLayout():update()
end

function getVocationName(id)
  local n = { "None", "Sorcerer", "Druid", "Paladin", "Knight", "Master Sorcerer", "Elder Druid", "Royal Paladin",
    "Elite Knight" }
  return n[id + 1] or "Unknown"
end

-- =============== PAGINAÇÃO ===============
local function changePage(p)
  if p < 1 or p > totalPages then return end
  disableButtons()
  requestHighscore(p)
end

function nextPage() changePage(currentPage + 1) end

function nextEndPage() changePage(totalPages) end

function prevPage() changePage(currentPage - 1) end

function prevEndPage() changePage(1) end

function disableButtons()
  for _, id in ipairs({ "next", "nextLast", "prev", "prevLast", "ownRankButton" }) do
    if ui[id] then ui[id]:setEnabled(false) end
  end
end

function submit()
  disableButtons(); requestHighscore(1)
end

function showOwnRank()
  disableButtons(); requestHighscore(1, true)
end

-- =============== ENVIO ===============
function requestHighscore(page, own)
  page = page or currentPage
  own = own or false

  loadUI() -- garante UI
  local vText = ui.filters.vocationBox:getCurrentOption().text
  local vocs = (vText == "All Vocations") and { 0, 1, 2, 3, 4, 5, 6, 7, 8 } or { getVocationId(vText) }

  local catMap = { Level = 0, ["Magic Level"] = 1, ["Fist Fighting"] = 2, Shielding = 3 }
  local cat = catMap[ui.filters.categoryBox:getCurrentOption().text] or 0

  local wtIdx = worldTypeRadioGroup and worldTypeRadioGroup:getCurrentWidgetIndex() or 1
  local wt = tempFixworldType[wtIdx] and tempFixworldType[wtIdx][1] or 0

  local be = ui.filters.BattlEyeBox:getCurrentOption().text == "BattlEye Only" and 1 or 0

  local req = {
    action = "request",
    category = cat,
    page = page,
    entriesPerPage = 20,
    type = own and 1 or 0,
    vocations = vocs,
    world = g_game.getWorldName(),
    worldType = wt,
    battlEye = be
  }

  g_game.sendExtendedOpcode(HIGH_OPCODE, json.encode(req))
end

function getVocationId(name)
  local map = {
    None = 0,
    Sorcerer = 1,
    Druid = 2,
    Paladin = 3,
    Knight = 4,
    ["Master Sorcerer"] = 5,
    ["Elder Druid"] = 6,
    ["Royal Paladin"] = 7,
    ["Elite Knight"] = 8
  }
  return map[name] or 0
end

-- local highscoreButton = nil
-- local worldTypeRadioGroup = nil
-- local currentPage = 0
-- local countPages = 0

-- local vocationArray = {}
-- local Category = {}

-- local tempFixworldType = {
--   { 0, "Open PvP" },
--   { 1, "Optional PvP" },
--   { 2, "Hardcore PvP" },
--   { 3, "Retro Open PvP" },
--   { 4, "Retro Hardcore PvP" }
-- }

-- local serverSide = {
--   action = 0,
--   category = 0,
--   vocation = 0xFFFFFFFF,
--   world = "",
--   worldType = 1,
--   battlEye = 1,
--   page = 1,
--   totalInPages = 20
-- }

-- local function getMinutesDifference(t1, t2)
--   local diffInSeconds = os.difftime(t2, t1)
--   local diffInMinutes = diffInSeconds / 60
--   local diffInHours = diffInMinutes / 60

--   if diffInHours >= 1 then
--     return string.format("Last Update: %.0f Hrs Ago", diffInHours)
--   elseif diffInMinutes >= 1 then
--     return string.format("Last Update: %.0f minutes Ago", diffInMinutes)
--   else
--     return string.format("Last Update: %.0f Second Ago", math.abs(diffInSeconds))
--   end
-- end

-- local function getCategory(arg)
--   if type(arg) == "string" then
--     for i, cat in ipairs(Category) do
--       if cat[2] == arg then
--         return cat[1]
--       end
--     end
--   end
--   return 0
-- end

-- local function getVocation(arg)
--   if type(arg) == "number" then
--     for _, voc in ipairs(vocationArray) do
--       if voc[1] == arg then
--         return voc[2]
--       end
--     end
--   elseif type(arg) == "string" then
--     for _, voc in ipairs(vocationArray) do
--       if voc[2] == arg then
--         return voc[1]
--       end
--     end
--   end
--   return "All Vocations"
-- end

-- highscoreController = Controller:new()
-- highscoreController:setUI('game_highscore')

-- function highscoreController:onInit()
--   self.ui:hide()

--   -- Registrar evento do jogo
--   connect(g_game, { onProcessHighscores = onProcessHighscores })
-- end

-- function highscoreController:onTerminate()
--   disconnect(g_game, { onProcessHighscores = onProcessHighscores })

--   if highscoreButton then
--     highscoreButton:destroy()
--     highscoreButton = nil
--   end

--   if worldTypeRadioGroup then
--     worldTypeRadioGroup:destroy()
--     worldTypeRadioGroup = nil
--   end
-- end

-- function highscoreController:onGameStart()
--   if g_game.getClientVersion() < 1310 then
--     return
--   end

--   -- Criar botão no topmenu
--   highscoreButton = modules.client_topmenu.addRightGameToggleButton(
--     "highscoreButton",
--     tr("Highscores"),
--     "highscores",
--     toggle,
--     true
--   )
--   highscoreButton:setOn(false)
-- end

-- function highscoreController:onGameEnd()
--   if self.ui:isVisible() then
--     self.ui:hide()
--   end
-- end

-- function hide()
--   if not highscoreController.ui then return end
--   highscoreController.ui:hide()
-- end

-- function show()
--   if not highscoreController.ui or not highscoreButton then return end

--   highscoreController.ui:show()
--   highscoreController.ui:raise()
--   highscoreController.ui:focus()
--   requestInfo()
-- end

-- function toggle()
--   if not highscoreController.ui then return end
--   if highscoreController.ui:isVisible() then
--     hide()
--   else
--     show()
--   end
-- end

-- function onProcessHighscores(serverName, world, worldType, battlEye, vocations, categories, page, totalInPages,
--                              highscores, entriesTs)
--   vocationArray = table.copy(vocations)
--   Category = table.copy(categories)
--   currentPage = page
--   countPages = totalInPages

--   local ui = highscoreController.ui
--   local filters = ui.filters

--   -- Preencher World Types (RadioGroup)
--   if not filters.PanelWorld.isFilled then
--     worldTypeRadioGroup = UIRadioGroup.create()
--     for _, wt in ipairs(tempFixworldType) do
--       local label = g_ui.createWidget("WorldType", filters.PanelWorld)
--       label.text:setText(wt[2])
--       worldTypeRadioGroup:addWidget(label.enabled)
--     end
--     worldTypeRadioGroup:setId('worldTypeRadioGroup')
--     filters.PanelWorld.isFilled = true
--   end

--   -- Preencher ComboBoxes
--   local filterData = {
--     { box = filters.vocationBox, data = vocations,  label = "All Vocations" },
--     { box = filters.categoryBox, data = categories, label = nil },
--   }

--   for _, f in ipairs(filterData) do
--     if not f.box.isFilled then
--       if f.label then
--         f.box:addOption(f.label)
--       end
--       for _, item in ipairs(f.data) do
--         f.box:addOption(item[2])
--       end
--       f.box.isFilled = true
--     end
--   end

--   -- BattlEye e Mundo
--   if not filters.BattlEyeBox.isFilled then
--     filters.BattlEyeBox:addOption(battlEye == 1 and "Yes" or "No")
--     filters.BattlEyeBox.isFilled = true
--   end

--   if not filters.gameWorldBox.isFilled then
--     filters.gameWorldBox:addOption(world ~= "" and world or serverName)
--     filters.gameWorldBox.isFilled = true
--   end

--   -- Paginação
--   local isFirst = currentPage == 1
--   local isLast = currentPage == countPages

--   ui.next:setEnabled(not isLast)
--   ui.nextLast:setEnabled(not isLast)
--   ui.prev:setEnabled(not isFirst)
--   ui.prevLast:setEnabled(not isFirst)
--   ui.ownRankButton:setEnabled(true)
--   ui.page:setText(currentPage .. " / " .. countPages)

--   -- Última atualização
--   ui.last_update:setText(getMinutesDifference(entriesTs, os.time()))

--   createHighscores(highscores)
-- end

-- function createHighscores(list)
--   local data = highscoreController.ui.data
--   data:getLayout():disableUpdates()
--   data:destroyChildren()

--   local playerName = g_game.getCharacterName()

--   for i, entry in ipairs(list) do
--     local row = g_ui.createWidget("HighScoreData", data)
--     row:setBackgroundColor(i % 2 == 0 and "#ffffff12" or "#00000012")
--     row.rank:setText(entry[1] .. ".")
--     row.name:setText(entry[2])
--     row.voc:setText(entry[4] == 0 and "None" or getVocation(entry[4]))
--     row.world:setText(entry[5])
--     row.level:setText(entry[6])
--     row.points:setText(comma_value(entry[8]))

--     if playerName and playerName:lower() == entry[2]:lower() then
--       for _, w in pairs({ "rank", "name", "voc", "world", "level", "points" }) do
--         row[w]:setColor("#60f860")
--       end
--     end
--   end

--   data:getLayout():enableUpdates()
--   data:getLayout():update()
-- end

-- -- Paginação
-- local function changePage(page)
--   disableButtons()
--   highscoreRequest(page, 0)
-- end

-- function nextPage() changePage(currentPage + 1) end

-- function nextEndPage() changePage(countPages) end

-- function prevPage() changePage(currentPage - 1) end

-- function prevEndPage() changePage(1) end

-- function disableButtons()
--   local ui = highscoreController.ui
--   for _, id in ipairs({ "next", "nextLast", "prev", "prevLast", "ownRankButton" }) do
--     ui[id]:setEnabled(false)
--   end
-- end

-- function submit()
--   disableButtons()
--   highscoreRequest(1, 0)
-- end

-- function showOwnRank()
--   disableButtons()
--   highscoreRequest(1, 1)
-- end

-- function highscoreRequest(page, action)
--   local vocationText = highscoreController.ui.filters.vocationBox:getCurrentOption().text
--   local vocationId = getVocation(vocationText)
--   vocationId = (vocationId == "All Vocations") and 0xFFFFFFFF or vocationId

--   local categoryId = getCategory(highscoreController.ui.filters.categoryBox:getCurrentOption().text)

--   -- World Type do RadioGroup
--   local worldTypeIndex = worldTypeRadioGroup and worldTypeRadioGroup:getCurrentWidgetIndex() or 1
--   local worldType = tempFixworldType[worldTypeIndex] and tempFixworldType[worldTypeIndex][1] or 1

--   g_game.requestHighscore(
--     action,
--     categoryId,
--     vocationId,
--     serverSide.world,
--     worldType,
--     serverSide.battlEye,
--     page,
--     serverSide.totalInPages
--   )
-- end

-- function requestInfo()
--   highscoreRequest(1, 0)
-- end
