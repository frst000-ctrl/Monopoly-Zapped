import { createContext, useContext } from 'react';
import type { Outcome } from '../domain/game';

export type TabId = 'turn' | 'bank' | 'props' | 'cards' | 'history' | 'zapped' | 'settings' | 'more';

export type SheetRequest =
  | { type: 'player'; playerId: string }
  | { type: 'property'; square: number }
  | { type: 'trade'; a?: string; b?: string; aGives?: number[] }
  | { type: 'custom'; playerId?: string; direction?: 'in' | 'out' }
  | { type: 'transfer'; from?: string; to?: string; amount?: number }
  | { type: 'rent'; payerId?: string; square?: number }
  | { type: 'tax'; playerId?: string }
  | { type: 'bankruptcy'; playerId: string };

export interface GameUi {
  open: (s: SheetRequest) => void;
  close: () => void;
  setTab: (t: TabId) => void;
  /** Résultat du dernier lancer / carte : propositions d'action. */
  outcome: Outcome | null;
  setOutcome: (o: Outcome | null) => void;
}

export const GameUiContext = createContext<GameUi | null>(null);

export function useGameUi(): GameUi {
  const c = useContext(GameUiContext);
  if (!c) throw new Error('GameUiContext manquant');
  return c;
}
