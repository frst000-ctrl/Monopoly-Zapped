import { Hotel, House, Lock } from 'lucide-react';
import { getProperty, GROUP_COLORS } from '../../domain/board';
import { formatMoney } from '../../domain/money';
import type { GameState } from '../../domain/types';
import { PlayerDot } from './ui';

export function propertyColor(square: number): string {
  const def = getProperty(square);
  if (def.kind === 'street') return GROUP_COLORS[def.group];
  return def.kind === 'railroad' ? '#5b6272' : '#9aa3b5';
}

export function Buildings({ houses }: { houses: number }) {
  if (houses === 5) return <span className="inline-flex items-center gap-1 text-loss text-xs font-bold"><Hotel size={14} /> Hôtel</span>;
  if (houses === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-gain" aria-label={`${houses} maison(s)`}>
      {Array.from({ length: houses }, (_, i) => <House key={i} size={13} />)}
    </span>
  );
}

export function PropertyRow({ game, square, onClick, showOwner = true }: { game: GameState; square: number; onClick?: () => void; showOwner?: boolean }) {
  const def = getProperty(square);
  const ps = game.properties[square]!;
  const owner = game.players.find((p) => p.id === ps.ownerId);
  return (
    <button type="button" onClick={onClick} className="w-full flex items-stretch rounded-2xl bg-surface-2 border border-line/60 overflow-hidden text-left hover:border-line transition active:scale-[0.99]">
      <span className="w-2 shrink-0" style={{ background: propertyColor(square) }} />
      <span className="flex-1 min-w-0 px-3 py-2.5">
        <span className="flex items-center gap-2">
          <span className="font-semibold truncate">{def.name}</span>
          {ps.mortgaged && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gold"><Lock size={11} /> Hypothéquée</span>}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted mt-0.5">
          <span className="tabular">{formatMoney(def.price, game.settings.currency)}</span>
          <Buildings houses={ps.houses} />
        </span>
      </span>
      {showOwner && (
        <span className="px-3 flex items-center gap-1.5 text-sm text-muted shrink-0 max-w-[40%]">
          {owner ? <><PlayerDot color={owner.color} size={10} /><span className="truncate">{owner.name}</span></> : <span className="text-xs">Libre</span>}
        </span>
      )}
    </button>
  );
}
