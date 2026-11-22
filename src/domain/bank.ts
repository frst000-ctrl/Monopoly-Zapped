import { fail } from './errors';
import { assertAmount, formatMoney } from './money';
import type { GameState, Player, PlayerId, TxKind } from './types';

// Banque électronique : toutes les écritures passent par ces fonctions,
// qui vérifient les soldes AVANT de modifier quoi que ce soit.
// Elles opèrent sur un brouillon (copie) de l'état fourni par le moteur.

export interface Ctx {
  now: number;
  newId: () => string;
  random: () => number;
}

export function getPlayer(state: GameState, id: PlayerId): Player {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) return fail('UNKNOWN_PLAYER', 'Joueur introuvable.');
  return p;
}

export function getActivePlayer(state: GameState, id: PlayerId): Player {
  const p = getPlayer(state, id);
  if (p.bankrupt) fail('PLAYER_BANKRUPT', `${p.name} est en faillite.`);
  return p;
}

function record(state: GameState, ctx: Ctx, kind: TxKind, from: PlayerId | null, to: PlayerId | null, amount: number, label: string) {
  state.transactions.push({ id: ctx.newId(), at: ctx.now, kind, from, to, amount, label });
}

export function ensureFunds(state: GameState, player: Player, amount: number, what = 'ce paiement') {
  if (player.balance < amount) {
    fail(
      'INSUFFICIENT_FUNDS',
      `${player.name} n’a que ${formatMoney(player.balance, state.settings.currency)} pour ${what} (${formatMoney(amount, state.settings.currency)}). Hypothéquez, vendez des bâtiments ou déclarez faillite.`,
    );
  }
}

/** La banque verse de l'argent à un joueur. */
export function bankPays(state: GameState, ctx: Ctx, to: PlayerId, amount: number, kind: TxKind, label: string) {
  assertAmount(amount);
  const p = getActivePlayer(state, to);
  p.balance += amount;
  record(state, ctx, kind, null, to, amount, label);
}

/** Un joueur paie la banque (ou le Parc gratuit si la règle maison est active et toPot = true). */
export function playerPaysBank(
  state: GameState,
  ctx: Ctx,
  from: PlayerId,
  amount: number,
  kind: TxKind,
  label: string,
  toPot = false,
) {
  assertAmount(amount);
  const p = getActivePlayer(state, from);
  ensureFunds(state, p, amount, label.toLowerCase());
  p.balance -= amount;
  if (toPot && state.settings.freeParkingJackpot) state.freeParkingPot += amount;
  record(state, ctx, kind, from, null, amount, label);
}

/** Transfert entre deux joueurs. */
export function transfer(state: GameState, ctx: Ctx, from: PlayerId, to: PlayerId, amount: number, kind: TxKind, label: string) {
  assertAmount(amount);
  if (from === to) fail('INVALID_STATE', 'Le payeur et le bénéficiaire doivent être différents.');
  const a = getActivePlayer(state, from);
  const b = getActivePlayer(state, to);
  ensureFunds(state, a, amount, label.toLowerCase());
  a.balance -= amount;
  b.balance += amount;
  record(state, ctx, kind, from, to, amount, label);
}

/** Vérifie les invariants comptables : aucun solde négatif, entiers uniquement. */
export function checkConsistency(state: GameState): string[] {
  const problems: string[] = [];
  for (const p of state.players) {
    if (!Number.isInteger(p.balance)) problems.push(`Solde non entier pour ${p.name}`);
    if (p.balance < 0) problems.push(`Solde négatif pour ${p.name}`);
    if (p.bankrupt && p.balance !== 0) problems.push(`${p.name} est en faillite mais a un solde`);
  }
  let houses = 0;
  let hotels = 0;
  for (const ps of Object.values(state.properties)) {
    if (ps.houses < 0 || ps.houses > 5) problems.push('Nombre de maisons invalide');
    if (ps.houses === 5) hotels++;
    else houses += ps.houses;
    if (ps.mortgaged && ps.houses > 0) problems.push('Propriété hypothéquée avec bâtiments');
    if (ps.ownerId && !state.players.some((p) => p.id === ps.ownerId && !p.bankrupt)) problems.push('Propriétaire invalide');
  }
  if (houses + state.bankHouses !== 32) problems.push('Stock de maisons incohérent');
  if (hotels + state.bankHotels !== 12) problems.push('Stock d’hôtels incohérent');
  if (state.freeParkingPot < 0) problems.push('Cagnotte négative');
  return problems;
}
