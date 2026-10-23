import { BOSS_POOL, createEnemy, ENEMY_BLUEPRINTS, randomBossId } from './enemy-blueprints';

describe('enemy blueprints', () => {
  it('gives every blueprint an element weakness', () => {
    for (const id of Object.keys(ENEMY_BLUEPRINTS)) {
      expect(createEnemy(id, 1).weakness, id).toBeTruthy();
    }
  });

  it('uses per-enemy affinities instead of role defaults', () => {
    const frost = createEnemy('frost-bear', 1);

    expect(frost.weakness).toBe('fire');
    expect(frost.resistance).toBe('ice');
  });

  it('builds distinct bosses with their own signature and hp', () => {
    const bosses = BOSS_POOL.map((id) => createEnemy(id, 8, true));

    expect(new Set(bosses.map((boss) => boss.name)).size).toBe(BOSS_POOL.length);
    expect(bosses.every((boss) => boss.isBoss && boss.role === 'boss')).toBe(true);
    expect(bosses.find((boss) => boss.name.includes('Frostwyrm'))?.signature?.forceStatus).toBe(
      true,
    );
    expect(new Set(bosses.map((boss) => boss.maxHp)).size).toBeGreaterThan(1);
  });

  it('falls back to the dragon king for unknown boss ids and picks pool members randomly', () => {
    expect(createEnemy('slime', 8, true).name).toBe('Drachenkonig');
    expect(BOSS_POOL).toContain(randomBossId());
  });

  it('scales hp with New Game+', () => {
    expect(createEnemy('slime', 1, false, 1, 2).maxHp).toBeGreaterThan(createEnemy('slime', 1).maxHp);
  });
});
