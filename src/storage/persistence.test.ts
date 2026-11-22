import { describe, expect, it } from 'vitest';
import { BACKUP_KEY, loadGame, SAVE_KEY, saveGame, type KeyValueStorage } from './persistence';
import { newGame } from '../domain/__tests__/helpers';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  quota = Infinity;
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) {
    if (v.length > this.quota) throw new Error('QuotaExceeded');
    this.data.set(k, v);
  }
  removeItem(k: string) { this.data.delete(k); }
}

describe('sauvegarde', () => {
  it('sauvegarde et recharge une partie à l’identique', () => {
    const st = new MemoryStorage();
    const { state } = newGame(3);
    expect(saveGame(st, state, [{ label: 'x', snapshot: state }]).ok).toBe(true);
    const loaded = loadGame(st)!;
    expect(loaded.fromBackup).toBe(false);
    expect(loaded.save.game).toEqual(state);
    expect(loaded.save.undo).toHaveLength(1);
  });
  it('utilise la copie de secours si la sauvegarde principale est corrompue', () => {
    const st = new MemoryStorage();
    const { state } = newGame(2);
    saveGame(st, state, []);
    saveGame(st, { ...state, updatedAt: 5 }, []);
    st.setItem(SAVE_KEY, '{corrompu');
    const loaded = loadGame(st)!;
    expect(loaded.fromBackup).toBe(true);
    expect(st.getItem(BACKUP_KEY)).not.toBeNull();
  });
  it('rejette des données incohérentes', () => {
    const st = new MemoryStorage();
    const { state } = newGame(2);
    const bad = structuredClone(state);
    bad.players[0]!.balance = -10;
    saveGame(st, bad, []);
    expect(loadGame(st)).toBeNull();
  });
  it('réduit l’historique d’annulation si le stockage est plein', () => {
    const st = new MemoryStorage();
    const { state } = newGame(2);
    const one = JSON.stringify(state).length;
    st.quota = one * 3;
    const undo = Array.from({ length: 10 }, () => ({ label: 'a', snapshot: state }));
    const r = saveGame(st, state, undo);
    expect(r).toEqual({ ok: true, trimmedUndo: true });
  });
});
