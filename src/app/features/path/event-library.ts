import type { DilemmaChoice } from '../encounters/run-encounter.service';
import type { Player, RunBlessingType, StatusEffect } from '../inventory/player.model';
import type { PathBiome } from './path-segment.model';

export type EventLogTone = 'normal' | 'heal' | 'damage' | 'event' | 'achievement';

/** Everything an event may do to the run. Implemented by the path service. */
export interface EventApi {
  hurt(fraction: number): void;
  heal(fraction: number): void;
  mana(amount: number): void;
  gold(amount: number): void;
  potions(amount: number): void;
  shards(amount: number): void;
  resolve(amount: number): void;
  permanent(stat: 'baseAttack' | 'baseDefense' | 'baseCrit' | 'luck' | 'maxHp' | 'maxMana' | 'maxResolve', amount: number): void;
  /** Rolls a blessing from `pool` and grants it. Returns its label. */
  blessing(pool: RunBlessingType[]): string;
  fixedBlessing(type: RunBlessingType, charges: number): void;
  relic(): void;
  cleanse(): void;
  afflict(effect: StatusEffect): void;
  /** True with `chance` percent probability. */
  gamble(chance: number): boolean;
  log(message: string, tone?: EventLogTone): void;
}

/** Read-only run snapshot handed to an event while it builds its choices. */
export interface EventInfo {
  depth: number;
  luck: number;
  /** Depth- and luck-scaled gold unit that rewards are expressed in. */
  goldBase: number;
  player: Player;
  /** Win chance (percent) for gambles, rising with luck. */
  odds(base: number, cap: number): number;
}

export interface EventChoice extends DilemmaChoice {
  apply(api: EventApi): void;
}

export interface EventDef {
  id: string;
  icon: string;
  source: string;
  flavor: string;
  /** Biomes where the event is common; untagged events can appear anywhere. */
  biomes?: PathBiome[];
  minDepth?: number;
  choices(info: EventInfo): EventChoice[];
}

const poison = (rounds: number, damagePerRound: number): StatusEffect => ({
  type: 'poison',
  rounds,
  damagePerRound,
});
const burn = (rounds: number, damagePerRound: number): StatusEffect => ({
  type: 'burn',
  rounds,
  damagePerRound,
});

export const EVENT_LIBRARY: EventDef[] = [
  // ───────────── Classic encounters (any biome) ─────────────
  {
    id: 'cursed-shrine',
    icon: '⛩',
    source: 'Verfluchter Schrein',
    flavor: 'Ein verfallener Schrein pulsiert mit dunkler Macht — sein Segen hat einen Preis.',
    choices: () => [
      {
        id: 'risk',
        title: 'Blut opfern',
        description: 'Lege die Hand auf den Altar und gib Lebenskraft hin.',
        tone: 'risk',
        riskLabel: 'Risiko: -18% HP',
        rewardLabel: 'Relikt + Shard',
        apply: (api) => {
          api.hurt(0.18);
          api.relic();
          api.shards(1);
          api.log('Du opferst Lebenskraft — der Altar gewährt ein Relikt und einen Shard.', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Andächtig beten',
        description: 'Ehre den Schrein ohne Opfer.',
        tone: 'reward',
        rewardLabel: 'Segen + Heilung',
        apply: (api) => {
          api.heal(0.15);
          api.mana(14);
          const label = api.blessing(['ward', 'focus']);
          api.log(`Dein Gebet bringt ${label} und etwas Heilung.`, 'heal');
        },
      },
    ],
  },
  {
    id: 'juggler-coin',
    icon: '🪙',
    source: 'Gauklermünze',
    flavor: 'Ein Geist wirft dir eine schimmernde Münze zu. Versuchst du dein Glück?',
    choices: (info) => {
      const win = info.odds(52, 72);
      return [
        {
          id: 'risk',
          title: 'Münze werfen',
          description: 'Alles oder nichts — der Geist liebt Mut.',
          tone: 'risk',
          chance: win,
          riskLabel: 'Verlust: -30% Gold',
          rewardLabel: `+${info.goldBase * 2} Gold + Shard`,
          apply: (api) => {
            if (api.gamble(win)) {
              api.gold(info.goldBase * 2);
              api.shards(1);
              api.log(`Die Münze fällt günstig! +${info.goldBase * 2} Gold und ein Shard.`, 'achievement');
            } else {
              api.gold(-Math.floor(info.player.gold * 0.3));
              api.log('Pech — der Geist nimmt 30% deines Goldes.', 'damage');
            }
          },
        },
        {
          id: 'reward',
          title: 'Sicher tauschen',
          description: 'Nimm den garantierten kleinen Gewinn.',
          tone: 'reward',
          rewardLabel: `+${Math.floor(info.goldBase * 0.8)} Gold, +1 Trank`,
          apply: (api) => {
            api.gold(Math.floor(info.goldBase * 0.8));
            api.potions(1);
            api.log(`Sicherer Tausch — +${Math.floor(info.goldBase * 0.8)} Gold und ein Trank.`, 'heal');
          },
        },
      ];
    },
  },
  {
    id: 'ancient-cache',
    icon: '📦',
    source: 'Uralter Hort',
    flavor: 'Eine versiegelte Truhe summt vor Energie. Das Schloss könnte eine Falle sein.',
    choices: (info) => [
      {
        id: 'risk',
        title: 'Gewaltsam öffnen',
        description: 'Brich das Siegel auf — egal, was lauert.',
        tone: 'risk',
        riskLabel: 'Risiko: -12% HP',
        rewardLabel: `+${info.goldBase + 20} Gold, Trank, Relikt-Chance`,
        apply: (api) => {
          api.hurt(0.12);
          api.gold(info.goldBase + 20);
          api.potions(1);
          if (api.gamble(45)) {
            api.relic();
          }
          api.shards(1);
          api.log(`Eine Falle schnappt zu, doch der Hort ist reich — +${info.goldBase + 20} Gold und mehr.`, 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Mechanik studieren',
        description: 'Entschärfe die Falle mit Bedacht.',
        tone: 'reward',
        rewardLabel: 'Fokus-Segen + Mana',
        apply: (api) => {
          api.mana(20);
          const label = api.blessing(['focus', 'fortune']);
          api.log(`Sorgfalt zahlt sich aus — ${label} und Mana.`, 'event');
        },
      },
    ],
  },
  {
    id: 'wandering-merchant',
    icon: '🧙',
    source: 'Wandernder Händler',
    flavor: 'Ein verhüllter Händler breitet seltene Ware aus und bietet dir einen Handel an.',
    choices: (info) => [
      {
        id: 'risk',
        title: 'Relikt erhandeln',
        description: 'Gib Gold für ein unbekanntes Relikt aus seinem Beutel.',
        tone: 'risk',
        riskLabel: `Kosten: ${info.goldBase + 30} Gold`,
        rewardLabel: 'Zufälliges Relikt',
        disabled: info.player.gold < info.goldBase + 30,
        apply: (api) => {
          api.gold(-(info.goldBase + 30));
          api.relic();
          api.log('Der Handel gelingt — ein Relikt wechselt den Besitzer.', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Vorräte kaufen',
        description: 'Nimm Tränke und einen Manaschluck.',
        tone: 'reward',
        rewardLabel: '+2 Tränke, +18 Mana',
        apply: (api) => {
          api.potions(2);
          api.mana(18);
          api.log('Du deckst dich mit Vorräten ein — +2 Tränke, +18 Mana.', 'heal');
        },
      },
    ],
  },
  {
    id: 'lost-soldier',
    icon: '🪖',
    source: 'Verlorener Soldat',
    flavor: 'Ein verwundeter Soldat lehnt an einem Felsen und bittet dich um Hilfe.',
    choices: (info) => [
      {
        id: 'risk',
        title: 'Wunden versorgen',
        description: 'Teile Vorräte und Zeit — er dankt es dir mit einem Segen.',
        tone: 'reward',
        riskLabel: 'Kosten: -1 Trank',
        rewardLabel: 'Kampf-Segen + Gold',
        disabled: info.player.potions < 1,
        apply: (api) => {
          api.potions(-1);
          api.gold(info.goldBase);
          api.fixedBlessing('battle', 2);
          api.log(`Dankbar teilt er Kampfwissen — Segen und +${info.goldBase} Gold.`, 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Weiterziehen',
        description: 'Nimm nur, was am Wegesrand liegt.',
        tone: 'safe',
        rewardLabel: `+${Math.floor(info.goldBase * 0.5)} Gold`,
        apply: (api) => {
          api.gold(Math.floor(info.goldBase * 0.5));
          api.log('Du ziehst weiter und findest etwas Gold.', 'event');
        },
      },
    ],
  },
  {
    id: 'dragon-ghost',
    icon: '🐉',
    source: 'Geist des Urdrachen',
    flavor: 'Ein schimmernder Drachengeist prüft deinen Mut mit einer uralten Frage.',
    choices: (info) => {
      const win = info.odds(55, 75);
      return [
        {
          id: 'risk',
          title: 'Herausforderung annehmen',
          description: 'Stelle dich der Prüfung des Geistes.',
          tone: 'risk',
          chance: win,
          riskLabel: 'Fehlschlag: -20% HP',
          rewardLabel: 'Dauerhaft +2 ATK + Shard',
          apply: (api) => {
            if (api.gamble(win)) {
              api.permanent('baseAttack', 2);
              api.shards(1);
              api.log('Du bestehst die Prüfung — dauerhaft +2 ATK und ein Shard!', 'achievement');
            } else {
              api.hurt(0.2);
              api.log('Die Prüfung überwältigt dich — der Geist entzieht Lebenskraft.', 'damage');
            }
          },
        },
        {
          id: 'reward',
          title: 'Um Weisheit bitten',
          description: 'Bescheidenheit bringt ruhige Gaben.',
          tone: 'reward',
          rewardLabel: '+1 Resolve, Fokus, Mana',
          apply: (api) => {
            api.mana(22);
            api.resolve(1);
            api.fixedBlessing('focus', 2);
            api.log('Weisheit fließt zu dir — Fokus, Mana und Resolve.', 'heal');
          },
        },
      ];
    },
  },
  {
    id: 'shrine-keeper',
    icon: '⛩',
    source: 'Drachenschrein-Hüter',
    flavor: 'Ein stiller Hüter bietet dir vollständige Heilung — gegen eine Opfergabe.',
    choices: (info) => [
      {
        id: 'risk',
        title: 'Opfergabe leisten',
        description: 'Lege Gold auf den Altar für vollständige Erholung.',
        tone: 'reward',
        riskLabel: 'Kosten: 60 Gold',
        rewardLabel: 'Voll-Heilung + Reinigung',
        disabled: info.player.gold < 60,
        apply: (api) => {
          api.gold(-60);
          api.heal(1);
          api.mana(999);
          api.cleanse();
          api.log('Der Altar leuchtet — volle HP, volles Mana, Status gereinigt.', 'heal');
        },
      },
      {
        id: 'reward',
        title: 'Nur rasten',
        description: 'Nimm eine bescheidene Erholung ohne Gabe.',
        tone: 'safe',
        rewardLabel: '+20% HP, +12 Mana',
        apply: (api) => {
          api.heal(0.2);
          api.mana(12);
          api.log('Eine kurze Rast stärkt dich etwas.', 'event');
        },
      },
    ],
  },
  {
    id: 'wandering-bard',
    icon: '🎵',
    source: 'Wandernder Barde',
    flavor: 'Ein Barde besingt deine Taten und hebt die Moral der Reise.',
    choices: (info) => [
      {
        id: 'risk',
        title: 'Zuhören & mitfeiern',
        description: 'Lass dich vom Lied mitreißen — Mut und Glück steigen.',
        tone: 'reward',
        rewardLabel: 'Glücks-Segen + Gold',
        apply: (api) => {
          api.gold(Math.floor(info.goldBase * 0.7));
          api.fixedBlessing('fortune', 2);
          api.log(`Das Lied beflügelt dich — Glücks-Segen und +${Math.floor(info.goldBase * 0.7)} Gold.`, 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Höflich weiterziehen',
        description: 'Ein kurzer Applaus, dann geht es weiter.',
        tone: 'safe',
        rewardLabel: '+10 Mana',
        apply: (api) => {
          api.mana(10);
          api.log('Die Melodie klärt deinen Geist — +10 Mana.', 'event');
        },
      },
    ],
  },

  // ───────────── Ember ─────────────
  {
    id: 'forge-spirit',
    icon: '🔥',
    source: 'Schmiedegeist',
    flavor: 'Zwischen glühenden Felsen hämmert ein Geist auf einen Amboss und mustert deine Waffe.',
    biomes: ['ember'],
    choices: (info) => [
      {
        id: 'risk',
        title: 'Klinge schärfen lassen',
        description: 'Bezahle den Geist für eine dauerhafte Verbesserung.',
        tone: 'reward',
        riskLabel: 'Kosten: 50 Gold',
        rewardLabel: 'Dauerhaft +3 ATK',
        disabled: info.player.gold < 50,
        apply: (api) => {
          api.gold(-50);
          api.permanent('baseAttack', 3);
          api.log('Funken sprühen — deine Klinge ist dauerhaft schärfer (+3 ATK).', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'An der Esse wärmen',
        description: 'Nimm die Hitze mit, ohne etwas zu zahlen.',
        tone: 'safe',
        rewardLabel: '+16 Mana, +10% HP',
        apply: (api) => {
          api.mana(16);
          api.heal(0.1);
          api.log('Die Esse wärmt Körper und Geist.', 'heal');
        },
      },
    ],
  },
  {
    id: 'lava-bridge',
    icon: '🌋',
    source: 'Lavabrücke',
    flavor: 'Eine brüchige Steinbrücke spannt sich über einen Lavastrom. Der Umweg ist weit.',
    biomes: ['ember'],
    choices: (info) => {
      const win = info.odds(58, 78);
      return [
        {
          id: 'risk',
          title: 'Brücke überqueren',
          description: 'Spring von Stein zu Stein, bevor sie zerbröckeln.',
          tone: 'risk',
          chance: win,
          riskLabel: 'Fehlschlag: -20% HP, Brand',
          rewardLabel: '+2 Shards',
          apply: (api) => {
            if (api.gamble(win)) {
              api.shards(2);
              api.log('Du erreichst die andere Seite und findest zwei Shards im Basalt.', 'achievement');
            } else {
              api.hurt(0.2);
              api.afflict(burn(3, 7));
              api.log('Die Brücke bricht — du rettest dich verbrannt ans Ufer.', 'damage');
            }
          },
        },
        {
          id: 'reward',
          title: 'Umweg nehmen',
          description: 'Der lange Weg ist sicher, aber nicht umsonst.',
          tone: 'safe',
          rewardLabel: `+${Math.floor(info.goldBase * 0.6)} Gold`,
          apply: (api) => {
            api.gold(Math.floor(info.goldBase * 0.6));
            api.log('Auf dem Umweg sammelst du etwas Gold ein.', 'event');
          },
        },
      ];
    },
  },
  {
    id: 'fire-fountain',
    icon: '♨',
    source: 'Feuerquelle',
    flavor: 'Eine Quelle aus flüssigem Licht brodelt in einer Felsschale.',
    biomes: ['ember'],
    choices: () => [
      {
        id: 'risk',
        title: 'Davon trinken',
        description: 'Die Glut stärkt dich — und verbrennt dich ein wenig.',
        tone: 'risk',
        riskLabel: 'Risiko: -10% HP',
        rewardLabel: '+30 Mana + Kampf-Segen',
        apply: (api) => {
          api.hurt(0.1);
          api.mana(30);
          api.fixedBlessing('battle', 2);
          api.log('Glut strömt durch deine Adern — Mana und Kampfrausch.', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Flaschen füllen',
        description: 'Sammle sicher einen Vorrat.',
        tone: 'safe',
        rewardLabel: '+1 Trank',
        apply: (api) => {
          api.potions(1);
          api.log('Du füllst eine Flasche mit warmem Elixier (+1 Trank).', 'heal');
        },
      },
    ],
  },
  {
    id: 'dragon-egg',
    icon: '🥚',
    source: 'Drachenei',
    flavor: 'In einer Mulde aus Asche liegt ein warmes, pochendes Ei.',
    biomes: ['ember'],
    minDepth: 4,
    choices: (info) => [
      {
        id: 'risk',
        title: 'Ei mit Mana wärmen',
        description: 'Gib einen Teil deiner Kraft, damit es schlüpft.',
        tone: 'reward',
        riskLabel: 'Kosten: 30 Mana',
        rewardLabel: '+3 Shards',
        disabled: info.player.mana < 30,
        apply: (api) => {
          api.mana(-30);
          api.shards(3);
          api.log('Das Ei zerfällt zu Splittern — drei Dragon Shards bleiben zurück.', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Liegen lassen',
        description: 'Manche Dinge sollen ungestört bleiben.',
        tone: 'safe',
        rewardLabel: '+1 Resolve',
        apply: (api) => {
          api.resolve(1);
          api.log('Dein Respekt vor dem Leben festigt deine Entschlossenheit.', 'event');
        },
      },
    ],
  },

  // ───────────── Grove ─────────────
  {
    id: 'druid',
    icon: '🌿',
    source: 'Waldheilerin',
    flavor: 'Eine alte Heilerin sortiert Kräuter unter einem Blätterdach.',
    biomes: ['grove'],
    choices: () => [
      {
        id: 'risk',
        title: 'Unbekannte Pilze probieren',
        description: 'Sie duften nach Heilung — oder Gift.',
        tone: 'risk',
        chance: 55,
        riskLabel: 'Fehlschlag: Gift',
        rewardLabel: '+2 Tränke, Reinigung',
        apply: (api) => {
          if (api.gamble(55)) {
            api.potions(2);
            api.cleanse();
            api.log('Die Pilze sind ein Segen — zwei Tränke und frische Kraft.', 'heal');
          } else {
            api.afflict(poison(3, 6));
            api.log('Die Pilze waren giftig!', 'damage');
          }
        },
      },
      {
        id: 'reward',
        title: 'Kräutertee annehmen',
        description: 'Die Heilerin reicht dir eine warme Tasse.',
        tone: 'reward',
        rewardLabel: '+25% HP, Reinigung',
        apply: (api) => {
          api.heal(0.25);
          api.cleanse();
          api.log('Der Tee heilt Wunden und reinigt den Körper.', 'heal');
        },
      },
    ],
  },
  {
    id: 'hollow-tree',
    icon: '🌳',
    source: 'Hohler Baum',
    flavor: 'In einem uralten Stamm glitzert etwas tief im Inneren.',
    biomes: ['grove'],
    choices: (info) => [
      {
        id: 'risk',
        title: 'Hineinklettern',
        description: 'Der Stamm ist eng und splittrig.',
        tone: 'risk',
        riskLabel: 'Risiko: -8% HP',
        rewardLabel: 'Relikt-Chance + Gold',
        apply: (api) => {
          api.hurt(0.08);
          api.gold(info.goldBase);
          if (api.gamble(40)) {
            api.relic();
          }
          api.log(`Zwischen Wurzeln liegt ein Schatz — +${info.goldBase} Gold.`, 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Außen absuchen',
        description: 'Ein paar Beeren und Nüsse tun es auch.',
        tone: 'safe',
        rewardLabel: '+1 Trank, +10 Mana',
        apply: (api) => {
          api.potions(1);
          api.mana(10);
          api.log('Du sammelst Beeren und Nüsse.', 'event');
        },
      },
    ],
  },
  {
    id: 'wolf-pack',
    icon: '🐺',
    source: 'Wolfsrudel',
    flavor: 'Gelbe Augen leuchten zwischen den Stämmen — ein hungriges Rudel umkreist dich.',
    biomes: ['grove'],
    choices: (info) => {
      const win = info.odds(60, 80);
      return [
        {
          id: 'risk',
          title: 'Rudel vertreiben',
          description: 'Zeige keine Furcht und schwinge deine Waffe.',
          tone: 'risk',
          chance: win,
          riskLabel: 'Fehlschlag: -15% HP',
          rewardLabel: `+${info.goldBase} Gold, Ruhm-Segen`,
          apply: (api) => {
            if (api.gamble(win)) {
              api.gold(info.goldBase);
              api.fixedBlessing('battle', 2);
              api.log('Das Rudel flieht — die Beute eines Jägers gehört dir.', 'achievement');
            } else {
              api.hurt(0.15);
              api.log('Das Rudel beißt zu, bevor es verschwindet.', 'damage');
            }
          },
        },
        {
          id: 'reward',
          title: 'Einen Trank opfern',
          description: 'Wirf ihnen Proviant hin und gehe in Deckung.',
          tone: 'safe',
          riskLabel: 'Kosten: -1 Trank',
          rewardLabel: 'Aegis-Segen',
          disabled: info.player.potions < 1,
          apply: (api) => {
            api.potions(-1);
            api.fixedBlessing('ward', 2);
            api.log('Satt und zufrieden bewachen die Wölfe deinen Weg.', 'event');
          },
        },
      ];
    },
  },

  // ───────────── Ruin ─────────────
  {
    id: 'sunken-crypt',
    icon: '⚰',
    source: 'Versunkene Gruft',
    flavor: 'Eine eingestürzte Treppe führt in eine überflutete Grabkammer.',
    biomes: ['ruin'],
    choices: (info) => [
      {
        id: 'risk',
        title: 'Gruft plündern',
        description: 'Tauche hinab und nimm, was die Toten hüten.',
        tone: 'risk',
        riskLabel: 'Risiko: -12% HP',
        rewardLabel: `+${Math.floor(info.goldBase * 1.6)} Gold + Shard`,
        apply: (api) => {
          api.hurt(0.12);
          api.gold(Math.floor(info.goldBase * 1.6));
          api.shards(1);
          api.log('Kalte Hände greifen nach dir, doch du entkommst mit reicher Beute.', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Für die Toten beten',
        description: 'Ehre die Ruhenden und bitte um Beistand.',
        tone: 'reward',
        rewardLabel: '+1 Resolve, +14 Mana',
        apply: (api) => {
          api.resolve(1);
          api.mana(14);
          api.log('Die Toten gewähren dir ihren Frieden.', 'heal');
        },
      },
    ],
  },
  {
    id: 'scholar-ghost',
    icon: '📜',
    source: 'Geisterschreiber',
    flavor: 'Ein durchscheinender Gelehrter kritzelt Runen in die Luft und winkt dich heran.',
    biomes: ['ruin'],
    choices: (info) => [
      {
        id: 'risk',
        title: 'Zielkunst lernen',
        description: 'Er lehrt dich, Schwachstellen zu erkennen.',
        tone: 'reward',
        riskLabel: 'Kosten: 40 Gold',
        rewardLabel: 'Dauerhaft +3 Krit',
        disabled: info.player.gold < 40,
        apply: (api) => {
          api.gold(-40);
          api.permanent('baseCrit', 3);
          api.log('Deine Hiebe finden künftig öfter ihr Ziel (+3 Krit).', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Notizen abschreiben',
        description: 'Ein paar Fußnoten sind gratis.',
        tone: 'safe',
        rewardLabel: 'Fokus-Segen',
        apply: (api) => {
          api.fixedBlessing('focus', 2);
          api.log('Die Notizen schärfen deine Konzentration.', 'event');
        },
      },
    ],
  },
  {
    id: 'mirror-pool',
    icon: '🪞',
    source: 'Spiegelteich',
    flavor: 'Dein Spiegelbild im schwarzen Wasser bewegt sich einen Herzschlag zu früh.',
    biomes: ['ruin'],
    choices: (info) => {
      const win = info.odds(50, 70);
      return [
        {
          id: 'risk',
          title: 'Das Wasser berühren',
          description: 'Fordere dein Spiegelbild heraus.',
          tone: 'risk',
          chance: win,
          riskLabel: 'Fehlschlag: -25% Mana',
          rewardLabel: 'Dauerhaft +3 DEF',
          apply: (api) => {
            if (api.gamble(win)) {
              api.permanent('baseDefense', 3);
              api.log('Du bezwingst dein Spiegelbild — dauerhaft +3 DEF.', 'achievement');
            } else {
              api.mana(-Math.floor(info.player.maxMana * 0.25));
              api.log('Das Spiegelbild saugt dir Mana aus.', 'damage');
            }
          },
        },
        {
          id: 'reward',
          title: 'Abwenden',
          description: 'Nicht jeder Blick lohnt sich.',
          tone: 'safe',
          rewardLabel: '+8 Mana',
          apply: (api) => {
            api.mana(8);
            api.log('Du wendest den Blick ab und gewinnst Ruhe.', 'event');
          },
        },
      ];
    },
  },

  // ───────────── Frost ─────────────
  {
    id: 'ice-hermit',
    icon: '🧓',
    source: 'Eisklausner',
    flavor: 'Ein Einsiedler friert vor einer Eishöhle und mustert deine Vorräte.',
    biomes: ['frost'],
    choices: (info) => [
      {
        id: 'risk',
        title: 'Einen Trank schenken',
        description: 'Er revanchiert sich mit alter Kältekunst.',
        tone: 'reward',
        riskLabel: 'Kosten: -1 Trank',
        rewardLabel: 'Dauerhaft +8 Max-HP',
        disabled: info.player.potions < 1,
        apply: (api) => {
          api.potions(-1);
          api.permanent('maxHp', 8);
          api.log('Der Einsiedler härtet deinen Körper — dauerhaft +8 Max-HP.', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Weiterziehen',
        description: 'Du hast selbst zu wenig.',
        tone: 'safe',
        rewardLabel: `+${Math.floor(info.goldBase * 0.4)} Gold`,
        apply: (api) => {
          api.gold(Math.floor(info.goldBase * 0.4));
          api.log('Im Schnee findest du etwas Münzgeld.', 'event');
        },
      },
    ],
  },
  {
    id: 'frozen-knight',
    icon: '🗿',
    source: 'Eingefrorener Ritter',
    flavor: 'Ein Ritter steht reglos im Eis, die Hand am Schwertgriff.',
    biomes: ['frost'],
    choices: (info) => {
      const win = info.odds(50, 70);
      return [
        {
          id: 'risk',
          title: 'Eis aufschmelzen',
          description: 'Befreie den Ritter — er könnte dankbar oder wütend sein.',
          tone: 'risk',
          chance: win,
          riskLabel: 'Fehlschlag: -15% HP',
          rewardLabel: 'Relikt',
          apply: (api) => {
            if (api.gamble(win)) {
              api.relic();
              api.log('Der Ritter überreicht dir ein Erbstück zum Dank.', 'achievement');
            } else {
              api.hurt(0.15);
              api.log('Der erwachte Ritter schlägt wild um sich.', 'damage');
            }
          },
        },
        {
          id: 'reward',
          title: 'Splitter sammeln',
          description: 'Nimm nur die Eisfragmente mit.',
          tone: 'safe',
          rewardLabel: `+${Math.floor(info.goldBase * 0.7)} Gold`,
          apply: (api) => {
            api.gold(Math.floor(info.goldBase * 0.7));
            api.log('Die Eissplitter lassen sich gut verkaufen.', 'event');
          },
        },
      ];
    },
  },
  {
    id: 'aurora',
    icon: '🌌',
    source: 'Polarlicht',
    flavor: 'Der Himmel leuchtet grün und violett — die Luft summt vor Magie.',
    biomes: ['frost'],
    choices: () => [
      {
        id: 'risk',
        title: 'In das Licht starren',
        description: 'Es blendet, aber es segnet auch.',
        tone: 'risk',
        riskLabel: 'Risiko: -6% HP',
        rewardLabel: 'Glücks-Segen + 20 Mana',
        apply: (api) => {
          api.hurt(0.06);
          api.mana(20);
          api.fixedBlessing('fortune', 2);
          api.log('Das Polarlicht schenkt dir Glück und Mana.', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Still genießen',
        description: 'Schau zu und finde Ruhe.',
        tone: 'safe',
        rewardLabel: '+28 Mana, +1 Resolve',
        apply: (api) => {
          api.mana(28);
          api.resolve(1);
          api.log('Das Lichtspiel beruhigt Geist und Körper.', 'heal');
        },
      },
    ],
  },

  // ───────────── Storm ─────────────
  {
    id: 'lightning-rod',
    icon: '⚡',
    source: 'Blitzableiter',
    flavor: 'Ein uralter Metallstab ragt in den Sturmhimmel; Funken tanzen an seiner Spitze.',
    biomes: ['storm'],
    choices: (info) => {
      const win = info.odds(52, 72);
      return [
        {
          id: 'risk',
          title: 'Stab berühren',
          description: 'Lass den Blitz durch deine Waffe fahren.',
          tone: 'risk',
          chance: win,
          riskLabel: 'Fehlschlag: -22% HP, Brand',
          rewardLabel: 'Dauerhaft +3 ATK',
          apply: (api) => {
            if (api.gamble(win)) {
              api.permanent('baseAttack', 3);
              api.log('Der Blitz lädt deine Waffe auf — dauerhaft +3 ATK.', 'achievement');
            } else {
              api.hurt(0.22);
              api.afflict(burn(3, 7));
              api.log('Der Blitz schlägt dich nieder!', 'damage');
            }
          },
        },
        {
          id: 'reward',
          title: 'Unterstand suchen',
          description: 'Warte das Gewitter in einer Felsspalte ab.',
          tone: 'safe',
          rewardLabel: '+18 Mana, +10% HP',
          apply: (api) => {
            api.mana(18);
            api.heal(0.1);
            api.log('Im Unterstand erholst du dich vom Sturm.', 'heal');
          },
        },
      ];
    },
  },
  {
    id: 'storm-trader',
    icon: '🪁',
    source: 'Windhändler',
    flavor: 'Ein Händler klammert sich an sein flatterndes Zelt und schreit sein Angebot in den Wind.',
    biomes: ['storm'],
    choices: (info) => [
      {
        id: 'risk',
        title: 'Sturmpaket kaufen',
        description: 'Zwei Tränke und ein Fokus-Segen.',
        tone: 'reward',
        riskLabel: 'Kosten: 70 Gold',
        rewardLabel: '+2 Tränke, Fokus-Segen',
        disabled: info.player.gold < 70,
        apply: (api) => {
          api.gold(-70);
          api.potions(2);
          api.fixedBlessing('focus', 2);
          api.log('Der Händler packt dir sein Sturmpaket ein.', 'event');
        },
      },
      {
        id: 'reward',
        title: 'Einen Trank verkaufen',
        description: 'Er zahlt gut für Heiltränke.',
        tone: 'safe',
        riskLabel: 'Kosten: -1 Trank',
        rewardLabel: `+${Math.floor(info.goldBase * 1.2)} Gold`,
        disabled: info.player.potions < 1,
        apply: (api) => {
          api.potions(-1);
          api.gold(Math.floor(info.goldBase * 1.2));
          api.log('Ein Trank wechselt für klingende Münze den Besitzer.', 'event');
        },
      },
    ],
  },
  {
    id: 'wind-shrine',
    icon: '🌀',
    source: 'Windschrein',
    flavor: 'Kleine Windspiele klingen um einen Schrein, in dem Sturmgeister wohnen.',
    biomes: ['storm'],
    choices: (info) => [
      {
        id: 'risk',
        title: 'Münzen opfern',
        description: 'Streue Gold in den Wind.',
        tone: 'reward',
        riskLabel: 'Kosten: 40 Gold',
        rewardLabel: 'Aegis-Segen + Shard',
        disabled: info.player.gold < 40,
        apply: (api) => {
          api.gold(-40);
          api.fixedBlessing('ward', 2);
          api.shards(1);
          api.log('Die Sturmgeister nehmen dein Opfer an.', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Windspiele lauschen',
        description: 'Der Klang beruhigt.',
        tone: 'safe',
        rewardLabel: '+14 Mana',
        apply: (api) => {
          api.mana(14);
          api.log('Das Läuten klärt deinen Geist.', 'event');
        },
      },
    ],
  },

  // ───────────── Sanctum ─────────────
  {
    id: 'angel-statue',
    icon: '👼',
    source: 'Engelsstatue',
    flavor: 'Eine strahlend weiße Statue hält eine Schale mit Licht in den Händen.',
    biomes: ['sanctum'],
    choices: (info) => [
      {
        id: 'risk',
        title: 'Spende leisten',
        description: 'Lege Gold in die Schale und bitte um Klärung.',
        tone: 'reward',
        riskLabel: 'Kosten: 30 Gold',
        rewardLabel: 'Reinigung + Resolve voll',
        disabled: info.player.gold < 30,
        apply: (api) => {
          api.gold(-30);
          api.cleanse();
          api.resolve(99);
          api.log('Licht umhüllt dich — Status gereinigt, Resolve aufgefüllt.', 'heal');
        },
      },
      {
        id: 'reward',
        title: 'Kurz verweilen',
        description: 'Ein stilles Gebet kostet nichts.',
        tone: 'safe',
        rewardLabel: '+20% HP',
        apply: (api) => {
          api.heal(0.2);
          api.log('Ein sanfter Glanz schließt deine Wunden.', 'heal');
        },
      },
    ],
  },
  {
    id: 'oath-stone',
    icon: '🪨',
    source: 'Eidstein',
    flavor: 'Ein glatter Stein trägt das Siegel eines alten Ordens. Wer schwört, wird geprüft.',
    biomes: ['sanctum'],
    choices: () => [
      {
        id: 'risk',
        title: 'Den Eid schwören',
        description: 'Binde dich an den Orden — es schmerzt.',
        tone: 'risk',
        riskLabel: 'Risiko: -10% HP',
        rewardLabel: 'Dauerhaft +1 Max-Resolve',
        apply: (api) => {
          api.hurt(0.1);
          api.permanent('maxResolve', 1);
          api.log('Du leistest den Eid — dein Wille wächst (+1 Max-Resolve).', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Stein nur berühren',
        description: 'Ein flüchtiger Segen.',
        tone: 'safe',
        rewardLabel: 'Aegis-Segen',
        apply: (api) => {
          api.fixedBlessing('ward', 2);
          api.log('Der Stein gewährt einen kleinen Schutz.', 'event');
        },
      },
    ],
  },
  {
    id: 'pilgrims',
    icon: '🕯',
    source: 'Pilgergruppe',
    flavor: 'Müde Pilger ruhen am Wegrand und bitten um etwas Heilung.',
    biomes: ['sanctum'],
    choices: (info) => [
      {
        id: 'risk',
        title: 'Einen Trank teilen',
        description: 'Sie segnen deinen weiteren Weg.',
        tone: 'reward',
        riskLabel: 'Kosten: -1 Trank',
        rewardLabel: 'Vitalitäts-Segen + Gold',
        disabled: info.player.potions < 1,
        apply: (api) => {
          api.potions(-1);
          api.fixedBlessing('vigor', 2);
          api.gold(Math.floor(info.goldBase * 0.6));
          api.log('Die Pilger danken dir mit Segen und einer Spende.', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Mit ihnen rasten',
        description: 'Teile ein Feuer, nicht mehr.',
        tone: 'safe',
        rewardLabel: '+10 Mana',
        apply: (api) => {
          api.mana(10);
          api.log('Das Feuer und die Gespräche tun gut.', 'event');
        },
      },
    ],
  },

  // ───────────── Anywhere ─────────────
  {
    id: 'void-rift',
    icon: '🕳',
    source: 'Leerenriss',
    flavor: 'Ein Riss in der Luft flüstert deinen Namen. Dahinter glimmt etwas.',
    minDepth: 3,
    choices: (info) => {
      const win = info.odds(48, 68);
      return [
        {
          id: 'risk',
          title: 'Hineingreifen',
          description: 'Zieh heraus, was dort glimmt.',
          tone: 'risk',
          chance: win,
          riskLabel: 'Fehlschlag: -18% HP, Gift',
          rewardLabel: 'Relikt',
          apply: (api) => {
            if (api.gamble(win)) {
              api.relic();
              api.log('Aus der Leere zieht deine Hand ein Relikt.', 'achievement');
            } else {
              api.hurt(0.18);
              api.afflict(poison(3, 6));
              api.log('Die Leere beißt zurück!', 'damage');
            }
          },
        },
        {
          id: 'reward',
          title: 'Riss versiegeln',
          description: 'Lass den Riss nicht größer werden.',
          tone: 'safe',
          rewardLabel: '+1 Shard',
          apply: (api) => {
            api.shards(1);
            api.log('Beim Versiegeln kondensiert ein Dragon Shard.', 'achievement');
          },
        },
      ];
    },
  },
  {
    id: 'dice-gambler',
    icon: '🎲',
    source: 'Würfelspieler',
    flavor: 'Ein Spieler klappert mit Würfeln und grinst dich an: „Fünfzig Gold, Fremder?“',
    choices: (info) => [
      {
        id: 'risk',
        title: 'Mitspielen',
        description: 'Setze 50 Gold auf einen Wurf.',
        tone: 'risk',
        chance: 48,
        riskLabel: 'Fehlschlag: -50 Gold',
        rewardLabel: '+100 Gold',
        disabled: info.player.gold < 50,
        apply: (api) => {
          if (api.gamble(48)) {
            api.gold(100);
            api.log('Die Würfel fallen günstig — +100 Gold!', 'achievement');
          } else {
            api.gold(-50);
            api.log('Die Würfel sind gegen dich — -50 Gold.', 'damage');
          }
        },
      },
      {
        id: 'reward',
        title: 'Ablehnen',
        description: 'Lieber behältst du deinen Beutel.',
        tone: 'safe',
        rewardLabel: '+6 Mana',
        apply: (api) => {
          api.mana(6);
          api.log('Du gehst weiter, den Beutel fest in der Hand.', 'event');
        },
      },
    ],
  },
  {
    id: 'campfire-tale',
    icon: '🏕',
    source: 'Lagerfeuer-Geschichte',
    flavor: 'Reisende laden dich an ihr Feuer ein und erzählen von fernen Ländern.',
    choices: (info) => [
      {
        id: 'risk',
        title: 'Beute teilen',
        description: 'Gib ein wenig Gold für ihre Freundschaft.',
        tone: 'reward',
        riskLabel: 'Kosten: 30 Gold',
        rewardLabel: 'Dauerhaft +1 Glück',
        disabled: info.player.gold < 30,
        apply: (api) => {
          api.gold(-30);
          api.permanent('luck', 1);
          api.log('Ihre Glücksbringer begleiten dich — dauerhaft +1 Glück.', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Zuhören',
        description: 'Wärme und gute Geschichten.',
        tone: 'safe',
        rewardLabel: '+16 Mana, +10% HP',
        apply: (api) => {
          api.mana(16);
          api.heal(0.1);
          api.log('Die Geschichten wärmen Herz und Glieder.', 'heal');
        },
      },
    ],
  },
  {
    id: 'blacksmith-apprentice',
    icon: '🛠',
    source: 'Schmiedelehrling',
    flavor: 'Ein Lehrling bietet dir an, deine Ausrüstung für wenig Geld zu verbessern.',
    choices: (info) => [
      {
        id: 'risk',
        title: 'Waffe verstärken',
        description: 'Er feilt an der Schneide.',
        tone: 'reward',
        riskLabel: 'Kosten: 60 Gold',
        rewardLabel: 'Dauerhaft +2 ATK',
        disabled: info.player.gold < 60,
        apply: (api) => {
          api.gold(-60);
          api.permanent('baseAttack', 2);
          api.log('Die Klinge liegt besser in der Hand (+2 ATK).', 'achievement');
        },
      },
      {
        id: 'reward',
        title: 'Rüstung polstern',
        description: 'Er näht Platten nach.',
        tone: 'reward',
        riskLabel: 'Kosten: 60 Gold',
        rewardLabel: 'Dauerhaft +2 DEF',
        disabled: info.player.gold < 60,
        apply: (api) => {
          api.gold(-60);
          api.permanent('baseDefense', 2);
          api.log('Deine Rüstung sitzt fester (+2 DEF).', 'achievement');
        },
      },
    ],
  },
  {
    id: 'cursed-chest',
    icon: '🧰',
    source: 'Verfluchte Truhe',
    flavor: 'Eine schwarze Truhe flüstert: „Öffne mich.“ Ketten rasseln dazu.',
    minDepth: 4,
    choices: (info) => {
      const win = info.odds(58, 78);
      return [
        {
          id: 'risk',
          title: 'Truhe öffnen',
          description: 'Der Fluch könnte stark sein — der Inhalt auch.',
          tone: 'risk',
          chance: win,
          riskLabel: 'Fehlschlag: -20% HP, Gift',
          rewardLabel: `Relikt + ${info.goldBase} Gold`,
          apply: (api) => {
            if (api.gamble(win)) {
              api.relic();
              api.gold(info.goldBase);
              api.log('Der Fluch bleibt aus — die Truhe gibt ihre Schätze frei.', 'achievement');
            } else {
              api.hurt(0.2);
              api.afflict(poison(4, 6));
              api.log('Der Fluch trifft dich mit voller Wucht!', 'damage');
            }
          },
        },
        {
          id: 'reward',
          title: 'Liegen lassen',
          description: 'Nimm nur die losen Münzen daneben.',
          tone: 'safe',
          rewardLabel: '+15 Gold',
          apply: (api) => {
            api.gold(15);
            api.log('Du nimmst die losen Münzen und gehst weiter.', 'event');
          },
        },
      ];
    },
  },
  {
    id: 'thief',
    icon: '🥷',
    source: 'Flinker Dieb',
    flavor: 'Ein Schatten huscht davon — und mit ihm ein Teil deines Beutels.',
    choices: (info) => {
      const win = info.odds(55, 75);
      return [
        {
          id: 'risk',
          title: 'Verfolgen',
          description: 'Schnapp ihn dir, bevor er verschwindet.',
          tone: 'risk',
          chance: win,
          riskLabel: 'Fehlschlag: -20 Gold',
          rewardLabel: '+40 Gold + Shard',
          apply: (api) => {
            if (api.gamble(win)) {
              api.gold(40);
              api.shards(1);
              api.log('Du erwischst den Dieb und nimmst mehr zurück, als er stahl.', 'achievement');
            } else {
              api.gold(-20);
              api.log('Der Dieb entkommt mit 20 Gold.', 'damage');
            }
          },
        },
        {
          id: 'reward',
          title: 'Gewinn verbuchen',
          description: 'Er hat nur Kleingeld erwischt.',
          tone: 'safe',
          rewardLabel: '+8 Mana',
          apply: (api) => {
            api.mana(8);
            api.log('Du lässt ihn ziehen und atmest durch.', 'event');
          },
        },
      ];
    },
  },
  {
    id: 'meditation-stone',
    icon: '🧘',
    source: 'Meditationsstein',
    flavor: 'Ein flacher Stein lädt zum Sitzen ein. Alles ist plötzlich ganz ruhig.',
    choices: () => [
      {
        id: 'risk',
        title: 'Tief versenken',
        description: 'Eine lange Meditation kostet Zeit und Kraft.',
        tone: 'reward',
        rewardLabel: '+1 Resolve, Vitalität',
        apply: (api) => {
          api.resolve(1);
          api.fixedBlessing('vigor', 2);
          api.log('Du erwachst gestärkt und gesammelt.', 'heal');
        },
      },
      {
        id: 'reward',
        title: 'Kurz durchatmen',
        description: 'Ein paar Atemzüge genügen.',
        tone: 'safe',
        rewardLabel: '+12 Mana, +10% HP',
        apply: (api) => {
          api.mana(12);
          api.heal(0.1);
          api.log('Ein kurzer Moment der Ruhe.', 'event');
        },
      },
    ],
  },
];

/**
 * Picks an event for the current depth and biome. Events tagged with the biome are three
 * times as likely as generic ones; events tagged for other biomes are rare.
 */
export function pickEvent(
  biome: PathBiome | undefined,
  depth: number,
  random: () => number = Math.random,
  library: EventDef[] = EVENT_LIBRARY,
): EventDef {
  const eligible = library.filter((event) => (event.minDepth ?? 0) <= depth);
  const pool = eligible.length ? eligible : library;
  const weights = pool.map((event) => {
    if (!event.biomes) {
      return 2;
    }

    return biome && event.biomes.includes(biome) ? 6 : 0.5;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = random() * total;

  for (const [index, event] of pool.entries()) {
    roll -= weights[index];

    if (roll < 0) {
      return event;
    }
  }

  return pool[pool.length - 1];
}
