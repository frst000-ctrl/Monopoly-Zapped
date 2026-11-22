import { CreditCard, Fingerprint, Info, Nfc, ScanLine, Trash2, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getProperty, PROPERTIES } from '../../domain/board';
import { formatMoney } from '../../domain/money';
import type { GameState, Player } from '../../domain/types';
import { useGame } from '../../store/gameStore';
import { isWebNfcSupported, startNfcScan } from '../../zapped/nfc';
import { averageSignatures, matchSignature, MIN_POINTS } from '../../zapped/touchSignature';
import { isTouchDevice, useCardCapture, useContactCount } from '../cardReader';
import { AmountInput, Button, Card, cx, Field, Notice, parseAmount, PlayerDot, SectionTitle, Select, Sheet } from '../components/ui';
import { useFeedback } from '../feedback';
import { useGameUi } from '../gameUi';
import { useAction, useFormId } from '../useAction';

// ---------------------------------------------------------------------------
// Zone de lecture tactile
// ---------------------------------------------------------------------------

/**
 * Zone visuelle où poser la carte. La lecture elle-même est faite par le lecteur
 * global ; tant que cette zone est affichée, elle reçoit les lectures en priorité.
 */
function TouchReader({ onRead, label }: { onRead: (sig: number[] | null, points: number) => void; label: string }) {
  useCardCapture(onRead);
  const count = useContactCount();
  return (
    <div
      style={{ touchAction: 'none' }}
      className={cx('h-48 rounded-3xl border-2 border-dashed grid place-items-center text-center select-none transition', count >= MIN_POINTS ? 'border-gain bg-gain/10' : 'border-line bg-surface-2')}
    >
      <div>
        <ScanLine size={36} className={cx('mx-auto mb-2', count >= MIN_POINTS ? 'text-gain' : 'text-muted')} />
        <div className="font-semibold">{label}</div>
        <div className="text-xs text-muted mt-1">Points de contact détectés : {count}</div>
      </div>
    </div>
  );
}

const touchCapable = isTouchDevice;

export function cardCandidates(game: GameState) {
  return game.players.filter((p) => p.cardSignature && !p.bankrupt).map((p) => ({ id: p.id, signature: p.cardSignature as number[] }));
}

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------

export function ZappedTab() {
  const game = useGame();
  const [calibrating, setCalibrating] = useState<Player | null>(null);
  const nfc = isWebNfcSupported();
  const touch = touchCapable();
  const linked = game.players.filter((p) => p.cardSignature).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Info className="text-[#7fb2ff] shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed space-y-2 text-fg/85">
            <p className="font-semibold text-fg">Ce que l’on sait des cartes Zapped d’origine</p>
            <p>
              Selon les tests publiés à la sortie du jeu (2012), les 4 cartes bancaires « Touch-Banking » ne contiennent <b>ni puce NFC ni code-barres</b>. Elles portent des plots conducteurs dont la disposition est propre à chaque carte. L’écran tactile les détecte comme plusieurs doigts posés en même temps, à condition que le joueur tienne la carte. Les cartes de propriétés n’ont aucune électronique.
            </p>
            <p>
              Cette application propose donc un <b>lecteur tactile expérimental</b>, actif sur <b>tous les écrans</b> : posez une carte n’importe où pendant la partie et la fenêtre de paiement du joueur s’ouvre (loyer, taxe ou achat dû proposés en un geste). Une carte inconnue peut être associée sur-le-champ, ou plus fiablement ci-dessous en 3 lectures. Le résultat dépend de l’écran. Si la lecture échoue, le <b>mode manuel</b> (boutons joueurs) fonctionne toujours.
            </p>
            <p className="text-muted">
              Lecture NFC : {nfc ? 'disponible sur cet appareil (Chrome Android), pour des tags NFC que vous ajoutez vous-même.' : 'indisponible sur cet appareil (Safari iPhone/iPad et Windows ne la proposent pas).'}
            </p>
          </div>
        </div>
      </Card>

      <ZappedTransaction />

      <div>
        <SectionTitle>Cartes bancaires associées ({linked}/{game.players.filter((p) => !p.bankrupt).length})</SectionTitle>
        {!touch && <div className="mb-3"><Notice tone="warn">Cet appareil n’a pas d’écran tactile : l’association des cartes doit se faire sur iPhone ou iPad.</Notice></div>}
        <div className="grid gap-2 sm:grid-cols-2">
          {game.players.filter((p) => !p.bankrupt).map((p) => (
            <Card key={p.id} className="p-4 flex items-center gap-3">
              <PlayerDot color={p.color} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs text-muted">{p.cardSignature ? `Carte associée (${p.cardSignature[0]} plots)` : 'Aucune carte'}</div>
              </div>
              <Button size="sm" disabled={!touch} onClick={() => setCalibrating(p)}>
                <Fingerprint size={16} /> {p.cardSignature ? 'Refaire' : 'Associer'}
              </Button>
              {p.cardSignature && <UnlinkButton player={p} />}
            </Card>
          ))}
        </div>
      </div>

      {nfc && <NfcPanel />}
      {calibrating && <CalibrateSheet player={calibrating} onClose={() => setCalibrating(null)} />}
    </div>
  );
}

function UnlinkButton({ player }: { player: Player }) {
  const run = useAction();
  return (
    <Button size="sm" variant="ghost" aria-label={`Dissocier la carte de ${player.name}`} onClick={() => run({ type: 'setCardSignature', playerId: player.id, signature: null }, `Carte de ${player.name} dissociée`)}>
      <Trash2 size={16} />
    </Button>
  );
}

function CalibrateSheet({ player, onClose }: { player: Player; onClose: () => void }) {
  const game = useGame();
  const run = useAction();
  const [reads, setReads] = useState<number[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const NEEDED = 3;

  const onRead = (sig: number[] | null, points: number) => {
    if (!sig) return setError(`Lecture invalide (${points} contacts). Reposez la carte bien à plat en la tenant.`);
    setError(null);
    setReads((r) => [...r, sig].slice(-NEEDED));
  };
  const avg = reads.length === NEEDED ? averageSignatures(reads) : null;
  const conflict = avg ? cardCandidates(game).find((c) => c.id !== player.id && matchSignature(avg, [c]) === c.id) : undefined;

  return (
    <Sheet
      title={`Carte de ${player.name}`}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!avg}
          onClick={async () => {
            if (!avg) return;
            const r = await run({ type: 'setCardSignature', playerId: player.id, signature: avg }, `Carte associée à ${player.name}`);
            if (r?.ok) onClose();
          }}
        >
          Associer cette carte
        </Button>
      }
    >
      <p className="text-sm text-muted mb-4">Posez la carte à plat sur la zone en gardant un doigt dessus, attendez la détection, puis retirez-la. Recommencez {NEEDED} fois.</p>
      <TouchReader onRead={onRead} label={`Lecture ${Math.min(reads.length + 1, NEEDED)} / ${NEEDED}`} />
      <div className="flex gap-2 justify-center my-4">
        {Array.from({ length: NEEDED }, (_, i) => <span key={i} className={cx('h-2.5 w-10 rounded-full', i < reads.length ? 'bg-gain' : 'bg-surface-3')} />)}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {reads.length === NEEDED && !avg && (
        <Notice tone="error">
          Les trois lectures ne concordent pas : cet écran ne lit sans doute pas la carte de façon fiable.{' '}
          <button type="button" className="underline" onClick={() => setReads([])}>Recommencer</button>
        </Notice>
      )}
      {avg && !conflict && <Notice tone="success">Lectures cohérentes : carte reconnue ({avg[0]} plots).</Notice>}
      {conflict && <Notice tone="warn">Cette empreinte ressemble à la carte d’un autre joueur : elle lui sera retirée.</Notice>}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Transaction « à la Zapped » : choisir l'opération, puis présenter les cartes
// ---------------------------------------------------------------------------

type ZOp = 'payBank' | 'receiveBank' | 'payPlayer' | 'go';
const OPS: { id: ZOp; label: string }[] = [
  { id: 'payBank', label: 'Payer la banque' },
  { id: 'receiveBank', label: 'Recevoir de la banque' },
  { id: 'payPlayer', label: 'Payer un joueur' },
  { id: 'go', label: 'Passage par le Départ' },
];

function ZappedTransaction() {
  const game = useGame();
  const run = useAction();
  const { toast } = useFeedback();
  const [op, setOp] = useState<ZOp>('payPlayer');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState<string | null>(null);
  const [payee, setPayee] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const formId = useFormIdFor(formKey);
  const cur = game.settings.currency;
  const value = op === 'go' ? game.settings.goSalary : parseAmount(amount);
  const needsTwo = op === 'payPlayer';
  const step: 'amount' | 'first' | 'second' | 'confirm' = !value ? 'amount' : !payer ? 'first' : needsTwo && !payee ? 'second' : 'confirm';
  const name = (id: string | null) => game.players.find((p) => p.id === id)?.name ?? '';
  const candidates = cardCandidates(game);

  const identify = (id: string) => {
    if (step === 'first') setPayer(id);
    else if (step === 'second') {
      if (id === payer) return toast('Présentez la carte de l’autre joueur.', 'warn');
      setPayee(id);
    }
  };
  const onRead = (sig: number[] | null) => {
    if (!sig) return toast('Lecture invalide : reposez la carte.', 'error');
    const id = matchSignature(sig, candidates);
    if (!id) return toast('Carte non reconnue. Utilisez les boutons joueurs.', 'error');
    identify(id);
  };
  const reset = () => {
    setPayer(null);
    setPayee(null);
    setAmount('');
    setFormKey((k) => k + 1);
  };

  const execute = async () => {
    if (!value || !payer) return;
    let r;
    if (op === 'payBank') r = await run({ type: 'debit', playerId: payer, amount: value, label: 'Paiement Zapped' }, `${name(payer)} paie ${formatMoney(value, cur)} à la banque`, { amount: value, actionId: formId });
    else if (op === 'receiveBank') r = await run({ type: 'credit', playerId: payer, amount: value, label: 'Encaissement Zapped' }, `${name(payer)} reçoit ${formatMoney(value, cur)}`, { amount: value, actionId: formId });
    else if (op === 'go') r = await run({ type: 'collectGo', playerId: payer }, `${name(payer)} touche le salaire du Départ`, { amount: value, actionId: formId });
    else if (payee) r = await run({ type: 'transfer', from: payer, to: payee, amount: value, label: 'Paiement Zapped' }, `${name(payer)} → ${name(payee)} : ${formatMoney(value, cur)}`, { amount: value, actionId: formId });
    if (r?.ok) reset();
  };

  const prompt =
    step === 'first'
      ? op === 'payBank' || op === 'payPlayer'
        ? 'Présentez la carte du payeur'
        : 'Présentez la carte du bénéficiaire'
      : 'Présentez la carte du bénéficiaire';

  return (
    <div>
      <SectionTitle>Transaction Zapped</SectionTitle>
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {OPS.map((o) => (
            <button key={o.id} type="button" onClick={() => { setOp(o.id); setPayer(null); setPayee(null); }} className={cx('h-12 rounded-2xl text-sm font-semibold border', op === o.id ? 'bg-fg text-ink border-fg' : 'bg-surface-2 border-line')}>
              {o.label}
            </button>
          ))}
        </div>
        {op !== 'go' ? (
          <Field label="Montant">
            <AmountInput value={amount} onChange={setAmount} currency={cur} presets={game.settings.quickAmounts} />
          </Field>
        ) : (
          <p className="text-sm text-muted mb-4">Montant : {formatMoney(game.settings.goSalary, cur)}</p>
        )}

        {(step === 'first' || step === 'second') && (
          <div className="space-y-3 fade-in">
            <div className="flex items-center gap-2 font-semibold"><CreditCard size={18} className="text-accent" /> {prompt}</div>
            {candidates.length > 0 && touchCapable() && <TouchReader key={step} onRead={onRead} label="Posez la carte ici" />}
            <div className="text-xs text-muted">{candidates.length ? 'Ou choisissez le joueur :' : 'Mode manuel (aucune carte associée) : choisissez le joueur.'}</div>
            <div className="grid grid-cols-2 gap-2">
              {game.players.filter((p) => !p.bankrupt && p.id !== payer).map((p) => (
                <button key={p.id} type="button" onClick={() => identify(p.id)} className="h-12 rounded-2xl bg-surface-2 border border-line px-3 flex items-center gap-2 font-semibold text-sm">
                  <PlayerDot color={p.color} /> {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'confirm' && value && (
          <div className="space-y-3 fade-in">
            <div className="rounded-2xl bg-surface-2 p-4 text-center">
              <Zap className="mx-auto text-gold mb-1" />
              <div className="text-2xl font-black tabular">{formatMoney(value, cur)}</div>
              <div className="text-sm text-muted mt-1">
                {op === 'payPlayer' ? `${name(payer)} → ${name(payee)}` : op === 'payBank' ? `${name(payer)} → Banque` : `Banque → ${name(payer)}`}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={reset}>Annuler</Button>
              <Button variant="primary" onClick={execute}>Valider</Button>
            </div>
          </div>
        )}
        {(payer || payee) && step !== 'confirm' && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={reset}>Recommencer</Button>
        )}
      </Card>
    </div>
  );
}

/** Nouvelle clé anti-doublon à chaque nouvelle transaction. */
function useFormIdFor(key: number) {
  const base = useFormId();
  return `${base}-${key}`;
}

// ---------------------------------------------------------------------------
// NFC (Android uniquement)
// ---------------------------------------------------------------------------

function NfcPanel() {
  const game = useGame();
  const run = useAction();
  const { toast } = useFeedback();
  const { open } = useGameUi();
  const [scanning, setScanning] = useState<'idle' | 'read' | 'link'>('idle');
  const [lastSerial, setLastSerial] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(game.players[0] ? `player:${game.players[0].id}` : `property:${PROPERTIES[0]!.index}`);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  const begin = async (mode: 'read' | 'link') => {
    stop.current?.();
    try {
      stop.current = await startNfcScan(
        (serial) => {
          setLastSerial(serial);
          if (mode === 'read') {
            const t = game.zapped.nfcLinks[serial];
            if (!t) toast('Tag inconnu : associez-le d’abord.', 'warn');
            else if (t.kind === 'player') open({ type: 'player', playerId: t.playerId });
            else open({ type: 'property', square: t.square });
          }
        },
        (msg) => toast(msg, 'error'),
      );
      setScanning(mode);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'NFC indisponible', 'error');
    }
  };

  const links = Object.entries(game.zapped.nfcLinks);
  return (
    <div>
      <SectionTitle>Tags NFC (vos propres autocollants)</SectionTitle>
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => begin('read')} variant={scanning === 'read' ? 'primary' : 'secondary'}><Nfc size={18} /> Lire un tag</Button>
          <Button onClick={() => begin('link')} variant={scanning === 'link' ? 'primary' : 'secondary'}><Nfc size={18} /> Associer un tag</Button>
        </div>
        {scanning !== 'idle' && <p className="text-sm text-muted">Approchez un tag NFC du dos du téléphone…{lastSerial && <> Dernier tag : <code>{lastSerial}</code></>}</p>}
        {scanning === 'link' && lastSerial && (
          <div className="space-y-2">
            <Select
              ariaLabel="Associer à"
              value={target}
              onChange={setTarget}
              options={[
                ...game.players.map((p) => ({ value: `player:${p.id}`, label: `Joueur : ${p.name}` })),
                ...PROPERTIES.map((p) => ({ value: `property:${p.index}`, label: `Propriété : ${p.name}` })),
              ]}
            />
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                const [kind, id] = target.split(':') as ['player' | 'property', string];
                void run({ type: 'setNfcLink', serial: lastSerial, target: kind === 'player' ? { kind, playerId: id } : { kind, square: Number(id) } }, 'Tag NFC associé');
              }}
            >
              Associer le tag {lastSerial}
            </Button>
          </div>
        )}
        {links.length > 0 && (
          <ul className="text-sm divide-y divide-line/50">
            {links.map(([serial, t]) => (
              <li key={serial} className="flex items-center justify-between py-2 gap-2">
                <code className="text-xs text-muted truncate">{serial}</code>
                <span className="font-semibold truncate">{t.kind === 'player' ? game.players.find((p) => p.id === t.playerId)?.name : getProperty(t.square).name}</span>
                <Button size="sm" variant="ghost" aria-label="Supprimer le tag" onClick={() => run({ type: 'setNfcLink', serial, target: null }, 'Tag NFC supprimé')}>
                  <Trash2 size={15} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
