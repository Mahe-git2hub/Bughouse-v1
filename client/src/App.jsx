import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import GameRoom from './components/GameRoom';
import InstallPrompt from './components/InstallPrompt';

function AppContent() {
  const { roomId, roomState } = useGame();

  if (!roomId) {
    return <Lobby />;
  }

  if (roomState && !roomState.gameStarted) {
    return <WaitingRoom />;
  }

  return <GameRoom />;
}

function App() {
  return (
    <GameProvider>
      <div className="app">
        <AppContent />
        <InstallPrompt />
      </div>
    </GameProvider>
  );
}

export default App;
