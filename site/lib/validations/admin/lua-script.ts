import { z } from "zod";

/** Pastas de scripts do OTServer (`data/{category}/scripts/*.lua`). */
export const LUA_SCRIPT_CATEGORIES = [
  "actions",
  "creaturescripts",
  "globalevents",
  "lib",
  "movements",
  "npc",
  "raids",
  "spells",
  "talkactions",
  "weapons",
  "mods",
] as const;
export type LuaScriptCategory = (typeof LUA_SCRIPT_CATEGORIES)[number];

export const luaScriptSchema = z.object({
  name: z.string().min(1, "Informe o nome do arquivo").max(255),
  category: z.enum(LUA_SCRIPT_CATEGORIES, {
    message: "Selecione a categoria (pasta de scripts)",
  }),
  content: z.string(),
});

export type LuaScriptInput = z.infer<typeof luaScriptSchema>;

export const defaultLuaScriptValues: LuaScriptInput = {
  name: "",
  category: "actions",
  content: "",
};
