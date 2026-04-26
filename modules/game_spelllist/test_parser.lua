local file = io.open("C:/Users/thiag/Projetos/server-tibia/data/spells/spells.xml", "r")
local content = file:read("*a")
file:close()

content = string.gsub(content, "<!%-%-.-%-%->", "")

local count_spells = 0
local count_vocs = 0

local i = 1
while true do
  local s, e = string.find(content, "<instant", i)
  if not s then break end
  
  local attrEnd = string.find(content, ">", e)
  if not attrEnd then break end
  
  local attributes = string.sub(content, e + 1, attrEnd - 1)
  local isSelfClosing = string.match(attributes, "/%s*$")
  
  local body = ""
  if isSelfClosing then
    attributes = string.gsub(attributes, "/%s*$", "")
    i = attrEnd + 1
  else
    local bodyEndStart, bodyEndEnd = string.find(content, "</%s*instant%s*>", attrEnd)
    if bodyEndStart then
      body = string.sub(content, attrEnd + 1, bodyEndStart - 1)
      i = bodyEndEnd + 1
    else
      break
    end
  end
  
  count_spells = count_spells + 1
  
  local vocations = {}
  for vocIdStr in string.gmatch(body, '<vocation%s+id="(.-)"') do
    table.insert(vocations, vocIdStr)
    count_vocs = count_vocs + 1
  end
end

print("Spells: " .. count_spells)
print("Vocations: " .. count_vocs)
