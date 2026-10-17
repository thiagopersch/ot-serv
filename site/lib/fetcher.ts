export class FetchError extends Error {
  info?: unknown;
  status?: number;
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const error = new FetchError("Erro ao buscar dados.");
    error.info = await response.json().catch(() => undefined);
    error.status = response.status;
    throw error;
  }

  return response.json();
}
