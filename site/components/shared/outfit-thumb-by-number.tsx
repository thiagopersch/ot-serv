"use client";

import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { useOutfitLooktypeByNumber } from "@/components/shared/use-outfit-looktype-by-number";
import { Skeleton } from "@/components/ui/skeleton";

const SIZE_CLASSES = { sm: "size-8", md: "size-16", lg: "size-24" } as const;

/** Miniatura animada de uma outfit a partir do **número** da looktype no cliente (não o id do
 * portal — ver `LooktypeThumbById` para esse caso). */
export function OutfitThumbByNumber({
  looktypeNumber,
  size = "sm",
}: {
  looktypeNumber: number;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const looktype = useOutfitLooktypeByNumber(looktypeNumber);

  if (looktype === undefined) return <Skeleton className={`${SIZE_CLASSES[size]} rounded-md`} />;
  if (!looktype) return null;

  return (
    <LooktypeAnimatedImage
      key={looktype.id}
      looktypeId={looktype.id}
      frameCount={looktype.frameCount}
      frameDurationsMs={looktype.frameDurationsMs}
      updatedAt={looktype.updatedAt}
      size={size}
    />
  );
}
