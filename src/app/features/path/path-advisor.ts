import type { Player, RouteHistoryType } from '../inventory/player.model';
import type { PathBranch } from './path-segment.model';

export type BranchAdviceTone = 'recommended' | 'prep' | 'stable' | 'danger';
export type BranchDangerLevel = 'low' | 'medium' | 'high' | 'boss';

export interface BranchAdvice {
  danger: BranchDangerLevel;
  label: string;
  reason: string;
  score: number;
  tone: BranchAdviceTone;
}

export interface RouteSynergyBonus {
  active: boolean;
  dragonShards: number;
  gold: number;
  label: string;
  mana: number;
}

const SAFE_BRANCHES = new Set<PathBranch['type']>(['rest', 'sanctuary', 'merchant']);
const PREP_BRANCHES = new Set<PathBranch['type']>(['forge', 'sanctuary', 'merchant']);

export function adviseBranch(
  branch: PathBranch,
  player: Player,
  currentDepth: number,
  bossPrepScore: number,
): BranchAdvice {
  const hpPercent = player.hp / player.maxHp;
  const manaPercent = player.mana / player.maxMana;
  const bossCountdown = 5 - (currentDepth % 5);
  let score = 50 - branch.threat * 8;
  let reason = branch.rewardHint ?? 'Solider Pfad ohne starke Abweichung.';
  let tone: BranchAdviceTone = 'stable';

  if (branch.eliteRoute) {
    score += bossPrepScore >= 45 || hpPercent >= 0.68 ? 14 : -10;
    reason =
      bossPrepScore >= 45
        ? 'Elite-Prep zahlt stark auf Bossfenster ein.'
        : 'Elite lohnt, aber erst mit mehr Stabilitaet.';
  }

  if (matchesContract(branch, player)) {
    score += 9;
    reason = `Passt zum Auftrag ${player.activeContract.title}.`;
  }

  if (hpPercent < 0.42) {
    if (SAFE_BRANCHES.has(branch.type)) {
      score += 28;
      reason = 'Empfohlen: HP ist knapp, sichere Route stabilisiert den Run.';
    } else if (branch.type === 'fight' || branch.type === 'boss') {
      score -= 30;
      reason = 'Riskant: HP ist knapp, Kampf kann den Run kippen.';
    }
  }

  if (manaPercent < 0.35 || player.skillCooldown > 1) {
    if (branch.type === 'rest' || branch.type === 'forge' || branch.type === 'merchant') {
      score += 14;
      reason = 'Tempo-Fenster: Mana oder Cooldown brauchen Hilfe.';
    }
  }

  if (bossCountdown <= 2 && bossPrepScore < 65) {
    if (PREP_BRANCHES.has(branch.type) || branch.eliteRoute) {
      score += 24;
      reason = 'Boss naht: dieser Pfad baut Prep statt nur Beute.';
    } else if (branch.type === 'treasure' || branch.type === 'minigame') {
      score -= 6;
      reason = 'Boss naht: gut, aber Prep-Routen sind gerade wertvoller.';
    }
  }

  if (branch.type === 'boss') {
    score += bossPrepScore >= 75 ? 10 : -28;
    reason =
      bossPrepScore >= 75
        ? 'Bossfenster ist offen.'
        : 'Bossdruck hoch: vor dem Kampf besser vorbereiten.';
  }

  if (score >= 72) {
    tone = PREP_BRANCHES.has(branch.type) || branch.eliteRoute ? 'prep' : 'recommended';
  } else if (score <= 34 || branch.type === 'boss') {
    tone = 'danger';
  }

  return {
    danger:
      branch.type === 'boss'
        ? 'boss'
        : branch.threat >= 4
          ? 'high'
          : branch.threat >= 2
            ? 'medium'
            : 'low',
    label: adviceLabel(tone),
    reason,
    score: Math.max(0, Math.min(100, Math.round(score))),
    tone,
  };
}

export function routeSynergyBonus(
  player: Player,
  selectedBranch: PathBranch | null,
): RouteSynergyBonus {
  if (!selectedBranch) {
    return emptySynergy();
  }

  const previousTypes = player.routeHistory.slice(0, 2).map((entry) => entry.type);
  const nextType = selectedBranch.type as RouteHistoryType;
  const uniqueTypes = new Set([...previousTypes, nextType]);

  if (previousTypes.length < 2 || uniqueTypes.size < 3) {
    return emptySynergy();
  }

  const prepMultiplier =
    selectedBranch.type === 'sanctuary' ||
    selectedBranch.type === 'forge' ||
    selectedBranch.eliteRoute
      ? 1.35
      : 1;

  return {
    active: true,
    dragonShards: selectedBranch.threat >= 3 || selectedBranch.eliteRoute ? 2 : 1,
    gold: Math.round((14 + selectedBranch.threat * 4) * prepMultiplier),
    label: 'Synergy',
    mana: Math.round((10 + selectedBranch.threat * 2) * prepMultiplier),
  };
}

export function routeSynergyPreview(player: Player): string {
  const types = player.routeHistory.slice(0, 2).map((entry) => entry.type);

  if (types.length < 2) {
    return `${types.length}/2 Vorlauf`;
  }

  return new Set(types).size >= 2 ? 'bereit fuer dritten Typ' : 'Typ wechseln';
}

function matchesContract(branch: PathBranch, player: Player): boolean {
  const contract = player.activeContract;

  if (contract.completed) {
    return false;
  }

  if (contract.type === 'slayer') {
    return branch.type === 'fight' || branch.type === 'boss';
  }

  if (contract.type === 'conserver') {
    return branch.type !== 'fight' && branch.type !== 'boss';
  }

  return true;
}

function adviceLabel(tone: BranchAdviceTone): string {
  switch (tone) {
    case 'recommended':
      return 'Empfohlen';
    case 'prep':
      return 'Prep';
    case 'danger':
      return 'Riskant';
    default:
      return 'Stabil';
  }
}

function emptySynergy(): RouteSynergyBonus {
  return {
    active: false,
    dragonShards: 0,
    gold: 0,
    label: 'Synergy',
    mana: 0,
  };
}
