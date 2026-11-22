import { describe, expect, it } from 'vitest';
import { applyAction } from '../game';
import { checkConsistency } from '../bank';
import { computeRent, canBuildHouse } from '../rules';
import { aid, bal, give, newGame } from './helpers';

describe('achat et loyers', () => {
  it('achète une propriété au prix officiel', () => {
    const { state, ctx, ids } = newGame(2);
    const s = applyAction(state, { id: aid(), type: 'buyProperty', playerId: ids[0]!, square: 39 }, ctx).state;
    expect(s.properties[39]!.ownerId).toBe(ids[0]);
    expect(bal(s, ids[0]!)).toBe(1100);
    expect(() => applyAction(s, { id: aid(), type: 'buyProperty', playerId: ids[1]!, square: 39 }, ctx)).toThrow(/appartient déjà/);
  });

  it('accepte un prix d’enchères', () => {
    const { state, ctx, ids } = newGame(2);
    const s = applyAction(state, { id: aid(), type: 'buyProperty', playerId: ids[1]!, square: 1, price: 10 }, ctx).state;
    expect(bal(s, ids[1]!)).toBe(1490);
  });

  it('refuse d’acheter une case non achetable', () => {
    const { state, ctx, ids } = newGame(2);
    expect(() => applyAction(state, { id: aid(), type: 'buyProperty', playerId: ids[0]!, square: 0 }, ctx)).toThrow(/pas une propriété/);
  });

  it('double le loyer d’un terrain nu quand le groupe est complet', () => {
    const { state, ids } = newGame(2);
    give(state, ids[0]!, 37);
    expect(computeRent(state, 37)).toBe(35);
    give(state, ids[0]!, 39);
    expect(computeRent(state, 37)).toBe(70);
    expect(computeRent(state, 39)).toBe(100);
  });

  it('loyers des gares et compagnies', () => {
    const { state, ids } = newGame(2);
    give(state, ids[0]!, 5, 15);
    expect(computeRent(state, 5)).toBe(50);
    give(state, ids[0]!, 25, 35);
    expect(computeRent(state, 5)).toBe(200);
    expect(computeRent(state, 5, { railroadDouble: true })).toBe(400);
    give(state, ids[1]!, 12);
    expect(computeRent(state, 12, { diceTotal: 7 })).toBe(28);
    give(state, ids[1]!, 28);
    expect(computeRent(state, 12, { diceTotal: 7 })).toBe(70);
  });

  it('paie le loyer au propriétaire', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 1, 3);
    const s = applyAction(state, { id: aid(), type: 'payRent', payerId: ids[1]!, square: 3 }, ctx).state;
    expect(bal(s, ids[1]!)).toBe(1492);
    expect(bal(s, ids[0]!)).toBe(1508);
    expect(() => applyAction(s, { id: aid(), type: 'payRent', payerId: ids[0]!, square: 3 }, ctx)).toThrow(/chez soi/);
  });

  it('compagnie : exige le total des dés', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 12);
    expect(() => applyAction(state, { id: aid(), type: 'payRent', payerId: ids[1]!, square: 12 }, ctx)).toThrow(/total des dés/);
    const s = applyAction(state, { id: aid(), type: 'payRent', payerId: ids[1]!, square: 12, diceTotal: 9 }, ctx).state;
    expect(bal(s, ids[0]!)).toBe(1536);
  });

  it('aucun loyer sur une propriété hypothéquée', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 6);
    const s = applyAction(state, { id: aid(), type: 'mortgage', square: 6 }, ctx).state;
    expect(computeRent(s, 6)).toBe(0);
    expect(() => applyAction(s, { id: aid(), type: 'payRent', payerId: ids[1]!, square: 6 }, ctx)).toThrow(/hypothéquée/);
  });
});

describe('constructions', () => {
  it('exige le groupe complet', () => {
    const { state, ids } = newGame(2);
    give(state, ids[0]!, 37);
    expect(canBuildHouse(state, 37).ok).toBe(false);
  });

  it('impose la construction équilibrée et l’hôtel après 4 maisons', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 37, 39);
    let s = applyAction(state, { id: aid(), type: 'buildHouse', square: 37 }, ctx).state;
    expect(() => applyAction(s, { id: aid(), type: 'buildHouse', square: 37 }, ctx)).toThrow(/équilibrée/);
    s = applyAction(s, { id: aid(), type: 'credit', playerId: ids[0]!, amount: 1000 }, ctx).state;
    for (let i = 0; i < 7; i++) s = applyAction(s, { id: aid(), type: 'buildHouse', square: i % 2 === 0 ? 39 : 37 }, ctx).state;
    expect(s.properties[37]!.houses).toBe(4);
    expect(s.properties[39]!.houses).toBe(4);
    expect(s.bankHouses).toBe(24);
    s = applyAction(s, { id: aid(), type: 'buildHouse', square: 39 }, ctx).state;
    expect(s.properties[39]!.houses).toBe(5);
    expect(s.bankHouses).toBe(28);
    expect(s.bankHotels).toBe(11);
    expect(computeRent(s, 39)).toBe(2000);
    expect(bal(s, ids[0]!)).toBe(1500 + 1000 - 9 * 200);
    expect(checkConsistency(s)).toEqual([]);
  });

  it('revend les bâtiments à moitié prix, de façon équilibrée', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 1, 3);
    let s = applyAction(state, { id: aid(), type: 'buildHouse', square: 1 }, ctx).state;
    s = applyAction(s, { id: aid(), type: 'buildHouse', square: 3 }, ctx).state;
    s = applyAction(s, { id: aid(), type: 'buildHouse', square: 3 }, ctx).state;
    expect(() => applyAction(s, { id: aid(), type: 'sellHouse', square: 1 }, ctx)).toThrow(/équilibrée/);
    s = applyAction(s, { id: aid(), type: 'sellHouse', square: 3 }, ctx).state;
    expect(bal(s, ids[0]!)).toBe(1500 - 150 + 25);
    expect(s.bankHouses).toBe(30);
  });

  it('limite le stock de maisons de la banque', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 1, 3);
    state.bankHouses = 0;
    // On garde la cohérence : on simule les maisons placées ailleurs.
    expect(() => applyAction(state, { id: aid(), type: 'buildHouse', square: 1 }, ctx)).toThrow(/plus de maison/);
  });
});

describe('hypothèques', () => {
  it('hypothèque à 50 % et rembourse à 110 %', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 39);
    let s = applyAction(state, { id: aid(), type: 'mortgage', square: 39 }, ctx).state;
    expect(bal(s, ids[0]!)).toBe(1700);
    expect(() => applyAction(s, { id: aid(), type: 'mortgage', square: 39 }, ctx)).toThrow(/Déjà/);
    s = applyAction(s, { id: aid(), type: 'unmortgage', square: 39 }, ctx).state;
    expect(bal(s, ids[0]!)).toBe(1700 - 220);
    expect(s.properties[39]!.mortgaged).toBe(false);
  });

  it('interdit d’hypothéquer avec des bâtiments dans le groupe', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 1, 3);
    const s = applyAction(state, { id: aid(), type: 'buildHouse', square: 1 }, ctx).state;
    expect(() => applyAction(s, { id: aid(), type: 'mortgage', square: 3 }, ctx)).toThrow(/bâtiments/);
  });

  it('interdit de construire si un terrain du groupe est hypothéqué', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 1, 3);
    const s = applyAction(state, { id: aid(), type: 'mortgage', square: 3 }, ctx).state;
    expect(() => applyAction(s, { id: aid(), type: 'buildHouse', square: 1 }, ctx)).toThrow(/hypothéqué/);
  });
});

describe('échanges', () => {
  it('échange propriétés et argent', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 1);
    give(state, ids[1]!, 3);
    const s = applyAction(state, { id: aid(), type: 'trade', a: ids[0]!, b: ids[1]!, aGives: [1], bGives: [3], aCash: 50, bCash: 0 }, ctx).state;
    expect(s.properties[1]!.ownerId).toBe(ids[1]);
    expect(s.properties[3]!.ownerId).toBe(ids[0]);
    expect(bal(s, ids[0]!)).toBe(1450);
    expect(bal(s, ids[1]!)).toBe(1550);
  });

  it('facture 10 % d’intérêts sur une propriété hypothéquée reçue', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 39);
    let s = applyAction(state, { id: aid(), type: 'mortgage', square: 39 }, ctx).state;
    s = applyAction(s, { id: aid(), type: 'trade', a: ids[0]!, b: ids[1]!, aGives: [39], bGives: [], aCash: 0, bCash: 100 }, ctx).state;
    expect(bal(s, ids[1]!)).toBe(1500 - 100 - 20);
    expect(s.properties[39]!.mortgaged).toBe(true);
  });

  it('refuse un échange de propriété d’autrui ou avec bâtiments', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 1, 3);
    expect(() => applyAction(state, { id: aid(), type: 'trade', a: ids[1]!, b: ids[0]!, aGives: [1], bGives: [], aCash: 0, bCash: 0 }, ctx)).toThrow(/n’appartient pas/);
    const s = applyAction(state, { id: aid(), type: 'buildHouse', square: 1 }, ctx).state;
    expect(() => applyAction(s, { id: aid(), type: 'trade', a: ids[0]!, b: ids[1]!, aGives: [3], bGives: [], aCash: 0, bCash: 10 }, ctx)).toThrow(/bâtiments/);
  });
});
