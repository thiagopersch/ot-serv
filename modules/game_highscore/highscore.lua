local OPCODE = 73

local CATEGORIES = {
  { id = 0, name = "Level" },
  { id = 1, name = "Magic Level" },
  { id = 2, name = "Fist Fighting" },
  { id = 3, name = "Club Fighting" },
  { id = 4, name = "Sword Fighting" },
  { id = 5, name = "Axe Fighting" },
  { id = 6, name = "Distance Fighting" },
  { id = 7, name = "Shielding" },
}

local VOCATION_NAMES = {
  [1] = "Bardock", [2] = "Bills", [3] = "Botamo", [4] = "Brolly", [5] = "Bulma",
  [6] = "Buu", [7] = "C8", [8] = "C17", [9] = "C18", [10] = "Cabba",
  [11] = "Cell", [12] = "Cooler", [13] = "Dende", [14] = "Freeza", [15] = "Ginn",
  [16] = "Gohan", [17] = "Goku", [18] = "Goku Black", [19] = "Hitto", [20] = "Janemba",
  [21] = "Jiren", [22] = "Kagome", [23] = "Kaio", [24] = "Kame", [25] = "King Cold",
  [26] = "King Vegeta", [27] = "Kuririn", [28] = "Liquir", [29] = "Pan", [30] = "Piccolo",
  [31] = "Quitela", [32] = "Raditz", [33] = "Shenron", [34] = "Tapion", [35] = "Trunks",
  [36] = "Tsuful", [37] = "Turles", [38] = "Uub", [39] = "Vados", [40] = "Vegeta",
  [41] = "Vegetto", [42] = "Vermouth", [43] = "Videl", [44] = "Zaiko", [45] = "Zeno",
  [47] = "Aizen", [48] = "Byakuya", [49] = "Gin", [50] = "Grimmjow", [51] = "Hitsugaya",
  [52] = "Ichigo FullBring", [53] = "Ichigo", [54] = "Ishida", [55] = "Kyouraku", [56] = "Neliel",
  [57] = "Orihime", [58] = "Renji", [59] = "Rukia", [60] = "Sado", [61] = "Shinji",
  [62] = "Soi Fong", [63] = "Tousen", [64] = "Ulquiorra", [65] = "Urahara", [66] = "Yoruichi",
  [67] = "Zaraki",
}

local window = nil
local topButton = nil
local categoryButtons = {}
local currentCategory = 0
local currentPage = 1
local totalPages = 1

function init()
  connect(g_game, { onGameEnd = offline })
  ProtocolGame.registerExtendedOpcode(OPCODE, onOpcode)
  topButton = modules.client_topmenu.addRightGameToggleButton('highscoreButton', tr('Highscores'),
    '/images/topbuttons/tier', toggle)
end

function terminate()
  disconnect(g_game, { onGameEnd = offline })
  ProtocolGame.unregisterExtendedOpcode(OPCODE)
  destroyWindow()
  if topButton then topButton:destroy() end
end

function offline()
  destroyWindow()
end

function toggle()
  if window then
    destroyWindow()
    return
  end

  window = g_ui.displayUI('highscore')
  local categoryList = window:getChildById('categoryList')
  categoryButtons = {}
  for _, cat in ipairs(CATEGORIES) do
    local btn = g_ui.createWidget('HighscoreCategoryButton', categoryList)
    btn:setText(cat.name)
    btn.categoryId = cat.id
    btn.onClick = function()
      selectCategory(cat.id)
    end
    categoryButtons[cat.id] = btn
  end

  selectCategory(currentCategory)
end

function destroyWindow()
  if window then
    window:destroy()
    window = nil
  end
  categoryButtons = {}
end

function selectCategory(categoryId)
  currentCategory = categoryId
  currentPage = 1

  for id, btn in pairs(categoryButtons) do
    btn:setOn(id == categoryId)
  end

  if window then
    local cat = CATEGORIES[categoryId + 1]
    window:getChildById('titleLabel'):setText(cat and cat.name or '')
  end

  requestPage()
end

function requestPage()
  local pg = g_game.getProtocolGame()
  if not pg then return end

  local payload = json.encode({
    action = 'request',
    category = currentCategory,
    page = currentPage,
    entriesPerPage = 15,
    type = 0,
  })
  pg:sendExtendedOpcode(OPCODE, payload)
end

function previousPage()
  if currentPage > 1 then
    currentPage = currentPage - 1
    requestPage()
  end
end

function nextPage()
  if currentPage < totalPages then
    currentPage = currentPage + 1
    requestPage()
  end
end

function onOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then return end
  if not buffer or buffer == '' then return end

  local ok, data = pcall(json.decode, buffer)
  if not ok or type(data) ~= 'table' or data.action ~= 'highscore' then return end
  if not window or data.category ~= currentCategory then return end

  currentPage = data.page or 1
  totalPages = data.pages or 1
  window:getChildById('pageLabel'):setText('Page ' .. currentPage .. ' / ' .. totalPages)

  local resultList = window:getChildById('resultList')
  resultList:destroyChildren()

  for _, entry in ipairs(data.data or {}) do
    local row = g_ui.createWidget('HighscoreRow', resultList)
    local vocName = VOCATION_NAMES[entry.vocation] or 'None'
    local onlineMark = (entry.online == 1) and '*' or ' '
    row:setText(string.format('%-4d %s%-24s %-18s %d',
      entry.rank or 0, onlineMark, entry.name or '', vocName, entry.experience or 0))
    if entry.online == 1 then
      row:setColor('#55ff55')
    end
  end
end
