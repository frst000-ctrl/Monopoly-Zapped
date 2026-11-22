import { fail } from './errors';

export const MAX_AMOUNT = 10_000_000;

/** Vérifie qu'un montant est un entier strictement positif et raisonnable. */
export function assertAmount(amount: number, label = 'Montant'): number {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    fail('INVALID_AMOUNT', `${label} invalide : utilisez un nombre entier.`);
  }
  if (amount <= 0) fail('INVALID_AMOUNT', `${label} doit être supérieur à 0.`);
  if (amount > MAX_AMOUNT) fail('INVALID_AMOUNT', `${label} trop élevé.`);
  return amount;
}

/** Montant positif ou nul (échanges sans argent, etc.). */
export function assertNonNegative(amount: number, label = 'Montant'): number {
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0 || amount > MAX_AMOUNT) {
    fail('INVALID_AMOUNT', `${label} invalide.`);
  }
  return amount;
}

export function formatMoney(amount: number, currency: string): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}${Math.abs(amount).toLocaleString('fr-FR')} ${currency}`;
}

/** Remboursement d'hypothèque : valeur + 10 %, arrondi à l'unité supérieure. */
export function unmortgageCost(mortgage: number): number {
  // Arithmétique entière : 200 * 1.1 vaut 220.00000000000003 en flottant.
  return Math.ceil((mortgage * 11) / 10);
}

/** Intérêts dus quand on reçoit une propriété hypothéquée (10 %). */
export function mortgageInterest(mortgage: number): number {
  return Math.ceil(mortgage / 10);
}
