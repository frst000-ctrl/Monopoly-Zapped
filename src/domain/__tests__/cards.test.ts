import { describe, expect, it } from 'vitest';
import { applyAction, type ActionInput, type GameAction } from '../game';
import { aid, bal, give, newGame } from './helpers';
import type { GameState } from '../types';
import type { Ctx } from '../bank';

const act = (s: GameState, ctx: Ctx, a: ActionInput) => applyAction(s, { id: aid(), ...a } as GameAction, ctx);

/** Place une carte précise en haut du paquet. */
function stack(s: GameState, cardId: string) {
  const card = s.cards.find((c) => c.id === cardId)!;
  const d = s.decks[card.deck];
  d.order = [cardId, ...d.order.filter((id) => id !== cardId)];
  d.next = 0;
  return card.deck;
}

describe('cartes', () => {
  it('16 cartes par paquet, toutes avec un texte', () => {
    const { state } = newGame(2);
    expect(state.decks.chance.order).toHaveLength(16);
    expect(state.decks.community.order).toHaveLength(16);
    state.cards.forEach((c) => expect(c.text.length).toBeGreaterThan(5));
  });

  it('gain et perte d’argent', () => {
    const { state, ctx, ids } = newGame(2);
    let s = act(state, ctx, { type: 'drawCard', deck: stack(state, 'cc-bank-error'), playerId: ids[0]! }).state;
    expect(bal(s, ids[0]!)).toBe(1700);
    s = act(s, ctx, { type: 'drawCard', deck: stack(s, 'cc-hospital'), playerId: ids[0]! }).state;
    expect(bal(s, ids[0]!)).toBe(1600);
  });

  it('anniversaire : chaque joueur paie', () => {
    const { state, ctx, ids } = newGame(3);
    const s = act(state, ctx, { type: 'drawCard', deck: stack(state, 'cc-birthday'), playerId: ids[0]! }).state;
    expect(bal(s, ids[0]!)).toBe(1520);
    expect(bal(s, ids[1]!)).toBe(1490);
  });

  it('payer chaque joueur', () => {
    const { state, ctx, ids } = newGame(4);
    const s = act(state, ctx, { type: 'drawCard', deck: stack(state, 'ch-president'), playerId: ids[0]! }).state;
    expect(bal(s, ids[0]!)).toBe(1350);
    expect(bal(s, ids[3]!)).toBe(1550);
  });

  it('carte en attente si fonds insuffisants, puis appliquée', () => {
    const { state, ctx, ids } = newGame(2);
    state.players[0]!.balance = 30;
    give(state, ids[0]!, 39);
    const r = act(state, ctx, { type: 'drawCard', deck: stack(state, 'cc-doctor'), playerId: ids[0]! });
    expect(r.outcome).toMatchObject({ kind: 'card', pending: true });
    expect(r.state.pendingCard).not.toBeNull();
    expect(() => act(r.state, ctx, { type: 'endTurn' })).toThrow(/en attente/);
    let s = act(r.state, ctx, { type: 'mortgage', square: 39 }).state;
    s = act(s, ctx, { type: 'applyPendingCard' }).state;
    expect(bal(s, ids[0]!)).toBe(30 + 200 - 50);
    expect(s.pendingCard).toBeNull();
  });

  it('déplacement vers le Départ avec salaire', () => {
    const { state, ctx, ids } = newGame(2);
    state.players[0]!.position = 7;
    const s = act(state, ctx, { type: 'drawCard', deck: stack(state, 'ch-go'), playerId: ids[0]! }).state;
    expect(s.players[0]!.position).toBe(0);
    expect(bal(s, ids[0]!)).toBe(1700);
  });

  it('reculer de 3 cases sans salaire', () => {
    const { state, ctx, ids } = newGame(2);
    state.players[0]!.position = 2;
    const r = act(state, ctx, { type: 'drawCard', deck: stack(state, 'ch-back3'), playerId: ids[0]! });
    expect(r.state.players[0]!.position).toBe(39);
    expect(bal(r.state, ids[0]!)).toBe(1500);
  });

  it('gare la plus proche : loyer doublé proposé', () => {
    const { state, ctx, ids } = newGame(2);
    state.players[0]!.position = 7;
    give(state, ids[1]!, 15);
    const r = act(state, ctx, { type: 'drawCard', deck: stack(state, 'ch-rail'), playerId: ids[0]! });
    expect(r.state.players[0]!.position).toBe(15);
    expect(r.outcome).toMatchObject({ kind: 'card', then: { suggestion: { type: 'rent', amount: 50, railroadDouble: true } } });
  });

  it('carte « sortie de prison » conservée puis utilisée, retirée du paquet pendant ce temps', () => {
    const { state, ctx, ids } = newGame(2);
    let s = act(state, ctx, { type: 'drawCard', deck: stack(state, 'ch-jail-free'), playerId: ids[0]! }).state;
    expect(s.players[0]!.jailCards).toEqual(['ch-jail-free']);
    // On parcourt tout le paquet : la carte détenue ne doit jamais ressortir.
    for (let i = 0; i < 20; i++) {
      const r = act(s, ctx, { type: 'drawCard', deck: 'chance', playerId: ids[1]! });
      s = r.state.pendingCard ? act(r.state, ctx, { type: 'declareBankruptcy', playerId: ids[1]!, creditorId: null }).state : r.state;
      if (s.status === 'ended') break;
      expect(s.lastDrawn?.cardId).not.toBe('ch-jail-free');
      // Remet le joueur 2 en position neutre pour éviter les effets de chaîne.
      s.players[1]!.inJail = false;
    }
  });

  it('réparations selon maisons et hôtels', () => {
    const { state, ctx, ids } = newGame(2);
    give(state, ids[0]!, 1, 3);
    let s = act(state, ctx, { type: 'buildHouse', square: 1 }).state;
    s = act(s, ctx, { type: 'buildHouse', square: 3 }).state;
    s = act(s, ctx, { type: 'drawCard', deck: stack(s, 'ch-reno'), playerId: ids[0]! }).state;
    expect(bal(s, ids[0]!)).toBe(1500 - 100 - 50);
  });

  it('montants configurables', () => {
    const { state, ctx, ids } = newGame(2);
    let s = act(state, ctx, { type: 'updateCard', cardId: 'cc-bank-error', effect: { type: 'money', amount: 500 } }).state;
    s = act(s, ctx, { type: 'drawCard', deck: stack(s, 'cc-bank-error'), playerId: ids[0]! }).state;
    expect(bal(s, ids[0]!)).toBe(2000);
    expect(() => act(s, ctx, { type: 'updateCard', cardId: 'cc-bank-error', effect: { type: 'goToJail' } })).toThrow(/type/);
  });
});

describe('plateau physique (positions non suivies)', () => {
  const physical = () => {
    const g = newGame(2);
    g.state.settings.trackPositions = false;
    return g;
  };
  it('les cartes de déplacement sont de simples consignes', () => {
    const { state, ctx, ids } = physical();
    state.players[0]!.position = 7;
    for (const id of ['ch-go', 'ch-back3', 'ch-rail']) {
      const r = act(state, ctx, { type: 'drawCard', deck: stack(state, id), playerId: ids[0]! });
      expect(r.state.players[0]!.position).toBe(7);
      expect(bal(r.state, ids[0]!)).toBe(1500);
      expect(r.outcome).toMatchObject({ kind: 'card', pending: false, then: undefined });
    }
  });
  it('les cartes d’argent et de prison s’appliquent', () => {
    const { state, ctx, ids } = physical();
    let s = act(state, ctx, { type: 'drawCard', deck: stack(state, 'cc-bank-error'), playerId: ids[0]! }).state;
    expect(bal(s, ids[0]!)).toBe(1700);
    s = act(s, ctx, { type: 'drawCard', deck: stack(s, 'cc-jail'), playerId: ids[0]! }).state;
    expect(s.players[0]!.inJail).toBe(true);
  });
  it('amende et carte de sortie de prison utilisables à tout moment', () => {
    const { state, ctx, ids } = physical();
    let s = act(state, ctx, { type: 'payJailFine', playerId: ids[0]! }).state;
    expect(bal(s, ids[0]!)).toBe(1450);
    s = act(s, ctx, { type: 'drawCard', deck: stack(s, 'ch-jail-free'), playerId: ids[0]! }).state;
    s = act(s, ctx, { type: 'useJailCard', playerId: ids[0]! }).state;
    expect(s.players[0]!.jailCards).toEqual([]);
  });
});

describe('describeEffect (montants Zapped)', () => {
  it('affiche les montants en millions et les cases par leur nom', async () => {
    const { describeEffect } = await import('../cards');
    expect(describeEffect({ type: 'money', amount: 150 }, 'KM')).toBe('Recevez 1,5M');
    expect(describeEffect({ type: 'payEach', amount: 50 }, 'KM')).toBe('Payez 500K à chaque joueur');
    expect(describeEffect({ type: 'moveTo', square: 39, collectGo: true }, 'KM')).toContain('Rue de la Paix');
  });
});
