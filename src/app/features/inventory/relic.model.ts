export type RelicId =
  | 'wyrmfang-seal'
  | 'aegis-feather'
  | 'oracle-lens'
  | 'gilded-compass'
  | 'embersigil';

export interface Relic {
  id: RelicId;
  name: string;
  icon: string;
  desc: string;
}
