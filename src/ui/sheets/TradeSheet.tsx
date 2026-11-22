import { useState } from 'react';
import { getProperty } from '../../domain/board';
import { formatMoney, mortgageInterest } from '../../domain/money';
import { canTransfer, ownedBy } from '../../domain/rules';
import { useGame } from '../../store/gameStore';
import { propertyColor } from '../components/PropertyRow';
import { AmountInput, Button, cx, Field, Notice, parseAmount, PlayerPicker, SectionTitle, Sheet } from '../components/ui';
import type { SheetRequest } from '../gameUi';
import { useAction, useFormId } from '../useAction';

export function TradeSheet({ init, onClose }: { init: Extract<SheetRequest, { type: 'trade' }>; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const formId = useFormId();
  const alive = game.players.filter((p) => !p.bankrupt);
  const [a, setA] = useState<string | null>(init.a ?? alive[0]?.id ?? null);
  const [b, setB] = useState<string | null>(init.b ?? alive.find((p) => p.id !== (init.a ?? alive[0]?.id))?.id ?? null);
  const [aGives, setAGives] = useState<number[]>(init.aGives ?? []);
  const [bGives, setBGives] = useState<number[]>([]);
  const [aCash, setACash] = useState('');
  const [bCash, setBCash] = useState('');
  const cur = game.settings.currency;
  const pa = game.players.find((p) => p.id === a);
  const pb = game.players.find((p) => p.id === b);
  const ac = aCash === '' ? 0 : (parseAmount(aCash) ?? Number.NaN);
  const bc = bCash === '' ? 0 : (parseAmount(bCash) ?? Number.NaN);
  const interest = (list: number[]) => list.filter((i) => game.properties[i]?.mortgaged).reduce((s, i) => s + mortgageInterest(getProperty(i).mortgage), 0);
  const empty = aGives.length + bGives.length === 0 && ac + bc === 0;
  const aShort = pa ? pa.balance < ac || pa.balance - ac + bc - interest(bGives) < 0 : true;
  const bShort = pb ? pb.balance < bc || pb.balance - bc + ac - interest(aGives) < 0 : true;
  const invalid = !pa || !pb || pa.id === pb.id || empty || aShort || bShort || Number.isNaN(ac) || Number.isNaN(bc);

  const toggle = (list: number[], set: (l: number[]) => void, sq: number) => set(list.includes(sq) ? list.filter((x) => x !== sq) : [...list, sq]);

  const submit = async () => {
    if (invalid || !pa || !pb) return;
    const names = (l: number[]) => (l.length ? l.map((i) => getProperty(i).name).join(', ') : 'rien');
    const summary = (
      <div className="space-y-2">
        <div><b>{pa.name}</b> donne : {names(aGives)}{ac ? ` + ${formatMoney(ac, cur)}` : ''}</div>
        <div><b>{pb.name}</b> donne : {names(bGives)}{bc ? ` + ${formatMoney(bc, cur)}` : ''}</div>
        {(interest(aGives) > 0 || interest(bGives) > 0) && <div className="text-sm text-muted">Intérêts de 10 % sur les propriétés hypothéquées reçues, payés à la banque.</div>}
      </div>
    );
    const r = await run({ type: 'trade', a: pa.id, b: pb.id, aGives, bGives, aCash: ac, bCash: bc }, `Échange ${pa.name} ⇄ ${pb.name}`, {
      confirm: { title: 'Confirmer l’échange', message: summary, confirmLabel: 'Valider l’échange' },
      actionId: formId,
    });
    if (r?.ok) onClose();
  };

  const Side = ({ playerId, list, set }: { playerId: string | null; list: number[]; set: (l: number[]) => void }) => {
    if (!playerId) return null;
    const props = ownedBy(game, playerId);
    if (!props.length) return <p className="text-sm text-muted mb-3">Aucune propriété.</p>;
    return (
      <div className="flex flex-wrap gap-2 mb-3">
        {props.map((sq) => {
          const ok = canTransfer(game, sq).ok;
          const on = list.includes(sq);
          return (
            <button
              key={sq}
              type="button"
              disabled={!ok}
              aria-pressed={on}
              onClick={() => toggle(list, set, sq)}
              title={ok ? undefined : 'Bâtiments dans le groupe : vendez-les d’abord'}
              className={cx('h-9 pl-2 pr-3 rounded-full text-sm font-semibold border flex items-center gap-2 disabled:opacity-30', on ? 'bg-fg text-ink border-fg' : 'bg-surface-2 border-line')}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: propertyColor(sq) }} />
              {getProperty(sq).name}
              {game.properties[sq]?.mortgaged ? ' (H)' : ''}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Sheet title="Vente / échange" onClose={onClose} wide footer={<Button variant="primary" size="lg" className="w-full" disabled={invalid} onClick={submit}>Valider l’échange</Button>}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <SectionTitle>Joueur A</SectionTitle>
          <PlayerPicker players={game.players} value={a} onChange={(id) => { setA(id); setAGives([]); if (id === b) setB(null); }} />
          <div className="mt-3 text-sm text-muted mb-2">Donne ces propriétés :</div>
          <Side playerId={a} list={aGives} set={setAGives} />
          <Field label="… et cette somme">
            <AmountInput value={aCash} onChange={setACash} currency={cur} />
          </Field>
        </div>
        <div>
          <SectionTitle>Joueur B</SectionTitle>
          <PlayerPicker players={game.players} value={b} onChange={(id) => { setB(id); setBGives([]); }} exclude={a ? [a] : []} />
          <div className="mt-3 text-sm text-muted mb-2">Donne ces propriétés :</div>
          <Side playerId={b} list={bGives} set={setBGives} />
          <Field label="… et cette somme">
            <AmountInput value={bCash} onChange={setBCash} currency={cur} />
          </Field>
        </div>
      </div>
      <p className="text-xs text-muted">Pour une vente simple : A donne la propriété, B donne la somme. Les propriétés dont le groupe a des bâtiments ne peuvent pas être échangées.</p>
      {!empty && aShort && pa && <div className="mt-3"><Notice tone="error">{pa.name} n’a pas assez d’argent.</Notice></div>}
      {!empty && bShort && pb && <div className="mt-3"><Notice tone="error">{pb.name} n’a pas assez d’argent.</Notice></div>}
    </Sheet>
  );
}
