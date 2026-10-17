dofile('data/lib/autoloot_lib.lua')

function onSay(cid, words, param, channel)
	doPlayerSendCancel(cid, "DEBUG: autoloot onSay triggered! param=[" .. tostring(param) .. "]")
	return true
end
