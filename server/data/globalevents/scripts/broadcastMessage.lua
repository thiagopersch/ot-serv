CONFIG = {
    [1] = {
        message =
        "..:: Dragon Ball TV ::..\nTo transform, simply say !transform or /transform.",
        color = TEXTCOLOR_WHITE
    },
    [2] = {
        message =
        "..:: Dragon Ball TV ::..\nTo see the commands, type /commands.",
        color = TEXTCOLOR_WHITE
    },
    [3] = {
        message =
            "To check your bank balance, type !balance. To deposit, type '!deposit value/all' and to withdraw, type '!withdraw value/all'.\nOr use our shortcuts: "
            .. "Right-click on your character and then select the 'My Bank' option from the menu.",
        color = TEXTCOLOR_BLUE

    },
    [4] = {
        message =
        'You can view your profile by clicking on your character and selecting the "Profile" option. Likewise, you can also view other players profiles by following the same procedure.',
        color = TEXTCOLOR_ORANGE
    }
}


function onThink()
    local getRandom = math.random(1, #CONFIG)
    local msg = CONFIG[getRandom].message
    local color = CONFIG[getRandom].color
    local formattedText = "top|" .. color .. "|" .. msg
    return doBroadcastMessage(formattedText)
end
