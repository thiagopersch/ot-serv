/**
 * Rótulo amigável por segmento de rota admin (`/api/admin/<segmento>/...`), reaproveitando
 * os nomes já usados em `components/admin/admin-sidebar.tsx`. Usado para preencher o campo
 * "página" da auditoria a partir da rota da API que gerou o log.
 */
const ROUTE_LABELS: Record<string, string> = {
  accounts: "Contas",
  players: "Jogadores",
  bans: "Banimentos",
  guilds: "Guilds",
  houses: "Houses",
  vocations: "Vocações",
  "vocation-archetypes": "Arquétipos de vocação",
  tilesets: "Tilesets",
  doodads: "Doodads",
  walls: "Walls",
  borders: "Borders",
  grounds: "Grounds",
  monsters: "Monstros",
  "monster-boost": "Monstros impulsionados",
  npcs: "NPCs",
  items: "Items",
  movements: "Movements",
  "lua-scripts": "Scripts Lua",
  looktypes: "Looktypes",
  "custom-outfits": "Outfits customizados",
  outfits: "Outfits",
  extoutfits: "Extoutfits",
  spells: "Spells",
  lottery: "Loteria",
  "daily-rewards": "Recompensas diárias",
  donations: "Doações",
  quests: "Quests",
  tasks: "Tasks",
  categories: "Categorias",
  "autoloot-items": "Autoloot",
  "battle-pass": "Battle Pass",
  chests: "Baús",
  posts: "Posts",
  tickets: "Tickets",
  "audit-logs": "Auditoria",
  universes: "Universos",
  towns: "Towns",
  images: "Imagens",
  "skill-caps": "Limites de skill",
};

function humanizeSegment(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Extrai o segmento relevante de uma rota `/api/admin/<segmento>/...` e devolve o rótulo
 * amigável correspondente. Rotas fora de `/api/admin` ou sem segmento mapeado caem no
 * fallback humanizado do próprio segmento.
 */
export function getPageNameForRoute(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const adminIndex = segments.indexOf("admin");
  const segment = adminIndex >= 0 ? segments[adminIndex + 1] : segments[segments.length - 1];

  if (!segment) return pathname;

  return ROUTE_LABELS[segment] ?? humanizeSegment(segment);
}
