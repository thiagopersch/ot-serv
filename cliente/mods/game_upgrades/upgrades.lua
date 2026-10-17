local UPGRADES_CODE = 125
local upgradesWindow = nil
local upgradesOffersGrid = nil
local upgradesMsgWindow = nil
local upgradesButton = nil

local upgradeCategories = nil
local upgradeOffers = {}

local selectedUpgradeOffer = nil

function init()
  connect(
    g_game,
    {
      onGameStart = createUpgradesWindow,
      onGameEnd = destroyUpgradesWindow
    }
  )

  ProtocolGame.registerExtendedOpcode(UPGRADES_CODE, onUpgradesExtendedOpcode)

  if g_game.isOnline() then
    createUpgradesWindow()
  end
end

function terminate()
  disconnect(
    g_game,
    {
      onGameStart = createUpgradesWindow,
      onGameEnd = destroyUpgradesWindow
    }
  )

  ProtocolGame.unregisterExtendedOpcode(UPGRADES_CODE)

  destroyUpgradesWindow()
end

function onUpgradesExtendedOpcode(protocol, code, buffer)
  local json_status, json_data =
    pcall(
    function()
      return json.decode(buffer)
    end
  )
  if not json_status then
    g_logger.error("UPGRADES json error: " .. json_data)
    return false
  end

  local action = json_data["action"]
  local data = json_data["data"]
  if not action or not data then
    return false
  end

  -- Log received actions for debugging
  g_logger.debug("UPGRADES received action: " .. action)

  if action == "fetchBase" then
    onUpgradesFetchBase(data)
  elseif action == "fetchOffers" then
    onUpgradesFetchOffers(data)
  elseif action == "upgrade_points" then
    onUpgradesUpdatePoints(data)
  elseif action == "msg" then
    onUpgradesMsg(data)
  elseif action == "refresh_offers" then
    onUpgradesRefreshOffers(data)
  end
end

function createUpgradesWindow()
  if upgradesWindow then
    return
  end
  upgradesWindow = g_ui.displayUI("upgrades")
  upgradesWindow:hide()

  upgradesButton = modules.client_topmenu.addRightGameToggleButton("upgradesButton", tr("Upgrades"), "/images/topbuttons/particles", toggleUpgrades, true)

  connect(upgradesWindow:getChildById("categories"), {onChildFocusChange = changeUpgradeCategory})
  connect(upgradesWindow:getChildById("offers"), {onChildFocusChange = upgradeOfferFocus})

  local protocolGame = g_game.getProtocolGame()
  if protocolGame then
    protocolGame:sendExtendedOpcode(UPGRADES_CODE, json.encode({action = "fetch", data = {}}))
  end
end

function destroyUpgradesWindow()
  if upgradesButton then
    upgradesButton:destroy()
    upgradesButton = nil
  end

  if upgradesWindow then
    disconnect(upgradesWindow:getChildById("categories"), {onChildFocusChange = changeUpgradeCategory})
    disconnect(upgradesWindow:getChildById("offers"), {onChildFocusChange = upgradeOfferFocus})
    upgradesOffersGrid = nil
    upgradesWindow:destroy()
    upgradesWindow = nil
  end

  if upgradesMsgWindow then
    upgradesMsgWindow:destroy()
    upgradesMsgWindow = nil
  end
end

function onUpgradesFetchBase(data)
  upgradeCategories = data.categories
  for i = 1, #upgradeCategories do
    addUpgradeCategory(upgradeCategories[i], i == 1)
  end
end

function onUpgradesFetchOffers(data)
  upgradeOffers[data.category] = data.offers

  -- Process custom image files - handle both cases: either imageFile is set directly or upgradeType with clientId=0
  for i, offer in ipairs(data.offers) do
    if offer.imageFile then
      -- Image file property is already set
    elseif offer.clientId == 0 and offer.upgradeType then
      offer.imageFile = offer.upgradeType
    end
  end

  -- If this is for the currently selected category, refresh the display
  local currentCategory = nil
  if upgradesWindow and upgradesWindow:isVisible() then
    local categoriesPanel = upgradesWindow:getChildById("categories")
    if categoriesPanel and categoriesPanel:getFocusedChild() then
      currentCategory = categoriesPanel:getFocusedChild():getId()
    end
  end

  -- Initialize offers for Mining category first time
  if data.category == "Mining" and not upgradesOffersGrid then
    upgradesOffersGrid = upgradesWindow:recursiveGetChildById("offers")
    addUpgradeOffers(upgradeOffers)
    upgradesWindow:getChildById("categories"):getChildByIndex(1):focus()
  -- Refresh current category if needed
  elseif data.category == currentCategory and upgradesOffersGrid then
    upgradesOffersGrid:destroyChildren()
    addUpgradeOffers(upgradeOffers[currentCategory])
  end
end

function onUpgradesUpdatePoints(data)
  -- Find the points info bar elements
  local totalPointsValue = upgradesWindow:recursiveGetChildById("totalPointsValue")
  local spendablePointsValue = upgradesWindow:recursiveGetChildById("spendablePointsValue")

  -- Create or update the item widget for points icon (kept for compatibility)
  local pointsIcon = upgradesWindow:recursiveGetChildById("pointsIcon")
  if not pointsIcon then
    local infoPanel = upgradesWindow:getChildById("infoPanel")
    pointsIcon = g_ui.createWidget("UIItem", infoPanel)
    pointsIcon:setId("pointsIcon")
    pointsIcon:setItemId(3249) -- Star points item
    pointsIcon:setMarginLeft(5)
    pointsIcon:setMarginTop(20)
    pointsIcon:setSize({width = 32, height = 32})
  end

  -- Check if we received a table with both types of points
  if type(data) == "table" and data.total ~= nil and data.spendable ~= nil then
    -- Format both point values
    local totalValue = comma_value(data.total)
    local spendableValue = comma_value(data.spendable)

    -- Update the new points display bar
    totalPointsValue:setText(totalValue)
    spendablePointsValue:setText(spendableValue)

    -- Keep the old display updated too for backward compatibility
    local pointsWidget = upgradesWindow:recursiveGetChildById("upgradePoints")
    if pointsWidget then
      pointsWidget:setText(spendableValue .. " / " .. totalValue)
      pointsWidget:setMarginLeft(40)
      pointsWidget:setMarginTop(27)
      pointsWidget:setTextAlign(AlignLeft)
      pointsWidget:setFont("verdana-11px-rounded")
    end
  else
    -- Fallback to the old method showing just one value
    local pointsValue = comma_value(data)

    -- For backward compatibility, show the same value in both fields
    totalPointsValue:setText(pointsValue)
    spendablePointsValue:setText(pointsValue)

    -- Keep the old display updated too
    local pointsWidget = upgradesWindow:recursiveGetChildById("upgradePoints")
    if pointsWidget then
      pointsWidget:setText(pointsValue)
      pointsWidget:setMarginLeft(40)
      pointsWidget:setMarginTop(27)
      pointsWidget:setTextAlign(AlignLeft)
      pointsWidget:setFont("verdana-11px-rounded")
    end
  end
end

function purchaseUpgrade()
  if not selectedUpgradeOffer then
    displayInfoBox("Error", "Something went wrong, make sure to select category and upgrade.")
    return
  end

  -- Store the current category
  local currentCategory = upgradesWindow:getChildById("categories"):getFocusedChild():getId()
  selectedUpgradeOffer.savedCategory = currentCategory

  -- Send purchase request directly without confirmation dialog
  local protocolGame = g_game.getProtocolGame()
  if protocolGame then
    protocolGame:sendExtendedOpcode(UPGRADES_CODE, json.encode({action = "purchase", data = selectedUpgradeOffer}))
  end
end

function onUpgradesMsg(data)
  local type = data.type
  local text = data.msg

  -- If it's a success message from a purchase, we refresh the offers
  if type == "info" and text:find("You've purchased") then
    -- Request a refresh of the current category to update prices after successful purchase
    local currentCategory = upgradesWindow:getChildById("categories"):getFocusedChild():getId()
    local protocolGame = g_game.getProtocolGame()
    if protocolGame then
      protocolGame:sendExtendedOpcode(UPGRADES_CODE, json.encode({
        action = "fetch_category",
        data = {category = currentCategory}
      }))
    end
  end

  -- Handle UI state changes if needed
  if (type == "info" and data.close) or type == "error" then
    upgradesWindow:getChildById("purchaseButton"):disable()
    upgradesWindow:getChildById("offers"):focusChild(nil)

    -- Add slight delay before hiding to allow server to send updated offers
    scheduleEvent(function()
      hideUpgradesWindow()
    end, 650)
  end
end

function changeUpgradeCategory(widget, newCategory)
  if not newCategory then
    return
  end

  local id = newCategory:getId()

  -- Make sure the grid exists before trying to clear it
  if not upgradesOffersGrid then
    upgradesOffersGrid = upgradesWindow:recursiveGetChildById("offers")
  end

  -- Clear existing offers
  upgradesOffersGrid:destroyChildren()

  -- Check if we have offers for this category
  if upgradeOffers[id] then
    addUpgradeOffers(upgradeOffers[id])
  else
    -- If we don't have offers, request them from the server
    local protocolGame = g_game.getProtocolGame()
    if protocolGame then
      protocolGame:sendExtendedOpcode(UPGRADES_CODE, json.encode({
        action = "fetch_category",
        data = {category = id}
      }))
    end
  end

  local category = nil
  for i = 1, #upgradeCategories do
    if upgradeCategories[i].title == id then
      category = upgradeCategories[i]
      break
    end
  end

  if category then
    updateUpgradesTopPanel(category)
    upgradesWindow:getChildById("purchaseButton"):disable()
    upgradesWindow:getChildById("search"):setText("")
  end
end

function upgradeOfferFocus(widget, offerWidget)
  -- Reset all level label colors first
  local children = upgradesOffersGrid:getChildCount()
  for i = 1, children do
    local child = upgradesOffersGrid:getChildByIndex(i)
    if child:getChildById("levelLabel") then
      child:getChildById("levelLabel"):setColor("#FFFFFF")
    end
  end

  if offerWidget then
    local category = upgradesWindow:getChildById("categories"):getFocusedChild():getChildById("name"):getText()
    local title = offerWidget:getChildById("offerNameHidden"):getText()
    local priceLabel = offerWidget:getChildById("offerPrice"):getText()
    local price = priceLabel:split(" upgrade points")[1]:gsub("%,", "")
    local goldCostLabel = offerWidget:getChildById("goldCost"):getText()
    local goldCost = goldCostLabel:split(" gold")[1]:gsub("%,", "")

    -- Highlight the currently selected offer
    offerWidget:getChildById("levelLabel"):setColor("#FFFF00")

    selectedUpgradeOffer = {
      category = category,
      title = title,
      price = tonumber(price),
      goldCost = tonumber(goldCost),
      upgradeType = offerWidget:getChildById("upgradeType"):getText()
    }
    upgradesWindow:getChildById("purchaseButton"):enable()
  end
end

function purchaseUpgradeDouble(offerWidget)
  if offerWidget and offerWidget:isFocused() then
    local category = upgradesWindow:getChildById("categories"):getFocusedChild():getChildById("name"):getText()
    local title = offerWidget:getChildById("offerNameHidden"):getText()
    local priceLabel = offerWidget:getChildById("offerPrice"):getText()
    local price = priceLabel:split(" upgrade points")[1]:gsub("%,", "")
    local goldCostLabel = offerWidget:getChildById("goldCost"):getText()
    local goldCost = goldCostLabel:split(" gold")[1]:gsub("%,", "")
    selectedUpgradeOffer = {
      category = category,
      title = title,
      price = tonumber(price),
      goldCost = tonumber(goldCost),
      clientId = tonumber(offerWidget:getId()),
      upgradeType = offerWidget:getChildById("upgradeType"):getText()
    }
    upgradesWindow:getChildById("purchaseButton"):enable()
    purchaseUpgrade()
  end
end

function addUpgradeCategory(data, first)
  local category = g_ui.createWidget("UpgradeCategory", upgradesWindow:getChildById("categories"))
  category:setId(data.title)
  category:getChildById("name"):setText(data.title)

  if first then
    updateUpgradesTopPanel(data)
  end
end

function addUpgradeOffers(offerData)
  -- Make sure we have data to display
  if not offerData or type(offerData) ~= "table" then
    return
  end

  -- Clear any existing offers if needed
  if upgradesOffersGrid:getChildCount() > 0 then
    upgradesOffersGrid:destroyChildren()
  end

  -- Add each offer to the grid
  for i = 1, #offerData do
    local offer = offerData[i]
    local panel = g_ui.createWidget("UpgradeOfferWidget")
    panel:setTooltip(offer.description)

    local nameHidden = panel:recursiveGetChildById("offerNameHidden")
    local upgradeType = g_ui.createWidget("Label", panel)
    upgradeType:setId("upgradeType")
    upgradeType:setText(offer.upgradeType)
    upgradeType:hide()

    -- Set the level label
    local levelLabel = panel:recursiveGetChildById("levelLabel")
    local currentLevel = offer.currentLevel or 0
    levelLabel:setText("Level " .. currentLevel)

    -- Make the title just the base name without the level
    local baseName = offer.title:match("(.+) %(Level")
    if baseName and baseName:len() > 20 then
      local shorter = baseName:sub(1, 20) .. "..."
      panel:setText(shorter)
    else
      panel:setText(baseName or offer.title)
    end
    nameHidden:setText(offer.title)

    local priceLabel = panel:recursiveGetChildById("offerPrice")
    local price = comma_value(offer.price)
    priceLabel:setText(string.format(priceLabel.baseText, price))

    local goldCost = panel:recursiveGetChildById("goldCost")
    goldCost:setText(comma_value(offer.goldCost) .. " gold")

    local offerTypePanel = panel:getChildById("offerTypePanel")

    -- Check if this is a custom image upgrade
    if offer.imageFile then
      -- Create a UIWidget for the custom image
      local offerIcon = g_ui.createWidget("UpgradeIconImage", offerTypePanel)
      offerIcon:setId("offerIcon")
      -- Set the appropriate image path
      offerIcon:setImageSource("/mods/game_upgrades/ui/" .. offer.imageFile .. ".png")
      offerIcon:setPhantom(true)
    elseif offer.type == "upgrade" then
      local offerIcon = g_ui.createWidget("UpgradeIconItem", offerTypePanel)
      offerIcon:setItemId(offer.clientId)
      if offer.count and offer.count > 0 then
        offerIcon:setItemCount(offer.count)
      end
    end

    upgradesOffersGrid:addChild(panel)
  end

  -- Reset selection
  selectedUpgradeOffer = nil
  upgradesWindow:getChildById("purchaseButton"):disable()
end

function updateUpgradesTopPanel(data)
  local topPanel = upgradesWindow:getChildById("topPanel")
  local categoryItemBg = topPanel:getChildById("categoryItemBg")
  categoryItemBg:destroyChildren()
  if data.iconType == "sprite" then
    local spriteIcon = g_ui.createWidget("UpgradeCategoryIconSprite", categoryItemBg)
    spriteIcon:setSpriteId(data.iconData)
  elseif data.iconType == "item" then
    local spriteIcon = g_ui.createWidget("UpgradeCategoryIconItem", categoryItemBg)
    spriteIcon:setItemId(data.iconData)
  elseif data.iconType == "creature" then
    local spriteIcon = g_ui.createWidget("UpgradeCategoryIconCreature", categoryItemBg)
    spriteIcon:setOutfit(data.iconData)
  end

  topPanel:getChildById("selectedCategory"):setText(data.title)
  topPanel:getChildById("categoryDescription"):setText(data.description)
end

function onUpgradeSearch()
  scheduleEvent(
    function()
      local searchWidget = upgradesWindow:getChildById("search")
      local text = searchWidget:getText()
      if text:len() >= 1 then
        local children = upgradesOffersGrid:getChildCount()
        for i = 1, children do
          local child = upgradesOffersGrid:getChildByIndex(i)
          local offerName = child:getChildById("offerNameHidden"):getText():lower()
          if offerName:find(text) then
            child:show()
          else
            child:hide()
          end
        end
      else
        local children = upgradesOffersGrid:getChildCount()
        for i = 1, children do
          local child = upgradesOffersGrid:getChildByIndex(i)
          child:show()
        end
      end
    end,
    50
  )
end

function toggleUpgrades()
  if not upgradesWindow then
    return
  end
  if upgradesWindow:isVisible() then
    return hideUpgradesWindow()
  end
  showUpgradesWindow()
end

function showUpgradesWindow()
  if not upgradesWindow or not upgradesButton then
    return
  end

  -- First focus the category
  local categoriesPanel = upgradesWindow:getChildById("categories")
  if categoriesPanel and categoriesPanel:getChildCount() > 0 then
    categoriesPanel:getChildByIndex(1):focus()

    -- Get the current focused category
    local focusedChild = categoriesPanel:getFocusedChild()
    if focusedChild then
      local categoryId = focusedChild:getId()

      -- Request a fresh update of this category's offers when opening the window
      local protocolGame = g_game.getProtocolGame()
      if protocolGame then
        protocolGame:sendExtendedOpcode(UPGRADES_CODE, json.encode({
          action = "fetch_category",
          data = {category = categoryId}
        }))
      end
    end
  end

  -- Show the window
  upgradesWindow:show()
  upgradesWindow:raise()
  upgradesWindow:focus()
end

function hideUpgradesWindow()
  if not upgradesWindow then
    return
  end
  upgradesWindow:hide()
end

function onUpgradesRefreshOffers(data)
  -- Log for debugging
  g_logger.debug("Refreshing offers for category: " .. data.category)

  -- Update stored offers data with new data
  upgradeOffers[data.category] = data.offers

  -- Process custom image files - handle both cases: either imageFile is set directly or upgradeType with clientId=0
  for i, offer in ipairs(data.offers) do
    if offer.imageFile then
      -- Image file property is already set
    elseif offer.clientId == 0 and offer.upgradeType then
      offer.imageFile = offer.upgradeType
    end
  end

  -- If category is currently displayed, refresh the view
  local currentCategory = nil
  if upgradesWindow and upgradesWindow:isVisible() then
    local categoriesPanel = upgradesWindow:getChildById("categories")
    if categoriesPanel and categoriesPanel:getFocusedChild() then
      currentCategory = categoriesPanel:getFocusedChild():getId()

      -- Make sure the grid exists
      if not upgradesOffersGrid then
        upgradesOffersGrid = upgradesWindow:recursiveGetChildById("offers")
      end

      if data.category == currentCategory and upgradesOffersGrid then
        -- Log the refresh to help debug
        g_logger.info("Refreshing upgrades display for category: " .. currentCategory)

        -- Clear and rebuild the offers grid
        upgradesOffersGrid:destroyChildren()
        addUpgradeOffers(upgradeOffers[currentCategory])

        -- Clear selection after refresh
        selectedUpgradeOffer = nil
        upgradesWindow:getChildById("purchaseButton"):disable()
      end
    end
  end
end

function comma_value(n)
  if n == nil then
    return "0"
  end

  -- Convert to string if it's a number
  local str_n = tostring(n)

  -- Apply the comma formatting
  local left, num, right = string.match(str_n, "^([^%d]*%d)(%d*)(.-)$")
  if left and num then
    return left .. (num:reverse():gsub("(%d%d%d)", "%1,"):reverse()) .. right
  else
    return str_n
  end
end
