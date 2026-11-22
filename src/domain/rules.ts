import { BOARD, getProperty, groupMembers, RAILROAD_RENTS, UTILITY_MULTIPLIERS, PROPERTIES } from './board';
import { unmortgageCost } from './money';
import type { ColorGroup, GameState, PlayerId, PropertyState } from './types';

// Règles du Monopoly en fonctions pures (lecture seule de l'état).

export type Check = { ok: true } | { ok: false; reason: string };
const ok: Check = { ok: true };
const no = (reason: string): Check => ({ ok: false, reason });

export function propState(state: GameState, index: number): PropertyState {
  const p = state.properties[index];
  if (!p) throw new Error(`Propriété ${index} absente de l’état`);
  return p;
}

export function ownedBy(state: GameState, playerId: PlayerId): number[] {
  return PROPERTIES.filter((p) => state.properties[p.index]?.ownerId === playerId).map((p) => p.index);
}

export function ownsFullGroup(state: GameState, playerId: PlayerId, group: ColorGroup): boolean {
  return groupMembers(group).every((s) => state.properties[s.index]?.ownerId === playerId);
}

export function groupHasBuildings(state: GameState, group: ColorGroup): boolean {
  return groupMembers(group).some((s) => (state.properties[s.index]?.houses ?? 0) > 0);
}

export function countOwnedOfKind(state: GameState, playerId: PlayerId, kind: 'railroad' | 'utility'): number {
  return PROPERTIES.filter((p) => p.kind === kind && state.properties[p.index]?.ownerId === playerId).length;
}

export interface RentOptions {
  diceTotal?: number;
  /** Carte « gare la plus proche » : loyer doublé. */
  railroadDouble?: boolean;
  /** Carte « compagnie la plus proche » : 10 × dés quel que soit le nombre possédé. */
  utilityTen?: boolean;
}

/** Calcule le loyer dû sur une case, ou 0 si aucun loyer n'est dû. */
export function computeRent(state: GameState, index: number, opts: RentOptions = {}): number {
  const def = getProperty(index);
  const ps = propState(state, index);
  if (!ps.ownerId || ps.mortgaged) return 0;
  switch (def.kind) {
    case 'street': {
      if (ps.houses > 0) return def.rents[ps.houses] ?? 0;
      const base = def.rents[0];
      return ownsFullGroup(state, ps.ownerId, def.group) ? base * 2 : base;
    }
    case 'railroad': {
      const n = countOwnedOfKind(state, ps.ownerId, 'railroad');
      const rent = RAILROAD_RENTS[Math.max(0, n - 1)] ?? 0;
      return opts.railroadDouble ? rent * 2 : rent;
    }
    case 'utility': {
      const dice = opts.diceTotal ?? 0;
      if (dice <= 0) return 0;
      if (opts.utilityTen) return dice * 10;
      const n = countOwnedOfKind(state, ps.ownerId, 'utility');
      return dice * (UTILITY_MULTIPLIERS[Math.max(0, n - 1)] ?? 4);
    }
  }
}

export function canBuildHouse(state: GameState, index: number): Check {
  const def = getProperty(index);
  if (def.kind !== 'street') return no('On ne construit que sur les terrains.');
  const ps = propState(state, index);
  if (!ps.ownerId) return no('Ce terrain n’a pas de propriétaire.');
  if (!ownsFullGroup(state, ps.ownerId, def.group)) return no('Il faut posséder tous les terrains du groupe.');
  const members = groupMembers(def.group);
  if (members.some((m) => propState(state, m.index).mortgaged)) return no('Un terrain du groupe est hypothéqué.');
  if (ps.houses >= 5) return no('Ce terrain a déjà un hôtel.');
  const min = Math.min(...members.map((m) => propState(state, m.index).houses));
  if (ps.houses > min) return no('Construction équilibrée : bâtissez d’abord sur les autres terrains du groupe.');
  if (ps.houses === 4) {
    if (state.bankHotels <= 0) return no('La banque n’a plus d’hôtel disponible.');
  } else if (state.bankHouses <= 0) {
    return no('La banque n’a plus de maison disponible.');
  }
  const owner = state.players.find((p) => p.id === ps.ownerId);
  if (!owner || owner.balance < def.housePrice) return no('Fonds insuffisants pour construire.');
  return ok;
}

export function canSellHouse(state: GameState, index: number): Check {
  const def = getProperty(index);
  if (def.kind !== 'street') return no('Aucun bâtiment sur cette case.');
  const ps = propState(state, index);
  if (ps.houses <= 0) return no('Aucun bâtiment à vendre.');
  const members = groupMembers(def.group);
  const max = Math.max(...members.map((m) => propState(state, m.index).houses));
  if (ps.houses < max) return no('Vente équilibrée : vendez d’abord sur les terrains les plus construits.');
  if (ps.houses === 5 && state.bankHouses < 4) {
    return no('La banque n’a pas 4 maisons pour remplacer l’hôtel. Vendez les bâtiments du groupe un par un ailleurs d’abord.');
  }
  return ok;
}

export function canMortgage(state: GameState, index: number): Check {
  const def = getProperty(index);
  const ps = propState(state, index);
  if (!ps.ownerId) return no('Propriété sans propriétaire.');
  if (ps.mortgaged) return no('Déjà hypothéquée.');
  if (def.kind === 'street' && groupHasBuildings(state, def.group)) {
    return no('Vendez d’abord les bâtiments de tout le groupe.');
  }
  return ok;
}

export function canUnmortgage(state: GameState, index: number): Check {
  const def = getProperty(index);
  const ps = propState(state, index);
  if (!ps.ownerId) return no('Propriété sans propriétaire.');
  if (!ps.mortgaged) return no('Cette propriété n’est pas hypothéquée.');
  const owner = state.players.find((p) => p.id === ps.ownerId);
  if (!owner || owner.balance < unmortgageCost(def.mortgage)) return no('Fonds insuffisants pour lever l’hypothèque.');
  return ok;
}

/** Une propriété peut changer de main seulement si son groupe n'a aucun bâtiment. */
export function canTransfer(state: GameState, index: number): Check {
  const def = getProperty(index);
  if (def.kind === 'street' && groupHasBuildings(state, def.group)) {
    return no(`${def.name} : vendez d’abord les bâtiments du groupe.`);
  }
  return ok;
}

/** Argent que le joueur peut encore lever (ventes de bâtiments + hypothèques). */
export function liquidationValue(state: GameState, playerId: PlayerId): number {
  let total = 0;
  for (const idx of ownedBy(state, playerId)) {
    const def = getProperty(idx);
    const ps = propState(state, idx);
    if (def.kind === 'street' && ps.houses > 0) total += (def.housePrice / 2) * ps.houses;
    if (!ps.mortgaged) total += def.mortgage;
  }
  return total;
}

export function netWorth(state: GameState, playerId: PlayerId): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  let total = player.balance;
  for (const idx of ownedBy(state, playerId)) {
    const def = getProperty(idx);
    const ps = propState(state, idx);
    total += ps.mortgaged ? def.mortgage : def.price;
    if (def.kind === 'street') total += def.housePrice * ps.houses;
  }
  return total;
}

export function nearestOfKind(position: number, kind: 'railroad' | 'utility'): number {
  for (let step = 1; step <= BOARD.length; step++) {
    const idx = (position + step) % BOARD.length;
    if (BOARD[idx]?.kind === kind) return idx;
  }
  throw new Error('Case introuvable');
}

export function countBuildings(state: GameState, playerId: PlayerId): { houses: number; hotels: number } {
  let houses = 0;
  let hotels = 0;
  for (const idx of ownedBy(state, playerId)) {
    const h = propState(state, idx).houses;
    if (h === 5) hotels++;
    else houses += h;
  }
  return { houses, hotels };
}
