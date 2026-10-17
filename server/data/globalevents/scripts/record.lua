function onRecord(current, old, cid)
    db.query("INSERT INTO `server_record` (`record`, `world_id`, `timestamp`) VALUES (" ..
        current .. ", " .. getConfigValue('worldId') .. ", " .. os.time() .. ");")
    local msg = "..:: New record ::..\nNew record: " .. current .. " players are logged in."
    local formattedText = "center|" .. TEXTCOLOR_GREEN .. "|" .. msg

    addEvent(doBroadcastMessage, 21, formattedText)
end
