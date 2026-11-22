import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoney } from '../../domain/money';
import type { GameState, Transaction } from '../../domain/types';
import { store, useGame, useStore } from '../../store/gameStore';
import { Button, Card, cx, PlayerDot, SectionTitle } from '../components/ui';
import { useFeedback } from '../feedback';
import { useGameUi } from '../gameUi';

export function TransactionList({ game, txs, perspective }: { game: GameState; txs: Transaction[]; perspective?: string }) {
  const name = (id: string | null) => (id ? game.players.find((p) => p.id === id)?.name ?? '?' : 'Banque');
  const color = (id: string | null) => (id ? game.players.find((p) => p.id === id)?.color : undefined);
  if (!txs.length) return <p className="text-sm text-muted">Aucune opération.</p>;
  return (
    <ul className="divide-y divide-line/50 rounded-2xl bg-surface-2 border border-line/60 overflow-hidden">
      {txs.map((t) => {
        const incoming = perspective ? t.to === perspective : t.from === null;
        const outgoing = perspective ? t.from === perspective : t.to === null;
        const Icon = t.from && t.to ? ArrowLeftRight : incoming ? ArrowDownLeft : ArrowUpRight;
        return (
          <li key={t.id} className="flex items-center gap-3 px-3.5 py-3">
            <span className={cx('h-9 w-9 rounded-full grid place-items-center shrink-0', incoming && !outgoing ? 'bg-gain/15 text-gain' : outgoing ? 'bg-loss/15 text-loss' : 'bg-surface-3')}>
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{t.label}</div>
              <div className="text-xs text-muted flex items-center gap-1.5 truncate">
                {color(t.from) && <PlayerDot color={color(t.from)!} size={7} />}
                {name(t.from)} → {color(t.to) && <PlayerDot color={color(t.to)!} size={7} />}
                {name(t.to)} · {new Date(t.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <span className={cx('tabular font-bold text-sm shrink-0', perspective ? (incoming ? 'text-gain' : 'text-loss') : '')}>
              {perspective ? (incoming ? '+' : '−') : ''}
              {formatMoney(t.amount, game.settings.currency)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function HistoryTab() {
  const game = useGame();
  const { undo } = useStore();
  const { confirm, toast } = useFeedback();
  const { setOutcome } = useGameUi();
  const [filter, setFilter] = useState<string>('all');
  const [view, setView] = useState<'money' | 'events'>('money');
  const txs = useMemo(
    () => game.transactions.filter((t) => filter === 'all' || t.from === filter || t.to === filter).slice().reverse(),
    [game.transactions, filter],
  );
  const lastUndo = undo[undo.length - 1];

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="p-4 mb-5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted font-bold uppercase tracking-wider">Dernière opération</div>
          <div className="font-semibold truncate">{lastUndo?.label ?? '—'}</div>
        </div>
        <Button
          disabled={!lastUndo}
          onClick={async () => {
            if (!lastUndo) return;
            if (await confirm({ title: 'Annuler la dernière opération ?', message: <>« <b>{lastUndo.label}</b> » sera annulée.</>, confirmLabel: 'Annuler l’opération' })) {
              const l = store.undo();
              setOutcome(null);
              if (l) toast(`Annulé : ${l}`, 'info');
            }
          }}
        >
          <Undo2 size={18} /> Annuler
        </Button>
      </Card>
      <p className="text-xs text-muted -mt-3 mb-5">Jusqu’à {undo.length} opération(s) annulable(s) à la suite.</p>

      <div className="flex gap-2 mb-4">
        {(['money', 'events'] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={cx('h-9 px-4 rounded-full text-sm font-semibold border', view === v ? 'bg-fg text-ink border-fg' : 'bg-surface border-line text-muted')}>
            {v === 'money' ? `Transactions (${game.transactions.length})` : `Événements (${game.events.length})`}
          </button>
        ))}
      </div>

      {view === 'money' ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>Tous</FilterChip>
            {game.players.map((p) => (
              <FilterChip key={p.id} active={filter === p.id} onClick={() => setFilter(p.id)}>
                <PlayerDot color={p.color} size={9} /> {p.name}
              </FilterChip>
            ))}
          </div>
          <TransactionList game={game} txs={txs} perspective={filter === 'all' ? undefined : filter} />
        </>
      ) : (
        <>
          <SectionTitle>Déroulement de la partie</SectionTitle>
          <ul className="rounded-2xl bg-surface-2 border border-line/60 divide-y divide-line/50">
            {game.events.slice().reverse().map((e) => (
              <li key={e.id} className="px-4 py-2.5 text-sm flex gap-3">
                <span className="text-muted tabular shrink-0">{new Date(e.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx('h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap flex items-center gap-2 border shrink-0', active ? 'bg-fg text-ink border-fg' : 'bg-surface border-line text-muted')}>
      {children}
    </button>
  );
}
