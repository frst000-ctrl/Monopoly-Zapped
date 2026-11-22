import { CheckCircle2, Download, Flag, Home, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { checkConsistency } from '../../domain/bank';
import { store, useGame } from '../../store/gameStore';
import { AmountInput, Button, Card, Field, parseAmount, SectionTitle, Toggle } from '../components/ui';
import { amountToInput, ZAPPED_CURRENCY } from '../../domain/money';
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
  const [zapped, setZapped] = useState(s.currency === ZAPPED_CURRENCY);
  const cur = zapped ? ZAPPED_CURRENCY : s.currency === ZAPPED_CURRENCY ? 'M' : s.currency;
  const [salary, setSalary] = useState(amountToInput(s.goSalary, s.currency));
  const [threshold, setThreshold] = useState(amountToInput(s.confirmThreshold, s.currency));
  const [fine, setFine] = useState(amountToInput(s.jailFine, s.currency));
  const [quick, setQuick] = useState(s.quickAmounts.map((q) => amountToInput(q, s.currency)));
  const [jackpot, setJackpot] = useState(s.freeParkingJackpot);
  const [track, setTrack] = useState(s.trackPositions);
  const playing = game.status === 'playing';

  // Change d'unité d'affichage : on convertit les saisies en cours.
  const switchUnit = (z: boolean) => {
    const to = z ? ZAPPED_CURRENCY : s.currency === ZAPPED_CURRENCY ? 'M' : s.currency;
    const conv = (v: string) => {
      const n = parseAmount(v);
      return n === null ? v : amountToInput(n, to);
    };
    setSalary(conv(salary));
    setThreshold(conv(threshold));
    setFine(conv(fine));
    setQuick(quick.map(conv));
    setZapped(z);
  };

  const val = (v: string) => (v.trim() === '' || /^0+[MK]?$/i.test(v.trim()) ? 0 : (parseAmount(v) ?? Number.NaN));
  const save = async () => {
    const quickAmounts = quick.map(val);
    const values = [val(salary), val(threshold), val(fine), ...quickAmounts];
    if (values.some((n) => Number.isNaN(n)) || val(fine) <= 0 || quickAmounts.some((q) => q <= 0)) return toast('Valeurs invalides : vérifiez les montants.', 'error');
    await run(
      { type: 'updateSettings', patch: { goSalary: val(salary), confirmThreshold: val(threshold), jailFine: val(fine), currency: cur, quickAmounts, freeParkingJackpot: jackpot, trackPositions: track } },
      'Réglages enregistrés',
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <SectionTitle>Règles et banque</SectionTitle>
        <Card className="p-5">
          <Toggle checked={zapped} onChange={switchUnit} label="Montants façon Zapped (15M, 600K)" />
          <div className="h-3" />
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Salaire du Départ"><AmountInput value={salary} onChange={setSalary} currency={cur} /></Field>
            <Field label="Amende de prison"><AmountInput value={fine} onChange={setFine} currency={cur} /></Field>
            <Field label="Confirmation à partir de" hint="Vide = jamais (achats et faillites restent confirmés)"><AmountInput value={threshold} onChange={setThreshold} currency={cur} /></Field>
          </div>
          <Field label="Montants rapides">
            <div className="space-y-2">
              {quick.map((q, i) => (
                <AmountInput key={i} value={q} onChange={(v) => setQuick((arr) => arr.map((x, j) => (j === i ? v : x)))} currency={cur} />
              ))}
            </div>
          </Field>
          <Toggle checked={jackpot} onChange={setJackpot} label="Taxes et amendes vont au Parc gratuit" />
          <Toggle checked={track} onChange={setTrack} label="Suivre les pions dans l’application (dés virtuels)" />
          <p className="text-xs text-muted mt-1">Désactivé : la partie se joue sur votre plateau, les cartes de déplacement sont de simples consignes.</p>
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
