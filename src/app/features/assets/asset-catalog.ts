const assetRoot = '/assets';
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
  },
  nodes: {
    treasure: `${tinyDungeon}/Tiles/tile_0044.png`,
    shrine: `${tinyDungeon}/Tiles/tile_0068.png`,
    camp: `${tinyDungeon}/Tiles/tile_0087.png`,
    boss: `${tinyDungeon}/Tiles/tile_0047.png`,
    forge: `${tinyDungeon}/Tiles/tile_0044.png`,
    merchant: `${tinyDungeon}/Tiles/tile_0087.png`,
    sanctuary: `${tinyDungeon}/Tiles/tile_0068.png`,
  },
  ui: {
    paper: `${tinySwords}/UI%20Elements/UI%20Elements/Papers/SpecialPaper.png`,
    handbook: `${tinySwords}/UI%20Elements/UI%20Elements/Icons/Icon_05.png`,
  },
} as const;

export type UnitSprite = (typeof assets.units)[keyof typeof assets.units];
