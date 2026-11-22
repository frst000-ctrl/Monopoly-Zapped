import { Download, Home, RotateCcw, Trophy } from 'lucide-react';
import { formatMoney } from '../../domain/money';
import { netWorth } from '../../domain/rules';
import { store, useGame } from '../../store/gameStore';
import { Button, Card, cx, PlayerDot } from '../components/ui';
import { downloadSave } from './SettingsTab';

export function GameOver({ onRestart }: { onRestart: () => void }) {
  const game = useGame();
  const ranking = game.players
    .map((p) => ({ p, worth: p.bankrupt ? -1 : netWorth(game, p.id) }))
    .sort((a, b) => b.worth - a.worth);
  const winner = game.winnerId ? game.players.find((p) => p.id === game.winnerId) : ranking[0]?.p;
  return (
    <div className="max-w-lg mx-auto text-center">
      <Trophy size={56} className="mx-auto text-gold mb-3" />
      <h1 className="text-3xl font-black">{winner ? `${winner.name} gagne !` : 'Partie terminée'}</h1>
      <p className="text-muted mt-1 mb-6">Classement au patrimoine (argent + propriétés + bâtiments).</p>
      <Card className="divide-y divide-line/60 text-left mb-6">
        {ranking.map(({ p, worth }, i) => (
          <div key={p.id} className={cx('flex items-center gap-3 px-5 py-4', p.bankrupt && 'opacity-50')}>
            <span className="w-6 font-black text-muted tabular">{i + 1}</span>
            <PlayerDot color={p.color} />
            <span className="font-semibold flex-1">{p.name}</span>
            <span className="tabular font-bold">{p.bankrupt ? 'Faillite' : formatMoney(worth, game.settings.currency)}</span>
          </div>
        ))}
      </Card>
      <div className="grid gap-2">
        <Button variant="primary" size="lg" onClick={onRestart}><RotateCcw size={18} /> Rejouer avec les mêmes joueurs</Button>
        <Button size="lg" onClick={() => downloadSave()}><Download size={18} /> Exporter la partie</Button>
        <Button size="lg" variant="ghost" onClick={() => store.leave()}><Home size={18} /> Accueil</Button>
      </div>
      <p className="text-xs text-muted mt-4">Vous pouvez encore consulter le journal ou annuler la dernière opération.</p>
    </div>
  );
}
