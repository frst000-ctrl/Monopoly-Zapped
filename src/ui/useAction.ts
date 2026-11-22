import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { ActionInput } from '../domain/game';
import { formatMoney } from '../domain/money';
import { newId, store, type DispatchResult } from '../store/gameStore';
import { useFeedback } from './feedback';

export interface RunOptions {
  /** Confirmation explicite (sinon automatique au-delà du seuil si amount est fourni). */
  confirm?: { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean };
  amount?: number;
  /** Texte du message de succès ; false pour aucun message. */
  success?: string | false;
  /** Clé anti-doublon (formulaire). */
  actionId?: string;
}

/**
 * Exécute une action du moteur avec : verrou anti double-clic, confirmation
 * des opérations importantes, notification du résultat.
 */
export function useAction() {
  const { confirm, toast } = useFeedback();
  const busy = useRef(false);
  return useCallback(
    async (input: ActionInput, label: string, opts: RunOptions = {}): Promise<DispatchResult | null> => {
      if (busy.current) return null;
      busy.current = true;
      try {
        const game = store.getSnapshot().game;
        const threshold = game?.settings.confirmThreshold ?? 0;
        let ask = opts.confirm;
        if (!ask && opts.amount !== undefined && threshold > 0 && opts.amount >= threshold && game) {
          ask = { title: 'Confirmer l’opération', message: `${label} — ${formatMoney(opts.amount, game.settings.currency)}` };
        }
        if (ask && !(await confirm(ask))) return null;
        const r = store.dispatch(input, label, opts.actionId ?? newId());
        if (r.ok) {
          if (opts.success !== false) toast(opts.success ?? label, 'success');
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(15);
        } else toast(r.error, 'error');
        return r;
      } finally {
        busy.current = false;
      }
    },
    [confirm, toast],
  );
}

/** Identifiant stable pour la durée de vie d'un formulaire. */
export function useFormId() {
  const [id] = useState(() => newId());
  return id;
}
