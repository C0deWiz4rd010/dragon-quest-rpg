import { assets } from '../assets/asset-catalog';
import { roleLootMultiplier } from '../combat/combat-rules';
import { EnemyRole } from '../combat/enemy.model';
import { Player } from '../inventory/player.model';
import {
  PathBranch,
  PathBranchModifier,
  PathSegment,
  type PathBiome,
  type PathWeather,
} from './path-segment.model';
import { ENEMY_BLUEPRINTS, randomBossId } from './enemy-blueprints';

export function hydratePathVisuals(segments: PathSegment[]): PathSegment[] {
  return segments.map((segment) => ({
    ...segment,
    branches: segment.branches.map((branch) => {
      const blueprint = branch.enemyId
        ? (ENEMY_BLUEPRINTS[branch.enemyId] ?? ENEMY_BLUEPRINTS['slime'])
        : null;
      const weatherPreview = branch.weatherPreview ?? weatherForBranch(branch.type);

      return {
        ...branch,
        assetUrl: branch.assetUrl ?? blueprint?.assetUrl,
        sprite: branch.sprite ?? blueprint?.sprite,
        enemyHue: branch.enemyHue ?? blueprint?.hue,
        enemyRole: branch.enemyRole ?? blueprint?.role,
        weatherPreview,
        biome: branch.biome ?? biomeForBranch(branch.type, weatherPreview),
        riskLabel: branch.riskLabel ?? riskLabel(branch.threat, blueprint?.role),
        rewardHint: branch.rewardHint ?? rewardHint(branch.type, branch.threat, blueprint?.role),
        modifier: branch.modifier,
        modifierHint: branch.modifierHint ?? modifierHint(branch.modifier),
      };
    }),
  }));
}

export function adaptSegmentToPlayerState(
  segment: PathSegment,
  player: Player,
  bossPrepScore: number,
): PathSegment {
  if (
    segment.depth === 0 ||
    isBossPrepDepth(segment.depth) ||
    segment.branches.some((branch) => branch.type === 'boss')
  ) {
    return segment;
  }

  const hasType = (...types: PathBranch['type'][]) =>
    segment.branches.some((branch) => types.includes(branch.type));
  const hpPercent = player.hp / player.maxHp;
  const manaPercent = player.mana / player.maxMana;
  const bossSoon = segment.depth % 5 >= 3 && bossPrepScore < 60;
  const replaceIndex = highestThreatBranchIndex(segment.branches);
  let replacement: PathBranch | null = null;

  if (hpPercent < 0.42 && !hasType('rest', 'sanctuary', 'merchant')) {
    replacement = createRestBranch(
      segment.depth,
      replaceIndex,
      'Notlager',
      'Adaptive Rettungsroute fuer knappe HP, Mana und Cooldown.',
      'Adaptiv: HP, Mana, Cooldown',
    );
  } else if (bossSoon && !hasType('sanctuary', 'merchant', 'forge')) {
    replacement = createSanctuaryBranch(
      segment.depth,
      replaceIndex,
      'Prep-Schrein',
      'Adaptive Bossvorbereitung mit Segen, Resolve und Reinigung.',
      'Adaptiv: Boss-Prep',
    );
  } else if (
    (manaPercent < 0.35 || player.skillCooldown > 2) &&
    !hasType('rest', 'forge', 'merchant')
  ) {
    replacement = createForgeBranch(
      segment.depth,
      replaceIndex,
      'Fokus-Schmiede',
      'Adaptive Tempo-Route fuer Mana, Cooldown und direkte Werte.',
      'Adaptiv: Tempo',
    );
  }

  if (!replacement) {
    return segment;
  }

  return {
    ...segment,
    branches: segment.branches.map((branch, index) =>
      index === replaceIndex ? withBranchMetadata(replacement) : branch,
    ),
  };
}

export function createPathSegment(depth: number, playerLevel: number): PathSegment {
  if (isBossPrepDepth(depth)) {
    return createBossPrepSegment(depth);
  }

  const branchCount = depth === 0 ? 2 : Math.min(4, 2 + Math.floor(Math.random() * 3));
  const branches = Array.from({ length: branchCount }, (_, index) =>
    createBranch(depth, index, playerLevel),
  );

  if (depth === 1 && !branches.some((branch) => branch.type === 'minigame')) {
    branches[branches.length - 1] = createMiniGameBranch(depth, branches.length - 1);
  }

  if (depth > 0 && depth % 5 === 0) {
    branches[0] = {
      id: `path-${depth}-boss`,
      type: 'boss',
      name: 'Thronsaal',
      icon: 'DK',
      assetUrl: assets.nodes.boss,
      description: 'Ein schwerer Kampf mit hoher Belohnung.',
      threat: 5,
      riskLabel: riskLabel(5, 'boss'),
      rewardHint: rewardHint('boss', 5, 'boss'),
      weatherPreview: weatherForBranch('boss'),
      enemyRole: 'boss',
      modifier: 'focus',
      modifierHint: modifierHint('focus'),
      completed: false,
      enemyId: randomBossId(),
    };
  }

  return {
    id: `segment-${depth}`,
    depth,
    branches: branches.map(withBranchMetadata),
    cleared: false,
  };
}

export function createBranch(depth: number, index: number, playerLevel: number): PathBranch {
  const roll = Math.random();

  if (roll > 0.82 && depth > 0) {
    return createMiniGameBranch(depth, index);
  }

  if (roll > 0.78 && depth > 2) {
    return createEliteBranch(depth, index);
  }

  if (roll > 0.76) {
    return {
      id: `path-${depth}-${index}`,
      type: 'treasure',
      name: 'Reliktkammer',
      icon: 'C',
      assetUrl: assets.nodes.treasure,
      description: 'Sichere Beute, aber der Lauf wird tiefer.',
      threat: 1,
      riskLabel: riskLabel(1),
      rewardHint: `Sicher: ${30 + depth * 12}+ Gold${depth > 2 ? ' und Relic-Chance' : ''}`,
      weatherPreview: weatherForBranch('treasure'),
      modifier: branchModifier(1, 'treasure'),
      completed: false,
      reward: {
        gold: 30 + depth * 12 + Math.floor(Math.random() * 25),
        potions: Math.random() > 0.72 ? 1 : 0,
      },
    };
  }

  if (roll > 0.68) {
    return {
      id: `path-${depth}-${index}`,
      type: 'rest',
      name: 'Lagerfeuer',
      icon: 'Camp',
      assetUrl: assets.nodes.camp,
      description: 'Rastplatz fur Heilung, Mana und einen ruhigen Reset.',
      threat: 0,
      riskLabel: riskLabel(0),
      rewardHint: 'Stabil: HP, Mana, Cooldown',
      weatherPreview: weatherForBranch('rest'),
      modifier: branchModifier(0, 'rest'),
      completed: false,
    };
  }

  if (roll > 0.6) {
    return {
      id: `path-${depth}-${index}`,
      type: 'event',
      name: 'Runenschrein',
      icon: 'R',
      assetUrl: assets.nodes.shrine,
      description: 'Unberechenbares Ereignis mit Ressourcen oder Erholung.',
      threat: 0,
      riskLabel: riskLabel(0),
      rewardHint: 'Variabel: Gold oder Erholung',
      weatherPreview: weatherForBranch('event'),
      modifier: branchModifier(0, 'event'),
      completed: false,
    };
  }

  if (roll > 0.52 && depth > 0) {
    return {
      id: `path-${depth}-${index}`,
      type: 'merchant',
      name: 'Trosshaendler',
      icon: 'G',
      assetUrl: assets.nodes.merchant,
      description: 'Passt seine Ware an deinen aktuellen Run-Zustand an.',
      threat: 0,
      riskLabel: riskLabel(0),
      rewardHint: 'Wahl: Tempo, Sustain oder Relic',
      weatherPreview: weatherForBranch('merchant'),
      modifier: branchModifier(0, 'merchant'),
      completed: false,
    };
  }

  if (roll > 0.44 && depth > 1) {
    return {
      id: `path-${depth}-${index}`,
      type: 'forge',
      name: 'Feldschmiede',
      icon: 'F',
      assetUrl: assets.nodes.forge,
      description: 'Schaerft deine Ausruestung direkt im Run.',
      threat: 1,
      riskLabel: riskLabel(1),
      rewardHint: 'Tempo: direkte Kampfwerte',
      weatherPreview: weatherForBranch('forge'),
      modifier: branchModifier(1, 'forge'),
      completed: false,
    };
  }

  if (roll > 0.36 && depth > 1) {
    return {
      id: `path-${depth}-${index}`,
      type: 'sanctuary',
      name: 'Sanktuarium',
      icon: 'S',
      assetUrl: assets.nodes.sanctuary,
      description: 'Klare den Fluss des Runs, tanke Resolve und sichere dir einen Segen.',
      threat: 0,
      riskLabel: riskLabel(0),
      rewardHint: 'Segen, Resolve, Reinigung',
      weatherPreview: weatherForBranch('sanctuary'),
      modifier: branchModifier(0, 'sanctuary'),
      completed: false,
    };
  }

  const enemyPool = Object.entries(ENEMY_BLUEPRINTS)
    .filter(([, enemy]) => !enemy.isBoss && enemy.level <= Math.min(7, playerLevel + depth + 1))
    .map(([id]) => id);
  const enemyId = enemyPool[Math.floor(Math.random() * enemyPool.length)] ?? 'slime';
  const role = ENEMY_BLUEPRINTS[enemyId].role;
  const threat = ENEMY_BLUEPRINTS[enemyId].elite ? 4 : Math.min(4, ENEMY_BLUEPRINTS[enemyId].level);

  return {
    id: `path-${depth}-${index}`,
    type: 'fight',
    name: depth > 3 && Math.random() > 0.75 ? 'Elite-Begegnung' : 'Monsterpfad',
    icon: ENEMY_BLUEPRINTS[enemyId].icon,
    assetUrl: ENEMY_BLUEPRINTS[enemyId].assetUrl,
    sprite: ENEMY_BLUEPRINTS[enemyId].sprite,
    enemyHue: ENEMY_BLUEPRINTS[enemyId].hue,
    description: describeFightPath(enemyId, depth),
    threat,
    riskLabel: riskLabel(threat, role),
    rewardHint: rewardHint('fight', threat, role),
    weatherPreview: weatherForBranch('fight'),
    enemyRole: role,
    modifier: branchModifier(threat, 'fight'),
    completed: false,
    enemyId,
  };
}

export function highestThreatBranchIndex(branches: PathBranch[]): number {
  if (!branches.length) {
    return 0;
  }

  return Math.max(
    0,
    branches.reduce(
      (bestIndex, branch, index) =>
        branch.threat > branches[bestIndex].threat ? index : bestIndex,
      0,
    ),
  );
}

export function createRestBranch(
  depth: number,
  index: number,
  name = 'Lagerfeuer',
  description = 'Rastplatz fur Heilung, Mana und einen ruhigen Reset.',
  reward = 'Stabil: HP, Mana, Cooldown',
): PathBranch {
  return {
    id: `path-${depth}-${index}-rest`,
    type: 'rest',
    name,
    icon: 'Camp',
    assetUrl: assets.nodes.camp,
    description,
    threat: 0,
    riskLabel: riskLabel(0),
    rewardHint: reward,
    weatherPreview: weatherForBranch('rest'),
    modifier: branchModifier(0, 'rest'),
    completed: false,
  };
}

export function createForgeBranch(
  depth: number,
  index: number,
  name = 'Feldschmiede',
  description = 'Schaerft deine Ausruestung direkt im Run.',
  reward = 'Tempo: direkte Kampfwerte',
): PathBranch {
  return {
    id: `path-${depth}-${index}-forge`,
    type: 'forge',
    name,
    icon: 'F',
    assetUrl: assets.nodes.forge,
    description,
    threat: 1,
    riskLabel: riskLabel(1),
    rewardHint: reward,
    weatherPreview: weatherForBranch('forge'),
    modifier: branchModifier(1, 'forge'),
    completed: false,
  };
}

export function createSanctuaryBranch(
  depth: number,
  index: number,
  name = 'Sanktuarium',
  description = 'Klaert den Fluss des Runs, tankt Resolve und sichert dir einen Segen.',
  reward = 'Segen, Resolve, Reinigung',
): PathBranch {
  return {
    id: `path-${depth}-${index}-sanctuary`,
    type: 'sanctuary',
    name,
    icon: 'S',
    assetUrl: assets.nodes.sanctuary,
    description,
    threat: 0,
    riskLabel: riskLabel(0),
    rewardHint: reward,
    weatherPreview: weatherForBranch('sanctuary'),
    modifier: branchModifier(0, 'sanctuary'),
    completed: false,
  };
}

export function createMiniGameBranch(depth: number, index: number): PathBranch {
  const miniGames = [
    {
      description: 'Kurzer Reflex-Test mit direkter Belohnung.',
      icon: 'R',
      name: 'Reflexprobe',
    },
    {
      description: 'Merk dir das Muster und sichere dir Extra-Ressourcen.',
      icon: 'M',
      name: 'Merkspiel',
    },
    {
      description: 'Präzisionspfad mit kleiner Bonuskiste.',
      icon: 'P',
      name: 'Präzisionslauf',
    },
    {
      description: 'Schnelltippen für einen sauberen Tempo-Bonus.',
      icon: 'T',
      name: 'Tastentest',
    },
  ] as const;
  const miniGame = miniGames[Math.floor(Math.random() * miniGames.length)] ?? miniGames[0];

  return {
    id: `path-${depth}-${index}`,
    type: 'minigame',
    name: miniGame.name,
    icon: miniGame.icon,
    description: miniGame.description,
    threat: 1,
    riskLabel: riskLabel(1),
    rewardHint: 'Skill: Gold, Mana, Bonuschance',
    weatherPreview: weatherForBranch('minigame'),
    modifier: branchModifier(1, 'minigame'),
    completed: false,
  };
}

export function createEliteBranch(depth: number, index: number): PathBranch {
  return {
    id: `path-${depth}-${index}`,
    type: 'fight',
    name: 'Elite-Jagd',
    icon: 'A',
    assetUrl: ENEMY_BLUEPRINTS['ancient'].assetUrl,
    sprite: ENEMY_BLUEPRINTS['ancient'].sprite,
    description: 'Ein harter Elite-Pfad fuer Prep, Relics und massiven Reward.',
    threat: 4,
    riskLabel: riskLabel(4, 'elite'),
    rewardHint: 'Elite: Relic-Chance, Resolve und Boss-Prep',
    weatherPreview: weatherForBranch('fight'),
    enemyRole: 'elite',
    modifier: branchModifier(4, 'fight'),
    eliteRoute: true,
    completed: false,
    enemyId: 'ancient',
  };
}

export function withBranchMetadata(branch: PathBranch): PathBranch {
  const weatherPreview = branch.weatherPreview ?? weatherForBranch(branch.type);

  return {
    ...branch,
    weatherPreview,
    biome: branch.biome ?? biomeForBranch(branch.type, weatherPreview),
    modifierHint: branch.modifierHint ?? modifierHint(branch.modifier),
  };
}

export function biomeForBranch(type: PathBranch['type'], weather: PathWeather): PathBiome {
  if (type === 'boss' || type === 'sanctuary') {
    return 'sanctum';
  }

  if (type === 'forge' || weather === 'ash') {
    return 'ember';
  }

  if (weather === 'storm') {
    return 'storm';
  }

  if (weather === 'snow') {
    return 'frost';
  }

  if (type === 'rest' || weather === 'rain' || weather === 'glow') {
    return 'grove';
  }

  return 'ruin';
}

export function weatherForBranch(type: PathBranch['type']): PathWeather {
  if (type === 'fight') {
    return Math.random() > 0.5 ? 'rain' : 'ash';
  }

  if (type === 'boss') {
    return 'storm';
  }

  if (type === 'forge') {
    return Math.random() > 0.5 ? 'ash' : 'snow';
  }

  if (type === 'merchant') {
    return 'clear';
  }

  if (type === 'sanctuary') {
    return 'glow';
  }

  if (type === 'rest') {
    return 'glow';
  }

  if (type === 'event') {
    return 'fog';
  }

  if (type === 'minigame') {
    return 'glow';
  }

  return 'snow';
}

export function branchModifier(
  threat: number,
  type: PathBranch['type'],
): PathBranchModifier | undefined {
  const roll = Math.random();

  if (type === 'boss') return 'focus';
  if (type === 'rest') return roll > 0.45 ? 'blessing' : undefined;
  if (type === 'sanctuary') return roll > 0.45 ? 'blessing' : 'focus';
  if (type === 'merchant') return roll > 0.5 ? 'cache' : 'blessing';
  if (type === 'forge') return roll > 0.48 ? 'focus' : 'cache';
  if (type === 'treasure') return roll > 0.42 ? 'cache' : undefined;
  if (type === 'event') return roll > 0.62 ? 'curse' : roll > 0.28 ? 'blessing' : undefined;
  if (type === 'minigame') return roll > 0.5 ? 'focus' : 'cache';
  if (threat >= 4) return roll > 0.55 ? 'ambush' : roll > 0.22 ? 'focus' : undefined;
  if (threat >= 2) return roll > 0.62 ? 'ambush' : roll > 0.36 ? 'cache' : undefined;

  return roll > 0.7 ? 'cache' : undefined;
}

export function modifierHint(modifier: PathBranchModifier | undefined): string | undefined {
  switch (modifier) {
    case 'ambush':
      return 'Mod: Hinterhalt';
    case 'blessing':
      return 'Mod: Segen';
    case 'cache':
      return 'Mod: Vorrat';
    case 'curse':
      return 'Mod: Fluch';
    case 'focus':
      return 'Mod: Fokus';
    default:
      return undefined;
  }
}

export function riskLabel(threat: number, role?: EnemyRole): string {
  if (role === 'boss') return 'Bossrisiko';
  if (role === 'elite' || threat >= 4) return 'Hohes Risiko';
  if (threat >= 2) return 'Taktisches Risiko';
  if (threat === 1) return 'Niedriges Risiko';
  return 'Sicher';
}

export function rewardHint(type: PathBranch['type'], threat: number, role?: EnemyRole): string {
  if (type === 'boss') return 'Boss: sehr viel XP/Gold';
  if (type === 'fight') {
    const multiplier = role ? roleLootMultiplier(role) + Math.max(0, threat - 1) * 0.08 : 1;
    return `${roleLabel(role)}: ${Math.round(multiplier * 100)}% Reward`;
  }
  if (type === 'treasure') return 'Sicherer Goldfund';
  if (type === 'rest') return 'Heilung und Tempo';
  if (type === 'merchant') return 'Adaptive Versorgung';
  if (type === 'forge') return 'Direkte Kampfwerte';
  if (type === 'sanctuary') return 'Blessing und Resolve';
  if (type === 'minigame') return 'Skill-Bonus';
  return 'Unbekannter Ausgang';
}

export function roleLabel(role?: EnemyRole): string {
  switch (role) {
    case 'bruiser':
      return 'Bruiser';
    case 'swift':
      return 'Swift';
    case 'hexer':
      return 'Hexer';
    case 'elite':
      return 'Elite';
    case 'boss':
      return 'Boss';
    default:
      return 'Route';
  }
}

export function describeFightPath(enemyId: string, depth: number): string {
  const enemy = ENEMY_BLUEPRINTS[enemyId] ?? ENEMY_BLUEPRINTS['slime'];
  const risk = depth > 3 || enemy.elite ? 'hohem Druck' : 'kontrollierbarem Risiko';

  return `${enemy.name} wartet hier mit ${risk}, XP und Gold.`;
}

export function createBossPrepSegment(depth: number): PathSegment {
  return {
    id: `segment-${depth}`,
    depth,
    branches: (
      [
        {
          id: `path-${depth}-elite`,
          type: 'fight',
          name: 'Elite-Jagd',
          icon: 'A',
          assetUrl: ENEMY_BLUEPRINTS['ancient'].assetUrl,
          sprite: ENEMY_BLUEPRINTS['ancient'].sprite,
          description: 'Ein uralter Drache bewacht seltene Prep-Beute vor dem Boss.',
          threat: 4,
          riskLabel: riskLabel(4, 'elite'),
          rewardHint: 'Elite: Relic-Chance und Resolve',
          weatherPreview: 'ash',
          enemyRole: 'elite',
          modifier: 'focus',
          modifierHint: modifierHint('focus'),
          eliteRoute: true,
          completed: false,
          enemyId: 'ancient',
        },
        {
          id: `path-${depth}-merchant`,
          type: 'merchant',
          name: 'Vorhut-Haendler',
          icon: 'G',
          assetUrl: assets.nodes.merchant,
          description: 'Letzte Einkaeufe und taktische Auswahl vor dem Boss.',
          threat: 0,
          riskLabel: riskLabel(0),
          rewardHint: 'Wahl: Boss-Prep',
          weatherPreview: 'clear',
          modifier: 'cache',
          modifierHint: modifierHint('cache'),
          completed: false,
        },
        {
          id: `path-${depth}-forge`,
          type: 'forge',
          name: 'Feldschmiede',
          icon: 'F',
          assetUrl: assets.nodes.forge,
          description: 'Direkte Werte fuer die naechste Bossphase.',
          threat: 1,
          riskLabel: riskLabel(1),
          rewardHint: 'Prep: direkte Stats',
          weatherPreview: 'snow',
          modifier: 'focus',
          modifierHint: modifierHint('focus'),
          completed: false,
        },
        {
          id: `path-${depth}-sanctuary`,
          type: 'sanctuary',
          name: 'Boss-Sanktuarium',
          icon: 'S',
          assetUrl: assets.nodes.sanctuary,
          description: 'Reinigt den Run und fuellt Blessings sowie Resolve vor dem Finale.',
          threat: 0,
          riskLabel: riskLabel(0),
          rewardHint: 'Prep: Blessing und Resolve',
          weatherPreview: 'glow',
          modifier: 'blessing',
          modifierHint: modifierHint('blessing'),
          completed: false,
        },
      ] satisfies PathBranch[]
    ).map(withBranchMetadata),
    cleared: false,
  };
}

export function isBossPrepDepth(depth: number): boolean {
  return depth > 0 && depth % 5 === 4;
}
