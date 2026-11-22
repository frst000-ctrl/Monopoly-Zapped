import { ArrowRight, Dices, Gavel, KeyRound, Lock, RotateCcw, ShoppingCart, Skull, Ticket } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getProperty, getSquare, GROUP_COLORS } from '../../domain/board';
import { DECK_LABELS } from '../../domain/cards';
import { formatMoney } from '../../domain/money';
import { landingSuggestion, type Outcome, type Suggestion } from '../../domain/game';
import { computeRent } from '../../domain/rules';
import type { GameState } from '../../domain/types';
import { rollDie, useGame } from '../../store/gameStore';
import { Die } from '../components/Dice';
import { Button, Card, cx, Money, Notice, PlayerDot, SectionTitle } from '../components/ui';
import { useGameUi } from '../gameUi';
import { useAction } from '../useAction';
import { CardReveal } from './CardsTab';

export function TurnTab() {
  const game = useGame();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <SectionTitle>Joueurs</SectionTitle>
        <PlayersGrid />
      </div>
      <div>
        <SectionTitle>Tour de jeu</SectionTitle>
        {game.status === 'playing' && <TurnPanel />}
      </div>
    </div>
  );
}

export function PlayersGrid() {
  const game = useGame();
  const { open } = useGameUi();
  return (
    <div className="grid grid-cols-2 gap-3">
      {game.players.map((p, i) => {
        const active = i === game.turn.currentIndex && game.status === 'playing';
        return (
          <Card
            key={p.id}
            onClick={() => open({ type: 'player', playerId: p.id })}
            className={cx('p-4 relative overflow-hidden', p.bankrupt && 'opacity-45', active && 'border-transparent')}
          >
            {active && <span className="absolute inset-0 rounded-3xl pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${p.color}` }} />}
            <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20" style={{ background: p.color }} />
            <div className="flex items-center gap-2 mb-2">
              <PlayerDot color={p.color} />
              <span className="font-bold truncate">{p.name}</span>
            </div>
            <BalanceText amount={p.balance} currency={game.settings.currency} />
            <div className="text-xs text-muted mt-1.5 truncate">
              {p.bankrupt ? 'En faillite' : p.inJail ? `En prison (${p.jailTurns}/3)` : getSquare(p.position).name}
            </div>
            <div className="flex gap-1.5 mt-2 min-h-5">
              {p.inJail && !p.bankrupt && <Badge icon={Lock} text="Prison" />}
              {p.jailCards.length > 0 && <Badge icon={KeyRound} text={`×${p.jailCards.length}`} />}
              {p.bankrupt && <Badge icon={Skull} text="Faillite" />}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Badge({ icon: Icon, text }: { icon: typeof Lock; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-surface-3 text-[11px] font-semibold text-fg/80">
      <Icon size={11} /> {text}
    </span>
  );
}

/** Solde avec un éclair vert/rouge quand il change. */
export function BalanceText({ amount, currency, className }: { amount: number; currency: string; className?: string }) {
  const prev = useRef(amount);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (amount !== prev.current) {
      setFlash(amount > prev.current ? 'flash-gain' : 'flash-loss');
      prev.current = amount;
      const t = setTimeout(() => setFlash(''), 1200);
      return () => clearTimeout(t);
    }
  }, [amount]);
  return <Money amount={amount} currency={currency} className={cx('text-2xl font-black block', flash, className)} />;
}

function TurnPanel() {
  const game = useGame();
  const run = useAction();
  const { outcome, setOutcome, open } = useGameUi();
  const [rolling, setRolling] = useState(false);
  const [faces, setFaces] = useState<[number | null, number | null]>(game.turn.lastRoll ?? [null, null]);
  const [manual, setManual] = useState(false);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const p = game.players[game.turn.currentIndex];

  // Sur téléphone, le résultat du lancer est sous les dés : on le fait défiler à l'écran.
  useEffect(() => {
    if (outcome) outcomeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [outcome]);

  useEffect(() => {
    if (!rolling) setFaces(game.turn.lastRoll ?? [null, null]);
  }, [game.turn.lastRoll, rolling]);

  if (!p) return null;
  const canRoll = !game.pendingCard && (!game.turn.hasRolled || (game.turn.extraTurn && !p.inJail));
  const mustPayJail = p.inJail && p.jailTurns >= 3 && game.turn.hasRolled;

  const doRoll = async (dice?: [number, number]) => {
    if (rolling) return;
    const final: [number, number] = dice ?? [rollDie(), rollDie()];
    if (!dice) {
      setRolling(true);
      const anim = setInterval(() => setFaces([rollDie(), rollDie()]), 90);
      await new Promise((r) => setTimeout(r, 650));
      clearInterval(anim);
      setRolling(false);
    }
    setFaces(final);
    const r = await run({ type: 'rollDice', dice: final }, `${p.name} lance les dés (${final[0]} + ${final[1]})`, { success: false });
    if (r?.ok) setOutcome(r.outcome);
  };

  const endTurn = async () => {
    const r = await run({ type: 'endTurn' }, game.turn.extraTurn ? `${p.name} rejoue` : 'Joueur suivant', {
      success: false,
      confirm:
        !game.turn.hasRolled && !p.inJail
          ? { title: 'Passer sans lancer les dés ?', message: `${p.name} n’a pas encore lancé les dés. Passer quand même au joueur suivant ?`, confirmLabel: 'Passer' }
          : undefined,
    });
    if (r?.ok) setOutcome(null);
  };

  const total = faces[0] && faces[1] ? faces[0] + faces[1] : null;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <PlayerDot color={p.color} size={14} />
          <span className="font-bold text-lg">{p.name}</span>
          {game.turn.doublesCount > 0 && <span className="ml-auto text-xs font-bold text-gold">Doubles : {game.turn.doublesCount}/3</span>}
        </div>

        {p.inJail && (
          <div className="mb-4 space-y-3">
            <Notice tone="warn">
              <b>{p.name} est en prison</b> — tentative {Math.min(p.jailTurns + (game.turn.hasRolled ? 0 : 1), 3)}/3. Faites un double pour sortir, payez l’amende ou utilisez une carte.
            </Notice>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={async () => {
                  const r = await run({ type: 'payJailFine', playerId: p.id }, `${p.name} paie l’amende de prison`, { amount: game.settings.jailFine });
                  if (r?.ok) setOutcome(r.outcome.kind === 'none' ? null : r.outcome);
                }}
              >
                <Gavel size={18} /> Payer {formatMoney(game.settings.jailFine, game.settings.currency)}
              </Button>
              <Button
                disabled={p.jailCards.length === 0}
                onClick={async () => {
                  const r = await run({ type: 'useJailCard', playerId: p.id }, `${p.name} utilise une carte « Sortie de prison »`);
                  if (r?.ok) setOutcome(r.outcome.kind === 'none' ? null : r.outcome);
                }}
              >
                <KeyRound size={18} /> Carte ({p.jailCards.length})
              </Button>
            </div>
            {mustPayJail && <Notice tone="error">Troisième échec : {p.name} doit payer l’amende (ou utiliser une carte), puis avance du total des dés.</Notice>}
          </div>
        )}

        <div className="flex items-center justify-center gap-5 py-3">
          <Die value={faces[0]} rolling={rolling} />
          <Die value={faces[1]} rolling={rolling} />
        </div>
        <div className="text-center text-sm text-muted h-5 mb-4 tabular">
          {total && !rolling ? <>Total <b className="text-fg">{total}</b>{faces[0] === faces[1] ? ' · Double !' : ''}</> : rolling ? 'Lancer…' : ' '}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button variant="primary" size="lg" onClick={() => doRoll()} disabled={!canRoll || rolling || mustPayJail}>
            <Dices size={22} /> {game.turn.extraTurn && game.turn.hasRolled ? 'Relancer (double)' : p.inJail ? 'Tenter un double' : 'Lancer les dés'}
          </Button>
          <Button size="lg" onClick={() => setManual((m) => !m)} disabled={!canRoll || rolling || mustPayJail} aria-expanded={manual}>
            Dés réels
          </Button>
        </div>
        {manual && canRoll && <ManualDice onSubmit={(d) => { setManual(false); void doRoll(d); }} />}

        <Button size="lg" className="w-full mt-2" onClick={endTurn} disabled={rolling}>
          {game.turn.extraTurn && game.turn.hasRolled ? <><RotateCcw size={18} /> Double : {p.name} rejoue</> : <>Joueur suivant <ArrowRight size={18} /></>}
        </Button>
      </Card>

      {game.pendingCard && <PendingCardPanel />}
      {outcome && (
        <div ref={outcomeRef} className="scroll-mt-20">
          <OutcomePanel outcome={outcome} game={game} />
        </div>
      )}
      {!outcome && game.turn.hasRolled && !p.inJail && (
        <Card className="p-4 text-sm text-muted">
          {p.name} est sur <b className="text-fg">{getSquare(p.position).name}</b>.{' '}
          <button type="button" className="underline text-fg" onClick={() => setOutcome(suggestHere(game))}>
            Afficher les actions de la case
          </button>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => open({ type: 'player', playerId: p.id })}>Fiche de {p.name}</Button>
        <Button onClick={() => open({ type: 'bankruptcy', playerId: p.id })} variant="danger">
          <Skull size={18} /> Faillite
        </Button>
      </div>
    </div>
  );
}

function suggestHere(game: GameState): Outcome {
  const p = game.players[game.turn.currentIndex]!;
  // Recalcul simple : sans les drapeaux de carte (loyer doublé, etc.).
  return { kind: 'moved', playerId: p.id, from: p.position, to: p.position, passedGo: false, suggestion: suggestionAt(game, p.id, p.position), doubles: false, extraTurn: game.turn.extraTurn };
}

const suggestionAt = (g: GameState, id: string, sq: number) => landingSuggestion(g, id, sq);

function ManualDice({ onSubmit }: { onSubmit: (d: [number, number]) => void }) {
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const Row = ({ v, set, label }: { v: number | null; set: (n: number) => void; label: string }) => (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={v === n} onClick={() => set(n)} className={cx('h-10 w-10 rounded-xl font-bold tabular', v === n ? 'bg-fg text-ink' : 'bg-surface-3')}>
          {n}
        </button>
      ))}
    </div>
  );
  return (
    <div className="mt-3 p-3 rounded-2xl bg-surface-2 space-y-2 fade-in">
      <div className="text-xs text-muted">Saisissez le résultat de vos dés physiques :</div>
      <Row v={a} set={setA} label="Dé 1" />
      <Row v={b} set={setB} label="Dé 2" />
      <Button variant="primary" className="w-full" disabled={!a || !b} onClick={() => a && b && onSubmit([a, b])}>
        Valider {a && b ? `${a} + ${b} = ${a + b}` : ''}
      </Button>
    </div>
  );
}

function PendingCardPanel() {
  const game = useGame();
  const run = useAction();
  const { open, setOutcome } = useGameUi();
  const pending = game.pendingCard!;
  const card = game.cards.find((c) => c.id === pending.cardId)!;
  const player = game.players.find((p) => p.id === pending.playerId)!;
  return (
    <Card className="p-5 border-gold/50">
      <div className="text-xs font-bold uppercase tracking-wider text-gold mb-2">Carte en attente</div>
      <CardReveal card={card} currency={game.settings.currency} compact />
      <p className="text-sm text-muted mt-3">
        Fonds insuffisants. {player.name} doit hypothéquer ou vendre des bâtiments, puis appliquer la carte — ou déclarer faillite.
      </p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button
          variant="primary"
          onClick={async () => {
            const r = await run({ type: 'applyPendingCard' }, 'Carte appliquée');
            if (r?.ok && r.outcome.kind === 'card' && r.outcome.then) setOutcome(r.outcome.then);
          }}
        >
          Appliquer la carte
        </Button>
        <Button onClick={() => open({ type: 'player', playerId: player.id })}>Gérer les biens</Button>
      </div>
    </Card>
  );
}

export function OutcomePanel({ outcome, game }: { outcome: Outcome; game: GameState }) {
  const { setOutcome } = useGameUi();
  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? '?';
  switch (outcome.kind) {
    case 'none':
    case 'gameOver':
      return null;
    case 'jail':
      return (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Lock className="text-gold" />
            <div>
              <div className="font-bold">{name(outcome.playerId)} va en prison</div>
              <div className="text-sm text-muted">
                {outcome.reason === 'doubles' ? 'Trois doubles de suite.' : outcome.reason === 'square' ? 'Case « Allez en prison ».' : outcome.reason === 'card' ? 'Carte tirée.' : 'Envoi manuel.'} Pas de salaire au passage du Départ.
              </div>
            </div>
          </div>
        </Card>
      );
    case 'jailRoll':
      return (
        <Card className="p-5">
          <div className="font-bold">Pas de double</div>
          <div className="text-sm text-muted">{outcome.mustPay ? 'Troisième tentative manquée : l’amende est obligatoire.' : `${name(outcome.playerId)} reste en prison.`}</div>
        </Card>
      );
    case 'card':
      return (
        <Card className="p-5">
          <CardReveal card={outcome.card} currency={game.settings.currency} />
          {outcome.pending && <div className="mt-3"><Notice tone="error">{outcome.error}</Notice></div>}
          {outcome.then && <div className="mt-4"><OutcomePanel outcome={outcome.then} game={game} /></div>}
          {!outcome.then && !outcome.pending && (
            <Button className="w-full mt-4" onClick={() => setOutcome(null)}>
              OK
            </Button>
          )}
        </Card>
      );
    case 'moved':
      return (
        <Card className="p-5 pop-in">
          <div className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Arrivée</div>
          <SquareTitle game={game} square={outcome.to} />
          {outcome.passedGo && <div className="text-sm text-gain mt-1">+ {formatMoney(game.settings.goSalary, game.settings.currency)} au passage du Départ</div>}
          <div className="mt-4">
            <SuggestionActions suggestion={outcome.suggestion} playerId={outcome.playerId} game={game} />
          </div>
        </Card>
      );
  }
}

function SquareTitle({ game, square }: { game: GameState; square: number }) {
  const sq = getSquare(square);
  const color = sq.kind === 'street' ? GROUP_COLORS[sq.group] : undefined;
  const owner = sq.kind === 'street' || sq.kind === 'railroad' || sq.kind === 'utility' ? game.properties[square]?.ownerId : null;
  const ownerP = owner ? game.players.find((p) => p.id === owner) : null;
  return (
    <div className="flex items-center gap-3">
      {color && <span className="h-10 w-2.5 rounded-full" style={{ background: color }} />}
      <div>
        <div className="text-xl font-black">{sq.name}</div>
        {ownerP && (
          <div className="text-sm text-muted flex items-center gap-1.5">
            <PlayerDot color={ownerP.color} size={9} /> Propriété de {ownerP.name}
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionActions({ suggestion, playerId, game }: { suggestion: Suggestion; playerId: string; game: GameState }) {
  const run = useAction();
  const { setOutcome, open } = useGameUi();
  const [rentDice, setRentDice] = useState<[number, number] | null>(null);
  const player = game.players.find((p) => p.id === playerId);
  if (!player) return null;
  const cur = game.settings.currency;

  switch (suggestion.type) {
    case 'none':
      return <div className="text-sm text-muted">Rien à payer sur cette case.</div>;
    case 'jailed':
      return null;
    case 'buy': {
      const def = getProperty(suggestion.square);
      const afford = player.balance >= suggestion.price;
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted">Propriété libre — prix {formatMoney(suggestion.price, cur)}</div>
          <Button
            variant="success"
            size="lg"
            className="w-full"
            disabled={!afford}
            onClick={async () => {
              const r = await run({ type: 'buyProperty', playerId, square: suggestion.square }, `${player.name} achète ${def.name}`, {
                confirm: { title: 'Confirmer l’achat', message: <>{player.name} achète <b>{def.name}</b> pour {formatMoney(suggestion.price, cur)}.</>, confirmLabel: 'Acheter' },
              });
              if (r?.ok) setOutcome(null);
            }}
          >
            <ShoppingCart size={20} /> Acheter {formatMoney(suggestion.price, cur)}
          </Button>
          {!afford && <div className="text-xs text-loss">Fonds insuffisants ({formatMoney(player.balance, cur)}).</div>}
          <Button className="w-full" onClick={() => open({ type: 'property', square: suggestion.square })}>
            <Gavel size={18} /> Enchères / autre acheteur
          </Button>
        </div>
      );
    }
    case 'rent': {
      const def = getProperty(suggestion.square);
      const owner = game.players.find((p) => p.id === suggestion.ownerId);
      const lastTotal = game.turn.lastRoll ? game.turn.lastRoll[0] + game.turn.lastRoll[1] : 0;
      const diceTotal = rentDice ? rentDice[0] + rentDice[1] : suggestion.needsDice ? 0 : lastTotal;
      const needsRoll = def.kind === 'utility' && diceTotal === 0;
      const shownAmount =
        def.kind === 'utility' ? (diceTotal ? computeRent(game, suggestion.square, { diceTotal, utilityTen: suggestion.utilityTen }) : 0) : suggestion.amount;
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted">
            Loyer dû à {owner?.name}
            {suggestion.railroadDouble ? ' (doublé par la carte)' : ''}
            {suggestion.utilityTen ? ' : 10 × les dés' : ''}
          </div>
          {needsRoll ? (
            <Button size="lg" className="w-full" onClick={() => setRentDice([rollDie(), rollDie()])}>
              <Dices size={20} /> Lancer les dés pour le loyer
            </Button>
          ) : (
            <>
              {rentDice && <div className="text-sm">Dés : {rentDice[0]} + {rentDice[1]} = <b>{diceTotal}</b></div>}
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={async () => {
                  const r = await run(
                    { type: 'payRent', payerId: playerId, square: suggestion.square, diceTotal: def.kind === 'utility' ? diceTotal : undefined, railroadDouble: suggestion.railroadDouble, utilityTen: suggestion.utilityTen },
                    `Loyer ${def.name} : ${player.name} → ${owner?.name}`,
                    { amount: shownAmount },
                  );
                  if (r?.ok) setOutcome(null);
                }}
              >
                Payer {formatMoney(shownAmount, cur)} à {owner?.name}
              </Button>
            </>
          )}
          {!needsRoll && player.balance < shownAmount && <InsufficientHelp playerId={playerId} />}
        </div>
      );
    }
    case 'tax':
      return (
        <div className="space-y-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={async () => {
              const r = await run({ type: 'payTax', playerId, square: suggestion.square }, `${player.name} paie ${getSquare(suggestion.square).name}`, { amount: suggestion.amount });
              if (r?.ok) setOutcome(null);
            }}
          >
            Payer {formatMoney(suggestion.amount, cur)}
          </Button>
          {player.balance < suggestion.amount && <InsufficientHelp playerId={playerId} />}
        </div>
      );
    case 'card':
      return (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={async () => {
            const r = await run({ type: 'drawCard', deck: suggestion.deck, playerId }, `Carte ${DECK_LABELS[suggestion.deck]} – ${player.name}`, { success: false });
            if (r?.ok) setOutcome(r.outcome);
          }}
        >
          <Ticket size={20} /> Piocher : {DECK_LABELS[suggestion.deck]}
        </Button>
      );
  }
}

function InsufficientHelp({ playerId }: { playerId: string }) {
  const { open } = useGameUi();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button size="sm" onClick={() => open({ type: 'player', playerId })}>Hypothéquer / vendre</Button>
      <Button size="sm" variant="danger" onClick={() => open({ type: 'bankruptcy', playerId })}>Faillite</Button>
    </div>
  );
}
