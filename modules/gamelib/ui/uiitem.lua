-- Raridade de itens: o servidor envia o tier no atributo customizado RARITY_ATTRIBUTE_KEY.
-- As cores padrao sao sobrescritas pelo catalogo do servidor (modulo game_rarity_craft).
RARITY_ATTRIBUTE_KEY = 1
RarityColors = RarityColors or {
  [1] = '#2ECC40', -- Incomum
  [2] = '#2F8CFF', -- Raro
  [3] = '#B04BFF', -- Epico
  [4] = '#FFB000', -- Lendario
  [5] = '#FF2E2E', -- Mitico
}

function getItemRarity(item)
  if not item or not g_game.getFeature(GameItemCustomAttributes) then return 0 end
  return tonumber(item:getCustomAttribute(RARITY_ATTRIBUTE_KEY)) or 0
end

function UIItem:getRarity()
  return getItemRarity(self:getItem())
end

function UIItem:highlightBorder()
  self:setBorderColor('#ffffff')
  self:setBorderWidth(1)
end

-- aplica (ou remove) a borda/fundo da raridade; widgets sem raridade nao sao tocados
function UIItem:updateRarityBorder()
  local rarity = self:getRarity()
  local color = rarity > 0 and RarityColors[rarity]
  if color then
    if not self.rarityOriginal then
      self.rarityOriginal = {
        background = self:getBackgroundColor(),
        borderColor = self:getBorderTopColor(),
        borderWidth = self:getBorderTopWidth(),
      }
    end
    self:setBorderColor(color)
    self:setBorderWidth(1)
    self:setBackgroundColor(color .. '33')
  elseif self.rarityOriginal then
    self:setBackgroundColor(self.rarityOriginal.background)
    self:setBorderColor(self.rarityOriginal.borderColor)
    self:setBorderWidth(self.rarityOriginal.borderWidth)
    self.rarityOriginal = nil
  end
end

-- substitui o antigo setBorderWidth(0) do highlight de arrastar
function UIItem:restoreBorder()
  if self.rarityOriginal or self:getRarity() > 0 then
    self:updateRarityBorder()
  else
    self:setBorderWidth(0)
  end
end

function UIItem:onDragEnter(mousePos)
  if self:isVirtual() then return false end

  local item = self:getItem()
  if not item then return false end

  self:highlightBorder()
  self.currentDragThing = item
  g_mouse.pushCursor('target')
  return true
end

function UIItem:onDragLeave(droppedWidget, mousePos)
  if self:isVirtual() then return false end
  self.currentDragThing = nil
  g_mouse.popCursor('target')
  self:restoreBorder()
  self.hoveredWho = nil
  return true
end

function UIItem:onDrop(widget, mousePos, forced)
  if not self:canAcceptDrop(widget, mousePos) and not forced then return false end

  local item = widget.currentDragThing
  if not item or not item:isItem() then return false end

  if self.selectable then
    if item:isPickupable() then
      self:setItem(Item.create(item:getId(), item:getCountOrSubType()))
      return true
    end
    return false
  end

  local toPos = self.position

  local itemPos = item:getPosition()
  if itemPos.x == toPos.x and itemPos.y == toPos.y and itemPos.z == toPos.z then return false end

  if item:getCount() > 1 then
    modules.game_interface.moveStackableItem(item, toPos)
  else
    g_game.move(item, toPos, 1)
  end

  self:restoreBorder()
  return true
end

function UIItem:onDestroy()
  if self == g_ui.getDraggingWidget() and self.hoveredWho then
    self.hoveredWho:restoreBorder()
  end

  if self.hoveredWho then
    self.hoveredWho = nil
  end
end

function UIItem:onHoverChange(hovered)
  --print("DBG onHoverChange widget=", self:getId() or "no-id", "hovered=", hovered, "tooltip=", self.tooltip)
  UIWidget.onHoverChange(self, hovered)

  if self:isVirtual() or not self:isDraggable() then return end

  local draggingWidget = g_ui.getDraggingWidget()
  if draggingWidget and self ~= draggingWidget then
    local gotMap = draggingWidget:getClassName() == 'UIGameMap'
    local gotItem = draggingWidget:getClassName() == 'UIItem' and not draggingWidget:isVirtual()
    if hovered and (gotItem or gotMap) then
      self:highlightBorder()
      draggingWidget.hoveredWho = self
    else
      self:restoreBorder()
      draggingWidget.hoveredWho = nil
    end
  end
end

function UIItem:onMouseRelease(mousePosition, mouseButton)
  if self.cancelNextRelease then
    self.cancelNextRelease = false
    return true
  end

  if self:isVirtual() then return false end

  local item = self:getItem()
  if not item or not self:containsPoint(mousePosition) then return false end

  if modules.client_options.getOption('classicControl') and not g_app.isMobile() and
      ((g_mouse.isPressed(MouseLeftButton) and mouseButton == MouseRightButton) or
        (g_mouse.isPressed(MouseRightButton) and mouseButton == MouseLeftButton)) then
    g_game.look(item)
    self.cancelNextRelease = true
    return true
  elseif modules.game_interface.processMouseAction(mousePosition, mouseButton, nil, item, item, nil, nil) then
    self:onHoverChange(false)
    return true
  end
  return false
end

function UIItem:canAcceptDrop(widget, mousePos)
  if not self.selectable and (self:isVirtual() or not self:isDraggable()) then return false end
  if not widget or not widget.currentDragThing then return false end

  local children = rootWidget:recursiveGetChildrenByPos(mousePos)
  for i = 1, #children do
    local child = children[i]
    if child == self then
      return true
    elseif not child:isPhantom() then
      return false
    end
  end

  error('Widget ' .. self:getId() .. ' not in drop list.')
  return false
end

function UIItem:onClick(mousePos)
  if not self.selectable or not self.editable then
    return
  end

  if modules.game_itemselector then
    modules.game_itemselector.show(self)
  end
end

function UIItem:onItemChange()
  local tooltip = nil
  if self:getItem() and self:getItem():getTooltip():len() > 0 then
    tooltip = self:getItem():getTooltip()
  end
  --print("DBG onItemChange widget=", self:getId() or "no-id", "item=", self:getItem() and self:getItem():getId() or "nil", "tooltip=", tooltip, "hovered=", self:isHovered())
  self:setTooltip(tooltip)
  self:updateRarityBorder()

  if self:isHovered() and tooltip then
    g_tooltip.display(tooltip)
  end
end
