import type { EntityImageType } from "@/lib/entity-image";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";

/** Janela de coalescência: todo `fetchEntityImageBatched` chamado dentro desse intervalo (ex.:
 * N `EntityThumb` montando juntos numa lista/combobox) vira uma única request
 * `/api/admin/images/{type}?ids=1,2,3,...` em vez de uma por item — evita N+1 requests que
 * deixavam listas grandes (catálogo de +30k items) lentas. */
const BATCH_WINDOW_MS = 10;

type Resolver = (info: EntityImageInfo | null) => void;

const queues = new Map<EntityImageType, Map<number, Resolver[]>>();
const timers = new Map<EntityImageType, ReturnType<typeof setTimeout>>();

function flush(entityType: EntityImageType) {
  timers.delete(entityType);
  const queue = queues.get(entityType);
  queues.delete(entityType);
  if (!queue || queue.size === 0) return;

  const ids = Array.from(queue.keys());

  fetch(`/api/admin/images/${entityType}?ids=${ids.join(",")}`)
    .then((response) => (response.ok ? response.json() : { images: [] }))
    .then(
      (data: {
        images: {
          entityId: number;
          extension: string | null;
          updatedAt: string | null;
          looktype: EntityImageInfo["looktype"];
        }[];
      }) => {
        const byId = new Map(data.images.map((image) => [image.entityId, image]));
        for (const [id, resolvers] of queue) {
          const image = byId.get(id);
          const info: EntityImageInfo | null = image
            ? { extension: image.extension, updatedAt: image.updatedAt, looktype: image.looktype }
            : null;
          for (const resolve of resolvers) resolve(info);
        }
      }
    )
    .catch(() => {
      for (const resolvers of queue.values()) {
        for (const resolve of resolvers) resolve(null);
      }
    });
}

export function fetchEntityImageBatched(
  entityType: EntityImageType,
  id: number,
): Promise<EntityImageInfo | null> {
  if (!Number.isFinite(id) || id <= 0) return Promise.resolve(null);

  let queue = queues.get(entityType);
  if (!queue) {
    queue = new Map();
    queues.set(entityType, queue);
  }

  return new Promise((resolve) => {
    let resolvers = queue.get(id);
    if (!resolvers) {
      resolvers = [];
      queue.set(id, resolvers);
    }
    resolvers.push(resolve);

    if (!timers.has(entityType)) {
      timers.set(
        entityType,
        setTimeout(() => flush(entityType), BATCH_WINDOW_MS),
      );
    }
  });
}
