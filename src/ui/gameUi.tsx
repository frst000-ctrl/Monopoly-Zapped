import { createContext, useContext } from 'react';
import type { Outcome } from '../domain/game';

export type TabId = 'home' | 'turn' | 'bank' | 'props' | 'cards' | 'history' | 'zapped' | 'settings' | 'more';

export type SheetRequest =
  | { type: 'player'; playerId: string }
  | { type: 'property'; square: number }
  | { type: 'trade'; a?: string; b?: string; aGives?: number[] }
  | { type: 'custom'; playerId?: string; direction?: 'in' | 'out' }
  | { type: 'transfer'; from?: string; to?: string; amount?: number }
  | { type: 'rent'; payerId?: string; square?: number; railroadDouble?: boolean; utilityTen?: boolean }
  | { type: 'tax'; playerId?: string }
  | { type: 'bankruptcy'; playerId: string }
  | { type: 'cardPay'; playerId: string }
  | { type: 'unknownCard'; signature: number[] | null }
  // Tuiles de l'écran principal (façon Zapped)
  | { type: 'buy'; playerId: string }
  | { type: 'build'; playerId: string }
  | { type: 'payPlayer'; playerId: string }
  | { type: 'auction'; playerId: string }
  | { type: 'draw'; playerId: string; deck: 'chance' | 'community' }
  | { type: 'jail'; playerId: string }
  | { type: 'menu' };

export interface GameUi {
  open: (s: SheetRequest) => void;
  close: () => void;
  setTab: (t: TabId) => void;
  tab: TabId;
  /** Joueur dont la carte est « dans le lecteur » sur l'écran principal. */
  selectedId: string | null;
  select: (id: string | null) => void;
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
