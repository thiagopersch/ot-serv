function Bar({
  label,
  current,
  max,
  gradient,
}: {
  label: string;
  current: number;
  max: number;
  gradient: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {current} / {max}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: gradient }} />
      </div>
    </div>
  );
}

export function HpManaBar({
  health,
  healthmax,
  mana,
  manamax,
}: {
  health: number;
  healthmax: number;
  mana: number;
  manamax: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Bar label="Saúde" current={health} max={healthmax} gradient="linear-gradient(180deg, #e0574a, #a5241c)" />
      <Bar label="Mana" current={mana} max={manamax} gradient="linear-gradient(180deg, #5a8fd8, #27488c)" />
    </div>
  );
}
