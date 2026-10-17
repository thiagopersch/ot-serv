/** Gera um nome único incrementando "(cópia)" / "(cópia 2)" / ... até `exists` retornar false. */
export async function uniqueCopyName(
  baseName: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let candidate = `${baseName} (cópia)`;
  let attempt = 2;

  while (await exists(candidate)) {
    candidate = `${baseName} (cópia ${attempt})`;
    attempt += 1;
  }

  return candidate;
}

/** Próximo id livre para models cujo `id` é definido manualmente (sem @default(autoincrement())). */
export async function nextManualId(
  maxId: () => Promise<number | null>,
): Promise<number> {
  const max = await maxId();
  return (max ?? 0) + 1;
}
