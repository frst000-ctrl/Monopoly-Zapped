import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CreditCard, Fingerprint, Gavel, Home, Landmark, Receipt, ShoppingCart, Ticket } from 'lucide-react';
import { useState } from 'react';
import { getProperty, getSquare } from '../../domain/board';
import type { Outcome, Suggestion } from '../../domain/game';
import { formatMoney } from '../../domain/money';
import { matchSignature } from '../../zapped/touchSignature';
import { useGame } from '../../store/gameStore';
import { useCardCapture } from '../cardReader';
import { AmountInput, Button, cx, Money, Notice, parseAmount, PlayerDot, Sheet } from '../components/ui';
import { useFeedback } from '../feedback';
import { useGameUi } from '../gameUi';
import { useAction, useFormId } from '../useAction';
import { cardCandidates } from '../screens/ZappedTab';

/** Suggestion de la case où se trouve ce joueur, si elle le concerne. */
function suggestionFor(outcome: Outcome | null, playerId: string): Suggestion | null {
  if (!outcome) return null;
  if (outcome.kind === 'moved' && outcome.playerId === playerId) return outcome.suggestion;
  if (outcome.kind === 'card' && outcome.then?.kind === 'moved' && outcome.then.playerId === playerId) return outcome.then.suggestion;
  return null;
}

/**
 * Fenêtre ouverte en posant une carte sur l'écran, depuis n'importe quel onglet.
 * Le paiement dû (loyer, taxe, achat) est proposé en premier, en un seul geste.
 */
export function CardPaySheet({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const { toast } = useFeedback();
  const { outcome, setOutcome } = useGameUi();
  const formId = useFormId();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'main' | 'payee'>('main');
  const p = game.players.find((x) => x.id === playerId);
  const cur = game.settings.currency;
  const value = parseAmount(amount);
  const playing = game.status === 'playing';

  const payTo = async (payeeId: string) => {
    if (!p || !value) return;
    if (payeeId === p.id) return toast('Présentez la carte de l’autre joueur.', 'warn');
    const payee = game.players.find((x) => x.id === payeeId && !x.bankrupt);
    if (!payee) return;
    const r = await run({ type: 'transfer', from: p.id, to: payee.id, amount: value, label: 'Paiement par carte' }, `${p.name} → ${payee.name} : ${formatMoney(value, cur)}`, { amount: value, actionId: formId });
    if (r?.ok) onClose();
  };

  // Étape « bénéficiaire » : la prochaine carte posée désigne qui reçoit.
  useCardCapture((sig) => {
    if (!sig) return toast('Lecture invalide : reposez la carte.', 'error');
    const id = matchSignature(sig, cardCandidates(game));
    if (!id) return toast('Carte non reconnue : touchez le nom du joueur.', 'error');
    void payTo(id);
  }, step === 'payee');

  if (!p) return null;
  if (p.bankrupt) {
    return (
      <Sheet title={`Carte de ${p.name}`} onClose={onClose}>
        <Notice tone="error">{p.name} est en faillite.</Notice>
      </Sheet>
    );
  }

  const s = suggestionFor(outcome, p.id);
  const isCurrent = game.players[game.turn.currentIndex]?.id === p.id;
  const done = async (r: { ok: boolean } | null) => {
    if (r?.ok) {
      setOutcome(null);
      onClose();
    }
  };

  // --- Paiement dû, en un geste ---
  let due: React.ReactNode = null;
  if (playing && s?.type === 'rent' && !s.needsDice && s.amount > 0) {
    const owner = game.players.find((x) => x.id === s.ownerId);
    const def = getProperty(s.square);
    due = (
      <DueButton icon={Home} disabled={p.balance < s.amount} onClick={async () => done(await run({ type: 'payRent', payerId: p.id, square: s.square, railroadDouble: s.railroadDouble }, `Loyer ${def.name} : ${p.name} → ${owner?.name}`, { amount: s.amount, actionId: formId }))}>
        Payer le loyer : {formatMoney(s.amount, cur)} à {owner?.name}
        <span className="block text-xs font-medium opacity-80">{def.name}</span>
      </DueButton>
    );
  } else if (playing && s?.type === 'tax') {
    due = (
      <DueButton icon={Receipt} disabled={p.balance < s.amount} onClick={async () => done(await run({ type: 'payTax', playerId: p.id, square: s.square }, `${p.name} paie ${getSquare(s.square).name}`, { amount: s.amount, actionId: formId }))}>
        Payer {getSquare(s.square).name} : {formatMoney(s.amount, cur)}
      </DueButton>
    );
  } else if (playing && s?.type === 'buy') {
    const def = getProperty(s.square);
    due = (
      <DueButton
        icon={ShoppingCart}
        tone="success"
        disabled={p.balance < s.price}
        onClick={async () => done(await run({ type: 'buyProperty', playerId: p.id, square: s.square }, `${p.name} achète ${def.name}`, { confirm: { title: 'Confirmer l’achat', message: <>{p.name} achète <b>{def.name}</b> pour {formatMoney(s.price, cur)}.</>, confirmLabel: 'Acheter' }, actionId: formId }))}
      >
        Acheter {def.name} : {formatMoney(s.price, cur)}
      </DueButton>
    );
  } else if (playing && game.pendingCard?.playerId === p.id) {
    due = (
      <DueButton icon={Ticket} onClick={async () => {
        const r = await run({ type: 'applyPendingCard' }, 'Carte appliquée', { actionId: formId });
        if (r?.ok) { setOutcome(r.outcome.kind === 'card' && r.outcome.then ? r.outcome.then : null); onClose(); }
      }}>
        Régler la carte en attente
      </DueButton>
    );
  } else if (playing && p.inJail && isCurrent) {
    due = (
      <DueButton icon={Gavel} disabled={p.balance < game.settings.jailFine} onClick={async () => {
        const r = await run({ type: 'payJailFine', playerId: p.id }, `${p.name} paie l’amende de prison`, { amount: game.settings.jailFine, actionId: formId });
        if (r?.ok) { setOutcome(r.outcome.kind === 'none' ? null : r.outcome); onClose(); }
      }}>
        Payer l’amende de prison : {formatMoney(game.settings.jailFine, cur)}
      </DueButton>
    );
  }

  return (
    <Sheet title={`Carte de ${p.name}`} onClose={onClose}>
      <div className="rounded-3xl p-5 mb-4 relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${p.color}, #141821 85%)` }}>
        <CreditCard className="absolute right-4 top-4 opacity-40" size={28} />
        <div className="flex items-center gap-2 text-sm font-semibold opacity-90"><PlayerDot color={p.color} /> {p.name}</div>
        <Money amount={p.balance} currency={cur} className="text-4xl font-black block mt-2" />
      </div>

      {!playing && <Notice>La partie est terminée.</Notice>}

      {playing && step === 'main' && (
        <>
          {due && <div className="mb-4">{due}</div>}
          <AmountInput value={amount} onChange={setAmount} currency={cur} presets={[...new Set([...game.settings.quickAmounts, 50, 150])].sort((a, b) => a - b)} />
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button size="lg" variant="danger" disabled={!value || p.balance < value} onClick={async () => done(value ? await run({ type: 'debit', playerId: p.id, amount: value, label: 'Paiement par carte' }, `${p.name} paie ${formatMoney(value, cur)} à la banque`, { amount: value, actionId: formId }) : null)}>
              <ArrowUpRight size={18} /> Payer la banque
            </Button>
            <Button size="lg" variant="success" disabled={!value} onClick={async () => done(value ? await run({ type: 'credit', playerId: p.id, amount: value, label: 'Encaissement par carte' }, `${p.name} reçoit ${formatMoney(value, cur)}`, { amount: value, actionId: formId }) : null)}>
              <ArrowDownLeft size={18} /> Recevoir
            </Button>
            <Button size="lg" variant="primary" className="col-span-2" disabled={!value || p.balance < value} onClick={() => setStep('payee')}>
              <ArrowLeftRight size={18} /> Payer un joueur
            </Button>
            <Button size="lg" className="col-span-2" disabled={game.settings.goSalary <= 0} onClick={async () => done(await run({ type: 'collectGo', playerId: p.id }, `${p.name} touche le salaire du Départ`, { amount: game.settings.goSalary, actionId: formId }))}>
              <Landmark size={18} /> Passage par le Départ +{formatMoney(game.settings.goSalary, cur)}
            </Button>
          </div>
          {value !== null && p.balance < value && <p className="text-xs text-loss mt-2">Solde insuffisant ({formatMoney(p.balance, cur)}).</p>}
        </>
      )}

      {playing && step === 'payee' && value && (
        <div className="fade-in">
          <div className="rounded-3xl border-2 border-dashed border-gain/60 bg-gain/10 p-6 text-center mb-4">
            <Fingerprint size={36} className="mx-auto text-gain mb-2" />
            <div className="font-bold text-lg">Posez la carte du bénéficiaire</div>
            <div className="text-sm text-muted mt-1">{formatMoney(value, cur)} payés par {p.name}</div>
          </div>
          <div className="text-xs text-muted mb-2">Ou touchez son nom :</div>
          <div className="grid grid-cols-2 gap-2">
            {game.players.filter((x) => !x.bankrupt && x.id !== p.id).map((x) => (
              <button key={x.id} type="button" onClick={() => payTo(x.id)} className="h-12 rounded-2xl bg-surface-2 border border-line px-3 flex items-center gap-2 font-semibold text-sm">
                <PlayerDot color={x.color} /> {x.name}
              </button>
            ))}
          </div>
          <Button variant="ghost" className="w-full mt-3" onClick={() => setStep('main')}>Retour</Button>
        </div>
      )}
    </Sheet>
  );
}

function DueButton({ icon: Icon, children, onClick, disabled, tone = 'primary' }: { icon: typeof Home; children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'primary' | 'success' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'w-full min-h-16 rounded-3xl px-5 py-3 flex items-center gap-3 text-left font-bold text-[17px] transition active:scale-[0.98] disabled:opacity-40',
        tone === 'success' ? 'bg-gain text-white' : 'bg-accent text-white shadow-lg shadow-accent/25',
      )}
    >
      <Icon size={24} className="shrink-0" />
      <span>{children}</span>
    </button>
  );
}

/** Carte posée mais inconnue : on propose de l'associer tout de suite. */
export function UnknownCardSheet({ signature, onClose }: { signature: number[] | null; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const { open, close, tab, select } = useGameUi();
  const alive = game.players.filter((p) => !p.bankrupt);
  return (
    <Sheet title="Carte non reconnue" onClose={onClose}>
      {!signature ? (
        <Notice tone="error">Lecture invalide : reposez la carte bien à plat en la tenant.</Notice>
      ) : (
        <>
          <p className="text-sm text-muted mb-4">À quel joueur appartient cette carte ? Elle sera reconnue ensuite sur tous les écrans.</p>
          <div className="grid grid-cols-2 gap-2">
            {alive.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={async () => {
                  const r = await run({ type: 'setCardSignature', playerId: p.id, signature }, `Carte associée à ${p.name}`);
                  if (!r?.ok) return;
                  // Écran principal : la carte sélectionne le joueur ; ailleurs : paiement direct.
                  if (tab === 'home') { select(p.id); close(); }
                  else open({ type: 'cardPay', playerId: p.id });
                }}
                className="h-14 rounded-2xl bg-surface-2 border border-line px-3 flex items-center gap-2 font-semibold"
              >
                <PlayerDot color={p.color} /> {p.name}
                {p.cardSignature && <span className="text-[11px] text-muted ml-auto">remplacer</span>}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-4">Pour une reconnaissance plus fiable, utilisez l’association en 3 lectures dans l’onglet Zapped.</p>
        </>
      )}
    </Sheet>
  );
}
