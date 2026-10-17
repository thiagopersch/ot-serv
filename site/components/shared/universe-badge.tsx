import { Badge } from "@/components/ui/badge";
import { textColorFor } from "@/lib/color-utils";

type UniverseBadgeProps = {
  name: string;
  color?: string | null;
};

/** Badge de universo — usado em toda listagem/select que referencia um `Universe`
 * (Vocações, Monstros, ...) pra refletir a cor cadastrada no CRUD de Universos. */
export function UniverseBadge({ name, color }: UniverseBadgeProps) {
  if (!color) return <Badge variant="outline">{name}</Badge>;

  return (
    <Badge style={{ backgroundColor: color, color: textColorFor(color), borderColor: color }}>
      {name}
    </Badge>
  );
}
