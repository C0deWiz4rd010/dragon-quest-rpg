import { assets } from '../assets/asset-catalog';
import { roleLootMultiplier } from '../combat/combat-rules';
import { Enemy, EnemyElement, EnemyRole } from '../combat/enemy.model';

export const ENEMY_BLUEPRINTS: Record<
  string,
  Omit<Enemy, 'id' | 'hp' | 'maxHp' | 'weakness' | 'telegraphedAbility'>
> = {
  slime: {
    name: 'Schleimling',
    role: 'swift',
    attack: 10,
    gold: 20,
    xp: 25,
    icon: 'S',
    sprite: assets.units.slime,
    assetUrl: assets.units.slime.idle,
    level: 1,
    elite: false,
  },
  bat: {
    name: 'Vampirfledermaus',
    role: 'swift',
    attack: 16,
    gold: 32,
    xp: 42,
    icon: 'B',
    sprite: assets.units.bat,
    assetUrl: assets.units.bat.idle,
    level: 2,
    elite: false,
  },
  skeleton: {
    name: 'Knochenwache',
    role: 'hexer',
    attack: 21,
    gold: 55,
    xp: 75,
    icon: 'K',
    sprite: assets.units.skeleton,
    assetUrl: assets.units.skeleton.idle,
    level: 3,
    elite: false,
  },
  knight: {
    name: 'Verfluchter Ritter',
    role: 'bruiser',
    attack: 30,
    gold: 95,
    xp: 130,
    icon: 'R',
    sprite: assets.units.knight,
    assetUrl: assets.units.knight.idle,
    level: 4,
    elite: false,
  },
  wyvern: {
    name: 'Junger Drache',
    role: 'bruiser',
    attack: 44,
    gold: 145,
    xp: 210,
    icon: 'D',
    sprite: assets.units.wyvern,
    assetUrl: assets.units.wyvern.idle,
    level: 5,
    elite: false,
  },
  ancient: {
    name: 'Uralter Drache',
    role: 'elite',
    attack: 58,
    gold: 240,
    xp: 330,
    icon: 'A',
    sprite: assets.units.ancient,
    assetUrl: assets.units.ancient.idle,
    level: 7,
    elite: true,
  },
  boss: {
    name: 'Drachenkonig',
    role: 'boss',
    attack: 72,
    gold: 600,
    xp: 800,
    icon: 'DK',
    sprite: assets.units.boss,
    assetUrl: assets.units.boss.idle,
    level: 8,
    elite: false,
    isBoss: true,
  },
  // === Ember biome ===
  'fire-sprite': {
    name: 'Feuergeist',
    role: 'swift',
    attack: 15,
    gold: 30,
    xp: 40,
    icon: 'FS',
    sprite: assets.units.fireSprite,
    assetUrl: assets.units.fireSprite.idle,
    level: 2,
    elite: false,
  },
  'lava-golem': {
    name: 'Lavagolem',
    role: 'bruiser',
    attack: 32,
    gold: 90,
    xp: 120,
    icon: 'LG',
    sprite: assets.units.lavaGolem,
    assetUrl: assets.units.lavaGolem.idle,
    level: 4,
    elite: false,
  },
  'magma-drake': {
    name: 'Magmadrache',
    role: 'elite',
    attack: 52,
    gold: 210,
    xp: 300,
    icon: 'MD',
    sprite: assets.units.magmaDrake,
    assetUrl: assets.units.magmaDrake.idle,
    level: 6,
    elite: true,
  },
  // === Grove biome ===
  'forest-wisp': {
    name: 'Waldirrlicht',
    role: 'hexer',
    attack: 14,
    gold: 34,
    xp: 44,
    icon: 'FW',
    sprite: assets.units.forestWisp,
    assetUrl: assets.units.forestWisp.idle,
    level: 2,
    elite: false,
  },
  'treant-archer': {
    name: 'Ent-Schutze',
    role: 'swift',
    attack: 20,
    gold: 52,
    xp: 70,
    icon: 'TA',
    sprite: assets.units.treantArcher,
    assetUrl: assets.units.treantArcher.idle,
    level: 3,
    elite: false,
  },
  'vine-horror': {
    name: 'Rankenschrecken',
    role: 'bruiser',
    attack: 40,
    gold: 130,
    xp: 180,
    icon: 'VH',
    sprite: assets.units.vineHorror,
    assetUrl: assets.units.vineHorror.idle,
    level: 5,
    elite: false,
  },
  // === Ruin biome ===
  'tomb-guardian': {
    name: 'Grabwachter',
    role: 'bruiser',
    attack: 30,
    gold: 92,
    xp: 125,
    icon: 'TG',
    sprite: assets.units.tombGuardian,
    assetUrl: assets.units.tombGuardian.idle,
    level: 4,
    elite: false,
  },
  'cursed-armor': {
    name: 'Fluchruestung',
    role: 'bruiser',
    attack: 38,
    gold: 120,
    xp: 175,
    icon: 'CA',
    sprite: assets.units.cursedArmor,
    assetUrl: assets.units.cursedArmor.idle,
    level: 5,
    elite: false,
  },
  'shadow-remnant': {
    name: 'Schattenrest',
    role: 'hexer',
    attack: 46,
    gold: 175,
    xp: 240,
    icon: 'SR',
    sprite: assets.units.shadowRemnant,
    assetUrl: assets.units.shadowRemnant.idle,
    level: 6,
    elite: false,
  },
  // === Frost biome ===
  'ice-wraith': {
    name: 'Eisgespenst',
    role: 'hexer',
    attack: 22,
    gold: 56,
    xp: 76,
    icon: 'IW',
    sprite: assets.units.iceWraith,
    assetUrl: assets.units.iceWraith.idle,
    level: 3,
    elite: false,
  },
  'frost-bear': {
    name: 'Frostbaer',
    role: 'bruiser',
    attack: 33,
    gold: 96,
    xp: 130,
    icon: 'FB',
    sprite: assets.units.frostBear,
    assetUrl: assets.units.frostBear.idle,
    level: 4,
    elite: false,
  },
  'blizzard-elemental': {
    name: 'Blizzardelementar',
    role: 'elite',
    attack: 56,
    gold: 235,
    xp: 320,
    icon: 'BE',
    sprite: assets.units.blizzardElemental,
    assetUrl: assets.units.blizzardElemental.idle,
    level: 7,
    elite: true,
  },
  // === Storm biome ===
  'thunder-hawk': {
    name: 'Donnerhabicht',
    role: 'swift',
    attack: 19,
    gold: 50,
    xp: 68,
    icon: 'TH',
    sprite: assets.units.thunderHawk,
    assetUrl: assets.units.thunderHawk.idle,
    level: 3,
    elite: false,
  },
  'storm-djinn': {
    name: 'Sturmdschinn',
    role: 'hexer',
    attack: 42,
    gold: 132,
    xp: 185,
    icon: 'SD',
    sprite: assets.units.stormDjinn,
    assetUrl: assets.units.stormDjinn.idle,
    level: 5,
    elite: false,
  },
  'cyclone-serpent': {
    name: 'Wirbelschlange',
    role: 'elite',
    attack: 55,
    gold: 230,
    xp: 315,
    icon: 'CS',
    sprite: assets.units.cycloneSerpent,
    assetUrl: assets.units.cycloneSerpent.idle,
    level: 7,
    elite: true,
  },
  // === Sanctum biome ===
  'holy-sentinel': {
    name: 'Heiliger Wachter',
    role: 'bruiser',
    attack: 31,
    gold: 94,
    xp: 128,
    icon: 'HS',
    sprite: assets.units.holySentinel,
    assetUrl: assets.units.holySentinel.idle,
    level: 4,
    elite: false,
  },
  'rune-golem': {
    name: 'Runengolem',
    role: 'elite',
    attack: 57,
    gold: 240,
    xp: 325,
    icon: 'RG',
    sprite: assets.units.runeGolem,
    assetUrl: assets.units.runeGolem.idle,
    level: 7,
    elite: true,
  },
  'void-walker': {
    name: 'Leerenwandler',
    role: 'elite',
    attack: 58,
    gold: 250,
    xp: 340,
    icon: 'VW',
    sprite: assets.units.voidWalker,
    assetUrl: assets.units.voidWalker.idle,
    level: 7,
    elite: true,
  },
};

export function hydrateEnemyVisuals(enemy: Enemy | null): Enemy | null {
  if (!enemy) {
    return null;
  }

  const key = Object.keys(ENEMY_BLUEPRINTS).find((enemyId) => {
    const blueprint = ENEMY_BLUEPRINTS[enemyId];

    return (
      blueprint.name === enemy.name ||
      enemy.assetUrl === blueprint.assetUrl ||
      enemy.icon === blueprint.icon
    );
  });
  const blueprint = key ? ENEMY_BLUEPRINTS[key] : ENEMY_BLUEPRINTS['slime'];

  return {
    ...enemy,
    role: enemy.role ?? blueprint.role,
    assetUrl: enemy.assetUrl ?? blueprint.assetUrl,
    sprite: enemy.sprite ?? blueprint.sprite,
    weakness: enemy.weakness ?? weaknessForRole(enemy.role ?? blueprint.role),
    telegraphedAbility: enemy.telegraphedAbility ?? null,
  };
}

export function weaknessForRole(role: EnemyRole): EnemyElement {
  switch (role) {
    case 'bruiser':
      return 'ice';
    case 'swift':
      return 'lightning';
    case 'hexer':
      return 'fire';
    case 'elite':
      return 'shadow';
    case 'boss':
      return 'shadow';
  }
}

export function createEnemy(
  enemyId: string,
  playerLevel: number,
  forceBoss = false,
  threat = 1,
  newGamePlus = 0,
): Enemy {
  const blueprint = ENEMY_BLUEPRINTS[forceBoss ? 'boss' : enemyId] ?? ENEMY_BLUEPRINTS['slime'];
  const scaling = Math.max(0, playerLevel - blueprint.level);
  // New Game+ tightens the screws: +22% enemy HP and +18% damage per cycle.
  const ngHpMult = 1 + newGamePlus * 0.22;
  const ngAtkMult = 1 + newGamePlus * 0.18;
  const ngRewardMult = 1 + newGamePlus * 0.15;
  const maxHp = Math.round(
    ((forceBoss ? 500 : 45 + blueprint.level * 26) + scaling * 18) * ngHpMult,
  );
  const rewardScale =
    (roleLootMultiplier(blueprint.role) + Math.max(0, threat - 1) * 0.08) * ngRewardMult;

  return {
    ...blueprint,
    id: `${enemyId}-${crypto.randomUUID()}`,
    hp: maxHp,
    maxHp,
    attack: Math.round((blueprint.attack + scaling * 3) * ngAtkMult),
    gold: Math.floor((blueprint.gold + scaling * 10) * rewardScale),
    xp: Math.floor((blueprint.xp + scaling * 12) * rewardScale),
    weakness: weaknessForRole(blueprint.role),
    telegraphedAbility: null,
  };
}
