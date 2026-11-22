import { ArrowBigLeftDash, Fingerprint, Gavel, Hotel, House, LockOpen, Minus, Plus, Ticket } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BOARD, getProperty, GROUP_COLORS, GROUP_ORDER, groupMembers } from '../../domain/board';
import { DECK_LABELS } from '../../domain/cards';
import type { Outcome } from '../../domain/game';
import { formatMoney } from '../../domain/money';
import { canBuildHouse, canSellHouse } from '../../domain/rules';
import type { DeckKind, GameState, PropertyDef } from '../../domain/types';
import { useGame } from '../../store/gameStore';
import { matchSignature } from '../../zapped/touchSignature';
import { useCardCapture } from '../cardReader';
import { AmountInput, Button, cx, Notice, parseAmount, PlayerDot, Sheet } from '../components/ui';
import { useFeedback } from '../feedback';
import { useGameUi } from '../gameUi';
import { CardReveal } from '../screens/CardsTab';
import { cardCandidates } from '../screens/ZappedTab';
import { useAction, useFormId } from '../useAction';

// Fenêtres ouvertes par les tuiles de l'écran principal. Chacune agit pour le
// joueur dont la carte a été posée (ou qui a été touché dans l'en-tête).

/** Propriétés dans l'ordre du plateau, regroupées par couleur puis gares et compagnies. */
function propertyGroups(): { key: string; label: string; color: string; items: PropertyDef[] }[] {
  const streets = GROUP_ORDER.map((g) => ({ key: g, label: '', color: GROUP_COLORS[g], items: groupMembers(g) as PropertyDef[] }));
  const rr = BOARD.filter((s): s is PropertyDef => s.kind === 'railroad');
  const ut = BOARD.filter((s): s is PropertyDef => s.kind === 'utility');
  return [...streets, { key: 'rr', label: 'Gares', color: '#2b2f36', items: rr }, { key: 'ut', label: 'Compagnies', color: '#8a96a3', items: ut }];
}

function usePlayer(playerId: string) {
  const game = useGame();
  const p = game.players.find((x) => x.id === playerId && !x.bankrupt);
  return { game, p, cur: game.settings.currency };
}

function Gone({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Joueur indisponible" onClose={onClose}>
      <Notice tone="error">Ce joueur n’est plus en jeu.</Notice>
    </Sheet>
  );
}

function BalanceLine({ name, color, balance, cur }: { name: string; color: string; balance: number; cur: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted mb-4">
      <PlayerDot color={color} /> <span className="font-semibold text-fg">{name}</span>
      <span className="ml-auto">Solde <b className="text-fg tabular">{formatMoney(balance, cur)}</b></span>
    </div>
  );
}

function ownerOf(game: GameState, square: number) {
  const id = game.properties[square]?.ownerId;
  return id ? game.players.find((p) => p.id === id) : undefined;
}

/** Liste des propriétés libres, pour l'achat ou les enchères. */
function FreeProperties({ game, selected, onSelect, cur, maxPrice }: { game: GameState; selected: number | null; onSelect: (i: number) => void; cur: string; maxPrice?: number }) {
  return (
    <div className="space-y-3">
      {propertyGroups().map((g) => (
        <div key={g.key}>
          {g.label && <div className="text-xs font-bold uppercase tracking-wider text-muted mb-1">{g.label}</div>}
          <div className="grid gap-1.5">
            {g.items.map((d) => {
              const owner = ownerOf(game, d.index);
              const tooExpensive = maxPrice !== undefined && d.price > maxPrice;
              return (
                <button
                  key={d.index}
                  type="button"
                  disabled={!!owner}
                  onClick={() => onSelect(d.index)}
                  aria-pressed={selected === d.index}
                  className={cx(
                    'h-12 rounded-2xl border pl-0 pr-3 flex items-center gap-3 text-left overflow-hidden transition',
                    selected === d.index ? 'border-fg bg-surface-3 ring-1 ring-fg' : 'border-line bg-surface-2',
                    owner && 'opacity-45',
                  )}
                >
                  <span className="h-full w-2.5 shrink-0" style={{ background: g.color }} />
                  <span className="font-semibold text-[15px] truncate flex-1">{d.name}</span>
                  {owner ? (
                    <span className="text-xs text-muted flex items-center gap-1 shrink-0"><PlayerDot color={owner.color} size={8} /> {owner.name}</span>
                  ) : (
                    <span className={cx('tabular font-bold shrink-0', tooExpensive && 'text-loss')}>{formatMoney(d.price, cur)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tuile « Propriétés » : payer à la banque le titre acheté sur le plateau. */
export function BuySheet({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { game, p, cur } = usePlayer(playerId);
  const run = useAction();
  const formId = useFormId();
  const [square, setSquare] = useState<number | null>(null);
  if (!p) return <Gone onClose={onClose} />;
  const def = square !== null ? getProperty(square) : null;
  const short = def ? p.balance < def.price : false;
  const submit = async () => {
    if (!def) return;
    const r = await run({ type: 'buyProperty', playerId: p.id, square: def.index }, `${p.name} achète ${def.name}`, {
      confirm: { title: 'Confirmer l’achat', message: <>{p.name} achète <b>{def.name}</b> pour {formatMoney(def.price, cur)}.</>, confirmLabel: 'Acheter' },
      actionId: formId,
    });
    if (r?.ok) onClose();
  };
  const mine = BOARD.filter((s) => game.properties[s.index]?.ownerId === p.id);
  return (
    <Sheet
      title="Acheter une propriété"
      onClose={onClose}
      footer={
        <Button variant="success" size="lg" className="w-full" disabled={!def || short} onClick={submit}>
          {def ? `Payer ${formatMoney(def.price, cur)} – ${def.name}` : 'Choisissez la propriété'}
        </Button>
      }
    >
      <BalanceLine name={p.name} color={p.color} balance={p.balance} cur={cur} />
      {short && def && <div className="mb-3"><Notice tone="error">{p.name} n’a pas assez d’argent pour {def.name}.</Notice></div>}
      <FreeProperties game={game} selected={square} onSelect={setSquare} cur={cur} maxPrice={p.balance} />
      {mine.length > 0 && <p className="text-xs text-muted mt-4">{p.name} possède {mine.length} propriété(s). Hypothèques : menu Accueil → Titres.</p>}
    </Sheet>
  );
}

/** Tuile « Maison et Hôtel » : construire ou revendre sur les groupes complets. */
export function BuildSheet({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { game, p, cur } = usePlayer(playerId);
  const run = useAction();
  if (!p) return <Gone onClose={onClose} />;
  const groups = GROUP_ORDER.filter((g) => groupMembers(g).some((m) => game.properties[m.index]?.ownerId === p.id));
  return (
    <Sheet title="Maisons et hôtels" onClose={onClose} wide>
      <BalanceLine name={p.name} color={p.color} balance={p.balance} cur={cur} />
      <div className="flex gap-3 text-xs text-muted mb-4">
        <span className="inline-flex items-center gap-1"><House size={14} /> Banque : {game.bankHouses} maisons</span>
        <span className="inline-flex items-center gap-1"><Hotel size={14} /> {game.bankHotels} hôtels</span>
      </div>
      {groups.length === 0 && <Notice>{p.name} ne possède encore aucun terrain. Il faut tous les terrains d’une couleur pour construire.</Notice>}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g} className="rounded-2xl border border-line overflow-hidden">
            <div className="h-2" style={{ background: GROUP_COLORS[g] }} />
            {groupMembers(g).map((m) => {
              const ps = game.properties[m.index];
              const mine = ps?.ownerId === p.id;
              const build = canBuildHouse(game, m.index);
              const sell = canSellHouse(game, m.index);
              const h = ps?.houses ?? 0;
              return (
                <div key={m.index} className="px-3 py-2.5 border-t border-line/60 first:border-t-0">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className={cx('font-semibold truncate', !mine && 'text-muted')}>{m.name}</div>
                      <div className="text-xs text-muted">
                        {mine ? (h === 5 ? 'Hôtel' : `${h} maison${h > 1 ? 's' : ''}`) : ownerOf(game, m.index)?.name ?? 'Libre'}
                        {mine && ` · ${formatMoney(m.housePrice, cur)} / bâtiment`}
                      </div>
                    </div>
                    {mine && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          aria-label={`Vendre un bâtiment sur ${m.name}`}
                          disabled={!sell.ok}
                          onClick={() => run({ type: 'sellHouse', square: m.index }, `Vente ${h === 5 ? 'd’un hôtel' : 'd’une maison'} – ${m.name}`, { amount: Math.floor(m.housePrice / 2) })}
                        >
                          <Minus size={16} />
                        </Button>
                        <span className="w-14 flex justify-center gap-0.5" aria-hidden>
                          {h === 5 ? <Hotel size={18} className="text-loss" /> : Array.from({ length: 4 }, (_, i) => <span key={i} className={cx('h-3 w-3 rounded-sm', i < h ? 'bg-gain' : 'bg-surface-3')} />)}
                        </span>
                        <Button
                          size="sm"
                          variant="success"
                          aria-label={`Construire sur ${m.name}`}
                          disabled={!build.ok}
                          onClick={() => run({ type: 'buildHouse', square: m.index }, `${h === 4 ? 'Hôtel' : 'Maison'} sur ${m.name}`, { amount: m.housePrice })}
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                  {mine && !build.ok && h < 5 && <div className="text-[11px] text-muted mt-1">{build.reason}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/** Choix du bénéficiaire : carte posée ou nom touché. */
function PayeePicker({ game, exclude, onPick, title, subtitle }: { game: GameState; exclude: string; onPick: (id: string) => void; title: string; subtitle: string }) {
  const { toast } = useFeedback();
  useCardCapture((sig) => {
    if (!sig) return toast('Lecture invalide : reposez la carte.', 'error');
    const id = matchSignature(sig, cardCandidates(game));
    if (!id) return toast('Carte non reconnue : touchez le nom du joueur.', 'error');
    if (id === exclude) return toast('Présentez la carte de l’autre joueur.', 'warn');
    onPick(id);
  });
  return (
    <div className="fade-in">
      <div className="rounded-3xl border-2 border-dashed border-gain/60 bg-gain/10 p-6 text-center mb-4">
        <Fingerprint size={36} className="mx-auto text-gain mb-2" />
        <div className="font-bold text-lg">{title}</div>
        <div className="text-sm text-muted mt-1">{subtitle}</div>
      </div>
      <div className="text-xs text-muted mb-2">Ou touchez son nom :</div>
      <div className="grid grid-cols-2 gap-2">
        {game.players.filter((x) => !x.bankrupt && x.id !== exclude).map((x) => (
          <button key={x.id} type="button" onClick={() => onPick(x.id)} className="h-12 rounded-2xl bg-surface-2 border border-line px-3 flex items-center gap-2 font-semibold text-sm">
            <PlayerDot color={x.color} /> {x.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Tuile « Payer joueur » : montant, puis carte du bénéficiaire. */
export function PayPlayerSheet({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { game, p, cur } = usePlayer(playerId);
  const run = useAction();
  const formId = useFormId();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'amount' | 'payee'>('amount');
  const value = parseAmount(amount);
  if (!p) return <Gone onClose={onClose} />;
  const short = value !== null && p.balance < value;
  const pay = async (to: string) => {
    const payee = game.players.find((x) => x.id === to);
    if (!value || !payee) return;
    const r = await run({ type: 'transfer', from: p.id, to: payee.id, amount: value, label: 'Paiement entre joueurs' }, `${p.name} → ${payee.name} : ${formatMoney(value, cur)}`, { amount: value, actionId: formId });
    if (r?.ok) onClose();
  };
  return (
    <Sheet
      title="Payer un joueur"
      onClose={onClose}
      footer={
        step === 'amount' ? (
          <Button variant="primary" size="lg" className="w-full" disabled={!value || short} onClick={() => setStep('payee')}>
            Continuer {value ? formatMoney(value, cur) : ''}
          </Button>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setStep('amount')}>Modifier le montant</Button>
        )
      }
    >
      <BalanceLine name={p.name} color={p.color} balance={p.balance} cur={cur} />
      {step === 'amount' ? (
        <>
          <AmountInput value={amount} onChange={setAmount} currency={cur} autoFocus presets={game.settings.quickAmounts} />
          {short && <p className="text-xs text-loss mt-2">Solde insuffisant ({formatMoney(p.balance, cur)}).</p>}
        </>
      ) : (
        value && <PayeePicker game={game} exclude={p.id} onPick={pay} title="Posez la carte du joueur payé" subtitle={`${formatMoney(value, cur)} payés par ${p.name}`} />
      )}
    </Sheet>
  );
}

/** Tuile « Enchères » : la vente se fait autour du plateau, l'app encaisse le prix final. */
export function AuctionSheet({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { game, p } = usePlayer(playerId);
  const cur = game.settings.currency;
  const run = useAction();
  const formId = useFormId();
  const [square, setSquare] = useState<number | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(p?.id ?? null);
  const [amount, setAmount] = useState('');
  const [pickWinner, setPickWinner] = useState(false);
  const value = parseAmount(amount);
  const def = square !== null ? getProperty(square) : null;
  const winner = game.players.find((x) => x.id === winnerId && !x.bankrupt);
  const short = !!winner && value !== null && winner.balance < value;
  const submit = async () => {
    if (!def || !winner || !value) return;
    const r = await run({ type: 'buyProperty', playerId: winner.id, square: def.index, price: value }, `Enchères : ${winner.name} remporte ${def.name}`, {
      confirm: { title: 'Adjuger la propriété', message: <><b>{def.name}</b> adjugée à {winner.name} pour {formatMoney(value, cur)}.</>, confirmLabel: 'Adjuger' },
      actionId: formId,
    });
    if (r?.ok) onClose();
  };
  return (
    <Sheet
      title="Enchères"
      onClose={onClose}
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={!def || !winner || !value || short} onClick={submit}>
          <Gavel size={18} /> Adjuger {value ? formatMoney(value, cur) : ''}
        </Button>
      }
    >
      {pickWinner ? (
        <>
          <PayeePicker game={game} exclude="" onPick={(id) => { setWinnerId(id); setPickWinner(false); }} title="Posez la carte du gagnant" subtitle="Celui qui a fait la meilleure offre" />
          <Button variant="ghost" className="w-full mt-3" onClick={() => setPickWinner(false)}>Retour</Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted mb-3">Mettez la propriété aux enchères autour du plateau, puis indiquez le gagnant et son offre.</p>
          <div className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Gagnant</div>
          <button type="button" onClick={() => setPickWinner(true)} className="w-full h-14 rounded-2xl border border-line bg-surface-2 px-4 flex items-center gap-3 font-semibold mb-4">
            {winner ? <><PlayerDot color={winner.color} /> {winner.name} <span className="ml-auto text-xs text-muted tabular">{formatMoney(winner.balance, cur)}</span></> : 'Choisir le gagnant'}
            <span className="text-xs text-accent font-bold">changer</span>
          </button>
          <div className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Offre gagnante</div>
          <AmountInput value={amount} onChange={setAmount} currency={cur} />
          {short && winner && <p className="text-xs text-loss mt-1">{winner.name} n’a que {formatMoney(winner.balance, cur)}.</p>}
          <div className="text-xs font-bold uppercase tracking-wider text-muted mt-4 mb-1">Propriété</div>
          <FreeProperties game={game} selected={square} onSelect={setSquare} cur={cur} />
        </>
      )}
    </Sheet>
  );
}

/** Ce que le joueur doit faire lui-même sur le plateau après une carte de déplacement. */
function MoveInstructions({ outcome, playerId, onClose }: { outcome: Extract<Outcome, { kind: 'card' }>; playerId: string; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const { open } = useGameUi();
  const formId = useFormId();
  const [paidGo, setPaidGo] = useState(false);
  const e = outcome.card.effect;
  const cur = game.settings.currency;
  if (game.settings.trackPositions || !['moveTo', 'moveBy', 'nearest', 'goToJail'].includes(e.type)) return null;
  const canPassGo = (e.type === 'moveTo' && e.collectGo) || e.type === 'nearest' || (e.type === 'moveBy' && e.steps > 0);
  return (
    <div className="space-y-2 mt-4">
      <Notice>Déplacez votre pion sur le plateau{e.type === 'goToJail' ? ' jusqu’à la prison, sans passer par le Départ' : ''}.</Notice>
      {canPassGo && (
        <Button
          size="lg"
          variant="success"
          className="w-full"
          disabled={paidGo || game.settings.goSalary <= 0}
          onClick={async () => {
            const r = await run({ type: 'collectGo', playerId }, 'Passage par le Départ', { amount: game.settings.goSalary, actionId: formId });
            if (r?.ok) setPaidGo(true);
          }}
        >
          <ArrowBigLeftDash size={20} /> {paidGo ? 'Salaire encaissé' : `Je passe par le Départ +${formatMoney(game.settings.goSalary, cur)}`}
        </Button>
      )}
      {e.type === 'nearest' && (
        <Button size="lg" className="w-full" onClick={() => { onClose(); open({ type: 'rent', payerId: playerId, railroadDouble: e.target === 'railroad', utilityTen: e.target === 'utility' }); }}>
          {e.target === 'railroad' ? 'Payer le loyer doublé de la gare' : 'Payer 10 × les dés à la compagnie'}
        </Button>
      )}
    </div>
  );
}

/** Tuiles « Chance » et « Caisse de communauté » : tirage virtuel, effet appliqué. */
export function DrawSheet({ playerId, deck, onClose }: { playerId: string; deck: DeckKind; onClose: () => void }) {
  const { game, p, cur } = usePlayer(playerId);
  const run = useAction();
  const { setOutcome } = useGameUi();
  const formId = useFormId();
  const [result, setResult] = useState<Extract<Outcome, { kind: 'card' }> | null>(null);
  const pendingOther = game.pendingCard && game.pendingCard.playerId !== playerId;
  const pendingMine = game.pendingCard?.playerId === playerId;
  const pendingCard = useMemo(() => (pendingMine ? game.cards.find((c) => c.id === game.pendingCard?.cardId) : undefined), [pendingMine, game.cards, game.pendingCard]);
  if (!p) return <Gone onClose={onClose} />;

  const draw = async () => {
    const r = await run({ type: 'drawCard', deck, playerId: p.id }, `Carte ${DECK_LABELS[deck]} – ${p.name}`, { success: false, actionId: formId });
    if (r?.ok && r.outcome.kind === 'card') {
      setResult(r.outcome);
      setOutcome(r.outcome);
    }
  };
  const retry = async () => {
    const r = await run({ type: 'applyPendingCard' }, 'Carte appliquée');
    if (r?.ok && r.outcome.kind === 'card') {
      setResult(r.outcome);
      setOutcome(r.outcome.then ?? null);
    }
  };
  const shown = result ?? (pendingCard ? { kind: 'card' as const, card: pendingCard, playerId, pending: true, error: 'Fonds insuffisants : hypothéquez ou vendez, puis réessayez.' } : null);
  const chance = deck === 'chance';
  return (
    <Sheet title={DECK_LABELS[deck]} onClose={onClose} footer={shown && !shown.pending ? <Button variant="primary" size="lg" className="w-full" onClick={onClose}>OK</Button> : undefined}>
      <BalanceLine name={p.name} color={p.color} balance={p.balance} cur={cur} />
      {!shown && (
        <>
          {pendingOther && <div className="mb-3"><Notice tone="warn">Une carte de {game.players.find((x) => x.id === game.pendingCard?.playerId)?.name} attend d’être réglée.</Notice></div>}
          <button
            type="button"
            disabled={!!pendingOther}
            onClick={draw}
            className={cx(
              'w-full h-44 rounded-3xl text-white font-black text-2xl shadow-xl active:scale-[0.98] transition disabled:opacity-40 flex flex-col items-center justify-center gap-2 bg-gradient-to-br',
              chance ? 'from-[#f28c28] to-[#c95f0a]' : 'from-[#2a7de1] to-[#1450a3]',
            )}
          >
            <Ticket size={40} />
            Tirer une carte
          </button>
        </>
      )}
      {shown && (
        <>
          <CardReveal card={shown.card} currency={cur} />
          {shown.pending ? (
            <div className="mt-3 space-y-2">
              <Notice tone="error">{shown.error}</Notice>
              <Button size="lg" variant="primary" className="w-full" onClick={retry}>Réessayer de régler la carte</Button>
            </div>
          ) : (
            <MoveInstructions outcome={shown} playerId={playerId} onClose={onClose} />
          )}
        </>
      )}
    </Sheet>
  );
}

/** Tuile « Sortie de prison » : amende ou carte « Sortie de prison ». */
export function JailSheet({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { game, p, cur } = usePlayer(playerId);
  const run = useAction();
  const formId = useFormId();
  if (!p) return <Gone onClose={onClose} />;
  const fine = game.settings.jailFine;
  const done = (r: { ok: boolean } | null) => r?.ok && onClose();
  return (
    <Sheet title="Sortie de prison" onClose={onClose}>
      <BalanceLine name={p.name} color={p.color} balance={p.balance} cur={cur} />
      <div className="grid gap-2">
        <Button size="lg" variant="primary" disabled={p.balance < fine} onClick={async () => done(await run({ type: 'payJailFine', playerId: p.id }, `${p.name} paie l’amende de prison`, { amount: fine, actionId: formId }))}>
          <LockOpen size={20} /> Payer l’amende {formatMoney(fine, cur)}
        </Button>
        <Button size="lg" disabled={p.jailCards.length === 0} onClick={async () => done(await run({ type: 'useJailCard', playerId: p.id }, `${p.name} utilise sa carte « Sortie de prison »`, { actionId: formId }))}>
          <Ticket size={20} /> Utiliser une carte « Sortie de prison » ({p.jailCards.length})
        </Button>
      </div>
      <p className="text-xs text-muted mt-3">Les cartes « Sortie de prison » tirées dans l’application sont gardées par le joueur jusqu’à leur utilisation.</p>
    </Sheet>
  );
}
