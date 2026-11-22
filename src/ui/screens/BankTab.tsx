import { ArrowLeftRight, Home, Landmark, PenLine, Receipt, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../domain/money';
import { useGame } from '../../store/gameStore';
import { Button, Card, cx, PlayerPicker, SectionTitle } from '../components/ui';
import { useGameUi } from '../gameUi';
import { useAction } from '../useAction';
import { BalanceText } from './TurnTab';

/** Mode banque rapide : gros boutons, un joueur sélectionné, opérations instantanées. */
export function BankTab() {
  const game = useGame();
  const run = useAction();
  const { open } = useGameUi();
  const alive = game.players.filter((p) => !p.bankrupt);
  const [selected, setSelected] = useState<string | null>(game.players[game.turn.currentIndex]?.id ?? alive[0]?.id ?? null);
  const player = game.players.find((p) => p.id === selected && !p.bankrupt) ?? alive[0];
  const cur = game.settings.currency;
  const amounts = game.settings.quickAmounts;
  const lastTap = useRef(0);

  // Suit le joueur actif quand le tour change.
  useEffect(() => {
    const active = game.players[game.turn.currentIndex];
    if (active && !active.bankrupt) setSelected(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.turn.turnNumber]);

  if (!player) return null;

  const quick = async (amount: number, sign: 1 | -1) => {
    // Anti double-tap accidentel : 350 ms minimum entre deux appuis rapides.
    const now = Date.now();
    if (now - lastTap.current < 350) return;
    lastTap.current = now;
    if (sign > 0) await run({ type: 'credit', playerId: player.id, amount }, `+${formatMoney(amount, cur)} pour ${player.name}`, { amount });
    else await run({ type: 'debit', playerId: player.id, amount }, `−${formatMoney(amount, cur)} pour ${player.name}`, { amount });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <SectionTitle>Joueur</SectionTitle>
      <PlayerPicker players={game.players} value={player.id} onChange={(id) => id && setSelected(id)} />

      <Card className="p-6 my-5 text-center relative overflow-hidden">
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: player.color }} />
        <div className="text-sm text-muted font-semibold">Solde de {player.name}</div>
        <BalanceText amount={player.balance} currency={cur} className="text-5xl mt-1" />
      </Card>

      <div className="grid grid-cols-3 gap-3 mb-3">
        {amounts.map((a) => (
          <QuickButton key={`+${a}`} tone="gain" onClick={() => quick(a, 1)}>
            +{a}
          </QuickButton>
        ))}
        {amounts.map((a) => (
          <QuickButton key={`-${a}`} tone="loss" onClick={() => quick(a, -1)} disabled={player.balance < a}>
            −{a}
          </QuickButton>
        ))}
      </div>
      <p className="text-xs text-muted mb-6 text-center">
        Montants modifiables dans Réglages. Confirmation demandée à partir de {formatMoney(game.settings.confirmThreshold, cur)}.
      </p>

      <SectionTitle>Opérations</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <BigAction icon={PenLine} label="Paiement personnalisé" onClick={() => open({ type: 'custom', playerId: player.id })} />
        <BigAction icon={ArrowLeftRight} label="Transfert entre joueurs" onClick={() => open({ type: 'transfer', from: player.id })} />
        <BigAction icon={Home} label="Payer un loyer" onClick={() => open({ type: 'rent', payerId: player.id })} />
        <BigAction icon={Receipt} label="Payer une taxe" onClick={() => open({ type: 'tax', playerId: player.id })} />
        <BigAction
          icon={Landmark}
          label={`Salaire Départ +${game.settings.goSalary}`}
          disabled={game.settings.goSalary <= 0}
          onClick={() => run({ type: 'collectGo', playerId: player.id }, `${player.name} touche le salaire du Départ`, { amount: game.settings.goSalary })}
        />
        <BigAction icon={Sparkles} label="Récompense" onClick={() => open({ type: 'custom', playerId: player.id, direction: 'in' })} />
      </div>
      {game.settings.freeParkingJackpot && (
        <Button
          size="lg"
          className="w-full mt-3"
          disabled={game.freeParkingPot <= 0}
          onClick={() => run({ type: 'collectFreeParking', playerId: player.id }, `${player.name} remporte la cagnotte`, { amount: game.freeParkingPot })}
        >
          Parc gratuit : cagnotte {formatMoney(game.freeParkingPot, cur)} → {player.name}
        </Button>
      )}
    </div>
  );
}

function QuickButton({ tone, children, onClick, disabled }: { tone: 'gain' | 'loss'; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'h-20 rounded-3xl text-2xl font-black tabular transition active:scale-95 disabled:opacity-30',
        tone === 'gain' ? 'bg-gain/15 text-gain border border-gain/30 hover:bg-gain/25' : 'bg-loss/15 text-loss border border-loss/30 hover:bg-loss/25',
      )}
    >
      {children}
    </button>
  );
}

function BigAction({ icon: Icon, label, onClick, disabled }: { icon: typeof Home; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-24 rounded-3xl bg-surface border border-line/70 p-4 flex flex-col items-start justify-between text-left font-semibold hover:border-line active:scale-[0.98] transition disabled:opacity-40"
    >
      <Icon size={22} className="text-accent" />
      <span className="text-[15px] leading-tight">{label}</span>
    </button>
  );
}
