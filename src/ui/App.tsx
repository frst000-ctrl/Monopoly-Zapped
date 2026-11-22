import { useState } from 'react';
import { store, useStore } from '../store/gameStore';
import { FeedbackProvider } from './feedback';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SetupScreen } from './screens/SetupScreen';
import type { SetupPlayer } from '../domain/game';

export function App() {
  return (
    <FeedbackProvider>
      <Router />
    </FeedbackProvider>
  );
}

function Router() {
  const { game } = useStore();
  const [setup, setSetup] = useState<{ players?: SetupPlayer[]; startingCash?: number } | null>(null);
  if (game) {
    return (
      <GameScreen
        onRestart={(players, startingCash) => {
          store.leave();
          setSetup({ players, startingCash });
        }}
      />
    );
  }
  if (setup) return <SetupScreen initial={setup} onCancel={() => setSetup(null)} onStarted={() => setSetup(null)} />;
  return <HomeScreen onNew={() => setSetup({})} />;
}
