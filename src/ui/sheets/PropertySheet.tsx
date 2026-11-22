import { Gavel, Hammer, Landmark, Repeat, ShoppingCart, Undo, UserCog } from 'lucide-react';
import { useState } from 'react';
import { getProperty, GROUP_LABELS, RAILROAD_RENTS } from '../../domain/board';
import { formatMoney, mortgageInterest, unmortgageCost } from '../../domain/money';
import { canBuildHouse, canMortgage, canSellHouse, canTransfer, canUnmortgage, computeRent, type Check } from '../../domain/rules';
import { useGame } from '../../store/gameStore';
import { Buildings, propertyColor } from '../components/PropertyRow';
import { AmountInput, Button, Field, Notice, parseAmount, PlayerDot, PlayerPicker, SectionTitle, Sheet } from '../components/ui';
import { useGameUi } from '../gameUi';
import { useAction, useFormId } from '../useAction';

export function PropertySheet({ square, onClose }: { square: number; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const { open } = useGameUi();
  const formId = useFormId();
  const def = getProperty(square);
  const ps = game.properties[square]!;
  const owner = game.players.find((p) => p.id === ps.ownerId);
  const cur = game.settings.currency;
  const m = (n: number) => formatMoney(n, cur);
  const current = game.players[game.turn.currentIndex];
  const [buyer, setBuyer] = useState<string | null>(current && !current.bankrupt ? current.id : null);
  const [price, setPrice] = useState(String(def.price));
  const [assigning, setAssigning] = useState(false);
  const [assignTo, setAssignTo] = useState<string | null>(null);
  const playing = game.status === 'playing';
  const priceValue = parseAmount(price);
  const buyerP = game.players.find((p) => p.id === buyer);

  return (
    <Sheet title={def.name} onClose={onClose}>
      <div className="rounded-3xl overflow-hidden border border-line mb-4">
        <div className="px-4 py-3 font-black text-center text-lg" style={{ background: propertyColor(square), color: def.kind === 'street' && ['yellow', 'lightBlue'].includes(def.group) ? '#111' : '#fff' }}>
          {def.kind === 'street' ? GROUP_LABELS[def.group] : def.kind === 'railroad' ? 'Gare' : 'Compagnie'}
        </div>
        <div className="p-4 text-sm space-y-1.5 bg-surface-2">
          <Row label="Prix d’achat" value={m(def.price)} />
          {def.kind === 'street' && (
            <>
              <Row label="Loyer terrain nu" value={m(def.rents[0])} hint="doublé si groupe complet" />
              {[1, 2, 3, 4].map((h) => <Row key={h} label={`Avec ${h} maison${h > 1 ? 's' : ''}`} value={m(def.rents[h]!)} />)}
              <Row label="Avec hôtel" value={m(def.rents[5])} />
              <Row label="Prix d’une maison" value={m(def.housePrice)} />
              <Row label="Prix de l’hôtel" value={`${m(def.housePrice)} + 4 maisons`} />
            </>
          )}
          {def.kind === 'railroad' && RAILROAD_RENTS.map((r, i) => <Row key={i} label={`${i + 1} gare${i ? 's' : ''} possédée${i ? 's' : ''}`} value={m(r)} />)}
          {def.kind === 'utility' && (
            <>
              <Row label="Une compagnie" value="4 × les dés" />
              <Row label="Les deux compagnies" value="10 × les dés" />
            </>
          )}
          <Row label="Valeur hypothécaire" value={m(def.mortgage)} />
          <Row label="Levée d’hypothèque" value={m(unmortgageCost(def.mortgage))} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 mb-4">
        <span className="text-muted text-sm">Propriétaire</span>
        <span className="font-semibold flex items-center gap-2">
          {owner ? <><PlayerDot color={owner.color} /> {owner.name}</> : 'Banque (libre)'}
        </span>
      </div>
      {owner && (
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 mb-4">
          <span className="text-muted text-sm">Loyer actuel</span>
          <span className="font-bold flex items-center gap-3">
            <Buildings houses={ps.houses} />
            {ps.mortgaged ? 'Hypothéquée' : def.kind === 'utility' ? (computeRent(game, square, { diceTotal: 1 }) === 10 ? '10 × dés' : '4 × dés') : m(computeRent(game, square))}
          </span>
        </div>
      )}

      {playing && !owner && (
        <>
          <SectionTitle>Acheter</SectionTitle>
          <Field label="Acheteur">
            <PlayerPicker players={game.players} value={buyer} onChange={setBuyer} />
          </Field>
          <Field label="Prix" hint="Modifiez le prix pour une vente aux enchères.">
            <AmountInput value={price} onChange={setPrice} currency={cur} presets={[def.price]} />
          </Field>
          <Button
            variant="success"
            size="lg"
            className="w-full mb-2"
            disabled={!buyerP || !priceValue || buyerP.balance < priceValue}
            onClick={async () => {
              if (!buyerP || !priceValue) return;
              const r = await run(
                { type: 'buyProperty', playerId: buyerP.id, square, price: priceValue },
                `${buyerP.name} achète ${def.name}`,
                { confirm: { title: 'Confirmer l’achat', message: <>{buyerP.name} achète <b>{def.name}</b> pour {m(priceValue)}{priceValue !== def.price ? ' (enchères)' : ''}.</>, confirmLabel: 'Acheter' }, actionId: formId },
              );
              if (r?.ok) onClose();
            }}
          >
            {priceValue !== def.price ? <Gavel size={20} /> : <ShoppingCart size={20} />} Acheter {priceValue ? m(priceValue) : ''}
          </Button>
          {buyerP && priceValue && buyerP.balance < priceValue && <Notice tone="error">{buyerP.name} n’a que {m(buyerP.balance)}.</Notice>}
        </>
      )}

      {playing && owner && (
        <>
          <SectionTitle>Gestion</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {def.kind === 'street' && (
              <>
                <CheckedButton check={canBuildHouse(game, square)} onClick={() => run({ type: 'buildHouse', square }, `${ps.houses === 4 ? 'Hôtel' : 'Maison'} sur ${def.name}`, { amount: def.housePrice })}>
                  <Hammer size={17} /> {ps.houses === 4 ? 'Hôtel' : 'Maison'} ({m(def.housePrice)})
                </CheckedButton>
                <CheckedButton check={canSellHouse(game, square)} onClick={() => run({ type: 'sellHouse', square }, `Vente ${ps.houses === 5 ? 'de l’hôtel' : 'd’une maison'} – ${def.name}`, { confirm: { title: 'Vendre un bâtiment ?', message: `La banque rachète à moitié prix : +${m(def.housePrice / 2)}.`, confirmLabel: 'Vendre' } })}>
                  <Undo size={17} /> Vendre ({m(def.housePrice / 2)})
                </CheckedButton>
              </>
            )}
            {ps.mortgaged ? (
              <CheckedButton check={canUnmortgage(game, square)} onClick={() => run({ type: 'unmortgage', square }, `Levée d’hypothèque – ${def.name}`, { amount: unmortgageCost(def.mortgage) })}>
                <Landmark size={17} /> Lever ({m(unmortgageCost(def.mortgage))})
              </CheckedButton>
            ) : (
              <CheckedButton check={canMortgage(game, square)} onClick={() => run({ type: 'mortgage', square }, `Hypothèque – ${def.name}`, { confirm: { title: 'Hypothéquer ?', message: <>{owner.name} reçoit {m(def.mortgage)}. Aucun loyer ne sera perçu tant que l’hypothèque n’est pas levée ({m(unmortgageCost(def.mortgage))}).</>, confirmLabel: 'Hypothéquer' } })}>
                <Landmark size={17} /> Hypothéquer (+{m(def.mortgage)})
              </CheckedButton>
            )}
            <CheckedButton check={canTransfer(game, square)} onClick={() => open({ type: 'trade', a: owner.id, aGives: [square] })}>
              <Repeat size={17} /> Vendre / échanger
            </CheckedButton>
          </div>
          {ps.mortgaged && <p className="text-xs text-muted mt-2">Un joueur qui reçoit cette propriété paie {m(mortgageInterest(def.mortgage))} d’intérêts (10 %).</p>}
        </>
      )}

      {playing && (
        <div className="mt-5">
          <Button size="sm" variant="ghost" className="text-muted" onClick={() => setAssigning((a) => !a)} aria-expanded={assigning}>
            <UserCog size={16} /> Attribution manuelle (correction)
          </Button>
          {assigning && (
            <div className="rounded-2xl bg-surface-2 p-4 mt-2 fade-in">
              <p className="text-xs text-muted mb-3">Change le propriétaire sans mouvement d’argent (pour corriger une erreur ou reprendre une partie commencée sans l’application).</p>
              <PlayerPicker players={game.players} value={assignTo} onChange={setAssignTo} allowBank />
              <Button
                className="w-full mt-3"
                disabled={assignTo === (ps.ownerId ?? null)}
                onClick={async () => {
                  const target = assignTo ? game.players.find((p) => p.id === assignTo)?.name : 'la banque';
                  const r = await run({ type: 'assignProperty', square, playerId: assignTo }, `${def.name} attribuée à ${target}`, {
                    confirm: { title: 'Attribuer sans paiement ?', message: `${def.name} sera attribuée à ${target}, sans aucun mouvement d’argent.`, confirmLabel: 'Attribuer' },
                  });
                  if (r?.ok) setAssigning(false);
                }}
              >
                Attribuer
              </Button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-fg/75">{label}{hint && <span className="text-muted text-xs"> ({hint})</span>}</span>
      <span className="font-semibold tabular">{value}</span>
    </div>
  );
}

/** Bouton actif seulement si la règle l'autorise ; sinon la raison est affichée. */
function CheckedButton({ check, onClick, children }: { check: Check; onClick: () => void; children: React.ReactNode }) {
  return (
    <div>
      <Button className="w-full" disabled={!check.ok} onClick={onClick}>
        {children}
      </Button>
      {!check.ok && <div className="text-[11px] text-muted mt-1 leading-snug">{check.reason}</div>}
    </div>
  );
}
