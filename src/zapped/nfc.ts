// Web NFC : uniquement Chrome sur Android (pas d'iPhone/iPad, pas de Windows).
// Les cartes Zapped d'origine n'ont pas de puce NFC : cette fonction sert
// uniquement à des tags NFC que vous collez vous-même sur vos cartes.

interface NdefReadingEvent extends Event {
  serialNumber: string;
}
interface NdefReaderLike {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  addEventListener(type: 'reading', cb: (e: NdefReadingEvent) => void): void;
  addEventListener(type: 'readingerror', cb: (e: Event) => void): void;
}

export function isWebNfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/** Démarre la lecture ; renvoie une fonction d'arrêt. */
export async function startNfcScan(onTag: (serial: string) => void, onError: (msg: string) => void): Promise<() => void> {
  if (!isWebNfcSupported()) throw new Error('Web NFC n’est pas disponible sur cet appareil.');
  const Ctor = (window as unknown as { NDEFReader: new () => NdefReaderLike }).NDEFReader;
  const reader = new Ctor();
  const controller = new AbortController();
  reader.addEventListener('reading', (e) => onTag(e.serialNumber || 'tag-sans-numero'));
  reader.addEventListener('readingerror', () => onError('Tag illisible. Réessayez.'));
  await reader.scan({ signal: controller.signal });
  return () => controller.abort();
}
