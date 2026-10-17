export type AccountGroup = { id: number; name: string };

// Espelha os <group> do groups.xml do OTServer.
export const ACCOUNT_GROUPS: AccountGroup[] = [
  { id: 1, name: "Player" },
  { id: 2, name: "Tutor" },
  { id: 3, name: "Gamemaster" },
  { id: 4, name: "Super Gamemaster" },
  { id: 5, name: "Administrador" },
  { id: 6, name: "Super Administrador" },
];

export function getAccountGroupName(id: number): string {
  return ACCOUNT_GROUPS.find((group) => group.id === id)?.name ?? String(id);
}
