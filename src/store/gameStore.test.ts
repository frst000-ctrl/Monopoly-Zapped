import { describe, expect, it } from 'vitest';
import { GameStore } from './gameStore';
import type { KeyValueStorage } from '../storage/persistence';

const mem = (): KeyValueStorage => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};
const setup = { players: [{ name: 'Alice', color: '#a' }, { name: 'Bob', color: '#b' }] };

describe('store', () => {
  it('sauvegarde chaque opération et la retrouve après « rechargement »', () => {
    const st = mem();
    const s1 = new GameStore(st);
    s1.start(setup);
    const id = s1.getSnapshot().game!.players[0]!.id;
    expect(s1.dispatch({ type: 'credit', playerId: id, amount: 100 }, '+100').ok).toBe(true);
    const s2 = new GameStore(st); // simule un rechargement de page
    expect(s2.savedGameInfo()?.players).toEqual(['Alice', 'Bob']);
    s2.resume();
    expect(s2.getSnapshot().game!.players[0]!.balance).toBe(1600);
    expect(s2.canUndo()).toBe(true);
  });

  it('annule la dernière opération', () => {
    const s = new GameStore(mem());
    s.start(setup);
    const id = s.getSnapshot().game!.players[0]!.id;
    s.dispatch({ type: 'credit', playerId: id, amount: 100 }, '+100');
    s.dispatch({ type: 'credit', playerId: id, amount: 200 }, '+200');
    expect(s.undo()).toBe('+200');
    expect(s.getSnapshot().game!.players[0]!.balance).toBe(1600);
  });

  it('un même identifiant d’action n’est exécuté qu’une fois (double clic)', () => {
    const s = new GameStore(mem());
    s.start(setup);
    const id = s.getSnapshot().game!.players[0]!.id;
    expect(s.dispatch({ type: 'credit', playerId: id, amount: 100 }, '+100', 'form-1').ok).toBe(true);
    const again = s.dispatch({ type: 'credit', playerId: id, amount: 100 }, '+100', 'form-1');
    expect(again.ok).toBe(false);
    expect(s.getSnapshot().game!.players[0]!.balance).toBe(1600);
  });

  it('renvoie une erreur lisible sans modifier l’état', () => {
    const s = new GameStore(mem());
    s.start(setup);
    const before = s.getSnapshot().game;
    const r = s.dispatch({ type: 'debit', playerId: before!.players[0]!.id, amount: 99999 }, 'x');
    expect(r.ok).toBe(false);
    expect(s.getSnapshot().game).toBe(before);
  });

  it('export / import de sauvegarde', () => {
    const s = new GameStore(mem());
    s.start(setup);
    const text = s.exportSave()!;
    const s2 = new GameStore(mem());
    expect(s2.importSave(text).ok).toBe(true);
    expect(s2.getSnapshot().game!.players).toHaveLength(2);
    expect(s2.importSave('nimporte quoi').ok).toBe(false);
  });
});
