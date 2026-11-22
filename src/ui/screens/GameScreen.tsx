import { Banknote, Building2, Gamepad2, History, Layers, Menu, Nfc, Settings2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Outcome, SetupPlayer } from '../../domain/game';
import { store, useGame, useStore } from '../../store/gameStore';
import { Button, cx, Money, Notice, PlayerDot } from '../components/ui';
import { Logo } from '../components/Logo';
import { useFeedback } from '../feedback';
import { GameUiContext, useGameUi as useGameUiSafe, type GameUi, type SheetRequest, type TabId } from '../gameUi';
import { SheetHost } from '../sheets/SheetHost';
import { BankTab } from './BankTab';
import { CardsTab } from './CardsTab';
import { GameOver } from './GameOver';
import { HistoryTab } from './HistoryTab';
import { PropertiesTab } from './PropertiesTab';
import { SettingsTab } from './SettingsTab';
import { TurnTab } from './TurnTab';
import { ZappedTab } from './ZappedTab';

const TABS: { id: TabId; label: string; icon: typeof Banknote; mobile: boolean }[] = [
  { id: 'turn', label: 'Partie', icon: Gamepad2, mobile: true },
  { id: 'bank', label: 'Banque', icon: Banknote, mobile: true },
  { id: 'props', label: 'Titres', icon: Building2, mobile: true },
  { id: 'cards', label: 'Cartes', icon: Layers, mobile: false },
  { id: 'zapped', label: 'Zapped', icon: Nfc, mobile: false },
  { id: 'history', label: 'Journal', icon: History, mobile: true },
  { id: 'settings', label: 'Réglages', icon: Settings2, mobile: false },
];

const TAB_KEY = 'zapped-bank/tab';

export function GameScreen({ onRestart }: { onRestart: (players: SetupPlayer[], startingCash: number) => void }) {
  const game = useGame();
  const { undo, storageWarning } = useStore();
  const { confirm, toast } = useFeedback();
  const [tab, setTabState] = useState<TabId>(() => {
    try {
      return (sessionStorage.getItem(TAB_KEY) as TabId) || 'turn';
    } catch {
      return 'turn';
    }
  });
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const setTab = useCallback((t: TabId) => {
    setTabState(t);
    try {
      sessionStorage.setItem(TAB_KEY, t);
    } catch {
      /* stockage indisponible : sans importance */
    }
    window.scrollTo({ top: 0 });
  }, []);

  const ui: GameUi = useMemo(() => ({ open: setSheet, close: () => setSheet(null), setTab, outcome, setOutcome }), [setTab, outcome]);

  // Le résultat affiché concerne le joueur actif : on l'efface quand le tour change.
  useEffect(() => setOutcome(null), [game.turn.turnNumber]);

  const current = game.players[game.turn.currentIndex];
  const lastUndo = undo[undo.length - 1];

  const doUndo = async () => {
    if (!lastUndo) return;
    if (await confirm({ title: 'Annuler la dernière opération ?', message: <>L’opération « <b>{lastUndo.label}</b> » sera annulée et les soldes rétablis.</>, confirmLabel: 'Annuler l’opération' })) {
      const label = store.undo();
      setOutcome(null);
      if (label) toast(`Annulé : ${label}`, 'info');
    }
  };

  const restart = () => onRestart(game.players.map((p) => ({ name: p.name, color: p.color })), game.settings.startingCash);

  let content;
  if (game.status === 'ended' && (tab === 'turn' || tab === 'bank')) content = <GameOver onRestart={restart} />;
  else
    switch (tab) {
      case 'turn': content = <TurnTab />; break;
      case 'bank': content = <BankTab />; break;
      case 'props': content = <PropertiesTab />; break;
      case 'cards': content = <CardsTab />; break;
      case 'history': content = <HistoryTab />; break;
      case 'zapped': content = <ZappedTab />; break;
      case 'settings': content = <SettingsTab onRestart={restart} />; break;
      case 'more': content = <MoreTab />; break;
    }

  return (
    <GameUiContext.Provider value={ui}>
      <div className="min-h-full md:flex">
        {/* Barre latérale (tablette paysage / ordinateur) */}
        <aside className="hidden md:flex md:flex-col w-60 lg:w-64 shrink-0 border-r border-line/60 bg-surface/50 h-dvh sticky top-0 p-4 safe-top">
          <div className="flex items-center gap-3 px-2 mb-6 mt-2">
            <Logo size={36} />
            <span className="font-black text-lg">Zapped Bank</span>
          </div>
          <nav className="flex flex-col gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cx('h-11 px-3 rounded-xl flex items-center gap-3 font-semibold text-[15px] transition', tab === t.id ? 'bg-accent/15 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg')}
              >
                <t.icon size={19} className={tab === t.id ? 'text-accent' : ''} /> {t.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto">
            <Button className="w-full" onClick={doUndo} disabled={!lastUndo}>
              <Undo2 size={18} /> Annuler
            </Button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* En-tête */}
          <header className="sticky top-0 z-30 bg-ink/85 backdrop-blur-xl border-b border-line/50 safe-top">
            <div className="h-14 px-4 flex items-center gap-3 max-w-5xl mx-auto w-full">
              {current && game.status === 'playing' ? (
                <button type="button" onClick={() => setSheet({ type: 'player', playerId: current.id })} className="flex items-center gap-2.5 min-w-0">
                  <PlayerDot color={current.color} size={14} />
                  <div className="min-w-0 text-left leading-tight">
                    <div className="text-[11px] uppercase tracking-wider text-muted font-bold">Tour {game.turn.turnNumber}</div>
                    <div className="font-bold truncate">{current.name}</div>
                  </div>
                  <Money amount={current.balance} currency={game.settings.currency} className="ml-2 font-bold text-gain" />
                </button>
              ) : (
                <div className="font-bold">Partie terminée</div>
              )}
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={doUndo} disabled={!lastUndo} aria-label="Annuler la dernière opération" className="md:hidden">
                  <Undo2 size={20} />
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 pt-4 pb-28 md:pb-10 max-w-5xl mx-auto w-full">
            {storageWarning && <div className="mb-4"><Notice tone="warn">{storageWarning}</Notice></div>}
            {content}
          </main>

          {/* Navigation basse (mobile) */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur-xl border-t border-line/60 safe-bottom">
            <div className="grid grid-cols-5">
              {TABS.filter((t) => t.mobile).map((t) => (
                <NavButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />
              ))}
              <NavButton active={['cards', 'zapped', 'settings', 'more'].includes(tab)} onClick={() => setTab('more')} icon={Menu} label="Plus" />
            </div>
          </nav>
        </div>
      </div>
      <SheetHost sheet={sheet} />
    </GameUiContext.Provider>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Banknote; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cx('h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold', active ? 'text-fg' : 'text-muted')}>
      <Icon size={22} className={active ? 'text-accent' : ''} />
      {label}
    </button>
  );
}

function MoreTab() {
  const { setTab } = useGameUiSafe();
  const items = TABS.filter((t) => !t.mobile);
  return (
    <div className="space-y-3">
      {items.map((t) => (
        <button key={t.id} type="button" onClick={() => setTab(t.id)} className="w-full h-16 rounded-3xl bg-surface border border-line/70 px-5 flex items-center gap-4 font-semibold text-lg">
          <t.icon size={22} className="text-accent" /> {t.label}
        </button>
      ))}
    </div>
  );
}

