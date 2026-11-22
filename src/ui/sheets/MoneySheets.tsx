import { useMemo, useState } from 'react';
import { BOARD, getProperty } from '../../domain/board';
import { amountToInput, formatMoney } from '../../domain/money';
import { computeRent } from '../../domain/rules';
import { rollDie, useGame } from '../../store/gameStore';
import { AmountInput, Button, cx, Field, inputClass, Notice, parseAmount, PlayerPicker, Select, Sheet } from '../components/ui';
import type { SheetRequest } from '../gameUi';
import { useAction, useFormId } from '../useAction';

type Init<T extends SheetRequest['type']> = Extract<SheetRequest, { type: T }>;

/** Crédit / débit libre, avec libellé et nature de l'opération. */
export function CustomSheet({ init, onClose }: { init: Init<'custom'>; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const formId = useFormId();
  const [playerId, setPlayerId] = useState<string | null>(init.playerId ?? game.players.find((p) => !p.bankrupt)?.id ?? null);
  const [direction, setDirection] = useState<'in' | 'out'>(init.direction ?? 'in');
  const [kind, setKind] = useState<'credit' | 'reward' | 'debit' | 'tax'>(init.direction === 'in' ? 'reward' : 'credit');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const value = parseAmount(amount);
  const player = game.players.find((p) => p.id === playerId);
  const cur = game.settings.currency;
  const effectiveKind = direction === 'in' ? (kind === 'reward' ? 'reward' : 'credit') : kind === 'tax' ? 'tax' : 'debit';
  const insufficient = direction === 'out' && player && value !== null && player.balance < value;

  const submit = async () => {
    if (!player || !value) return;
    const defaultLabel = { credit: 'Encaissement banque', reward: 'Récompense', debit: 'Paiement à la banque', tax: 'Taxe' }[effectiveKind];
    const text = label.trim() || defaultLabel;
    const r =
      direction === 'in'
        ? await run({ type: 'credit', playerId: player.id, amount: value, label: text, kind: effectiveKind as 'credit' | 'reward' }, `${text} : +${formatMoney(value, cur)} pour ${player.name}`, { amount: value, actionId: formId })
        : await run({ type: 'debit', playerId: player.id, amount: value, label: text, kind: effectiveKind as 'debit' | 'tax' }, `${text} : −${formatMoney(value, cur)} pour ${player.name}`, { amount: value, actionId: formId });
    if (r?.ok) onClose();
  };

  return (
    <Sheet
      title="Opération personnalisée"
      onClose={onClose}
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={!player || !value || !!insufficient} onClick={submit}>
          Valider {value ? `${direction === 'in' ? '+' : '−'}${formatMoney(value, cur)}` : ''}
        </Button>
      }
    >
      <Field label="Joueur">
        <PlayerPicker players={game.players} value={playerId} onChange={setPlayerId} />
      </Field>
      <div className="grid grid-cols-2 gap-2 mb-4" role="radiogroup" aria-label="Sens">
        {(['in', 'out'] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={direction === d}
            onClick={() => {
              setDirection(d);
              setKind(d === 'in' ? 'credit' : 'debit');
            }}
            className={cx('h-12 rounded-2xl font-bold border', direction === d ? (d === 'in' ? 'bg-gain/20 border-gain text-gain' : 'bg-loss/20 border-loss text-loss') : 'bg-surface-2 border-line text-muted')}
          >
            {d === 'in' ? 'Recevoir de la banque' : 'Payer la banque'}
          </button>
        ))}
      </div>
      <Field label="Nature">
        <Select
          ariaLabel="Nature de l’opération"
          value={kind}
          onChange={setKind}
          options={direction === 'in' ? [{ value: 'credit', label: 'Encaissement de la banque' }, { value: 'reward', label: 'Récompense' }] : [{ value: 'debit', label: 'Paiement à la banque' }, { value: 'tax', label: 'Taxe / amende' }]}
        />
      </Field>
      <Field label="Montant">
        <AmountInput value={amount} onChange={setAmount} currency={cur} autoFocus presets={[10, 25, 50, 100, 150, 200]} />
      </Field>
      <Field label="Libellé (facultatif)">
        <input className={inputClass} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. : mini-jeu, pari…" />
      </Field>
      {insufficient && player && <Notice tone="error">{player.name} n’a que {formatMoney(player.balance, cur)}.</Notice>}
    </Sheet>
  );
}

export function TransferSheet({ init, onClose }: { init: Init<'transfer'>; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const formId = useFormId();
  const alive = game.players.filter((p) => !p.bankrupt);
  const [from, setFrom] = useState<string | null>(init.from ?? alive[0]?.id ?? null);
  const [to, setTo] = useState<string | null>(init.to ?? alive.find((p) => p.id !== (init.from ?? alive[0]?.id))?.id ?? null);
  const [amount, setAmount] = useState(init.amount ? amountToInput(init.amount, game.settings.currency) : '');
  const [label, setLabel] = useState('');
  const value = parseAmount(amount);
  const pf = game.players.find((p) => p.id === from);
  const pt = game.players.find((p) => p.id === to);
  const cur = game.settings.currency;
  const invalid = !pf || !pt || pf.id === pt.id || !value || pf.balance < value;

  const submit = async () => {
    if (invalid || !pf || !pt || !value) return;
    const r = await run({ type: 'transfer', from: pf.id, to: pt.id, amount: value, label: label.trim() || undefined }, `Transfert ${pf.name} → ${pt.name} : ${formatMoney(value, cur)}`, { amount: value, actionId: formId });
    if (r?.ok) onClose();
  };

  return (
    <Sheet title="Transfert entre joueurs" onClose={onClose} footer={<Button variant="primary" size="lg" className="w-full" disabled={invalid} onClick={submit}>Transférer {value ? formatMoney(value, cur) : ''}</Button>}>
      <Field label="Payeur">
        <PlayerPicker players={game.players} value={from} onChange={(id) => { setFrom(id); if (id === to) setTo(null); }} />
      </Field>
      <Field label="Bénéficiaire">
        <PlayerPicker players={game.players} value={to} onChange={setTo} exclude={from ? [from] : []} />
      </Field>
      <Field label="Montant">
        <AmountInput value={amount} onChange={setAmount} currency={cur} autoFocus presets={[50, 100, 200, 500]} />
      </Field>
      <Field label="Motif (facultatif)">
        <input className={inputClass} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. : vente, accord…" />
      </Field>
      {pf && value !== null && pf.balance < value && <Notice tone="error">{pf.name} n’a que {formatMoney(pf.balance, cur)}.</Notice>}
    </Sheet>
  );
}

export function RentSheet({ init, onClose }: { init: Init<'rent'>; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const formId = useFormId();
  const [payerId, setPayerId] = useState<string | null>(init.payerId ?? null);
  const owned = useMemo(
    () => BOARD.filter((s) => (s.kind === 'street' || s.kind === 'railroad' || s.kind === 'utility') && game.properties[s.index]?.ownerId && game.properties[s.index]?.ownerId !== payerId),
    [game.properties, payerId],
  );
  const [square, setSquare] = useState<number | null>(init.square ?? null);
  const [dice, setDice] = useState('');
  const [double, setDouble] = useState(!!init.railroadDouble);
  const utilityTen = !!init.utilityTen;
  const cur = game.settings.currency;
  const def = square !== null ? getProperty(square) : null;
  const ps = square !== null ? game.properties[square] : undefined;
  const owner = game.players.find((p) => p.id === ps?.ownerId);
  const payer = game.players.find((p) => p.id === payerId);
  const diceTotal = Number(dice);
  const diceOk = def?.kind !== 'utility' || (Number.isInteger(diceTotal) && diceTotal >= 2 && diceTotal <= 12);
  const rent = def && diceOk ? computeRent(game, def.index, { diceTotal: def.kind === 'utility' ? diceTotal : undefined, railroadDouble: def.kind === 'railroad' && double, utilityTen: def.kind === 'utility' && utilityTen }) : 0;
  const invalid = !payer || !def || !owner || owner.id === payer.id || ps?.mortgaged || !diceOk || rent <= 0 || payer.balance < rent;

  const submit = async () => {
    if (invalid || !def || !payer || !owner) return;
    const r = await run(
      { type: 'payRent', payerId: payer.id, square: def.index, diceTotal: def.kind === 'utility' ? diceTotal : undefined, railroadDouble: def.kind === 'railroad' && double, utilityTen: def.kind === 'utility' && utilityTen },
      `Loyer ${def.name} : ${payer.name} → ${owner.name}`,
      { amount: rent, actionId: formId },
    );
    if (r?.ok) onClose();
  };

  return (
    <Sheet title="Payer un loyer" onClose={onClose} footer={<Button variant="primary" size="lg" className="w-full" disabled={invalid} onClick={submit}>Payer {rent ? formatMoney(rent, cur) : ''}{owner ? ` à ${owner.name}` : ''}</Button>}>
      <Field label="Qui paie ?">
        <PlayerPicker players={game.players} value={payerId} onChange={(id) => { setPayerId(id); setSquare(null); }} />
      </Field>
      <Field label="Propriété">
        {owned.length === 0 ? (
          <Notice>Aucune propriété appartenant à un autre joueur.</Notice>
        ) : (
          <Select
            ariaLabel="Propriété"
            value={square ?? -1}
            onChange={(v) => setSquare(v === -1 ? null : v)}
            options={[{ value: -1, label: 'Choisir…' }, ...owned.map((s) => ({ value: s.index, label: `${s.name} — ${game.players.find((p) => p.id === game.properties[s.index]?.ownerId)?.name ?? ''}${game.properties[s.index]?.mortgaged ? ' (hypothéquée)' : ''}` }))]}
          />
        )}
      </Field>
      {def?.kind === 'utility' && (
        <Field label="Total des dés" hint={utilityTen ? 'Carte « compagnie la plus proche » : loyer = 10 × dés.' : 'Loyer = 4 × dés (une compagnie) ou 10 × dés (les deux).'}>
          <div className="flex gap-2">
            <input className={inputClass} inputMode="numeric" value={dice} onChange={(e) => setDice(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="2 à 12" />
            <Button onClick={() => setDice(String(rollDie() + rollDie()))}>Lancer</Button>
          </div>
        </Field>
      )}
      {def?.kind === 'railroad' && (
        <label className="flex items-center gap-3 mb-4 text-[15px]">
          <input type="checkbox" checked={double} onChange={(e) => setDouble(e.target.checked)} className="h-5 w-5 accent-[#e0262f]" />
          Loyer doublé (carte « gare la plus proche »)
        </label>
      )}
      {ps?.mortgaged && <Notice tone="warn">Propriété hypothéquée : aucun loyer n’est dû.</Notice>}
      {def && !ps?.mortgaged && diceOk && (
        <div className="rounded-2xl bg-surface-2 p-4 flex items-center justify-between">
          <span className="text-muted">Loyer calculé</span>
          <span className="text-2xl font-black tabular">{formatMoney(rent, cur)}</span>
        </div>
      )}
      {payer && rent > 0 && payer.balance < rent && <div className="mt-3"><Notice tone="error">{payer.name} n’a que {formatMoney(payer.balance, cur)} : hypothéquez, vendez ou déclarez faillite.</Notice></div>}
    </Sheet>
  );
}

export function TaxSheet({ init, onClose }: { init: Init<'tax'>; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const formId = useFormId();
  const [playerId, setPlayerId] = useState<string | null>(init.playerId ?? null);
  const taxes = BOARD.filter((s): s is Extract<typeof s, { kind: 'tax' }> => s.kind === 'tax');
  const [square, setSquare] = useState<number>(taxes[0]?.index ?? 4);
  const tax = taxes.find((t) => t.index === square);
  const player = game.players.find((p) => p.id === playerId);
  const cur = game.settings.currency;
  const invalid = !player || !tax || player.balance < tax.amount;
  const submit = async () => {
    if (invalid || !player || !tax) return;
    const r = await run({ type: 'payTax', playerId: player.id, square }, `${player.name} paie ${tax.name}`, { amount: tax.amount, actionId: formId });
    if (r?.ok) onClose();
  };
  return (
    <Sheet title="Payer une taxe" onClose={onClose} footer={<Button variant="primary" size="lg" className="w-full" disabled={invalid} onClick={submit}>Payer {tax ? formatMoney(tax.amount, cur) : ''}</Button>}>
      <Field label="Joueur">
        <PlayerPicker players={game.players} value={playerId} onChange={setPlayerId} />
      </Field>
      <div className="grid gap-2 mb-4">
        {taxes.map((t) => (
          <button key={t.index} type="button" onClick={() => setSquare(t.index)} className={cx('h-14 rounded-2xl border px-4 flex items-center justify-between font-semibold', square === t.index ? 'border-fg bg-surface-3' : 'border-line bg-surface-2')}>
            {t.name} <span className="tabular">{formatMoney(t.amount, cur)}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">Pour une autre taxe ou amende, utilisez « Paiement personnalisé ».{game.settings.freeParkingJackpot ? ' Le montant alimente la cagnotte du Parc gratuit.' : ''}</p>
      {player && tax && player.balance < tax.amount && <div className="mt-3"><Notice tone="error">{player.name} n’a que {formatMoney(player.balance, cur)}.</Notice></div>}
    </Sheet>
  );
}
