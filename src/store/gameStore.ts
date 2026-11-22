import { useSyncExternalStore } from 'react';
import { checkConsistency } from '../domain/bank';
import { GameError } from '../domain/errors';
import { applyAction, createGame, type ActionInput, type Ctx, type GameAction, type GameSetup, type Outcome } from '../domain/game';
import type { GameState } from '../domain/types';
import { browserStorage, clearSave, loadGame, saveGame, type KeyValueStorage, type UndoEntry } from '../storage/persistence';

// Store applicatif : relie le moteur de règles (pur) à React et à la sauvegarde.

export const MAX_UNDO = 30;

export type DispatchResult = { ok: true; outcome: Outcome } | { ok: false; error: string };

export interface StoreState {
  game: GameState | null;
  undo: UndoEntry[];
  storageWarning: string | null;
  restoredFromBackup: boolean;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function secureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] as number) / 2 ** 32;
  }
  return Math.random();
}

export function rollDie(): number {
  return 1 + Math.floor(secureRandom() * 6);
}

const ctx = (): Ctx => ({ now: Date.now(), newId, random: secureRandom });

export class GameStore {
  private state: StoreState;
  private listeners = new Set<() => void>();
  private storage: KeyValueStorage | null;

  constructor(storage: KeyValueStorage | null) {
    this.storage = storage;
    const loaded = storage ? loadGame(storage) : null;
    this.state = {
      game: null,
      undo: [],
      storageWarning: storage ? null : 'Le stockage du navigateur est indisponible (navigation privée ?) : la partie ne sera pas sauvegardée.',
      restoredFromBackup: loaded?.fromBackup ?? false,
    };
    // La partie sauvegardée n'est pas chargée automatiquement : l'accueil propose de la reprendre.
    this.saved = loaded?.save ?? null;
  }

  private saved: { game: GameState; undo: UndoEntry[]; savedAt: number } | null;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.state;

  savedGameInfo() {
    if (!this.saved) return null;
    const g = this.saved.game;
    return { savedAt: this.saved.savedAt, players: g.players.map((p) => p.name), status: g.status, turn: g.turn.turnNumber };
  }

  private set(next: Partial<StoreState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((l) => l());
  }

  private persist(game: GameState, undo: UndoEntry[]) {
    if (!this.storage) return;
    const r = saveGame(this.storage, game, undo);
    this.saved = { game, undo, savedAt: Date.now() };
    if (!r.ok) this.set({ storageWarning: r.error });
    else if (r.trimmedUndo) this.set({ storageWarning: 'Stockage presque plein : l’historique d’annulation a été réduit.' });
  }

  resume(): boolean {
    if (!this.saved) return false;
    this.set({ game: this.saved.game, undo: this.saved.undo });
    return true;
  }

  start(setup: GameSetup): DispatchResult {
    try {
      const game = createGame(setup, ctx());
      this.set({ game, undo: [] });
      this.persist(game, []);
      return { ok: true, outcome: { kind: 'none' } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Applique une action. L'identifiant (clé anti-doublon) peut être fourni par l'UI
   * pour qu'un double clic sur le même formulaire ne soit jamais exécuté deux fois.
   */
  dispatch(input: ActionInput, label: string, actionId: string = newId()): DispatchResult {
    const game = this.state.game;
    if (!game) return { ok: false, error: 'Aucune partie en cours.' };
    try {
      const { state, outcome } = applyAction(game, { ...input, id: actionId } as GameAction, ctx());
      const problems = checkConsistency(state);
      if (problems.length) {
        // Filet de sécurité : on refuse tout état incohérent.
        return { ok: false, error: `Opération annulée (incohérence détectée : ${problems.join(', ')}).` };
      }
      const undo = [...this.state.undo, { label, snapshot: game }].slice(-MAX_UNDO);
      this.set({ game: state, undo });
      this.persist(state, undo);
      return { ok: true, outcome };
    } catch (e) {
      if (e instanceof GameError) return { ok: false, error: e.message };
      console.error(e);
      return { ok: false, error: 'Erreur inattendue : l’opération n’a pas été appliquée.' };
    }
  }

  canUndo() {
    return this.state.undo.length > 0;
  }

  undo(): string | null {
    const last = this.state.undo[this.state.undo.length - 1];
    if (!last) return null;
    const undo = this.state.undo.slice(0, -1);
    this.set({ game: last.snapshot, undo });
    this.persist(last.snapshot, undo);
    return last.label;
  }

  /** Quitte vers l'accueil (la sauvegarde reste disponible). */
  leave() {
    this.set({ game: null, undo: [] });
  }

  /** Supprime définitivement la sauvegarde. */
  discard() {
    if (this.storage) clearSave(this.storage);
    this.saved = null;
    this.set({ game: null, undo: [], restoredFromBackup: false });
  }

  exportSave(): string | null {
    const g = this.state.game ?? this.saved?.game;
    if (!g) return null;
    return JSON.stringify({ format: 'zapped-bank-save', version: 1, savedAt: Date.now(), game: g, undo: [] }, null, 2);
  }

  importSave(text: string): DispatchResult {
    const mem = new Map<string, string>([['zapped-bank/v1/save', text]]);
    const loaded = loadGame({ getItem: (k) => mem.get(k) ?? null, setItem: () => {}, removeItem: () => {} });
    if (!loaded) return { ok: false, error: 'Fichier de sauvegarde invalide.' };
    const problems = checkConsistency(loaded.save.game);
    if (problems.length) return { ok: false, error: `Sauvegarde incohérente : ${problems.join(', ')}` };
    this.set({ game: loaded.save.game, undo: [] });
    this.persist(loaded.save.game, []);
    return { ok: true, outcome: { kind: 'none' } };
  }
}

export const store = new GameStore(typeof window !== 'undefined' ? browserStorage() : null);

export function useStore(): StoreState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useGame(): GameState {
  const { game } = useStore();
  if (!game) throw new Error('useGame appelé sans partie');
  return game;
}
