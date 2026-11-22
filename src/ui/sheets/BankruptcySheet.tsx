import { useState } from 'react';
import { formatMoney } from '../../domain/money';
import { liquidationValue } from '../../domain/rules';
import { useGame } from '../../store/gameStore';
import { Button, Field, Notice, PlayerPicker, Sheet } from '../components/ui';
import { useGameUi } from '../gameUi';
import { useAction, useFormId } from '../useAction';

export function BankruptcySheet({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const formId = useFormId();
  const { setOutcome } = useGameUi();
  const p = game.players.find((x) => x.id === playerId);
  const [creditor, setCreditor] = useState<string | null>(null);
  if (!p || p.bankrupt) return null;
  const cur = game.settings.currency;
  const potential = p.balance + liquidationValue(game, p.id);
  const cName = creditor ? game.players.find((x) => x.id === creditor)?.name : 'la banque';

  return (
    <Sheet
      title={`Faillite de ${p.name}`}
      onClose={onClose}
      footer={
        <Button
          variant="danger"
          size="lg"
          className="w-full"
          onClick={async () => {
            const r = await run({ type: 'declareBankruptcy', playerId: p.id, creditorId: creditor }, `Faillite de ${p.name}`, {
              confirm: { title: 'Déclarer la faillite ?', message: <>{p.name} sera éliminé. Tous ses biens iront à <b>{cName}</b>. Cette opération peut être annulée avec « Annuler ».</>, danger: true, confirmLabel: 'Déclarer la faillite' },
              actionId: formId,
            });
            if (r?.ok) {
              setOutcome(r.outcome.kind === 'gameOver' ? r.outcome : null);
              onClose();
            }
          }}
        >
          Déclarer la faillite
        </Button>
      }
    >
      <div className="space-y-4">
        <Notice tone="warn">
          Avant de déclarer faillite, {p.name} peut encore mobiliser jusqu’à <b>{formatMoney(potential, cur)}</b> (solde + ventes de bâtiments + hypothèques).
        </Notice>
        <Field label="Envers qui ?" hint="Créancier = le joueur à qui l’argent est dû. Sinon, la banque.">
          <PlayerPicker players={game.players} value={creditor} onChange={setCreditor} exclude={[p.id]} allowBank />
        </Field>
        <ul className="text-sm text-fg/80 list-disc pl-5 space-y-1">
          <li>Les maisons et hôtels sont revendus à la banque à moitié prix.</li>
          <li>{creditor ? `${cName} reçoit l’argent, les propriétés (hypothèques comprises) et les cartes prison.` : 'Les propriétés redeviennent libres, l’argent retourne à la banque.'}</li>
        </ul>
      </div>
    </Sheet>
  );
}
