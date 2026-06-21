import { RunBlessing, RunBlessingType } from '../inventory/player.model';

export const RUN_BLESSING_META: Record<RunBlessingType, { description: string; label: string }> = {
  battle: {
    label: 'Kampfrausch',
    description: 'Naechste offensive Aktionen verursachen mehr Schaden.',
  },
  focus: {
    label: 'Fokuslicht',
    description: 'Naechste Runden geben extra Mana und Cooldown-Tempo.',
  },
  fortune: {
    label: 'Glueckssegen',
    description: 'Naechste Reward-Routen schuetten mehr Gold aus.',
  },
  vigor: {
    label: 'Lebenskern',
    description: 'Naechste Heilquellen werden verstaerkt und fuellen Resolve an.',
  },
  ward: {
    label: 'Aegis',
    description: 'Naechste gegnerische Treffer werden abgeschwaecht und Status geblockt.',
  },
};

export function blessingLabel(type: RunBlessingType): string {
  return RUN_BLESSING_META[type].label;
}

export function blessingDescription(type: RunBlessingType): string {
  return RUN_BLESSING_META[type].description;
}

export function getBlessingCharges(blessings: RunBlessing[], type: RunBlessingType): number {
  return blessings.find((blessing) => blessing.type === type)?.charges ?? 0;
}

export function mergeBlessing(blessings: RunBlessing[], type: RunBlessingType, charges = 1): RunBlessing[] {
  const nextCharges = Math.max(1, charges);
  const existing = blessings.find((blessing) => blessing.type === type);

  if (!existing) {
    return [...blessings, { type, charges: nextCharges }];
  }

  return blessings.map((blessing) =>
    blessing.type === type ? { ...blessing, charges: blessing.charges + nextCharges } : blessing,
  );
}

export function spendBlessing(
  blessings: RunBlessing[],
  type: RunBlessingType,
  charges = 1,
): { blessings: RunBlessing[]; consumed: boolean } {
  const amount = Math.max(1, charges);
  const current = blessings.find((blessing) => blessing.type === type);

  if (!current || current.charges < amount) {
    return {
      blessings,
      consumed: false,
    };
  }

  const nextBlessings = blessings
    .map((blessing) =>
      blessing.type === type ? { ...blessing, charges: Math.max(0, blessing.charges - amount) } : blessing,
    )
    .filter((blessing) => blessing.charges > 0);

  return {
    blessings: nextBlessings,
    consumed: true,
  };
}
