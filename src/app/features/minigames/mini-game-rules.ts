/** Pure difficulty and scoring rules for the mini-games, kept out of the overlay for testing. */

export interface MiniGameDifficulty {
  /** Length of the colour sequence in the memory game. */
  memoryLength: number;
  /** Seconds to hit the dot, and how often it jumps. */
  precisionSeconds: number;
  precisionMoveMs: number;
  /** Seconds to type the sentence. */
  typingSeconds: number;
  /** Number of sums and the time to solve them all. */
  sumsCount: number;
  sumsSeconds: number;
  /** Slowest reaction (ms) that still counts as a win. */
  reactionLimitMs: number;
}

/** Deeper routes make every mini-game a little harder; values are clamped to stay fair. */
export function miniGameDifficulty(depth: number): MiniGameDifficulty {
  const d = Math.max(0, depth);

  return {
    memoryLength: Math.min(7, 4 + Math.floor(d / 4)),
    precisionSeconds: Math.max(2, 3 - Math.floor(d / 8)),
    precisionMoveMs: Math.max(380, 600 - d * 12),
    typingSeconds: Math.max(7, 10 - Math.floor(d / 5)),
    sumsCount: Math.min(5, 3 + Math.floor(d / 6)),
    sumsSeconds: Math.max(10, 16 - Math.floor(d / 4)),
    reactionLimitMs: Math.max(450, 700 - d * 10),
  };
}

/** Score 60-100 for finishing with `remaining` of `total` seconds left; 0 for a loss. */
export function timeScore(won: boolean, remaining: number, total: number): number {
  if (!won || total <= 0) {
    return 0;
  }

  const ratio = Math.min(1, Math.max(0, remaining / total));

  return Math.round(60 + 40 * ratio);
}

/** Longer sequences are worth more: 4 colours = 70, +8 per extra colour. */
export function memoryScore(won: boolean, length: number): number {
  if (!won) {
    return 20;
  }

  return Math.min(100, 70 + Math.max(0, length - 4) * 10);
}

/** Faster reactions score higher; anything under the limit wins. */
export function reactionScore(ms: number, limitMs: number): number {
  if (ms >= limitMs) {
    return 0;
  }

  return Math.max(1, Math.round(((limitMs - ms) / limitMs) * 100));
}

export interface SumProblem {
  text: string;
  answer: number;
}

/** Generates simple arithmetic problems that scale mildly with depth. */
export function generateSums(
  count: number,
  depth: number,
  random: () => number = Math.random,
): SumProblem[] {
  const max = 9 + Math.min(20, Math.floor(depth / 2));
  const int = (limit: number) => 2 + Math.floor(random() * (limit - 1));

  return Array.from({ length: count }, () => {
    const a = int(max);
    const b = int(max);
    const kind = Math.floor(random() * 3);

    if (kind === 0) {
      return { text: `${a} + ${b}`, answer: a + b };
    }

    if (kind === 1) {
      const high = Math.max(a, b);
      const low = Math.min(a, b);

      return { text: `${high} − ${low}`, answer: high - low };
    }

    const x = int(9);
    const y = int(9);

    return { text: `${x} × ${y}`, answer: x * y };
  });
}
