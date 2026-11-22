import { MIN_POINTS, signatureFromPoints, type Point } from './touchSignature';

// Lecteur de carte global : surveille TOUS les contacts sur l'écran.
// Une carte Zapped posée = au moins 3 contacts simultanés et immobiles.
// Un doigt seul (ou deux pour zoomer) n'est jamais pris pour une carte.

export type ReaderEvent =
  | { type: 'count'; count: number }
  | { type: 'card'; signature: number[] | null; points: number };

export interface CardReaderOptions {
  /** Durée pendant laquelle les contacts doivent rester stables. */
  stableMs?: number;
  /** Déplacement maximal toléré (px) pendant la stabilisation. */
  jitterPx?: number;
}

/**
 * Logique du lecteur, indépendante du DOM (testable) : on lui donne la liste
 * des contacts à chaque changement, il émet les événements.
 */
export class CardReaderCore {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private read = false;
  private anchor: Point[] | null = null;
  private latest: Point[] = [];
  private readonly stableMs: number;
  private readonly jitterPx: number;

  constructor(
    private readonly emit: (e: ReaderEvent) => void,
    opts: CardReaderOptions = {},
  ) {
    this.stableMs = opts.stableMs ?? 400;
    this.jitterPx = opts.jitterPx ?? 12;
  }

  /** true si le geste en cours est (ou a été) une carte : l'UI doit alors ignorer ces contacts. */
  get cardGesture(): boolean {
    return this.read || this.latest.length >= MIN_POINTS;
  }

  update(points: Point[]) {
    const prevCount = this.latest.length;
    this.latest = points;
    if (points.length !== prevCount) this.emit({ type: 'count', count: points.length });
    if (points.length === 0) {
      this.clear();
      this.read = false;
      return;
    }
    if (this.read || points.length < MIN_POINTS) {
      this.clear();
      return;
    }
    // Relance la temporisation si le nombre de contacts change ou s'ils bougent trop.
    const moved = !this.anchor || this.anchor.length !== points.length || points.some((p, i) => {
      const a = this.anchor![i]!;
      return Math.hypot(p.x - a.x, p.y - a.y) > this.jitterPx;
    });
    if (moved) {
      this.clear();
      this.anchor = points;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.read = true;
        this.emit({ type: 'card', signature: signatureFromPoints(this.latest), points: this.latest.length });
      }, this.stableMs);
    }
  }

  /**
   * Nouveau geste (tous les contacts viennent d'apparaître). Indispensable : si l'élément
   * touché disparaît de la page (fenêtre fermée par la lecture), le « touchend » final
   * n'arrive jamais jusqu'à la fenêtre et le lecteur resterait bloqué.
   */
  reset() {
    this.clear();
    this.read = false;
    this.latest = [];
  }

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.anchor = null;
  }

  dispose() {
    this.clear();
  }
}

/** Branche le lecteur sur toute la fenêtre. Renvoie la fonction de débranchement. */
export function attachCardReader(emit: (e: ReaderEvent) => void, opts?: CardReaderOptions): () => void {
  const core = new CardReaderCore(emit, opts);
  const handle = (e: TouchEvent) => {
    if (e.type === 'touchstart' && e.touches.length === e.changedTouches.length) core.reset();
    core.update(Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY })));
    // Une carte posée ne doit ni faire défiler, ni zoomer, ni « cliquer » sur un bouton dessous.
    if (core.cardGesture && e.cancelable) e.preventDefault();
  };
  const block = (e: Event) => e.preventDefault(); // pincement Safari (iOS)
  const opt = { passive: false, capture: true } as const;
  window.addEventListener('touchstart', handle, opt);
  window.addEventListener('touchmove', handle, opt);
  window.addEventListener('touchend', handle, opt);
  window.addEventListener('touchcancel', handle, opt);
  window.addEventListener('gesturestart', block, opt);
  return () => {
    window.removeEventListener('touchstart', handle, opt);
    window.removeEventListener('touchmove', handle, opt);
    window.removeEventListener('touchend', handle, opt);
    window.removeEventListener('touchcancel', handle, opt);
    window.removeEventListener('gesturestart', block, opt);
    core.dispose();
  };
}
