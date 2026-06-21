export type GameLogType = 'normal' | 'damage' | 'heal' | 'critical' | 'skill' | 'event' | 'achievement';

export interface GameLogEntry {
  id: string;
  message: string;
  type: GameLogType;
  createdAt: Date;
}
