import { Hotel, House, Repeat } from 'lucide-react';
import { useState } from 'react';
import { GROUP_LABELS, GROUP_ORDER, groupMembers, PROPERTIES } from '../../domain/board';
import { useGame } from '../../store/gameStore';
import { PropertyRow } from '../components/PropertyRow';
import { Button, Card, cx, PlayerDot, SectionTitle } from '../components/ui';
import { useGameUi } from '../gameUi';

export function PropertiesTab() {
  const game = useGame();
  const { open } = useGameUi();
  const [filter, setFilter] = useState<string>('all');
  const visible = (sq: number) => {
    const owner = game.properties[sq]?.ownerId ?? null;
    if (filter === 'all') return true;
    if (filter === 'free') return owner === null;
    return owner === filter;
  };
  const groups: { title: string; squares: number[] }[] = [
    ...GROUP_ORDER.map((g) => ({ title: GROUP_LABELS[g], squares: groupMembers(g).map((s) => s.index) })),
    { title: 'Gares', squares: PROPERTIES.filter((p) => p.kind === 'railroad').map((p) => p.index) },
    { title: 'Compagnies', squares: PROPERTIES.filter((p) => p.kind === 'utility').map((p) => p.index) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Card className="px-4 py-2.5 flex items-center gap-4 text-sm">
          <span className="text-muted">Banque :</span>
          <span className="flex items-center gap-1.5 font-bold tabular"><House size={15} className="text-gain" /> {game.bankHouses}</span>
          <span className="flex items-center gap-1.5 font-bold tabular"><Hotel size={15} className="text-loss" /> {game.bankHotels}</span>
        </Card>
        <Button className="ml-auto" onClick={() => open({ type: 'trade' })} disabled={game.status !== 'playing'}>
          <Repeat size={18} /> Vente / échange
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4" role="tablist" aria-label="Filtre">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Toutes</Chip>
        <Chip active={filter === 'free'} onClick={() => setFilter('free')}>Libres</Chip>
        {game.players.map((p) => (
          <Chip key={p.id} active={filter === p.id} onClick={() => setFilter(p.id)}>
            <PlayerDot color={p.color} size={9} /> {p.name}
          </Chip>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => {
          const squares = g.squares.filter(visible);
          if (!squares.length) return null;
          return (
            <div key={g.title}>
              <SectionTitle>{g.title}</SectionTitle>
              <div className="space-y-2">
                {squares.map((sq) => <PropertyRow key={sq} game={game} square={sq} onClick={() => open({ type: 'property', square: sq })} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cx('h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap flex items-center gap-2 border shrink-0', active ? 'bg-fg text-ink border-fg' : 'bg-surface border-line text-muted')}>
      {children}
    </button>
  );
}
