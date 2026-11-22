import { createGame, type Ctx } from '../game';
import type { GameState } from '../types';

export function seeded(seed = 42): () => number {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

export function makeCtx(seed = 1): Ctx {
  let n = 0;
  return { now: 1_700_000_000_000, newId: () => `id-${seed}-${++n}`, random: seeded(seed) };
}

let actionCounter = 0;
export const aid = () => `act-${++actionCounter}`;

export function newGame(players = 3, ctx = makeCtx()): { state: GameState; ctx: Ctx; ids: string[] } {
  const colors = ['#e0262f', '#1f6feb', '#1f9d55', '#f5b014'];
  const names = ['Alice', 'Bob', 'Chloé', 'David'];
  const state = createGame({ players: names.slice(0, players).map((name, i) => ({ name, color: colors[i] as string })) }, ctx);
  return { state, ctx, ids: state.players.map((p) => p.id) };
}

/** Donne directement une propriété (outil de test). */
export function give(state: GameState, playerId: string, ...squares: number[]) {
  for (const s of squares) {
    const ps = state.properties[s];
    if (!ps) throw new Error('bad square');
    ps.ownerId = playerId;
  }
}

export const bal = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.balance;
