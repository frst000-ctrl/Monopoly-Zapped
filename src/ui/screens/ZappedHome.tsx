import {
  ArrowBigLeftDash,
  Banknote,
  Building2,
  Gamepad2,
  History,
  Layers,
  Nfc,
  Settings2,
  ArrowLeftRight,
  CircleHelp,
  CreditCard,
  Gavel,
  Gem,
  HandCoins,
  Hotel,
  House,
  KeyRound,
  LockOpen,
  PackageOpen,
  Percent,
  TrendingDown,
  Undo2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { BOARD } from '../../domain/board';
import { formatMoney } from '../../domain/money';
import { store, useGame, useStore } from '../../store/gameStore';
import { cx, Sheet } from '../components/ui';
import { useFeedback } from '../feedback';
import { useGameUi, type SheetRequest, type TabId } from '../gameUi';
import { useAction } from '../useAction';

type Icon = typeof House;

interface Tile {
  id: string;
  label: string;
  /** Deux teintes pour l'effet « bouton brillant ». */
  from: string;
  to: string;
  icon: ReactNode;
  onTap: (playerId: string) => void;
}

const glyph = (I: Icon, size = 44) => <I size={size} strokeWidth={2.2} className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]" />;

/**
 * Écran principal façon Zapped : la carte posée (ou le joueur touché) apparaît
 * dans la barre du haut, puis une tuile déclenche l'opération correspondante.
 */
export function ZappedHome() {
  const game = useGame();
  const { undo } = useStore();
  const { open, selectedId, select } = useGameUi();
  const { confirm, toast } = useFeedback();
  const run = useAction();
  const cur = game.settings.currency;
  const alive = game.players.filter((p) => !p.bankrupt);
  const player = alive.find((p) => p.id === selectedId) ?? null;
  const lastUndo = undo[undo.length - 1];

  const tax = (index: number) => (pid: string) => {
    const sq = BOARD[index];
    const p = game.players.find((x) => x.id === pid);
    if (!sq || sq.kind !== 'tax' || !p) return;
    void run({ type: 'payTax', playerId: pid, square: index }, `${p.name} paie ${sq.name}`, {
      confirm: { title: sq.name, message: <>{p.name} paie <b>{formatMoney(sq.amount, cur)}</b> à la banque.</>, confirmLabel: 'Payer' },
    });
  };
  const sheet = (make: (pid: string) => SheetRequest) => (pid: string) => open(make(pid));

  const tiles: Tile[] = [
    { id: 'props', label: 'Propriétés', from: '#3fc26b', to: '#13843d', icon: glyph(KeyRound), onTap: sheet((playerId) => ({ type: 'buy', playerId })) },
    {
      id: 'build',
      label: 'Maison et Hôtel',
      from: '#ff6b5e',
      to: '#c8241b',
      icon: (
        <span className="flex items-end gap-0.5">
          {glyph(House, 34)}
          {glyph(Hotel, 42)}
        </span>
      ),
      onTap: sheet((playerId) => ({ type: 'build', playerId })),
    },
    {
      id: 'go',
      label: `Départ +${formatMoney(game.settings.goSalary, cur)}`,
      from: '#ff4b55',
      to: '#b3121c',
      icon: glyph(ArrowBigLeftDash, 50),
      onTap: (pid) => {
        const p = game.players.find((x) => x.id === pid);
        if (p) void run({ type: 'collectGo', playerId: pid }, `${p.name} passe par le Départ`, { amount: game.settings.goSalary });
      },
    },
    { id: 'rent', label: 'Payer loyer', from: '#ffb547', to: '#d9740b', icon: glyph(HandCoins), onTap: sheet((payerId) => ({ type: 'rent', payerId })) },
    { id: 'pay', label: 'Payer joueur', from: '#38b6ff', to: '#0b6fc2', icon: glyph(ArrowLeftRight), onTap: sheet((playerId) => ({ type: 'payPlayer', playerId })) },
    { id: 'auction', label: 'Enchères', from: '#b07cff', to: '#6a32c9', icon: glyph(Gavel), onTap: sheet((playerId) => ({ type: 'auction', playerId })) },
    { id: 'chance', label: 'Chance', from: '#ff9f2e', to: '#d0610a', icon: glyph(CircleHelp, 50), onTap: sheet((playerId) => ({ type: 'draw', playerId, deck: 'chance' })) },
    { id: 'community', label: 'Caisse de communauté', from: '#4f8dff', to: '#1d4fc4', icon: glyph(PackageOpen), onTap: sheet((playerId) => ({ type: 'draw', playerId, deck: 'community' })) },
    { id: 'jail', label: 'Sortie de prison', from: '#8f9aa8', to: '#4b5663', icon: glyph(LockOpen), onTap: sheet((playerId) => ({ type: 'jail', playerId })) },
    { id: 'luxury', label: 'Taxe de luxe', from: '#3ad1c6', to: '#0f8f86', icon: glyph(Gem), onTap: tax(38) },
    { id: 'income', label: 'Impôt sur le revenu', from: '#f25aa6', to: '#b51c6b', icon: glyph(Percent), onTap: tax(4) },
    { id: 'bankrupt', label: 'Faillite', from: '#4a4f58', to: '#1d2026', icon: glyph(TrendingDown), onTap: sheet((playerId) => ({ type: 'bankruptcy', playerId })) },
  ];

  const tap = (t: Tile) => {
    if (!player) {
      toast('Posez d’abord une carte bancaire, ou touchez un joueur en haut.', 'warn');
      return;
    }
    t.onTap(player.id);
  };

  const doUndo = async () => {
    if (!lastUndo) return;
    if (await confirm({ title: 'Annuler la dernière opération ?', message: <>« <b>{lastUndo.label}</b> » sera annulée.</>, confirmLabel: 'Annuler l’opération' })) {
      const label = store.undo();
      if (label) toast(`Annulé : ${label}`, 'info');
    }
  };

  return (
    <div className="zapped-board h-dvh min-h-[560px] flex flex-col overflow-hidden">
      {/* Barre du joueur, à la couleur de sa carte */}
      <header
        className="safe-top shadow-[0_6px_18px_rgba(0,0,0,0.25)] transition-colors"
        style={{ background: player ? `linear-gradient(180deg, ${player.color}, color-mix(in srgb, ${player.color} 70%, #000))` : 'linear-gradient(180deg, #5b6673, #343b44)' }}
      >
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-3 text-white">
          <div className="flex items-center gap-3 min-h-14">
            <div className="h-12 w-12 rounded-2xl bg-white/20 grid place-items-center shrink-0 ring-1 ring-white/30">
              <CreditCard size={26} />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[13px] font-semibold opacity-85">{player ? 'Carte de' : 'Aucune carte'}</div>
              <div className="text-2xl font-black truncate">{player ? player.name : 'Posez une carte'}</div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-semibold opacity-85">Solde</div>
              <div className="text-3xl sm:text-4xl font-black tabular drop-shadow" aria-live="polite">{player ? formatMoney(player.balance, cur) : '—'}</div>
            </div>
          </div>
          {/* Choix du joueur sans carte */}
          <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar" role="radiogroup" aria-label="Joueur">
            {alive.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === player?.id}
                onClick={() => select(p.id)}
                className={cx(
                  'h-9 px-3 rounded-full text-sm font-bold flex items-center gap-2 shrink-0 transition',
                  p.id === player?.id ? 'bg-white text-[#13202b] shadow' : 'bg-black/20 text-white/90 hover:bg-black/30',
                )}
              >
                <span className="h-3 w-3 rounded-full ring-1 ring-white/70" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Grille de tuiles */}
      <main className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-3 sm:px-5 pt-4 pb-2 flex flex-col">
        <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-4 sm:grid-cols-4 sm:grid-rows-3 gap-3 sm:gap-4">
          {tiles.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => tap(t)}
              className={cx('zapped-tile min-h-0 rounded-[22px] text-white flex flex-col items-center justify-between pt-2 pb-2 px-1.5', !player && 'opacity-85')}
              style={{ background: `linear-gradient(160deg, ${t.from}, ${t.to})` }}
            >
              <span className="flex-1 min-h-0 grid place-items-center [&_svg]:max-h-full">{t.icon}</span>
              <span className="w-full rounded-xl bg-black/25 py-1 text-[12px] sm:text-[14px] font-extrabold leading-tight text-center">{t.label}</span>
            </button>
          ))}
        </div>
        {!player && <p className="text-center text-sm font-semibold text-[#21506b] mt-3">Posez une carte bancaire à plat sur l’écran pour la sélectionner.</p>}
      </main>

      {/* Bouton accueil */}
      <footer className="safe-bottom pb-3 pt-1 flex shrink-0 items-center justify-center gap-6">
        <button type="button" onClick={doUndo} disabled={!lastUndo} aria-label="Annuler la dernière opération" className="h-12 w-12 rounded-full bg-white/80 text-[#21506b] grid place-items-center shadow disabled:opacity-40">
          <Undo2 size={22} />
        </button>
        <button type="button" onClick={() => open({ type: 'menu' })} aria-label="Menu" className="zapped-home h-16 w-16 rounded-full grid place-items-center text-white">
          <span className="h-6 w-6 rounded-md border-[3px] border-white" />
        </button>
        <span className="h-12 w-12" aria-hidden />
      </footer>
    </div>
  );
}

/** Menu du bouton accueil : accès à tous les écrans existants. */
export function MenuSheet({ onClose }: { onClose: () => void }) {
  const { setTab } = useGameUi();
  const game = useGame();
  const items: { tab: TabId; label: string; hint: string; icon: Icon }[] = [
    { tab: 'history', label: 'Journal', hint: 'Toutes les opérations, annulation', icon: History },
    { tab: 'props', label: 'Titres de propriété', hint: 'Propriétaires, hypothèques, échanges', icon: Building2 },
    { tab: 'zapped', label: 'Cartes bancaires', hint: 'Associer une carte à un joueur', icon: Nfc },
    { tab: 'cards', label: 'Chance et Communauté', hint: 'Textes et montants des cartes', icon: Layers },
    { tab: 'bank', label: 'Banque rapide', hint: 'Crédit, débit, montants rapides', icon: Banknote },
    ...(game.settings.trackPositions ? [{ tab: 'turn' as TabId, label: 'Tour de jeu et dés', hint: 'Dés virtuels et pions suivis', icon: Gamepad2 }] : []),
    { tab: 'settings', label: 'Réglages', hint: 'Montants, règles maison, sauvegarde', icon: Settings2 },
  ];
  return (
    <Sheet title="Menu" onClose={onClose}>
      <div className="grid gap-2">
        {items.map((it) => (
          <button
            key={it.tab}
            type="button"
            onClick={() => { onClose(); setTab(it.tab); }}
            className="min-h-16 rounded-2xl bg-surface-2 border border-line px-4 py-2 flex items-center gap-4 text-left"
          >
            <it.icon size={22} className="text-accent shrink-0" />
            <span>
              <span className="block font-bold">{it.label}</span>
              <span className="block text-xs text-muted">{it.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
