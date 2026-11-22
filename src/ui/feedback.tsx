import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, cx, Sheet } from './components/ui';

// Confirmations (promesses) et notifications éphémères, accessibles partout.

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
type ToastTone = 'success' | 'error' | 'info' | 'warn';
interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
}

interface FeedbackApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (text: string, tone?: ToastTone) => void;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })), []);
  const toast = useCallback((text: string, tone: ToastTone = 'success') => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);
  const api = useMemo(() => ({ confirm, toast }), [confirm, toast]);

  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };

  const icons = { success: CheckCircle2, error: XCircle, info: Info, warn: AlertTriangle };
  return (
    <Ctx.Provider value={api}>
      {children}
      {pending && (
        <Sheet
          title={pending.title}
          onClose={() => close(false)}
          footer={
            <>
              <Button className="flex-1" onClick={() => close(false)}>
                Annuler
              </Button>
              <Button className="flex-1" variant={pending.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                {pending.confirmLabel ?? 'Confirmer'}
              </Button>
            </>
          }
        >
          <div className="text-[15px] leading-relaxed text-fg/90">{pending.message}</div>
        </Sheet>
      )}
      <div className="fixed z-[60] left-0 right-0 bottom-20 md:bottom-6 md:left-auto md:right-6 md:w-96 safe-bottom pointer-events-none flex flex-col items-center gap-2 px-4 pb-2" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              className={cx(
                'pop-in pointer-events-auto max-w-md w-full flex items-start gap-3 rounded-2xl px-4 py-3 shadow-2xl border text-sm font-medium backdrop-blur',
                t.tone === 'success' && 'bg-[#0f2a1a]/95 border-gain/40',
                t.tone === 'error' && 'bg-[#2c1012]/95 border-loss/50',
                t.tone === 'info' && 'bg-surface-2/95 border-line',
                t.tone === 'warn' && 'bg-[#2b230c]/95 border-gold/40',
              )}
              role={t.tone === 'error' ? 'alert' : 'status'}
            >
              <Icon size={18} className={cx('shrink-0 mt-0.5', t.tone === 'success' && 'text-gain', t.tone === 'error' && 'text-loss', t.tone === 'warn' && 'text-gold')} />
              <span>{t.text}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('FeedbackProvider manquant');
  return c;
}
