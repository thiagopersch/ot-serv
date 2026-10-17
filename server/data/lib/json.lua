--
-- json.lua
--
-- Copyright (c) 2020 rxi
--
-- Permission is hereby granted, free of charge, to any person obtaining a copy of
-- this software and associated documentation files (the "Software"), to deal in
-- the Software without restriction, including without limitation the rights to
-- use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
-- of the Software, and to permit persons to whom the Software is furnished to do
-- so, subject to the following conditions:
--
-- The above copyright notice and this permission notice shall be included in all
-- copies or substantial portions of the Software.
--
-- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-- IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
-- SOFTWARE.
--

local json = { _version = "0.1.2" }

-------------------------------------------------------------------------------
-- Encode
-------------------------------------------------------------------------------

local encode

local escape_char_map = {
  [ "\\" ] = "\\\\",
  [ "\"" ] = "\\\"",
  [ "\b" ] = "\\b",
  [ "\f" ] = "\\f",
  [ "\n" ] = "\\n",
  [ "\r" ] = "\\r",
  [ "\t" ] = "\\t",
}

local escape_char_map_inv = { [ "\\/" ] = "/" }
for k, v in pairs(escape_char_map) do escape_char_map_inv[v] = k end


local function escape_char(c)
  return escape_char_map[c] or string.format("\\u%04x", string.byte(c))
end


local function encode_nil(val)
  return "null"
end


local function encode_table(val, stack)
  local res = {}
  stack = stack or {}

  -- Circular reference check
  if stack[val] then error("circular reference") end

  stack[val] = true

  if rawget(val, 1) ~= nil or next(val) == nil then
    -- Treat as array -- check keys are valid and it is not sparse
    local n = 0
    for k in pairs(val) do
      if type(k) ~= "number" then
        n = -1
        break
      end
      n = n + 1
    end
    if n == #val then
      for i, v in ipairs(val) do
        table.insert(res, encode(v, stack))
      end
      stack[val] = nil
      return "[" .. table.concat(res, ",") .. "]"
    end
  end

  -- Treat as object
  for k, v in pairs(val) do
    if type(k) ~= "string" then
      error("invalid table key type (string expected, got " .. type(k) .. ")")
    end
    table.insert(res, encode(k, stack) .. ":" .. encode(v, stack))
  end

  stack[val] = nil
  return "{" .. table.concat(res, ",") .. "}"
end


local function encode_string(val)
  return '"' .. val:gsub('[%z\1-\31\\"]', escape_char) .. '"'
end


local function encode_number(val)
  -- Check for NaN, -inf and inf
  if val ~= val or val <= -math.huge or val >= math.huge then
    error("unexpected number value '" .. tostring(val) .. "'")
  end
  return string.format("%.14g", val)
end


local type_func_map = {
  [ "nil"     ] = encode_nil,
  [ "table"   ] = encode_table,
  [ "string"  ] = encode_string,
  [ "number"  ] = encode_number,
  [ "boolean" ] = tostring,
}


encode = function(val, stack)
  local t = type(val)
  local f = type_func_map[t]
  if f then
    return f(val, stack)
  end
  error("unexpected type '" .. t .. "'")
end


function json.encode(val)
  return ( encode(val) )
end


-------------------------------------------------------------------------------
-- Decode
-------------------------------------------------------------------------------

local parse

local function create_set(...)
  local res = {}
  for i = 1, select("#", ...) do
    res[ select(i, ...) ] = true
  end
  return res
end

local space_chars   = create_set(" ", "\t", "\r", "\n")
local delim_chars    = create_set(" ", "\t", "\r", "\n", "]", "}", ",")
local escape_chars   = create_set("\\", "/", "\"", "b", "f", "n", "r", "t", "u")
local literals       = create_set("true", "false", "null")

local literal_map = {
  [ "true"  ] = true,
  [ "false" ] = false,
  [ "null"  ] = nil,
}


local function next_char(str, idx, set, negate)
  for i = idx, #str do
    if set[str:sub(i, i)] ~= negate then
      return i
    end
  end
  return #str + 1
end


local function decode_error(str, idx, msg)
  local line_count = 1
  local col_count = 1
  for i = 1, idx - 1 do
    col_count = col_count + 1
    if str:sub(i, i) == "\n" then
      line_count = line_count + 1
      col_count = 1
    end
  end
  error( string.format("%s at line %d col %d", msg, line_count, col_count) )
end


local function codepoint_to_utf8(n)
  -- http://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=iws-appendixa
  local f = math.floor
  if n <= 0x7f then
    return string.char(n)
  elseif n <= 0x7ff then
    return string.char(f(n / 64) + 192, n % 64 + 128)
  elseif n <= 0xffff then
    return string.char(f(n / 4096) + 224, f(n % 4096 / 64) + 128, n % 64 + 128)
  elseif n <= 0x10ffff then
    return string.char(f(n / 262144) + 240, f(n % 262144 / 4096) + 128,
                       f(n % 4096 / 64) + 128, n % 64 + 128)
  end
  error( string.format("invalid unicode codepoint '%x'", n) )
end


local function parse_unicode_escape(s, idx)
  local n1 = tonumber( s:sub(idx, idx + 3), 16 )
  local n2 = tonumber( s:sub(idx + 6, idx + 9), 16 )
  -- Surrogate pair?
  if n1 and n1 >= 0xd800 and n1 <= 0xdbff and n2 and n2 >= 0xdc00 and n2 <= 0xdfff then
    local n = (n1 - 0xd800) * 0x400 + (n2 - 0xdc00) + 0x10000
    return codepoint_to_utf8(n), idx + 10
  end
  return codepoint_to_utf8(n1), idx + 4
end


local function parse_string(str, idx)
  local res = ""
  local j = idx + 1
  local i = j

  while i <= #str do
    local c = str:sub(i, i)
    if c == "\"" then
      return res .. str:sub(j, i - 1), i + 1
    end
    if c == "\\" then
      res = res .. str:sub(j, i - 1)
      local nextc = str:sub(i + 1, i + 1)
      if nextc == "u" then
        local x, newidx = parse_unicode_escape(str, i + 2)
        res = res .. x
        i = newidx
      else
        if not escape_chars[nextc] then
          decode_error(str, i, "invalid escape char '" .. nextc .. "'")
        end
        res = res .. (escape_char_map_inv[nextc] or nextc)
        i = i + 2
      end
      j = i
    else
      i = i + 1
    end
  end

  decode_error(str, idx, "expected closing quote for string")
end


local function parse_number(str, idx)
  local i = next_char(str, idx, delim_chars)
  local next_str = str:sub(idx, i - 1)
  local res = tonumber(next_str)
  if not res then
    decode_error(str, idx, "invalid number '" .. next_str .. "'")
  end
  return res, i
end


local function parse_literal(str, idx)
  local i = next_char(str, idx, delim_chars)
  local next_str = str:sub(idx, i - 1)
  if not literals[next_str] then
    decode_error(str, idx, "invalid literal '" .. next_str .. "'")
  end
  return literal_map[next_str], i
end


local function parse_array(str, idx)
  local res = {}
  local n = 1
  idx = idx + 1
  while 1 do
    local c
    idx = next_char(str, idx, space_chars, true)
    if str:sub(idx, idx) == "]" then
      idx = idx + 1
      break
    end
    res[n], idx = parse(str, idx)
    n = n + 1
    idx = next_char(str, idx, space_chars, true)
    c = str:sub(idx, idx)
    if c == "]" then
      idx = idx + 1
      break
    end
    if c ~= "," then decode_error(str, idx, "expected ']' or ','") end
    idx = idx + 1
  end
  return res, idx
end


local function parse_object(str, idx)
  local res = {}
  idx = idx + 1
  while 1 do
    local c, key, val
    idx = next_char(str, idx, space_chars, true)
    if str:sub(idx, idx) == "}" then
      idx = idx + 1
      break
    end
    if str:sub(idx, idx) ~= "\"" then
      decode_error(str, idx, "expected string for key")
    end
    key, idx = parse(str, idx)
    idx = next_char(str, idx, space_chars, true)
    if str:sub(idx, idx) ~= ":" then
      decode_error(str, idx, "expected ':' after key")
    end
    idx = next_char(str, idx + 1, space_chars, true)
    val, idx = parse(str, idx)
    res[key] = val
    idx = next_char(str, idx, space_chars, true)
    c = str:sub(idx, idx)
    if c == "}" then
      idx = idx + 1
      break
    end
    if c ~= "," then decode_error(str, idx, "expected '}' or ','") end
    idx = idx + 1
  end
  return res, idx
end


local char_func_map = {
  [ "\"" ] = parse_string,
  [ "0"  ] = parse_number,
  [ "1"  ] = parse_number,
  [ "2"  ] = parse_number,
  [ "3"  ] = parse_number,
  [ "4"  ] = parse_number,
  [ "5"  ] = parse_number,
  [ "6"  ] = parse_number,
  [ "7"  ] = parse_number,
  [ "8"  ] = parse_number,
  [ "9"  ] = parse_number,
  [ "-"  ] = parse_number,
  [ "t"  ] = parse_literal,
  [ "f"  ] = parse_literal,
  [ "n"  ] = parse_literal,
  [ "["  ] = parse_array,
  [ "{"  ] = parse_object,
}


parse = function(str, idx)
  local c = str:sub(idx, idx)
  local f = char_func_map[c]
  if f then
    return f(str, idx)
  end
  decode_error(str, idx, "unexpected character '" .. c .. "'")
end


function json.decode(str)
  if type(str) ~= "string" then
    error("expected argument of type string, got " .. type(str))
  end
  local res, idx = parse(str, next_char(str, 1, space_chars, true))
  idx = next_char(str, idx, space_chars, true)
  if idx <= #str then
    decode_error(str, idx, "trailing garbage")
  end
  return res
end


return json
