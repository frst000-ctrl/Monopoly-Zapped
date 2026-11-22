import { HelpCircle, Pencil, Users } from 'lucide-react';
import { useState } from 'react';
import { DECK_LABELS, describeEffect } from '../../domain/cards';
import type { CardDef, CardEffect, DeckKind } from '../../domain/types';
import { useGame } from '../../store/gameStore';
import { AmountInput, Button, Card, cx, Field, inputClass, parseAmount, PlayerPicker, SectionTitle, Sheet } from '../components/ui';
import { amountToInput } from '../../domain/money';
import { useGameUi } from '../gameUi';
import { useAction } from '../useAction';
import { OutcomePanel } from './TurnTab';

const DECK_STYLE: Record<DeckKind, string> = {
  chance: 'from-[#f28c28] to-[#c95f0a]',
  community: 'from-[#2a7de1] to-[#1450a3]',
};

export function CardReveal({ card, currency, compact }: { card: CardDef; currency: string; compact?: boolean }) {
  return (
    <div className={cx('rounded-3xl bg-gradient-to-br p-[2px] pop-in', DECK_STYLE[card.deck])}>
      <div className={cx('rounded-[22px] bg-[#fbfaf6] text-[#1a1a1a]', compact ? 'p-4' : 'p-6')}>
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle size={18} className={card.deck === 'chance' ? 'text-[#e07a12]' : 'text-[#1f63c4]'} />
          <span className="text-xs font-black uppercase tracking-[0.16em]">{DECK_LABELS[card.deck]}</span>
        </div>
        <p className={cx('font-semibold leading-snug', compact ? 'text-base' : 'text-lg')}>{card.text}</p>
        <p className="text-sm text-[#555] mt-3 font-medium">{describeEffect(card.effect, currency)}</p>
      </div>
    </div>
  );
}

export function CardsTab() {
  const game = useGame();
  const run = useAction();
  const { outcome, setOutcome } = useGameUi();
  const current = game.players[game.turn.currentIndex];
  const [playerId, setPlayerId] = useState<string | null>(current?.id ?? null);
  const [editing, setEditing] = useState<CardDef | null>(null);
  const player = game.players.find((p) => p.id === playerId && !p.bankrupt);
  const playing = game.status === 'playing';

  const draw = async (deck: DeckKind) => {
    if (!player) return;
    const r = await run({ type: 'drawCard', deck, playerId: player.id }, `Carte ${DECK_LABELS[deck]} – ${player.name}`, { success: false });
    if (r?.ok) setOutcome(r.outcome);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {playing && (
        <>
          <SectionTitle>Piocher pour</SectionTitle>
          <PlayerPicker players={game.players} value={player?.id ?? null} onChange={setPlayerId} />
          <div className="grid grid-cols-2 gap-3 my-5">
            {(['chance', 'community'] as const).map((d) => (
              <button
                key={d}
                type="button"
                disabled={!player || !!game.pendingCard}
                onClick={() => draw(d)}
                className={cx('h-36 rounded-3xl bg-gradient-to-br text-white font-black text-xl shadow-xl active:scale-[0.98] transition disabled:opacity-40 flex flex-col items-center justify-center gap-2', DECK_STYLE[d])}
              >
                <HelpCircle size={36} />
                {DECK_LABELS[d]}
                <span className="text-xs font-semibold opacity-80">{game.decks[d].order.length - game.decks[d].next} carte(s) avant mélange</span>
              </button>
            ))}
          </div>
          {game.pendingCard && <p className="text-sm text-gold mb-4">Une carte est en attente (onglet Partie) : appliquez-la avant d’en piocher une autre.</p>}
          {outcome?.kind === 'card' && <div className="mb-6"><OutcomePanel outcome={outcome} game={game} /></div>}
        </>
      )}

      <SectionTitle>Cartes et montants</SectionTitle>
      <p className="text-sm text-muted mb-4">Textes originaux créés pour cette application. Touchez une carte pour modifier ses montants.</p>
      <div className="grid gap-6 md:grid-cols-2">
        {(['chance', 'community'] as const).map((d) => (
          <div key={d}>
            <div className="font-bold mb-2">{DECK_LABELS[d]}</div>
            <div className="space-y-2">
              {game.cards.filter((c) => c.deck === d).map((c) => {
                const holder = game.players.find((p) => p.jailCards.includes(c.id));
                return (
                  <Card key={c.id} onClick={editable(c.effect) && playing ? () => setEditing(c) : undefined} className="p-3.5">
                    <div className="text-sm leading-snug">{c.text}</div>
                    <div className="text-xs text-muted mt-1.5 flex items-center gap-2">
                      {describeEffect(c.effect, game.settings.currency)}
                      {editable(c.effect) && playing && <Pencil size={12} />}
                      {holder && <span className="inline-flex items-center gap-1 text-gold"><Users size={12} /> chez {holder.name}</span>}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {editing && <CardEditor card={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const editable = (e: CardEffect) => ['money', 'payEach', 'collectEach', 'repairs', 'moveBy'].includes(e.type);

function CardEditor({ card, onClose }: { card: CardDef; onClose: () => void }) {
  const run = useAction();
  const game = useGame();
  const e = card.effect;
  const [a, setA] = useState(() => {
    switch (e.type) {
      case 'money': return amountToInput(Math.abs(e.amount), game.settings.currency);
      case 'payEach':
      case 'collectEach': return amountToInput(e.amount, game.settings.currency);
      case 'repairs': return amountToInput(e.perHouse, game.settings.currency);
      case 'moveBy': return String(Math.abs(e.steps));
      default: return '';
    }
  });
  const [b, setB] = useState(e.type === 'repairs' ? amountToInput(e.perHotel, game.settings.currency) : '');
  const [sign, setSign] = useState(e.type === 'money' ? Math.sign(e.amount) : e.type === 'moveBy' ? Math.sign(e.steps) : 1);
  const na = e.type === 'moveBy' ? (/^\d+$/.test(a) ? Number(a) : Number.NaN) : (parseAmount(a) ?? Number.NaN);
  const nb = parseAmount(b) ?? Number.NaN;

  const build = (): CardEffect | null => {
    if (a === '' || !Number.isInteger(na) || na < 0) return null;
    switch (e.type) {
      case 'money': return na > 0 ? { type: 'money', amount: sign * na } : null;
      case 'payEach': return { type: 'payEach', amount: na };
      case 'collectEach': return { type: 'collectEach', amount: na };
      case 'repairs': return b !== '' && Number.isInteger(nb) && nb >= 0 ? { type: 'repairs', perHouse: na, perHotel: nb } : null;
      case 'moveBy': return na > 0 && na < 40 ? { type: 'moveBy', steps: sign * na } : null;
      default: return null;
    }
  };
  const next = build();
  const numeric = (v: string, set: (s: string) => void, label: string) => (
    <Field label={label}>
      <input className={inputClass} inputMode="numeric" value={v} onChange={(ev) => set(ev.target.value.replace(/\D/g, '').slice(0, 6))} />
    </Field>
  );

  return (
    <Sheet
      title="Modifier la carte"
      onClose={onClose}
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={!next} onClick={async () => {
          if (!next) return;
          const r = await run({ type: 'updateCard', cardId: card.id, effect: next }, 'Carte modifiée');
          if (r?.ok) onClose();
        }}>
          Enregistrer
        </Button>
      }
    >
      <p className="mb-4 text-[15px]">{card.text}</p>
      {(e.type === 'money' || e.type === 'moveBy') && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[1, -1].map((s) => (
            <button key={s} type="button" onClick={() => setSign(s)} className={cx('h-11 rounded-2xl font-semibold border', sign === s ? 'bg-fg text-ink border-fg' : 'bg-surface-2 border-line')}>
              {e.type === 'money' ? (s > 0 ? 'Gain' : 'Perte') : s > 0 ? 'Avancer' : 'Reculer'}
            </button>
          ))}
        </div>
      )}
      {e.type === 'moveBy' ? (
        numeric(a, setA, 'Nombre de cases')
      ) : (
        <Field label={e.type === 'repairs' ? 'Par maison' : 'Montant'}>
          <AmountInput value={a} onChange={setA} currency={game.settings.currency} />
        </Field>
      )}
      {e.type === 'repairs' && (
        <Field label="Par hôtel">
          <AmountInput value={b} onChange={setB} currency={game.settings.currency} />
        </Field>
      )}
      {next && <p className="text-sm text-muted">Nouvel effet : {describeEffect(next, game.settings.currency)}</p>}
    </Sheet>
  );
}
