// Lecture « tactile » expérimentale des cartes bancaires Zapped.
//
// D'après les tests publiés en 2012, les cartes de l'édition zAPPed ne contiennent
// ni puce NFC ni code-barres : elles portent des plots conducteurs disposés selon
// un motif propre à chaque carte, que l'écran capacitif détecte comme plusieurs
// doigts simultanés (le joueur doit toucher la carte). On reproduit ici le
// principe : on mesure les distances entre les points de contact, ce qui donne
// une empreinte indépendante de la position et de l'orientation de la carte.
// Rien ne garantit que chaque écran détecte ces plots : c'est expérimental,
// et le mode manuel reste toujours disponible.

export interface Point {
  x: number;
  y: number;
}

export const MIN_POINTS = 3;
export const MAX_POINTS = 8;

/** Empreinte = nombre de points + distances deux à deux triées (en px CSS, arrondies). */
export function signatureFromPoints(points: Point[]): number[] | null {
  if (points.length < MIN_POINTS || points.length > MAX_POINTS) return null;
  const d: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i] as Point;
      const b = points[j] as Point;
      d.push(Math.round(Math.hypot(a.x - b.x, a.y - b.y)));
    }
  }
  d.sort((x, y) => x - y);
  if ((d[0] ?? 0) < 4) return null; // deux contacts confondus : lecture douteuse
  return [points.length, ...d];
}

/** Écart relatif moyen entre deux empreintes (Infinity si incomparables). */
export function signatureDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a[0] !== b[0]) return Infinity;
  let sum = 0;
  let ref = 0;
  for (let i = 1; i < a.length; i++) {
    sum += Math.abs((a[i] as number) - (b[i] as number));
    ref += ((a[i] as number) + (b[i] as number)) / 2;
  }
  return ref === 0 ? Infinity : sum / ref;
}

export const MATCH_TOLERANCE = 0.08;

/** Retourne l'identifiant de la carte la plus proche, si elle est assez proche et sans ambiguïté. */
export function matchSignature(sig: number[], candidates: { id: string; signature: number[] }[], tolerance = MATCH_TOLERANCE): string | null {
  const scored = candidates
    .map((c) => ({ id: c.id, score: signatureDistance(sig, c.signature) }))
    .filter((c) => c.score <= tolerance)
    .sort((x, y) => x.score - y.score);
  const best = scored[0];
  if (!best) return null;
  const second = scored[1];
  if (second && second.score - best.score < tolerance / 4) return null; // trop ambigu
  return best.id;
}

/** Moyenne de plusieurs lectures cohérentes (calibration). */
export function averageSignatures(sigs: number[][]): number[] | null {
  const first = sigs[0];
  if (!first || sigs.some((s) => s.length !== first.length || s[0] !== first[0])) return null;
  for (const s of sigs) if (signatureDistance(s, first) > MATCH_TOLERANCE) return null;
  return first.map((_, i) => (i === 0 ? first[0] as number : Math.round(sigs.reduce((sum, s) => sum + (s[i] as number), 0) / sigs.length)));
}
