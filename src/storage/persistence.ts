import type { GameState } from '../domain/types';

// Sauvegarde locale (localStorage). Écriture synchrone à chaque opération :
// un rechargement de page ou une fermeture du navigateur ne perd rien.
// Une copie de secours de la sauvegarde précédente est conservée.

export const SAVE_KEY = 'zapped-bank/v1/save';
export const BACKUP_KEY = 'zapped-bank/v1/backup';

export interface UndoEntry {
  label: string;
  snapshot: GameState;
}

export interface SaveFile {
  format: 'zapped-bank-save';
  version: 1;
  savedAt: number;
  game: GameState;
  undo: UndoEntry[];
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function browserStorage(): KeyValueStorage | null {
  try {
    const ls = window.localStorage;
    const probe = '__zapped_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/** Vérifie la structure d'une partie chargée et complète les champs ajoutés depuis. */
export function validateGame(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Partial<GameState>;
  if (g.schemaVersion !== 1 || typeof g.id !== 'string') return null;
  if (!Array.isArray(g.players) || g.players.length < 2 || g.players.length > 4) return null;
  for (const p of g.players) {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') return null;
    if (!Number.isInteger(p.balance) || p.balance < 0) return null;
    if (!Number.isInteger(p.position) || p.position < 0 || p.position > 39) return null;
    if (!Array.isArray(p.jailCards)) p.jailCards = [];
  }
  if (!g.properties || typeof g.properties !== 'object' || Object.keys(g.properties).length !== 28) return null;
  if (!g.turn || !g.settings || !Array.isArray(g.cards) || !g.decks) return null;
  if (!Array.isArray(g.transactions) || !Array.isArray(g.events)) return null;
  if (!Array.isArray(g.processedActionIds)) g.processedActionIds = [];
  if (!g.zapped) g.zapped = { nfcLinks: {} };
  return g as GameState;
}

export function parseSave(text: string | null): SaveFile | null {
  if (!text) return null;
  try {
    const data = JSON.parse(text) as Partial<SaveFile>;
    if (data.format !== 'zapped-bank-save' || data.version !== 1) return null;
    const game = validateGame(data.game);
    if (!game) return null;
    const undo = Array.isArray(data.undo)
      ? data.undo.filter((u): u is UndoEntry => !!u && typeof u.label === 'string' && validateGame(u.snapshot) !== null)
      : [];
    return { format: 'zapped-bank-save', version: 1, savedAt: Number(data.savedAt) || Date.now(), game, undo };
  } catch {
    return null;
  }
}

export function serialize(game: GameState, undo: UndoEntry[]): string {
  const file: SaveFile = { format: 'zapped-bank-save', version: 1, savedAt: Date.now(), game, undo };
  return JSON.stringify(file);
}

export type SaveResult = { ok: true; trimmedUndo: boolean } | { ok: false; error: string };

export function saveGame(storage: KeyValueStorage, game: GameState, undo: UndoEntry[]): SaveResult {
  const previous = storage.getItem(SAVE_KEY);
  const attempts = [undo, undo.slice(-5), []];
  for (const [i, u] of attempts.entries()) {
    try {
      storage.setItem(SAVE_KEY, serialize(game, u));
      if (previous) {
        try {
          storage.setItem(BACKUP_KEY, previous);
        } catch {
          storage.removeItem(BACKUP_KEY);
        }
      }
      return { ok: true, trimmedUndo: i > 0 };
    } catch {
      // Quota dépassé : on réessaie avec moins d'historique d'annulation.
      storage.removeItem(BACKUP_KEY);
    }
  }
  return { ok: false, error: 'Sauvegarde impossible : stockage du navigateur plein ou désactivé.' };
}

export function loadGame(storage: KeyValueStorage): { save: SaveFile; fromBackup: boolean } | null {
  const main = parseSave(storage.getItem(SAVE_KEY));
  if (main) return { save: main, fromBackup: false };
  const backup = parseSave(storage.getItem(BACKUP_KEY));
  if (backup) return { save: backup, fromBackup: true };
  return null;
}

export function clearSave(storage: KeyValueStorage) {
  storage.removeItem(SAVE_KEY);
  storage.removeItem(BACKUP_KEY);
}
