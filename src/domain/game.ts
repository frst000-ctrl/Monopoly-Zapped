import { bankPays, ensureFunds, getActivePlayer, getPlayer, playerPaysBank, transfer, type Ctx } from './bank';
import { BOARD, BOARD_SIZE, getProperty, getSquare, GO_TO_JAIL_INDEX, isProperty, JAIL_INDEX, PROPERTIES, TOTAL_HOTELS, TOTAL_HOUSES } from './board';
import { DEFAULT_CARDS, shuffle } from './cards';
import { fail, GameError } from './errors';
import { assertAmount, assertNonNegative, formatMoney, mortgageInterest, unmortgageCost } from './money';
import {
  canBuildHouse,
  canMortgage,
  canSellHouse,
  canTransfer,
  canUnmortgage,
  computeRent,
  countBuildings,
  nearestOfKind,
  propState,
  type Check,
} from './rules';
import type { CardDef, CardEffect, DeckKind, GameSettings, GameState, PlayerId, PropertyState, ZappedTarget } from './types';

export type { Ctx } from './bank';

// ---------------------------------------------------------------------------
// Création d'une partie
// ---------------------------------------------------------------------------

export const PLAYER_COLORS = ['#e0262f', '#1f6feb', '#1f9d55', '#f5b014', '#9b51e0', '#ef6c00'] as const;

export const DEFAULT_SETTINGS: GameSettings = {
  startingCash: 1500,
  goSalary: 200,
  currency: 'M',
  freeParkingJackpot: false,
  confirmThreshold: 500,
  quickAmounts: [100, 200, 500],
  jailFine: 50,
};

export interface SetupPlayer {
  name: string;
  color: string;
}

export interface GameSetup {
  players: SetupPlayer[];
  settings?: Partial<GameSettings>;
}

export function createGame(setup: GameSetup, ctx: Ctx): GameState {
  const settings: GameSettings = { ...DEFAULT_SETTINGS, ...setup.settings };
  if (setup.players.length < 2 || setup.players.length > 4) fail('INVALID_STATE', 'Il faut entre 2 et 4 joueurs.');
  const names = setup.players.map((p) => p.name.trim());
  if (names.some((n) => n.length === 0)) fail('INVALID_STATE', 'Chaque joueur doit avoir un nom.');
  if (names.some((n) => n.length > 20)) fail('INVALID_STATE', 'Nom trop long (20 caractères maximum).');
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) fail('INVALID_STATE', 'Deux joueurs ont le même nom.');
  if (new Set(setup.players.map((p) => p.color)).size !== setup.players.length) fail('INVALID_STATE', 'Deux joueurs ont la même couleur.');
  assertAmount(settings.startingCash, 'Capital de départ');
  assertNonNegative(settings.goSalary, 'Salaire du Départ');

  const properties: Record<number, PropertyState> = {};
  for (const p of PROPERTIES) properties[p.index] = { ownerId: null, houses: 0, mortgaged: false };

  const cards: CardDef[] = structuredClone(DEFAULT_CARDS);
  const deckOrder = (deck: DeckKind) => shuffle(cards.filter((c) => c.deck === deck).map((c) => c.id), ctx.random);

  const state: GameState = {
    schemaVersion: 1,
    id: ctx.newId(),
    createdAt: ctx.now,
    updatedAt: ctx.now,
    status: 'playing',
    winnerId: null,
    settings,
    players: setup.players.map((p, i) => ({
      id: `p${i + 1}-${ctx.newId().slice(0, 6)}`,
      name: names[i] as string,
      color: p.color,
      balance: 0,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailCards: [],
      bankrupt: false,
    })),
    properties,
    bankHouses: TOTAL_HOUSES,
    bankHotels: TOTAL_HOTELS,
    freeParkingPot: 0,
    turn: { currentIndex: 0, doublesCount: 0, hasRolled: false, lastRoll: null, extraTurn: false, turnNumber: 1 },
    cards,
    decks: { chance: { order: deckOrder('chance'), next: 0 }, community: { order: deckOrder('community'), next: 0 } },
    pendingCard: null,
    lastDrawn: null,
    transactions: [],
    events: [],
    zapped: { nfcLinks: {} },
    processedActionIds: [],
  };
  for (const p of state.players) bankPays(state, ctx, p.id, settings.startingCash, 'credit', 'Capital de départ');
  logEvent(state, ctx, 'Nouvelle partie : ' + names.join(', '));
  return state;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type GameAction = { id: string } & (
  | { type: 'credit'; playerId: PlayerId; amount: number; label?: string; kind?: 'credit' | 'reward' }
  | { type: 'debit'; playerId: PlayerId; amount: number; label?: string; kind?: 'debit' | 'tax' }
  | { type: 'transfer'; from: PlayerId; to: PlayerId; amount: number; label?: string }
  | { type: 'payRent'; payerId: PlayerId; square: number; diceTotal?: number; railroadDouble?: boolean; utilityTen?: boolean }
  | { type: 'payTax'; playerId: PlayerId; square: number }
  | { type: 'collectGo'; playerId: PlayerId }
  | { type: 'buyProperty'; playerId: PlayerId; square: number; price?: number }
  | { type: 'assignProperty'; square: number; playerId: PlayerId | null }
  | { type: 'buildHouse'; square: number }
  | { type: 'sellHouse'; square: number }
  | { type: 'mortgage'; square: number }
  | { type: 'unmortgage'; square: number }
  | { type: 'trade'; a: PlayerId; b: PlayerId; aGives: number[]; bGives: number[]; aCash: number; bCash: number }
  | { type: 'rollDice'; dice: [number, number] }
  | { type: 'movePlayer'; playerId: PlayerId; to: number; collectGo: boolean }
  | { type: 'drawCard'; deck: DeckKind; playerId: PlayerId }
  | { type: 'applyPendingCard' }
  | { type: 'payJailFine'; playerId: PlayerId }
  | { type: 'useJailCard'; playerId: PlayerId }
  | { type: 'sendToJail'; playerId: PlayerId }
  | { type: 'endTurn' }
  | { type: 'collectFreeParking'; playerId: PlayerId }
  | { type: 'declareBankruptcy'; playerId: PlayerId; creditorId: PlayerId | null }
  | { type: 'updateCard'; cardId: string; effect: CardEffect }
  | { type: 'updateSettings'; patch: Partial<Pick<GameSettings, 'goSalary' | 'confirmThreshold' | 'quickAmounts' | 'freeParkingJackpot' | 'jailFine' | 'currency'>> }
  | { type: 'setCardSignature'; playerId: PlayerId; signature: number[] | null }
  | { type: 'setNfcLink'; serial: string; target: ZappedTarget | null }
  | { type: 'endGame' }
);

/** Action sans identifiant (l'identifiant est ajouté par le store). */
export type ActionInput = GameAction extends infer A ? (A extends GameAction ? Omit<A, 'id'> : never) : never;

/** Ce qui doit être proposé au joueur après un déplacement. */
export type Suggestion =
  | { type: 'none' }
  | { type: 'buy'; square: number; price: number }
  | { type: 'rent'; square: number; ownerId: PlayerId; amount: number; needsDice: boolean; railroadDouble?: boolean; utilityTen?: boolean }
  | { type: 'tax'; square: number; amount: number }
  | { type: 'card'; deck: DeckKind }
  | { type: 'jailed' };

export type Outcome =
  | { kind: 'none' }
  | { kind: 'moved'; playerId: PlayerId; from: number; to: number; passedGo: boolean; suggestion: Suggestion; doubles: boolean; extraTurn: boolean }
  | { kind: 'jail'; playerId: PlayerId; reason: 'doubles' | 'square' | 'card' | 'manual' }
  | { kind: 'jailRoll'; playerId: PlayerId; freed: boolean; mustPay: boolean }
  | { kind: 'card'; card: CardDef; playerId: PlayerId; pending: boolean; error?: string; then?: Outcome }
  | { kind: 'gameOver'; winnerId: PlayerId | null };

export interface ApplyResult {
  state: GameState;
  outcome: Outcome;
}

const MAX_PROCESSED_IDS = 500;
const NONE: Outcome = { kind: 'none' };

/**
 * Point d'entrée unique du moteur. Ne modifie jamais l'état reçu :
 * travaille sur une copie et la renvoie seulement si tout s'est bien passé.
 * Lève une GameError (aucune modification) en cas de règle violée.
 */
export function applyAction(state: GameState, action: GameAction, ctx: Ctx): ApplyResult {
  if (!action.id) fail('INVALID_STATE', 'Action sans identifiant.');
  if (state.processedActionIds.includes(action.id)) fail('DUPLICATE_ACTION', 'Cette opération a déjà été enregistrée.');
  if (state.status === 'ended' && action.type !== 'updateSettings') fail('GAME_ENDED', 'La partie est terminée.');

  const draft = structuredClone(state);
  const outcome = reduce(draft, action, ctx);
  draft.processedActionIds.push(action.id);
  if (draft.processedActionIds.length > MAX_PROCESSED_IDS) draft.processedActionIds.splice(0, draft.processedActionIds.length - MAX_PROCESSED_IDS);
  draft.updatedAt = ctx.now;
  const end = checkGameOver(draft, ctx);
  return { state: draft, outcome: end ?? outcome };
}

function mustOk(check: Check) {
  if (!check.ok) fail('RULE_VIOLATION', check.reason);
}

function logEvent(state: GameState, ctx: Ctx, text: string) {
  state.events.push({ id: ctx.newId(), at: ctx.now, text });
}

const money = (state: GameState, n: number) => formatMoney(n, state.settings.currency);

function currentPlayer(state: GameState) {
  const p = state.players[state.turn.currentIndex];
  if (!p) return fail('INVALID_STATE', 'Aucun joueur actif.');
  return p;
}

function reduce(s: GameState, a: GameAction, ctx: Ctx): Outcome {
  switch (a.type) {
    case 'credit': {
      const p = getActivePlayer(s, a.playerId);
      bankPays(s, ctx, p.id, a.amount, a.kind ?? 'credit', a.label?.trim() || 'Crédit de la banque');
      return NONE;
    }
    case 'debit': {
      const p = getActivePlayer(s, a.playerId);
      playerPaysBank(s, ctx, p.id, a.amount, a.kind ?? 'debit', a.label?.trim() || 'Paiement à la banque', a.kind === 'tax');
      return NONE;
    }
    case 'transfer': {
      transfer(s, ctx, a.from, a.to, a.amount, 'transfer', a.label?.trim() || 'Transfert');
      return NONE;
    }
    case 'payRent': {
      if (!isProperty(a.square)) fail('NOT_A_PROPERTY', 'Cette case n’est pas une propriété.');
      const def = getProperty(a.square);
      const ps = propState(s, a.square);
      if (!ps.ownerId) fail('RULE_VIOLATION', `${def.name} n’a pas de propriétaire : aucun loyer.`);
      if (ps.ownerId === a.payerId) fail('RULE_VIOLATION', 'On ne paie pas de loyer chez soi.');
      if (ps.mortgaged) fail('RULE_VIOLATION', `${def.name} est hypothéquée : aucun loyer.`);
      if (def.kind === 'utility' && !(a.diceTotal && a.diceTotal >= 2 && a.diceTotal <= 12)) {
        fail('INVALID_AMOUNT', 'Indiquez le total des dés (2 à 12) pour une compagnie.');
      }
      const rent = computeRent(s, a.square, { diceTotal: a.diceTotal, railroadDouble: a.railroadDouble, utilityTen: a.utilityTen });
      transfer(s, ctx, a.payerId, ps.ownerId as string, rent, 'rent', `Loyer – ${def.name}`);
      return NONE;
    }
    case 'payTax': {
      const sq = getSquare(a.square);
      if (sq.kind !== 'tax') fail('INVALID_STATE', 'Cette case n’est pas une taxe.');
      if (sq.kind === 'tax') playerPaysBank(s, ctx, a.playerId, sq.amount, 'tax', sq.name, true);
      return NONE;
    }
    case 'collectGo': {
      bankPays(s, ctx, a.playerId, s.settings.goSalary, 'go', 'Passage par le Départ');
      return NONE;
    }
    case 'buyProperty': {
      if (!isProperty(a.square)) fail('NOT_A_PROPERTY', 'Cette case n’est pas une propriété.');
      const def = getProperty(a.square);
      const ps = propState(s, a.square);
      if (ps.ownerId) fail('ALREADY_OWNED', `${def.name} appartient déjà à ${getPlayer(s, ps.ownerId).name}.`);
      const price = a.price ?? def.price;
      assertAmount(price, 'Prix');
      playerPaysBank(s, ctx, a.playerId, price, 'purchase', `Achat – ${def.name}${a.price !== undefined && a.price !== def.price ? ' (enchères)' : ''}`);
      ps.ownerId = a.playerId;
      return NONE;
    }
    case 'assignProperty': {
      if (!isProperty(a.square)) fail('NOT_A_PROPERTY', 'Cette case n’est pas une propriété.');
      const def = getProperty(a.square);
      const ps = propState(s, a.square);
      mustOk(canTransfer(s, a.square));
      if (a.playerId) getActivePlayer(s, a.playerId);
      ps.ownerId = a.playerId;
      if (!a.playerId) ps.mortgaged = false;
      logEvent(s, ctx, `${def.name} attribuée ${a.playerId ? 'à ' + getPlayer(s, a.playerId).name : 'à la banque'} (manuel)`);
      return NONE;
    }
    case 'buildHouse': {
      const def = getProperty(a.square);
      if (def.kind !== 'street') return fail('RULE_VIOLATION', 'On ne construit que sur les terrains.');
      mustOk(canBuildHouse(s, a.square));
      const ps = propState(s, a.square);
      const owner = ps.ownerId as string;
      const toHotel = ps.houses === 4;
      playerPaysBank(s, ctx, owner, def.housePrice, 'build', `${toHotel ? 'Hôtel' : 'Maison'} – ${def.name}`);
      if (toHotel) {
        s.bankHotels -= 1;
        s.bankHouses += 4;
      } else {
        s.bankHouses -= 1;
      }
      ps.houses += 1;
      return NONE;
    }
    case 'sellHouse': {
      const def = getProperty(a.square);
      if (def.kind !== 'street') return fail('RULE_VIOLATION', 'Aucun bâtiment sur cette case.');
      mustOk(canSellHouse(s, a.square));
      const ps = propState(s, a.square);
      const fromHotel = ps.houses === 5;
      if (fromHotel) {
        s.bankHotels += 1;
        s.bankHouses -= 4;
      } else {
        s.bankHouses += 1;
      }
      ps.houses -= 1;
      bankPays(s, ctx, ps.ownerId as string, def.housePrice / 2, 'sellBuilding', `Vente ${fromHotel ? 'hôtel' : 'maison'} – ${def.name}`);
      return NONE;
    }
    case 'mortgage': {
      const def = getProperty(a.square);
      mustOk(canMortgage(s, a.square));
      const ps = propState(s, a.square);
      ps.mortgaged = true;
      bankPays(s, ctx, ps.ownerId as string, def.mortgage, 'mortgage', `Hypothèque – ${def.name}`);
      return NONE;
    }
    case 'unmortgage': {
      const def = getProperty(a.square);
      mustOk(canUnmortgage(s, a.square));
      const ps = propState(s, a.square);
      playerPaysBank(s, ctx, ps.ownerId as string, unmortgageCost(def.mortgage), 'unmortgage', `Levée d’hypothèque – ${def.name}`);
      ps.mortgaged = false;
      return NONE;
    }
    case 'trade':
      doTrade(s, a, ctx);
      return NONE;
    case 'rollDice':
      return doRoll(s, a.dice, ctx);
    case 'movePlayer': {
      const p = getActivePlayer(s, a.playerId);
      if (!Number.isInteger(a.to) || a.to < 0 || a.to >= BOARD_SIZE) fail('INVALID_STATE', 'Case invalide.');
      if (a.to === GO_TO_JAIL_INDEX) {
        sendToJail(s, p.id, ctx, 'square');
        return { kind: 'jail', playerId: p.id, reason: 'square' };
      }
      return moveTo(s, p.id, a.to, a.collectGo, ctx, false);
    }
    case 'drawCard':
      return doDraw(s, a.deck, a.playerId, ctx);
    case 'applyPendingCard': {
      if (!s.pendingCard) fail('INVALID_STATE', 'Aucune carte en attente.');
      const pending = s.pendingCard!;
      const card = findCard(s, pending.cardId);
      const then = applyCard(s, card, pending.playerId, ctx);
      s.pendingCard = null;
      return { kind: 'card', card, playerId: pending.playerId, pending: false, then };
    }
    case 'payJailFine': {
      const p = getActivePlayer(s, a.playerId);
      if (!p.inJail) fail('INVALID_STATE', `${p.name} n’est pas en prison.`);
      playerPaysBank(s, ctx, p.id, s.settings.jailFine, 'jail', 'Amende de sortie de prison', true);
      return releaseFromJail(s, p.id, ctx);
    }
    case 'useJailCard': {
      const p = getActivePlayer(s, a.playerId);
      if (!p.inJail) fail('INVALID_STATE', `${p.name} n’est pas en prison.`);
      const cardId = p.jailCards.shift();
      if (!cardId) fail('INVALID_STATE', `${p.name} n’a pas de carte « Sortie de prison ».`);
      logEvent(s, ctx, `${p.name} utilise une carte « Sortie de prison »`);
      return releaseFromJail(s, p.id, ctx);
    }
    case 'sendToJail': {
      getActivePlayer(s, a.playerId);
      sendToJail(s, a.playerId, ctx, 'manual');
      return { kind: 'jail', playerId: a.playerId, reason: 'manual' };
    }
    case 'endTurn':
      doEndTurn(s, ctx);
      return NONE;
    case 'collectFreeParking': {
      if (!s.settings.freeParkingJackpot) fail('RULE_VIOLATION', 'La règle du Parc gratuit n’est pas activée.');
      if (s.freeParkingPot <= 0) fail('RULE_VIOLATION', 'La cagnotte est vide.');
      const pot = s.freeParkingPot;
      s.freeParkingPot = 0;
      bankPays(s, ctx, a.playerId, pot, 'freeParking', 'Cagnotte du Parc gratuit');
      return NONE;
    }
    case 'declareBankruptcy':
      doBankruptcy(s, a.playerId, a.creditorId, ctx);
      return NONE;
    case 'updateCard': {
      const card = findCard(s, a.cardId);
      validateCardEffect(card.effect, a.effect);
      card.effect = a.effect;
      return NONE;
    }
    case 'updateSettings': {
      const p = a.patch;
      if (p.goSalary !== undefined) assertNonNegative(p.goSalary, 'Salaire');
      if (p.confirmThreshold !== undefined) assertNonNegative(p.confirmThreshold, 'Seuil');
      if (p.jailFine !== undefined) assertAmount(p.jailFine, 'Amende');
      if (p.quickAmounts !== undefined) {
        if (p.quickAmounts.length < 1 || p.quickAmounts.length > 6) fail('INVALID_AMOUNT', 'Entre 1 et 6 montants rapides.');
        p.quickAmounts.forEach((n) => assertAmount(n, 'Montant rapide'));
      }
      if (p.currency !== undefined && (p.currency.trim().length === 0 || p.currency.length > 4)) fail('INVALID_STATE', 'Symbole monétaire invalide.');
      if (p.freeParkingJackpot === false && s.freeParkingPot > 0) {
        fail('RULE_VIOLATION', 'La cagnotte n’est pas vide : distribuez-la avant de désactiver la règle.');
      }
      s.settings = { ...s.settings, ...p };
      return NONE;
    }
    case 'setCardSignature': {
      const p = getPlayer(s, a.playerId);
      if (a.signature) {
        for (const other of s.players) if (other.id !== p.id && other.cardSignature && sameSignature(other.cardSignature, a.signature)) delete other.cardSignature;
        p.cardSignature = a.signature;
      } else delete p.cardSignature;
      return NONE;
    }
    case 'setNfcLink': {
      const serial = a.serial.trim();
      if (!serial || serial.length > 64) fail('INVALID_STATE', 'Identifiant de tag invalide.');
      if (!a.target) {
        delete s.zapped.nfcLinks[serial];
        return NONE;
      }
      if (a.target.kind === 'player') getPlayer(s, a.target.playerId);
      else if (!isProperty(a.target.square)) fail('NOT_A_PROPERTY', 'Case invalide.');
      // Un joueur ou une propriété n'a qu'un seul tag.
      for (const [k, t] of Object.entries(s.zapped.nfcLinks)) {
        if (JSON.stringify(t) === JSON.stringify(a.target)) delete s.zapped.nfcLinks[k];
      }
      s.zapped.nfcLinks[serial] = a.target;
      return NONE;
    }
    case 'endGame': {
      s.status = 'ended';
      const ranked = s.players.filter((p) => !p.bankrupt);
      logEvent(s, ctx, 'Partie terminée');
      s.winnerId = ranked.length === 1 ? (ranked[0]?.id ?? null) : null;
      return { kind: 'gameOver', winnerId: s.winnerId };
    }
  }
}

function sameSignature(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ---------------------------------------------------------------------------
// Déplacements et dés
// ---------------------------------------------------------------------------

function sendToJail(s: GameState, playerId: PlayerId, ctx: Ctx, reason: 'doubles' | 'square' | 'card' | 'manual') {
  const p = getPlayer(s, playerId);
  p.position = JAIL_INDEX;
  p.inJail = true;
  p.jailTurns = 0;
  if (currentPlayer(s).id === playerId) {
    s.turn.extraTurn = false;
    s.turn.doublesCount = 0;
  }
  const why = { doubles: 'trois doubles de suite', square: 'case « Allez en prison »', card: 'carte', manual: 'manuel' }[reason];
  logEvent(s, ctx, `${p.name} va en prison (${why})`);
}

export function landingSuggestion(s: GameState, playerId: PlayerId, square: number, flags: { railroadDouble?: boolean; utilityTen?: boolean } = {}): Suggestion {
  const sq = getSquare(square);
  switch (sq.kind) {
    case 'street':
    case 'railroad':
    case 'utility': {
      const ps = propState(s, square);
      if (!ps.ownerId) return { type: 'buy', square, price: sq.price };
      if (ps.ownerId === playerId || ps.mortgaged) return { type: 'none' };
      const needsDice = sq.kind === 'utility';
      const diceTotal = s.turn.lastRoll ? s.turn.lastRoll[0] + s.turn.lastRoll[1] : 0;
      // Après une carte « compagnie », il faut relancer les dés : on ne réutilise pas le dernier lancer.
      const amount = needsDice ? (flags.utilityTen ? 0 : computeRent(s, square, { diceTotal })) : computeRent(s, square, flags);
      return { type: 'rent', square, ownerId: ps.ownerId, amount, needsDice: needsDice && (flags.utilityTen || diceTotal === 0), ...flags };
    }
    case 'tax':
      return { type: 'tax', square, amount: sq.amount };
    case 'chance':
      return { type: 'card', deck: 'chance' };
    case 'community':
      return { type: 'card', deck: 'community' };
    case 'goToJail':
      return { type: 'jailed' };
    default:
      return { type: 'none' };
  }
}

function moveTo(s: GameState, playerId: PlayerId, to: number, collectGo: boolean, ctx: Ctx, viaRoll: boolean, flags: { railroadDouble?: boolean; utilityTen?: boolean } = {}): Outcome {
  const p = getActivePlayer(s, playerId);
  const from = p.position;
  const passedGo = collectGo && to < from;
  const landsOnGo = collectGo && to === 0 && from !== 0;
  p.position = to;
  if ((passedGo || landsOnGo) && s.settings.goSalary > 0) {
    bankPays(s, ctx, p.id, s.settings.goSalary, 'go', 'Passage par le Départ');
  }
  logEvent(s, ctx, `${p.name} → ${getSquare(to).name}`);
  if (to === GO_TO_JAIL_INDEX) {
    sendToJail(s, p.id, ctx, 'square');
    return { kind: 'jail', playerId: p.id, reason: 'square' };
  }
  const sq = getSquare(to);
  if (sq.kind === 'freeParking' && s.settings.freeParkingJackpot && s.freeParkingPot > 0) {
    const pot = s.freeParkingPot;
    s.freeParkingPot = 0;
    bankPays(s, ctx, p.id, pot, 'freeParking', 'Cagnotte du Parc gratuit');
  }
  return {
    kind: 'moved',
    playerId: p.id,
    from,
    to,
    passedGo: passedGo || landsOnGo,
    suggestion: landingSuggestion(s, p.id, to, flags),
    doubles: viaRoll && !!s.turn.lastRoll && s.turn.lastRoll[0] === s.turn.lastRoll[1],
    extraTurn: s.turn.extraTurn,
  };
}

function assertDie(n: number) {
  if (!Number.isInteger(n) || n < 1 || n > 6) fail('INVALID_STATE', 'Valeur de dé invalide (1 à 6).');
}

function doRoll(s: GameState, dice: [number, number], ctx: Ctx): Outcome {
  assertDie(dice[0]);
  assertDie(dice[1]);
  const p = currentPlayer(s);
  if (p.bankrupt) fail('PLAYER_BANKRUPT', `${p.name} est en faillite.`);
  if (s.pendingCard) fail('INVALID_STATE', 'Résolvez d’abord la carte en attente.');
  if (s.turn.hasRolled && !s.turn.extraTurn) fail('INVALID_STATE', `${p.name} a déjà lancé les dés. Passez au joueur suivant.`);
  if (p.inJail && s.turn.hasRolled) fail('INVALID_STATE', `${p.name} a déjà tenté sa chance ce tour-ci.`);
  s.turn.extraTurn = false;
  s.turn.hasRolled = true;
  s.turn.lastRoll = [dice[0], dice[1]];
  const total = dice[0] + dice[1];
  const isDouble = dice[0] === dice[1];
  logEvent(s, ctx, `${p.name} lance ${dice[0]} + ${dice[1]} = ${total}${isDouble ? ' (double)' : ''}`);

  if (p.inJail) {
    if (isDouble) {
      p.inJail = false;
      p.jailTurns = 0;
      logEvent(s, ctx, `${p.name} sort de prison grâce au double`);
      // Pas de tour supplémentaire après une sortie de prison par double.
      return moveTo(s, p.id, (p.position + total) % BOARD_SIZE, true, ctx, true);
    }
    p.jailTurns += 1;
    const mustPay = p.jailTurns >= 3;
    return { kind: 'jailRoll', playerId: p.id, freed: false, mustPay };
  }

  if (isDouble) {
    s.turn.doublesCount += 1;
    if (s.turn.doublesCount >= 3) {
      sendToJail(s, p.id, ctx, 'doubles');
      return { kind: 'jail', playerId: p.id, reason: 'doubles' };
    }
    s.turn.extraTurn = true;
  }
  return moveTo(s, p.id, (p.position + total) % BOARD_SIZE, true, ctx, true);
}

function releaseFromJail(s: GameState, playerId: PlayerId, ctx: Ctx): Outcome {
  const p = getPlayer(s, playerId);
  const forcedExit = p.jailTurns >= 3;
  p.inJail = false;
  p.jailTurns = 0;
  logEvent(s, ctx, `${p.name} sort de prison`);
  // Après le 3e échec, le joueur paie puis avance du total des dés déjà lancés.
  if (forcedExit && s.turn.lastRoll && currentPlayer(s).id === playerId) {
    const total = s.turn.lastRoll[0] + s.turn.lastRoll[1];
    return moveTo(s, p.id, (p.position + total) % BOARD_SIZE, true, ctx, false);
  }
  return NONE;
}

function doEndTurn(s: GameState, ctx: Ctx) {
  if (s.pendingCard) fail('INVALID_STATE', 'Une carte est en attente : appliquez-la ou déclarez faillite.');
  const cur = currentPlayer(s);
  if (cur.inJail && cur.jailTurns >= 3) fail('INVALID_STATE', `${cur.name} doit payer l’amende ou utiliser une carte pour sortir de prison.`);
  if (s.turn.extraTurn && !cur.bankrupt && !cur.inJail) {
    s.turn.hasRolled = false;
    s.turn.extraTurn = false;
    logEvent(s, ctx, `${cur.name} rejoue (double)`);
    return;
  }
  advanceTurn(s, ctx);
}

function advanceTurn(s: GameState, ctx: Ctx) {
  const n = s.players.length;
  let idx = s.turn.currentIndex;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    if (!s.players[idx]?.bankrupt) break;
  }
  s.turn = { currentIndex: idx, doublesCount: 0, hasRolled: false, lastRoll: null, extraTurn: false, turnNumber: s.turn.turnNumber + 1 };
  const next = s.players[idx];
  if (next) logEvent(s, ctx, `Au tour de ${next.name}`);
}

// ---------------------------------------------------------------------------
// Cartes
// ---------------------------------------------------------------------------

function findCard(s: GameState, id: string): CardDef {
  const card = s.cards.find((c) => c.id === id);
  if (!card) return fail('INVALID_STATE', 'Carte inconnue.');
  return card;
}

function heldJailCards(s: GameState): Set<string> {
  return new Set(s.players.flatMap((p) => p.jailCards));
}

function doDraw(s: GameState, deck: DeckKind, playerId: PlayerId, ctx: Ctx): Outcome {
  getActivePlayer(s, playerId);
  if (s.pendingCard) fail('INVALID_STATE', 'Une carte est déjà en attente.');
  const held = heldJailCards(s);
  const d = s.decks[deck];
  let cardId: string | undefined;
  for (let guard = 0; guard < 64 && !cardId; guard++) {
    if (d.next >= d.order.length) {
      d.order = shuffle(d.order, ctx.random);
      d.next = 0;
    }
    const candidate = d.order[d.next++];
    if (candidate && !held.has(candidate)) cardId = candidate;
  }
  if (!cardId) return fail('INVALID_STATE', 'Paquet vide.');
  const card = findCard(s, cardId);
  s.lastDrawn = { cardId, playerId };
  logEvent(s, ctx, `${getPlayer(s, playerId).name} pioche : « ${card.text} »`);

  // On tente d'appliquer l'effet sur une copie : si les fonds manquent,
  // la carte reste en attente (le joueur peut hypothéquer puis réessayer).
  const trial = structuredClone(s);
  try {
    const then = applyCard(trial, card, playerId, ctx);
    Object.assign(s, trial);
    return { kind: 'card', card, playerId, pending: false, then };
  } catch (e) {
    if (e instanceof GameError && e.code === 'INSUFFICIENT_FUNDS') {
      s.pendingCard = { cardId, playerId };
      return { kind: 'card', card, playerId, pending: true, error: e.message };
    }
    throw e;
  }
}

function applyCard(s: GameState, card: CardDef, playerId: PlayerId, ctx: Ctx): Outcome | undefined {
  const e = card.effect;
  const p = getActivePlayer(s, playerId);
  const label = `Carte ${card.deck === 'chance' ? 'Chance' : 'Communauté'}`;
  switch (e.type) {
    case 'money':
      if (e.amount > 0) bankPays(s, ctx, p.id, e.amount, 'card', label);
      else if (e.amount < 0) playerPaysBank(s, ctx, p.id, -e.amount, 'card', label, true);
      return undefined;
    case 'moveTo':
      return moveTo(s, p.id, e.square, e.collectGo, ctx, false);
    case 'moveBy': {
      const to = (((p.position + e.steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
      return moveTo(s, p.id, to, e.steps > 0, ctx, false);
    }
    case 'goToJail':
      sendToJail(s, p.id, ctx, 'card');
      return { kind: 'jail', playerId: p.id, reason: 'card' };
    case 'jailFree':
      p.jailCards.push(card.id);
      return undefined;
    case 'payEach': {
      const others = s.players.filter((o) => !o.bankrupt && o.id !== p.id);
      ensureFunds(s, p, e.amount * others.length, 'payer chaque joueur');
      for (const o of others) transfer(s, ctx, p.id, o.id, e.amount, 'card', label);
      return undefined;
    }
    case 'collectEach': {
      const others = s.players.filter((o) => !o.bankrupt && o.id !== p.id);
      const broke = others.filter((o) => o.balance < e.amount);
      if (broke.length) {
        fail('INSUFFICIENT_FUNDS', `${broke.map((b) => b.name).join(', ')} ne peut pas payer ${money(s, e.amount)}. Il doit lever des fonds ou déclarer faillite.`);
      }
      for (const o of others) transfer(s, ctx, o.id, p.id, e.amount, 'card', label);
      return undefined;
    }
    case 'repairs': {
      const { houses, hotels } = countBuildings(s, p.id);
      const total = houses * e.perHouse + hotels * e.perHotel;
      if (total > 0) playerPaysBank(s, ctx, p.id, total, 'card', `${label} – réparations (${houses} maisons, ${hotels} hôtels)`, true);
      return undefined;
    }
    case 'nearest': {
      const to = nearestOfKind(p.position, e.target);
      return moveTo(s, p.id, to, true, ctx, false, e.target === 'railroad' ? { railroadDouble: true } : { utilityTen: true });
    }
  }
}

function validateCardEffect(prev: CardEffect, next: CardEffect) {
  if (prev.type !== next.type) fail('INVALID_STATE', 'Le type d’effet ne peut pas changer.');
  const check = (n: number, label: string, allowNegative = false) => {
    if (!Number.isInteger(n) || Math.abs(n) > 100_000 || (!allowNegative && n < 0)) fail('INVALID_AMOUNT', `${label} invalide.`);
  };
  switch (next.type) {
    case 'money':
      check(next.amount, 'Montant', true);
      if (next.amount === 0) fail('INVALID_AMOUNT', 'Le montant ne peut pas être nul.');
      break;
    case 'payEach':
    case 'collectEach':
      check(next.amount, 'Montant');
      break;
    case 'repairs':
      check(next.perHouse, 'Montant par maison');
      check(next.perHotel, 'Montant par hôtel');
      break;
    case 'moveBy':
      if (!Number.isInteger(next.steps) || next.steps === 0 || Math.abs(next.steps) > 39) fail('INVALID_STATE', 'Nombre de cases invalide.');
      break;
    case 'moveTo':
      if (!Number.isInteger(next.square) || next.square < 0 || next.square >= BOARD_SIZE) fail('INVALID_STATE', 'Case invalide.');
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Échanges
// ---------------------------------------------------------------------------

function doTrade(s: GameState, a: Extract<GameAction, { type: 'trade' }>, ctx: Ctx) {
  if (a.a === a.b) fail('INVALID_STATE', 'Choisissez deux joueurs différents.');
  const pa = getActivePlayer(s, a.a);
  const pb = getActivePlayer(s, a.b);
  assertNonNegative(a.aCash, 'Somme');
  assertNonNegative(a.bCash, 'Somme');
  if (a.aGives.length + a.bGives.length === 0 && a.aCash + a.bCash === 0) fail('INVALID_STATE', 'L’échange est vide.');
  if (new Set([...a.aGives, ...a.bGives]).size !== a.aGives.length + a.bGives.length) fail('INVALID_STATE', 'Propriété en double dans l’échange.');
  for (const [giver, list] of [[pa, a.aGives], [pb, a.bGives]] as const) {
    for (const idx of list) {
      if (!isProperty(idx)) fail('NOT_A_PROPERTY', 'Case invalide dans l’échange.');
      if (propState(s, idx).ownerId !== giver.id) fail('NOT_OWNER', `${getProperty(idx).name} n’appartient pas à ${giver.name}.`);
      mustOk(canTransfer(s, idx));
    }
  }
  // Intérêts de 10 % pour chaque propriété hypothéquée reçue.
  const interestFor = (list: number[]) =>
    list.filter((i) => propState(s, i).mortgaged).reduce((sum, i) => sum + mortgageInterest(getProperty(i).mortgage), 0);
  const aInterest = interestFor(a.bGives);
  const bInterest = interestFor(a.aGives);
  const aFinal = pa.balance - a.aCash + a.bCash - aInterest;
  const bFinal = pb.balance - a.bCash + a.aCash - bInterest;
  if (pa.balance < a.aCash || aFinal < 0) fail('INSUFFICIENT_FUNDS', `${pa.name} n’a pas assez d’argent pour cet échange.`);
  if (pb.balance < a.bCash || bFinal < 0) fail('INSUFFICIENT_FUNDS', `${pb.name} n’a pas assez d’argent pour cet échange.`);

  if (a.aCash > 0) transfer(s, ctx, pa.id, pb.id, a.aCash, 'trade', 'Échange – soulte');
  if (a.bCash > 0) transfer(s, ctx, pb.id, pa.id, a.bCash, 'trade', 'Échange – soulte');
  for (const idx of a.aGives) propState(s, idx).ownerId = pb.id;
  for (const idx of a.bGives) propState(s, idx).ownerId = pa.id;
  if (aInterest > 0) playerPaysBank(s, ctx, pa.id, aInterest, 'trade', 'Intérêts 10 % sur propriétés hypothéquées');
  if (bInterest > 0) playerPaysBank(s, ctx, pb.id, bInterest, 'trade', 'Intérêts 10 % sur propriétés hypothéquées');
  const names = (l: number[]) => (l.length ? l.map((i) => getProperty(i).name).join(', ') : '—');
  logEvent(s, ctx, `Échange ${pa.name} ⇄ ${pb.name} : ${names(a.aGives)} contre ${names(a.bGives)}`);
}

// ---------------------------------------------------------------------------
// Faillite et fin de partie
// ---------------------------------------------------------------------------

function doBankruptcy(s: GameState, playerId: PlayerId, creditorId: PlayerId | null, ctx: Ctx) {
  const p = getActivePlayer(s, playerId);
  if (creditorId === playerId) fail('INVALID_STATE', 'Créancier invalide.');
  const creditor = creditorId ? getActivePlayer(s, creditorId) : null;
  const owned = PROPERTIES.filter((d) => s.properties[d.index]?.ownerId === p.id).map((d) => d.index);

  // 1. Les bâtiments sont revendus à la banque à moitié prix.
  for (const idx of owned) {
    const def = getProperty(idx);
    const ps = propState(s, idx);
    if (def.kind === 'street' && ps.houses > 0) {
      const value = (def.housePrice / 2) * ps.houses;
      if (ps.houses === 5) s.bankHotels += 1;
      else s.bankHouses += ps.houses;
      ps.houses = 0;
      bankPays(s, ctx, p.id, value, 'sellBuilding', `Liquidation bâtiments – ${def.name}`);
    }
  }
  // 2. L'argent restant va au créancier (ou disparaît à la banque).
  const cash = p.balance;
  if (cash > 0) {
    if (creditor) transfer(s, ctx, p.id, creditor.id, cash, 'bankruptcy', `Faillite de ${p.name}`);
    else playerPaysBank(s, ctx, p.id, cash, 'bankruptcy', `Faillite de ${p.name}`);
  }
  // 3. Les propriétés (et cartes prison) passent au créancier ou retournent à la banque.
  for (const idx of owned) {
    const ps = propState(s, idx);
    if (creditor) ps.ownerId = creditor.id;
    else {
      ps.ownerId = null;
      ps.mortgaged = false;
    }
  }
  if (creditor) creditor.jailCards.push(...p.jailCards);
  p.jailCards = [];
  p.bankrupt = true;
  p.inJail = false;
  if (s.pendingCard?.playerId === p.id) s.pendingCard = null;
  logEvent(s, ctx, `${p.name} fait faillite${creditor ? ` au profit de ${creditor.name}` : ' (banque)'}`);
  if (currentPlayer(s).id === p.id) advanceTurn(s, ctx);
}

function checkGameOver(s: GameState, ctx: Ctx): Outcome | null {
  if (s.status !== 'playing') return null;
  const alive = s.players.filter((p) => !p.bankrupt);
  if (alive.length <= 1) {
    s.status = 'ended';
    s.winnerId = alive[0]?.id ?? null;
    logEvent(s, ctx, alive[0] ? `${alive[0].name} remporte la partie !` : 'Partie terminée');
    return { kind: 'gameOver', winnerId: s.winnerId };
  }
  return null;
}

export const ALL_SQUARES = BOARD;
