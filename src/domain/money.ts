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

/**
 * Monnaie de l'édition Zapped : les montants s'affichent en millions et milliers
 * (15M au départ, +2M au Départ, loyer 600K). En interne, 1 unité = 10 000 :
 * les valeurs du plateau classique (1 500, 200, 60…) correspondent exactement
 * à celles de l'édition Zapped (15M, 2M, 600K…).
 */
export const ZAPPED_CURRENCY = 'KM';
export const ZAPPED_UNIT = 10_000;

const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export function formatMoney(amount: number, currency: string): string {
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  if (currency === ZAPPED_CURRENCY) {
    const v = abs * ZAPPED_UNIT;
    if (v === 0) return '0M';
    return `${sign}${v >= 1_000_000 ? `${fr(v / 1_000_000)}M` : `${fr(v / 1_000)}K`}`;
  }
  return `${sign}${abs.toLocaleString('fr-FR')} ${currency}`;
}

/** Texte de saisie correspondant à un montant (inverse de parseAmountInput). */
export function amountToInput(amount: number, currency: string): string {
  if (currency !== ZAPPED_CURRENCY) return String(amount);
  const v = amount * ZAPPED_UNIT;
  return v >= 1_000_000 && v % 10_000 === 0 ? `${fr(v / 1_000_000).replace(/\s/g, '')}M` : `${fr(v / 1_000).replace(/\s/g, '')}K`;
}

/**
 * Lit une saisie : « 250 » (unités classiques), ou « 1,5M » / « 600K » (Zapped).
 * Renvoie null si invalide, non entière ou nulle.
 */
export function parseAmountInput(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').toUpperCase();
  const m = /^(\d+(?:[.,]\d{1,2})?)([MK])$/.exec(t);
  if (m) {
    const x = Number((m[1] as string).replace(',', '.'));
    const units = m[2] === 'M' ? (x * 1_000_000) / ZAPPED_UNIT : (x * 1_000) / ZAPPED_UNIT;
    const rounded = Math.round(units);
    if (Math.abs(units - rounded) > 1e-9 || rounded <= 0 || !Number.isSafeInteger(rounded)) return null;
    return rounded;
  }
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
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
