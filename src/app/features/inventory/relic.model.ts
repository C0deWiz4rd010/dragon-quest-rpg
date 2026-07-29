export type RelicId =
  | 'wyrmfang-seal'
  | 'aegis-feather'
  | 'oracle-lens'
  | 'gilded-compass'
  | 'embersigil'
  | 'storm-signet'
  | 'frozen-crest'
  | 'shadow-mantle'
  | 'grove-charm'
  | 'ruin-ward'
  | 'sanctum-orb'
  | 'void-fragment'
  | 'tempest-seal'
  | 'drake-talisman'
  | 'dusk-medallion'
  | 'twin-fang'
  | 'bastion-core'
  | 'celestial-lens';

export type RelicBiome = 'ember' | 'grove' | 'ruin' | 'frost' | 'storm' | 'sanctum';

export interface Relic {
  id: RelicId;
  name: string;
  icon: string;
  desc: string;
  biome?: RelicBiome;
  synergy?: RelicId;
}
