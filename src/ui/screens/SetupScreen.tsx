import { ArrowLeft, Minus, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_SETTINGS, PLAYER_COLORS, type SetupPlayer } from '../../domain/game';
import { amountToInput } from '../../domain/money';
import { store } from '../../store/gameStore';
import { AmountInput, Button, Card, cx, Field, inputClass, parseAmount, SectionTitle, Toggle } from '../components/ui';
import { useFeedback } from '../feedback';

const DEFAULT_NAMES = ['Joueur 1', 'Joueur 2', 'Joueur 3', 'Joueur 4'];

export function SetupScreen({ initial, onCancel, onStarted }: { initial: { players?: SetupPlayer[]; startingCash?: number }; onCancel: () => void; onStarted: () => void }) {
  const { toast } = useFeedback();
  const [players, setPlayers] = useState<SetupPlayer[]>(
    initial.players ?? [
      { name: '', color: PLAYER_COLORS[0] },
      { name: '', color: PLAYER_COLORS[1] },
    ],
  );
  const cur = DEFAULT_SETTINGS.currency;
  const [cash, setCash] = useState(amountToInput(initial.startingCash ?? DEFAULT_SETTINGS.startingCash, cur));
  const [salary, setSalary] = useState(amountToInput(DEFAULT_SETTINGS.goSalary, cur));
  const [jackpot, setJackpot] = useState(false);
  const [starting, setStarting] = useState(false);

  const setCount = (n: number) => {
    if (n < 2 || n > 4) return;
    setPlayers((ps) => {
      if (n < ps.length) return ps.slice(0, n);
      const used = new Set(ps.map((p) => p.color));
      const next = [...ps];
      while (next.length < n) {
        const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
        used.add(color);
        next.push({ name: '', color });
      }
      return next;
    });
  };

  const update = (i: number, patch: Partial<SetupPlayer>) => setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const start = () => {
    if (starting) return;
    const startingCash = parseAmount(cash);
    const goSalary = salary === '' ? 0 : (parseAmount(salary) ?? Number.NaN);
    if (!startingCash) return toast('Indiquez un capital de départ valide.', 'error');
    if (!Number.isInteger(goSalary) || goSalary < 0) return toast('Salaire du Départ invalide.', 'error');
    setStarting(true);
    const r = store.start({
      players: players.map((p, i) => ({ name: p.name.trim() || (DEFAULT_NAMES[i] as string), color: p.color })),
      settings: { startingCash, goSalary, freeParkingJackpot: jackpot, trackPositions: false },
    });
    setStarting(false);
    if (!r.ok) return toast(r.error, 'error');
    toast('La partie commence !');
    onStarted();
  };

  return (
    <div className="min-h-full px-4 sm:px-6 py-6 safe-top safe-bottom">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Retour">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-black">Nouvelle partie</h1>
        </div>

        <SectionTitle>Nombre de joueurs</SectionTitle>
        <Card className="p-3 mb-6 flex items-center justify-between">
          <Button size="lg" onClick={() => setCount(players.length - 1)} disabled={players.length <= 2} aria-label="Retirer un joueur">
            <Minus size={20} />
          </Button>
          <div className="text-3xl font-black tabular" aria-live="polite">
            {players.length} <span className="text-base font-semibold text-muted">joueurs</span>
          </div>
          <Button size="lg" onClick={() => setCount(players.length + 1)} disabled={players.length >= 4} aria-label="Ajouter un joueur">
            <Plus size={20} />
          </Button>
        </Card>

        <SectionTitle>Joueurs</SectionTitle>
        <div className="space-y-3 mb-6">
          {players.map((p, i) => (
            <Card key={i} className="p-4">
              <input
                className={inputClass}
                placeholder={DEFAULT_NAMES[i]}
                value={p.name}
                maxLength={20}
                onChange={(e) => update(i, { name: e.target.value })}
                aria-label={`Nom du joueur ${i + 1}`}
              />
              <div className="flex gap-2 mt-3" role="radiogroup" aria-label={`Couleur du joueur ${i + 1}`}>
                {PLAYER_COLORS.map((c) => {
                  const takenBy = players.findIndex((o, j) => j !== i && o.color === c);
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={p.color === c}
                      aria-label={`Couleur ${c}`}
                      disabled={takenBy >= 0}
                      onClick={() => update(i, { color: c })}
                      className={cx('h-9 w-9 rounded-full transition disabled:opacity-20', p.color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-fg scale-110' : '')}
                      style={{ background: c }}
                    />
                  );
                })}
              </div>
            </Card>
          ))}
        </div>

        <SectionTitle>Règles</SectionTitle>
        <Card className="p-4 mb-8">
          <Field label="Capital de départ">
            <AmountInput value={cash} onChange={setCash} currency={cur} presets={[1500, 2000, 2500]} />
          </Field>
          <Field label="Salaire au passage du Départ">
            <AmountInput value={salary} onChange={setSalary} currency={cur} />
          </Field>
          <Toggle checked={jackpot} onChange={setJackpot} label="Règle maison : taxes et amendes vont au Parc gratuit" />
        </Card>

        <Button variant="primary" size="lg" className="w-full" onClick={start} disabled={starting}>
          <Play size={20} /> Commencer la partie
        </Button>
      </div>
    </div>
  );
}
