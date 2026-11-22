import { ScanLine } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { attachCardReader } from '../zapped/cardReader';
import { MIN_POINTS } from '../zapped/touchSignature';

// Lecteur de carte actif sur tout l'écran pendant la partie.
// Les composants peuvent « réserver » la prochaine lecture (ex. : carte du bénéficiaire,
// calibration) ; sinon la lecture va au gestionnaire par défaut (ouvrir le paiement).

type Handler = (signature: number[] | null, points: number) => void;

interface ReaderApi {
  push: (h: { current: Handler }) => () => void;
  subscribeCount: (fn: (n: number) => void) => () => void;
}

const Ctx = createContext<ReaderApi | null>(null);

export function CardReaderProvider({ onCard, children }: { onCard: Handler; children: ReactNode }) {
  const stack = useRef<{ current: Handler }[]>([]);
  const countListeners = useRef(new Set<(n: number) => void>());
  const defaultRef = useRef(onCard);
  defaultRef.current = onCard;
  const [count, setCount] = useState(0);
  const api = useRef<ReaderApi>({
    push: (h) => {
      stack.current.push(h);
      return () => {
        stack.current = stack.current.filter((x) => x !== h);
      };
    },
    subscribeCount: (fn) => {
      countListeners.current.add(fn);
      return () => countListeners.current.delete(fn);
    },
  });

  useEffect(
    () =>
      attachCardReader((e) => {
        if (e.type === 'count') {
          setCount(e.count);
          countListeners.current.forEach((fn) => fn(e.count));
        } else {
          const top = stack.current[stack.current.length - 1];
          (top ? top.current : defaultRef.current)(e.signature, e.points);
          if ('vibrate' in navigator) navigator.vibrate?.(30);
        }
      }),
    [],
  );

  return (
    <Ctx.Provider value={api.current}>
      {children}
      {count >= MIN_POINTS && (
        <div className="fixed inset-x-0 top-0 z-[70] flex justify-center pointer-events-none safe-top" aria-live="polite">
          <div className="mt-3 rounded-full bg-gain text-[#04210f] font-bold text-sm px-4 py-2 flex items-center gap-2 shadow-2xl pop-in">
            <ScanLine size={16} /> Lecture de la carte…
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Réserve les lectures de carte tant que le composant est affiché (et enabled). */
export function useCardCapture(handler: Handler, enabled = true) {
  const api = useContext(Ctx);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!api || !enabled) return;
    return api.push(ref);
  }, [api, enabled]);
}

export function useContactCount(): number {
  const api = useContext(Ctx);
  const [n, setN] = useState(0);
  useEffect(() => api?.subscribeCount(setN), [api]);
  return n;
}

export const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
