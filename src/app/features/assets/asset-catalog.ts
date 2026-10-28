// Relative (no leading slash) so URLs resolve against <base href>, which the
// production build rewrites to "/dragon-quest-rpg/" for GitHub Pages. An
// absolute "/assets" would 404 because the app is not served from the domain root.
const assetRoot = 'assets';
const tinySwords = `${assetRoot}/Tiny%20Swords%20%28Free%20Pack%29`;
const tinyDungeon = `${assetRoot}/kenney_tinyDungeon`;

export const assets = {
  units: {
    hero: { idle: `${tinySwords}/Units/Blue%20Units/Warrior/Warrior_Idle.png`, frames: 8 },
    slime: { idle: `${tinySwords}/Units/Red%20Units/Pawn/Pawn_Idle.png`, frames: 8 },
    bat: { idle: `${tinySwords}/Units/Red%20Units/Archer/Archer_Idle.png`, frames: 6 },
    skeleton: { idle: `${tinySwords}/Units/Purple%20Units/Pawn/Pawn_Idle%20Axe.png`, frames: 8 },
    knight: { idle: `${tinySwords}/Units/Red%20Units/Warrior/Warrior_Idle.png`, frames: 8 },
    wyvern: { idle: `${tinySwords}/Units/Yellow%20Units/Lancer/Lancer_Idle.png`, frames: 12 },
    ancient: { idle: `${tinySwords}/Units/Purple%20Units/Warrior/Warrior_Idle.png`, frames: 8 },
    boss: { idle: `${tinySwords}/Units/Red%20Units/Lancer/Lancer_Idle.png`, frames: 12 },
    // --- Expanded bestiary sprites (biome variants) ---
    fireSprite: { idle: `${tinySwords}/Units/Yellow%20Units/Archer/Archer_Idle.png`, frames: 6 },
    lavaGolem: { idle: `${tinySwords}/Units/Yellow%20Units/Warrior/Warrior_Idle.png`, frames: 8 },
    magmaDrake: { idle: `${tinySwords}/Units/Yellow%20Units/Pawn/Pawn_Idle.png`, frames: 8 },
    forestWisp: { idle: `${tinySwords}/Units/Blue%20Units/Archer/Archer_Idle.png`, frames: 6 },
    treantArcher: { idle: `${tinySwords}/Units/Blue%20Units/Pawn/Pawn_Idle.png`, frames: 8 },
    vineHorror: { idle: `${tinySwords}/Units/Blue%20Units/Lancer/Lancer_Idle.png`, frames: 12 },
    tombGuardian: { idle: `${tinySwords}/Units/Black%20Units/Warrior/Warrior_Idle.png`, frames: 8 },
    cursedArmor: { idle: `${tinySwords}/Units/Black%20Units/Pawn/Pawn_Idle.png`, frames: 8 },
    shadowRemnant: { idle: `${tinySwords}/Units/Black%20Units/Archer/Archer_Idle.png`, frames: 6 },
    iceWraith: { idle: `${tinySwords}/Units/Purple%20Units/Archer/Archer_Idle.png`, frames: 6 },
    frostBear: { idle: `${tinySwords}/Units/Purple%20Units/Pawn/Pawn_Idle.png`, frames: 8 },
    blizzardElemental: { idle: `${tinySwords}/Units/Purple%20Units/Lancer/Lancer_Idle.png`, frames: 12 },
    thunderHawk: { idle: `${tinySwords}/Units/Red%20Units/Archer/Archer_Idle.png`, frames: 6 },
    stormDjinn: { idle: `${tinySwords}/Units/Yellow%20Units/Monk/Idle.png`, frames: 8 },
    cycloneSerpent: { idle: `${tinySwords}/Units/Black%20Units/Lancer/Lancer_Idle.png`, frames: 12 },
    holySentinel: { idle: `${tinySwords}/Units/Blue%20Units/Warrior/Warrior_Idle.png`, frames: 8 },
    runeGolem: { idle: `${tinySwords}/Units/Blue%20Units/Monk/Idle.png`, frames: 8 },
    voidWalker: { idle: `${tinySwords}/Units/Black%20Units/Monk/Idle.png`, frames: 8 },
  },
  // Every node type has its own tile so routes are readable at a glance.
  nodes: {
    treasure: `${tinyDungeon}/Tiles/tile_0089.png`,
    shrine: `${tinyDungeon}/Tiles/tile_0032.png`,
    camp: `${tinyDungeon}/Tiles/tile_0029.png`,
    boss: `${tinyDungeon}/Tiles/tile_0047.png`,
    forge: `${tinyDungeon}/Tiles/tile_0064.png`,
    merchant: `${tinyDungeon}/Tiles/tile_0087.png`,
    sanctuary: `${tinyDungeon}/Tiles/tile_0044.png`,
  },
  fx: {
    fire: `${tinySwords}/Particle%20FX/Fire_01.png`,
    explosion: `${tinySwords}/Particle%20FX/Explosion_01.png`,
    explosionBig: `${tinySwords}/Particle%20FX/Explosion_02.png`,
    dust: `${tinySwords}/Particle%20FX/Dust_01.png`,
  },
  decor: {
    rocks: [1, 2, 3, 4].map((n) => `${tinySwords}/Terrain/Decorations/Rocks/Rock${n}.png`),
    bushes: [1, 2, 3, 4].map((n) => `${tinySwords}/Terrain/Decorations/Bushes/Bushe${n}.png`),
  },
  ui: {
    paper: `${tinySwords}/UI%20Elements/UI%20Elements/Papers/SpecialPaper.png`,
    handbook: `${tinySwords}/UI%20Elements/UI%20Elements/Icons/Icon_05.png`,
  },
} as const;

export type UnitSprite = (typeof assets.units)[keyof typeof assets.units];

/**
 * Maps an idle sheet to the sheet that shows the unit attacking, or null if none exists.
 * Tiny Swords names its sheets consistently, so the mapping is a pure string rewrite.
 */
export function attackSheetFor(idleUrl: string): string | null {
  const url = idleUrl;

  if (url.includes('Warrior_Idle.png')) return url.replace('Warrior_Idle.png', 'Warrior_Attack1.png');
  if (url.includes('Archer_Idle.png')) return url.replace('Archer_Idle.png', 'Archer_Shoot.png');
  if (url.includes('Lancer_Idle.png')) return url.replace('Lancer_Idle.png', 'Lancer_Right_Attack.png');
  if (/\/Monk\/Idle\.png$/.test(url)) return url.replace('/Idle.png', '/Heal.png');

  const pawn = /Pawn_Idle(?:%20(Axe|Hammer|Knife|Pickaxe))?\.png$/.exec(url);
  if (pawn) {
    return url.replace(/Pawn_Idle(?:%20\w+)?\.png$/, `Pawn_Interact%20${pawn[1] ?? 'Hammer'}.png`);
  }

  return null;
}
