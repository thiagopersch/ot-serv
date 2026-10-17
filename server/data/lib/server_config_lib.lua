-- Leitura da tabela genérica `server_config` (mesma tabela que o engine usa para
-- versionamento de schema — ver databasemanager.cpp) para configurações administráveis
-- feitas pelo portal em `/admin/settings` (lib/server-config.ts no lado do portal).
ServerConfigLib = ServerConfigLib or {}

function ServerConfigLib.getValue(key, fallback)
    local resultId = db.getResult("SELECT `value` FROM `server_config` WHERE `config` = " .. db.escapeString(key))
    if resultId == -1 then return fallback end

    local value = result.getDataString(resultId, "value")
    result.free(resultId)
    return value ~= "" and value or fallback
end

function ServerConfigLib.getNumber(key, fallback)
    return tonumber(ServerConfigLib.getValue(key, tostring(fallback))) or fallback
end

-- Mesmas chaves de lib/server-config.ts (SKILL_CAP_DODGE_KEY / SKILL_CAP_CRITICAL_KEY).
ServerConfigLib.SKILL_CAP_DODGE_KEY = "skill_cap_dodge"
ServerConfigLib.SKILL_CAP_CRITICAL_KEY = "skill_cap_critical"

function ServerConfigLib.getDodgeCap()
    return ServerConfigLib.getNumber(ServerConfigLib.SKILL_CAP_DODGE_KEY, 1000)
end

function ServerConfigLib.getCriticalCap()
    return ServerConfigLib.getNumber(ServerConfigLib.SKILL_CAP_CRITICAL_KEY, 1000)
end
