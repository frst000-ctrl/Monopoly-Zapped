import { ArrowLeftRight, Lock, MapPin, PenLine, Repeat, Skull } from 'lucide-react';
import { useState } from 'react';
import { BOARD, getSquare } from '../../domain/board';
import { formatMoney } from '../../domain/money';
import { liquidationValue, netWorth, ownedBy } from '../../domain/rules';
import { useGame } from '../../store/gameStore';
import { PropertyRow } from '../components/PropertyRow';
import { Button, Field, Money, Notice, PlayerDot, SectionTitle, Select, Sheet } from '../components/ui';
import { useGameUi } from '../gameUi';
import { useAction } from '../useAction';
import { TransactionList } from '../screens/HistoryTab';

export function PlayerSheet({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const game = useGame();
  const { open, setOutcome } = useGameUi();
  const run = useAction();
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState(0);
  const p = game.players.find((x) => x.id === playerId);
  if (!p) return null;
  const cur = game.settings.currency;
  const props = ownedBy(game, p.id);
  const txs = game.transactions.filter((t) => t.from === p.id || t.to === p.id).slice(-15).reverse();
  const playing = game.status === 'playing' && !p.bankrupt;

  return (
    <Sheet title={p.name} onClose={onClose} wide>
      <div className="flex items-center gap-3 mb-4">
        <PlayerDot color={p.color} size={18} />
        <Money amount={p.balance} currency={cur} className="text-4xl font-black" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-5 text-center">
        <Stat label="Patrimoine" value={formatMoney(netWorth(game, p.id), cur)} />
        <Stat label="Mobilisable" value={formatMoney(p.balance + liquidationValue(game, p.id), cur)} />
        <Stat label="Position" value={p.inJail ? 'Prison' : getSquare(p.position).name} />
      </div>
      {p.bankrupt && <div className="mb-4"><Notice tone="error">{p.name} est en faillite.</Notice></div>}
      {p.jailCards.length > 0 && <div className="mb-4"><Notice>Cartes « Sortie de prison » : {p.jailCards.length}</Notice></div>}

      {playing && (
        <div className="grid grid-cols-2 gap-2 mb-5">
          <Button onClick={() => open({ type: 'custom', playerId: p.id })}><PenLine size={17} /> Opération</Button>
          <Button onClick={() => open({ type: 'transfer', from: p.id })}><ArrowLeftRight size={17} /> Transfert</Button>
          <Button onClick={() => open({ type: 'trade', a: p.id })}><Repeat size={17} /> Échanger</Button>
          <Button onClick={() => setMoving((m) => !m)} aria-expanded={moving}><MapPin size={17} /> Déplacer</Button>
          {!p.inJail && (
            <Button
              onClick={() =>
                run({ type: 'sendToJail', playerId: p.id }, `${p.name} va en prison`, { confirm: { title: 'Envoyer en prison ?', message: `${p.name} sera placé en prison, sans salaire.`, confirmLabel: 'Envoyer' } })
              }
            >
              <Lock size={17} /> Prison
            </Button>
          )}
          <Button variant="danger" onClick={() => open({ type: 'bankruptcy', playerId: p.id })}><Skull size={17} /> Faillite</Button>
        </div>
      )}
      {moving && playing && (
        <div className="rounded-2xl bg-surface-2 p-4 mb-5 fade-in">
          <Field label="Placer le pion sur la case">
            <Select ariaLabel="Case" value={target} onChange={setTarget} options={BOARD.map((s) => ({ value: s.index, label: `${s.index}. ${s.name}` }))} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={async () => {
                const r = await run({ type: 'movePlayer', playerId: p.id, to: target, collectGo: false }, `${p.name} placé sur ${getSquare(target).name}`);
                if (r?.ok) { setMoving(false); setOutcome(r.outcome); }
              }}
            >
              Placer
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const r = await run({ type: 'movePlayer', playerId: p.id, to: target, collectGo: true }, `${p.name} avance jusqu’à ${getSquare(target).name}`);
                if (r?.ok) { setMoving(false); setOutcome(r.outcome); }
              }}
            >
              Avancer (salaire)
            </Button>
          </div>
          <p className="text-xs text-muted mt-2">« Avancer » verse le salaire si le pion passe par le Départ.</p>
        </div>
      )}

      <SectionTitle>Propriétés ({props.length})</SectionTitle>
      <div className="space-y-2 mb-5">
        {props.length === 0 && <p className="text-sm text-muted">Aucune propriété.</p>}
        {props.map((sq) => <PropertyRow key={sq} game={game} square={sq} showOwner={false} onClick={() => open({ type: 'property', square: sq })} />)}
      </div>

      <SectionTitle>Dernières opérations</SectionTitle>
      <TransactionList game={game} txs={txs} perspective={p.id} />
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted font-bold">{label}</div>
      <div className="text-sm font-bold mt-1 truncate tabular">{value}</div>
    </div>
  );
}
