import { describe, expect, it } from 'vitest';
import { applyAction, type ActionInput, type GameAction } from '../game';
import { aid, bal, give, newGame } from './helpers';
import type { GameState } from '../types';
import type { Ctx } from '../bank';

const roll = (s: GameState, ctx: Ctx, d: [number, number]) => applyAction(s, { id: aid(), type: 'rollDice', dice: d }, ctx);
const act = (s: GameState, ctx: Ctx, a: ActionInput) => applyAction(s, { id: aid(), ...a } as GameAction, ctx);

describe('dés et tours', () => {
  it('déplace le joueur et suggère l’achat', () => {
    const { state, ctx, ids } = newGame(2);
    const r = roll(state, ctx, [2, 4]);
    expect(r.state.players[0]!.position).toBe(6);
    expect(r.outcome).toMatchObject({ kind: 'moved', suggestion: { type: 'buy', square: 6, price: 100 } });
    expect(() => roll(r.state, ctx, [1, 2])).toThrow(/déjà lancé/);
    const s = act(r.state, ctx, { type: 'endTurn' }).state;
    expect(s.players[s.turn.currentIndex]!.id).toBe(ids[1]);
  });

  it('suggère le loyer chez un autre joueur', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[1]!, 6);
    const r = roll(state, ctx, [2, 4]);
    expect(r.outcome).toMatchObject({ kind: 'moved', suggestion: { type: 'rent', amount: 6, ownerId: ids[1] } });
  });

  it('verse le salaire au passage du Départ', () => {
    const { state, ctx, ids } = newGame(2);
    state.players[0]!.position = 38;
    const r = roll(state, ctx, [1, 3]);
    expect(r.state.players[0]!.position).toBe(2);
    expect(bal(r.state, ids[0]!)).toBe(1700);
  });

  it('un double donne un tour supplémentaire, trois doubles envoient en prison', () => {
    const { state, ctx } = newGame(2);
    let r = roll(state, ctx, [1, 1]);
    expect(r.state.turn.extraTurn).toBe(true);
    let s = act(r.state, ctx, { type: 'endTurn' }).state; // rejoue
    expect(s.turn.currentIndex).toBe(0);
    r = roll(s, ctx, [2, 2]);
    s = r.state;
    r = roll(s, ctx, [3, 3]); // directement, sans endTurn
    expect(r.outcome).toMatchObject({ kind: 'jail', reason: 'doubles' });
    expect(r.state.players[0]!.inJail).toBe(true);
    expect(r.state.players[0]!.position).toBe(10);
    s = act(r.state, ctx, { type: 'endTurn' }).state;
    expect(s.turn.currentIndex).toBe(1);
  });

  it('case « Allez en prison » : pas de salaire', () => {
    const { state, ctx, ids } = newGame(2);
    state.players[0]!.position = 25;
    const r = roll(state, ctx, [2, 3]);
    expect(r.state.players[0]!.inJail).toBe(true);
    expect(r.state.players[0]!.position).toBe(10);
    expect(bal(r.state, ids[0]!)).toBe(1500);
    expect(r.state.turn.extraTurn).toBe(false);
  });

  it('prison : double pour sortir, sans rejouer', () => {
    const { state, ctx } = newGame(2);
    const s = act(state, ctx, { type: 'sendToJail', playerId: state.players[0]!.id }).state;
    const r = roll(s, ctx, [4, 4]);
    expect(r.state.players[0]!.inJail).toBe(false);
    expect(r.state.players[0]!.position).toBe(18);
    expect(r.state.turn.extraTurn).toBe(false);
  });

  it('prison : 3e échec, amende obligatoire puis déplacement', () => {
    const { state, ctx, ids } = newGame(2);
    let s = act(state, ctx, { type: 'sendToJail', playerId: ids[0]! }).state;
    for (let t = 0; t < 2; t++) {
      s = roll(s, ctx, [1, 2]).state;
      expect(s.players[0]!.inJail).toBe(true);
      s = act(s, ctx, { type: 'endTurn' }).state; // Bob
      s = act(s, ctx, { type: 'endTurn' }).state; // Alice
    }
    const r = roll(s, ctx, [1, 2]);
    expect(r.outcome).toMatchObject({ kind: 'jailRoll', mustPay: true });
    expect(() => act(r.state, ctx, { type: 'endTurn' })).toThrow(/amende/);
    const paid = act(r.state, ctx, { type: 'payJailFine', playerId: ids[0]! });
    expect(paid.state.players[0]!.inJail).toBe(false);
    expect(paid.state.players[0]!.position).toBe(13);
    expect(bal(paid.state, ids[0]!)).toBe(1450);
  });

  it('saute les joueurs en faillite', () => {
    const { state, ctx, ids } = newGame(3);
    let s = act(state, ctx, { type: 'declareBankruptcy', playerId: ids[1]!, creditorId: null }).state;
    s = act(s, ctx, { type: 'endTurn' }).state;
    expect(s.players[s.turn.currentIndex]!.id).toBe(ids[2]);
  });
});

describe('faillite', () => {
  it('transfère argent et propriétés au créancier et liquide les bâtiments', () => {
    const { state, ctx, ids } = newGame(3);
    give(state, ids[0]!, 1, 3);
    let s = act(state, ctx, { type: 'buildHouse', square: 1 }).state;
    s = act(s, ctx, { type: 'declareBankruptcy', playerId: ids[0]!, creditorId: ids[1]! }).state;
    expect(s.players[0]!.bankrupt).toBe(true);
    expect(bal(s, ids[0]!)).toBe(0);
    expect(bal(s, ids[1]!)).toBe(1500 + 1450 + 25);
    expect(s.properties[1]!.ownerId).toBe(ids[1]);
    expect(s.properties[1]!.houses).toBe(0);
    expect(s.bankHouses).toBe(32);
  });

  it('déclare le vainqueur quand il ne reste qu’un joueur', () => {
    const { state, ctx, ids } = newGame(2);
    const r = act(state, ctx, { type: 'declareBankruptcy', playerId: ids[0]!, creditorId: null });
    expect(r.state.status).toBe('ended');
    expect(r.state.winnerId).toBe(ids[1]);
    expect(r.outcome).toMatchObject({ kind: 'gameOver' });
    expect(() => act(r.state, ctx, { type: 'credit', playerId: ids[1]!, amount: 10 })).toThrow(/terminée/);
  });
});
