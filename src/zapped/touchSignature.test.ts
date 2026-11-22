import { describe, expect, it } from 'vitest';
import { averageSignatures, matchSignature, signatureFromPoints, type Point } from './touchSignature';

const card = (pts: Point[], dx = 0, dy = 0, angle = 0): Point[] =>
  pts.map((p) => ({
    x: p.x * Math.cos(angle) - p.y * Math.sin(angle) + dx,
    y: p.x * Math.sin(angle) + p.y * Math.cos(angle) + dy,
  }));

const A = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }];
const B = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 45 }];

describe('empreinte tactile', () => {
  it('est invariante par translation et rotation', () => {
    const s1 = signatureFromPoints(card(A))!;
    const s2 = signatureFromPoints(card(A, 120, 80, Math.PI / 3))!;
    expect(matchSignature(s2, [{ id: 'A', signature: s1 }])).toBe('A');
  });
  it('distingue deux cartes', () => {
    const sa = signatureFromPoints(card(A))!;
    const sb = signatureFromPoints(card(B))!;
    const read = signatureFromPoints(card(B, 10, 10, 1))!;
    expect(matchSignature(read, [{ id: 'A', signature: sa }, { id: 'B', signature: sb }])).toBe('B');
  });
  it('refuse trop peu de points ou des points confondus', () => {
    expect(signatureFromPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull();
    expect(signatureFromPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 50, y: 50 }])).toBeNull();
  });
  it('rejette une carte inconnue', () => {
    const sa = signatureFromPoints(card(A))!;
    const other = signatureFromPoints([{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 0, y: 90 }])!;
    expect(matchSignature(other, [{ id: 'A', signature: sa }])).toBeNull();
  });
  it('calibration : moyenne seulement si les lectures concordent', () => {
    const s1 = signatureFromPoints(card(A))!;
    const s2 = signatureFromPoints(card(A, 5, 5, 0.2))!;
    expect(averageSignatures([s1, s2])).not.toBeNull();
    expect(averageSignatures([s1, signatureFromPoints(card(B))!])).toBeNull();
  });
});
