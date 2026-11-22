import { CheckCircle2, Download, Flag, Home, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { checkConsistency } from '../../domain/bank';
import { store, useGame } from '../../store/gameStore';
import { Button, Card, Field, inputClass, SectionTitle, Toggle } from '../components/ui';
import { useFeedback } from '../feedback';
import { useAction } from '../useAction';

export function downloadSave() {
  const text = store.exportSave();
  if (!text) return false;
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zapped-bank-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function SettingsTab({ onRestart }: { onRestart: () => void }) {
  const game = useGame();
  const run = useAction();
  const { confirm, toast } = useFeedback();
  const s = game.settings;
  const [salary, setSalary] = useState(String(s.goSalary));
  const [threshold, setThreshold] = useState(String(s.confirmThreshold));
  const [fine, setFine] = useState(String(s.jailFine));
  const [currency, setCurrency] = useState(s.currency);
  const [quick, setQuick] = useState(s.quickAmounts.map(String));
  const [jackpot, setJackpot] = useState(s.freeParkingJackpot);
  const playing = game.status === 'playing';

  const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : NaN);
  const save = async () => {
    const quickAmounts = quick.map(num);
    if ([num(salary), num(threshold), num(fine), ...quickAmounts].some((n) => Number.isNaN(n))) return toast('Valeurs invalides : nombres entiers uniquement.', 'error');
    await run(
      { type: 'updateSettings', patch: { goSalary: num(salary), confirmThreshold: num(threshold), jailFine: num(fine), currency: currency.trim(), quickAmounts, freeParkingJackpot: jackpot } },
      'Réglages enregistrés',
    );
  };
  const n = (v: string, set: (s: string) => void, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className={inputClass} inputMode="numeric" value={v} onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 7))} />
    </Field>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <SectionTitle>Règles et banque</SectionTitle>
        <Card className="p-5">
          <div className="grid sm:grid-cols-2 gap-x-4">
            {n(salary, setSalary, 'Salaire du Départ')}
            {n(fine, setFine, 'Amende de prison')}
            {n(threshold, setThreshold, 'Confirmation à partir de', '0 = jamais (les achats et faillites restent confirmés)')}
            <Field label="Symbole monétaire">
              <input className={inputClass} value={currency} maxLength={4} onChange={(e) => setCurrency(e.target.value)} />
            </Field>
          </div>
          <Field label="Montants de la banque rapide">
            <div className="grid grid-cols-3 gap-2">
              {quick.map((q, i) => (
                <input key={i} aria-label={`Montant rapide ${i + 1}`} className={inputClass} inputMode="numeric" value={q} onChange={(e) => setQuick((arr) => arr.map((x, j) => (j === i ? e.target.value.replace(/\D/g, '').slice(0, 6) : x)))} />
              ))}
            </div>
          </Field>
          <Toggle checked={jackpot} onChange={setJackpot} label="Taxes et amendes vont au Parc gratuit" />
          <Button variant="primary" className="w-full mt-4" onClick={save} disabled={!playing}>
            Enregistrer les réglages
          </Button>
        </Card>
      </div>

      <div>
        <SectionTitle>Partie</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={() => (downloadSave() ? toast('Sauvegarde exportée', 'info') : toast('Rien à exporter', 'error'))}>
            <Download size={18} /> Exporter la sauvegarde
          </Button>
          <Button
            size="lg"
            onClick={() => {
              const problems = checkConsistency(game);
              if (problems.length) toast(`Problèmes : ${problems.join(', ')}`, 'error');
              else toast('Données cohérentes : soldes, bâtiments et propriétés vérifiés.');
            }}
          >
            <CheckCircle2 size={18} /> Vérifier la cohérence
          </Button>
          <Button
            size="lg"
            disabled={!playing}
            onClick={() => run({ type: 'endGame' }, 'Partie terminée', { confirm: { title: 'Terminer la partie ?', message: 'Le classement final sera affiché. Vous pourrez encore annuler cette opération.', confirmLabel: 'Terminer' } })}
          >
            <Flag size={18} /> Terminer la partie
          </Button>
          <Button
            size="lg"
            onClick={async () => {
              if (await confirm({ title: 'Recommencer ?', message: 'Une nouvelle partie sera préparée avec les mêmes joueurs. La partie actuelle sera remplacée au démarrage.', confirmLabel: 'Recommencer' })) onRestart();
            }}
          >
            <RotateCcw size={18} /> Recommencer
          </Button>
          <Button size="lg" variant="ghost" className="sm:col-span-2" onClick={() => store.leave()}>
            <Home size={18} /> Retour à l’accueil (la partie reste sauvegardée)
          </Button>
        </div>
      </div>
    </div>
  );
}
