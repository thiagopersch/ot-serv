export type NavLink = {
  label: string;
  href: string;
};

export type NavItem = {
  label: string;
  href?: string;
  children?: NavLink[];
};

export const navMenu: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Downloads', href: '/downloads' },
  { label: 'Regras', href: '/rules' },
  {
    label: 'Comunidade',
    children: [
      { label: 'Buscar jogador', href: '/community/characters' },
      { label: 'Guilds', href: '/community/guilds' },
      { label: 'Ranking', href: '/community/ranking' },
      { label: 'Quem está online?', href: '/community/online' },
      { label: 'Quem está ao vivo?', href: '/community/cast' },
      { label: 'Últimas mortes', href: '/community/deaths' },
    ],
  },
  {
    label: 'Gameplay',
    children: [
      { label: 'Sistemas', href: '/gameplay/systems' },
      { label: 'Eventos', href: '/gameplay/events' },
      { label: 'Quests', href: '/gameplay/quests' },
      { label: 'Raids', href: '/gameplay/raids' },
      { label: 'Tarefas (Tasks)', href: '/gameplay/tasks' },
      { label: 'Missões', href: '/gameplay/missions' },
      { label: 'Itens', href: '/gameplay/items' },
      { label: 'Monstros', href: '/gameplay/monsters' },
      { label: 'Técnicas/Habilidades', href: '/gameplay/spells' },
      { label: 'Vocações', href: '/gameplay/vocations' },
      { label: 'Cidades/Locais', href: '/gameplay/towns' },
    ],
  },
  {
    label: 'Suporte',
    children: [
      { label: 'Abrir ticket', href: '/support/new' },
      { label: 'Meus tickets', href: '/support/tickets' },
    ],
  },
  {
    label: 'Loja',
    children: [
      { label: 'Vitrine', href: '/shop/store' },
      { label: 'Bazar', href: '/shop/bazar' },
      { label: 'Comprar pontos', href: '/shop/donate' },
      { label: 'Mercado', href: '/shop/market' },
    ],
  },
];

export const accountMenu: NavLink[] = [
  { label: 'Login', href: '/login' },
  { label: 'Cadastro', href: '/register' },
  { label: 'Recuperação de conta', href: '/recover' },
];
