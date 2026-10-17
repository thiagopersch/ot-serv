-- Talkaction to open Vocation Change window for testing
dofile("data/lib/change_vocation.lua")

function onTalk(cid, words, param)
    ChangeVocation.open(cid)
    return true
end
