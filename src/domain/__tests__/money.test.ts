import { describe, expect, it } from 'vitest';
import { amountToInput, formatMoney, parseAmountInput, ZAPPED_CURRENCY as Z } from '../money';

describe('monnaie Zapped (M / K)', () => {
  it('affiche les montants comme l’édition Zapped', () => {
    expect(formatMoney(1500, Z)).toBe('15M');
    expect(formatMoney(200, Z)).toBe('2M');
    expect(formatMoney(60, Z)).toBe('600K');
    expect(formatMoney(150, Z)).toBe('1,5M');
    expect(formatMoney(2, Z)).toBe('20K');
    expect(formatMoney(-50, Z)).toBe('−500K');
    expect(formatMoney(0, Z)).toBe('0M');
    expect(formatMoney(250, 'M')).toBe('250 M');
  });
  it('lit les saisies en M et K', () => {
    expect(parseAmountInput('15M')).toBe(1500);
    expect(parseAmountInput('1,5M')).toBe(150);
    expect(parseAmountInput('1.25M')).toBe(125);
    expect(parseAmountInput('600K')).toBe(60);
    expect(parseAmountInput('20k')).toBe(2);
    expect(parseAmountInput('250')).toBe(250);
    expect(parseAmountInput('5K')).toBeNull(); // pas un multiple de 10K
    expect(parseAmountInput('0M')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('')).toBeNull();
  });
  it('aller-retour saisie ↔ montant', () => {
    for (const n of [1, 2, 15, 60, 100, 150, 200, 1500, 2350]) expect(parseAmountInput(amountToInput(n, Z))).toBe(n);
  });
});
