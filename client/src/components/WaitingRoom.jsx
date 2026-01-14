import React from 'react';
import { useGame } from '../context/GameContext';

function WaitingRoom() {
  const {
    roomId,
    roomState,
    playerId,
    playerPosition,
    isSpectator,
    toggleReady,
    leaveRoom,
    error
  } = useGame();

  if (!roomState) {
    return (
      <div className="waiting-room">
        <div className="spinner"></div>
        <p>Loading room...</p>
      </div>
    );
  }

  const currentPlayer = roomState.players.find(p => p.id === playerId);
  const isReady = currentPlayer?.ready || false;

  const getPositionLabel = (position) => {
    const labels = [
      'Board 1 - White (Team A)',
      'Board 1 - Black (Team B)',
      'Board 2 - White (Team A)',
      'Board 2 - Black (Team B)'
    ];
    return labels[position] || `Position ${position}`;
  };

  const getTeamClass = (position) => {
    return position % 2 === 0 ? 'team-a' : 'team-b';
  };

  return (
    <div className="waiting-room">
      <div className="waiting-container">
        <div className="room-header">
          <h2>Room: {roomId}</h2>
          <button className="btn btn-secondary btn-small" onClick={leaveRoom}>
            Leave
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="share-code">
          <p>Share this code with friends:</p>
          <div className="code-display">
            <span>{roomId}</span>
            <button
              className="btn btn-small"
              onClick={() => navigator.clipboard.writeText(roomId)}
            >
              Copy
            </button>
          </div>
        </div>

        <div className="players-grid">
          <div className="board-section">
            <h3>Board 1</h3>
            <div className="player-slots">
              {[0, 1].map(pos => {
                const player = roomState.players.find(p => p.position === pos);
                return (
                  <div
                    key={pos}
                    className={`player-slot ${getTeamClass(pos)} ${player ? 'filled' : 'empty'}`}
                  >
                    <div className="position-label">{pos === 0 ? 'White' : 'Black'}</div>
                    {player ? (
                      <>
                        <div className="player-name">{player.name}</div>
                        <div className={`ready-status ${player.ready ? 'ready' : ''}`}>
                          {player.ready ? 'Ready' : 'Not Ready'}
                        </div>
                      </>
                    ) : (
                      <div className="waiting-text">Waiting for player...</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="vs-divider">VS</div>

          <div className="board-section">
            <h3>Board 2</h3>
            <div className="player-slots">
              {[3, 2].map(pos => {
                const player = roomState.players.find(p => p.position === pos);
                return (
                  <div
                    key={pos}
                    className={`player-slot ${getTeamClass(pos)} ${player ? 'filled' : 'empty'}`}
                  >
                    <div className="position-label">{pos === 3 ? 'White' : 'Black'}</div>
                    {player ? (
                      <>
                        <div className="player-name">{player.name}</div>
                        <div className={`ready-status ${player.ready ? 'ready' : ''}`}>
                          {player.ready ? 'Ready' : 'Not Ready'}
                        </div>
                      </>
                    ) : (
                      <div className="waiting-text">Waiting for player...</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="team-legend">
          <div className="team-item team-a">
            <span className="team-color"></span>
            Team A (Positions 0 & 2)
          </div>
          <div className="team-item team-b">
            <span className="team-color"></span>
            Team B (Positions 1 & 3)
          </div>
        </div>

        {!isSpectator && (
          <div className="your-position">
            <p>You are: <strong>{getPositionLabel(playerPosition)}</strong></p>
          </div>
        )}

        {isSpectator ? (
          <div className="spectator-notice">
            <p>You are spectating this game</p>
          </div>
        ) : (
          <button
            className={`btn btn-large ${isReady ? 'btn-secondary' : 'btn-primary'}`}
            onClick={toggleReady}
          >
            {isReady ? 'Cancel Ready' : 'Ready'}
          </button>
        )}

        <div className="waiting-info">
          <p>
            {roomState.players.length}/4 players •{' '}
            {roomState.players.filter(p => p.ready).length}/4 ready
          </p>
          {roomState.players.length === 4 && (
            <p className="start-hint">Game will start when all players are ready</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default WaitingRoom;
