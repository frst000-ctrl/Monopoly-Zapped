import { describe, expect, it } from 'vitest';
import { applyAction } from '../game';
import { checkConsistency } from '../bank';
import { GameError } from '../errors';
import { aid, bal, newGame } from './helpers';

describe('création de partie', () => {
  it('crédite le capital de départ à chaque joueur', () => {
    const { state } = newGame(4);
    expect(state.players).toHaveLength(4);
    state.players.forEach((p) => expect(p.balance).toBe(1500));
    expect(state.transactions).toHaveLength(4);
    expect(checkConsistency(state)).toEqual([]);
  });
  it('refuse les noms en double', async () => {
    const { createGame } = await import('../game');
    const { makeCtx } = await import('./helpers');
    expect(() => createGame({ players: [{ name: 'A', color: '#1' }, { name: 'a', color: '#2' }] }, makeCtx())).toThrow(GameError);
    expect(() => createGame({ players: [{ name: 'A', color: '#1' }] }, makeCtx())).toThrow(/entre 2 et 4/);
  });
});

describe('banque électronique', () => {
  it('crédite, débite et transfère', () => {
    const { state, ctx, ids } = newGame(2);
    const [a, b] = ids as [string, string];
    let s = applyAction(state, { id: aid(), type: 'credit', playerId: a, amount: 200 }, ctx).state;
    s = applyAction(s, { id: aid(), type: 'debit', playerId: b, amount: 100 }, ctx).state;
    s = applyAction(s, { id: aid(), type: 'transfer', from: a, to: b, amount: 700 }, ctx).state;
    expect(bal(s, a)).toBe(1000);
    expect(bal(s, b)).toBe(2100);
    expect(checkConsistency(s)).toEqual([]);
  });

  it('ne modifie jamais l’état d’origine', () => {
    const { state, ctx, ids } = newGame(2);
    applyAction(state, { id: aid(), type: 'credit', playerId: ids[0]!, amount: 200 }, ctx);
    expect(bal(state, ids[0]!)).toBe(1500);
  });

  it('refuse un paiement sans fonds suffisants, sans rien modifier', () => {
    const { state, ctx, ids } = newGame(2);
    expect(() => applyAction(state, { id: aid(), type: 'debit', playerId: ids[0]!, amount: 1501 }, ctx)).toThrow(/n’a que/);
    expect(() => applyAction(state, { id: aid(), type: 'transfer', from: ids[0]!, to: ids[1]!, amount: 5000 }, ctx)).toThrow(GameError);
    expect(bal(state, ids[0]!)).toBe(1500);
  });

  it('refuse les montants invalides', () => {
    const { state, ctx, ids } = newGame(2);
    for (const amount of [0, -5, 1.5, Number.NaN, Infinity, 1e9]) {
      expect(() => applyAction(state, { id: aid(), type: 'credit', playerId: ids[0]!, amount }, ctx)).toThrow(GameError);
    }
  });

  it('n’exécute jamais deux fois la même opération', () => {
    const { state, ctx, ids } = newGame(2);
    const action = { id: 'unique-1', type: 'credit' as const, playerId: ids[0]!, amount: 100 };
    const s1 = applyAction(state, action, ctx).state;
    expect(() => applyAction(s1, action, ctx)).toThrow(/déjà été enregistrée/);
    expect(bal(s1, ids[0]!)).toBe(1600);
  });

  it('refuse le transfert vers soi-même', () => {
    const { state, ctx, ids } = newGame(2);
    expect(() => applyAction(state, { id: aid(), type: 'transfer', from: ids[0]!, to: ids[0]!, amount: 10 }, ctx)).toThrow(GameError);
  });

  it('taxe : alimente la cagnotte si la règle maison est active', () => {
    const { state, ctx, ids } = newGame(2);
    let s = applyAction(state, { id: aid(), type: 'updateSettings', patch: { freeParkingJackpot: true } }, ctx).state;
    s = applyAction(s, { id: aid(), type: 'payTax', playerId: ids[0]!, square: 4 }, ctx).state;
    expect(bal(s, ids[0]!)).toBe(1300);
    expect(s.freeParkingPot).toBe(200);
    s = applyAction(s, { id: aid(), type: 'collectFreeParking', playerId: ids[1]! }, ctx).state;
    expect(bal(s, ids[1]!)).toBe(1700);
    expect(s.freeParkingPot).toBe(0);
  });
});
