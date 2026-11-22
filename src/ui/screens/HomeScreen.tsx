import { Download, FolderOpen, Play, Plus, Smartphone, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { store, useStore } from '../../store/gameStore';
import { Button, Card, Notice, Sheet } from '../components/ui';
import { Logo } from '../components/Logo';
import { useFeedback } from '../feedback';

export function HomeScreen({ onNew }: { onNew: () => void }) {
  const { storageWarning, restoredFromBackup } = useStore();
  const { confirm, toast } = useFeedback();
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const saved = store.savedGameInfo();

  const importFile = async (file: File) => {
    const text = await file.text();
    const r = store.importSave(text);
    if (!r.ok) toast(r.error, 'error');
    else toast('Partie importée');
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-5 py-10 safe-top safe-bottom bg-[radial-gradient(ellipse_at_top,rgba(224,38,47,0.18),transparent_60%)]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-10">
          <Logo size={76} />
          <h1 className="mt-5 text-4xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Zapped Bank
          </h1>
          <p className="mt-2 text-muted">La banque électronique de vos parties de Monopoly Zapped.</p>
        </div>

        {storageWarning && <div className="mb-4"><Notice tone="warn">{storageWarning}</Notice></div>}
        {restoredFromBackup && <div className="mb-4"><Notice tone="warn">La dernière sauvegarde était illisible : la copie de secours précédente a été récupérée.</Notice></div>}

        {saved && (
          <Card className="p-5 mb-4">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted mb-1">Partie sauvegardée</div>
            <div className="font-semibold text-lg">{saved.players.join(' · ')}</div>
            <div className="text-sm text-muted mb-4">
              {saved.status === 'ended' ? 'Terminée' : `Tour ${saved.turn}`} — {new Date(saved.savedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="lg" className="flex-1" onClick={() => store.resume()}>
                <Play size={20} /> Reprendre
              </Button>
              <Button
                size="lg"
                variant="danger"
                aria-label="Supprimer la sauvegarde"
                onClick={async () => {
                  if (await confirm({ title: 'Supprimer la sauvegarde ?', message: 'La partie sauvegardée sera définitivement effacée de cet appareil.', danger: true, confirmLabel: 'Supprimer' })) {
                    store.discard();
                    force((n) => n + 1);
                    toast('Sauvegarde supprimée', 'info');
                  }
                }}
              >
                <Trash2 size={20} />
              </Button>
            </div>
          </Card>
        )}

        <Button
          variant={saved ? 'secondary' : 'primary'}
          size="lg"
          className="w-full mb-3"
          onClick={async () => {
            if (saved && !(await confirm({ title: 'Nouvelle partie', message: 'La partie sauvegardée sera remplacée dès que la nouvelle partie commencera.', confirmLabel: 'Continuer' }))) return;
            onNew();
          }}
        >
          <Plus size={20} /> Nouvelle partie
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={() => fileRef.current?.click()}>
            <FolderOpen size={18} /> Importer
          </Button>
          <Button size="lg" onClick={() => setHelp(true)}>
            <Smartphone size={18} /> Installer
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
        <p className="text-center text-xs text-muted mt-10 leading-relaxed">
          Application non officielle, sans lien avec Hasbro. Monopoly est une marque de Hasbro.
          <br />
          Les parties sont enregistrées uniquement sur cet appareil.
        </p>
      </div>
      {help && <InstallHelp onClose={() => setHelp(false)} />}
    </div>
  );
}

function InstallHelp({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Installer l’application" onClose={onClose}>
      <div className="space-y-4 text-[15px] leading-relaxed">
        <div>
          <div className="font-semibold mb-1">iPhone / iPad (Safari)</div>
          <ol className="list-decimal pl-5 text-fg/85 space-y-1">
            <li>Touchez le bouton Partager (carré avec une flèche).</li>
            <li>Choisissez « Sur l’écran d’accueil ».</li>
            <li>Validez avec « Ajouter ».</li>
          </ol>
        </div>
        <div>
          <div className="font-semibold mb-1">Windows (Edge ou Chrome)</div>
          <p className="text-fg/85">
            Cliquez sur l’icône <Download size={14} className="inline" /> « Installer » dans la barre d’adresse, ou menu ⋯ → Applications → Installer.
          </p>
        </div>
        <Notice>Une fois installée, l’application fonctionne hors connexion.</Notice>
      </div>
    </Sheet>
  );
}
