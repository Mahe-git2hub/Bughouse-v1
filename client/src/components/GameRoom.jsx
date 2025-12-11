import React, { useState, useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import ChessBoard from './ChessBoard';
import PieceBank from './PieceBank';
import Chat from './Chat';

function GameRoom() {
  const {
    roomId,
    roomState,
    gameState,
    playerPosition,
    isSpectator,
    error,
    gameOver,
    restartGame,
    leaveRoom,
    getPlayerBoard,
    getPlayerColor,
    getPlayerTeam
  } = useGame();

  const [chatCollapsed, setChatCollapsed] = useState(true);
  const mainBoardRef = useRef(null);

  const playerBoard = getPlayerBoard();
  const playerColor = getPlayerColor();
  const playerTeam = getPlayerTeam();

  if (!gameState || !roomState) {
    return (
      <div className="game-room loading">
        <div className="spinner"></div>
        <p>Loading game...</p>
      </div>
    );
  }

  const { boards, pieceBanks } = gameState;

  // Get teammate position
  const getTeammate = (pos) => {
    const teammates = { 0: 2, 1: 3, 2: 0, 3: 1 };
    return teammates[pos];
  };

  // Get which board a player plays on
  const getPlayerBoardIndex = (pos) => {
    return pos < 2 ? 0 : 1;
  };

  // Get player's color by position
  const getColorByPosition = (pos) => {
    return pos % 2 === 0 ? 'w' : 'b';
  };

  // Get player info by position
  const getPlayerByPosition = (pos) => {
    return roomState.players.find(p => p.position === pos);
  };

  const handlePieceSelect = useCallback((pieceType) => {
    if (isSpectator) return;
    if (mainBoardRef.current && mainBoardRef.current.handleBankPieceDrop) {
      mainBoardRef.current.handleBankPieceDrop(pieceType);
    }
  }, [isSpectator]);

  // Calculate board indices and colors
  const myBoardIndex = playerBoard;
  const partnerPosition = getTeammate(playerPosition);
  const partnerBoardIndex = getPlayerBoardIndex(partnerPosition);
  const partnerColor = getColorByPosition(partnerPosition);

  // Get board data
  const myBoard = boards[myBoardIndex]?.board || [];
  const myTurn = boards[myBoardIndex]?.turn;
  const partnerBoard = boards[partnerBoardIndex]?.board || [];
  const partnerTurn = boards[partnerBoardIndex]?.turn;

  // Get player names for display
  const myPlayer = getPlayerByPosition(playerPosition);
  const partnerPlayer = getPlayerByPosition(partnerPosition);

  // Get opponents on my board
  const myOpponentPosition = myBoardIndex === 0
    ? (playerColor === 'w' ? 1 : 0)
    : (playerColor === 'w' ? 3 : 2);
  const myOpponent = getPlayerByPosition(myOpponentPosition);

  // Get partner's opponent
  const partnerOpponentPosition = partnerBoardIndex === 0
    ? (partnerColor === 'w' ? 1 : 0)
    : (partnerColor === 'w' ? 3 : 2);
  const partnerOpponent = getPlayerByPosition(partnerOpponentPosition);

  const isMyTurn = myTurn === playerColor;

  return (
    <div className="game-room">
      <div className="game-header">
        <div className="room-info">
          <span className="room-code">Room: {roomId}</span>
          {!isSpectator && (
            <span className={`team-indicator team-${playerTeam}`}>
              Team {playerTeam}
            </span>
          )}
          {isSpectator && <span className="spectator-badge">Spectating</span>}
        </div>
        <button className="btn btn-secondary btn-small" onClick={leaveRoom}>
          Leave
        </button>
      </div>

      {error && <div className="error-toast">{error}</div>}

      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <h2>Game Over!</h2>
            {gameOver.winner ? (
              <p className={`winner-text team-${gameOver.winner}`}>
                Team {gameOver.winner} Wins!
              </p>
            ) : (
              <p>Draw by {gameOver.reason}</p>
            )}
            <p className="game-over-reason">
              {gameOver.reason === 'checkmate' && `Checkmate on Board ${gameOver.boardIndex + 1}`}
              {gameOver.reason === 'stalemate' && `Stalemate on Board ${gameOver.boardIndex + 1}`}
            </p>
            <div className="game-over-actions">
              <button className="btn btn-primary" onClick={restartGame}>
                Play Again
              </button>
              <button className="btn btn-secondary" onClick={leaveRoom}>
                Leave Room
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="game-content">
        {/* Main Board Section - Player's Board */}
        <div className="main-board-section">
          {/* Opponent info (top) */}
          <div className={`player-bar opponent ${myTurn !== playerColor ? '' : 'active-turn'}`}>
            <span className={`player-color-dot ${playerColor === 'w' ? 'black' : 'white'}`}></span>
            <span className="player-name">{myOpponent?.name || 'Opponent'}</span>
          </div>

          <div className="main-board-container">
            {/* Piece bank on the left */}
            <PieceBank
              playerPosition={playerPosition}
              isOwnBank={true}
              onPieceSelect={handlePieceSelect}
              vertical={true}
            />

            {/* Main chess board */}
            <ChessBoard
              ref={mainBoardRef}
              boardIndex={myBoardIndex}
              board={myBoard}
              isPlayerBoard={!isSpectator}
              playerColor={playerColor}
              currentTurn={myTurn}
              isMainBoard={true}
            />
          </div>

          {/* Player info (bottom) */}
          <div className={`player-bar self ${isMyTurn ? 'active-turn' : ''}`}>
            <span className={`player-color-dot ${playerColor}`}></span>
            <span className="player-name">{myPlayer?.name || 'You'} (You)</span>
          </div>
        </div>

        {/* Partner Board Section */}
        <div className="partner-board-section">
          <div className="partner-header">
            <span className="partner-label">Partner's Board</span>
          </div>

          {/* Partner's opponent (top) */}
          <div className={`player-bar small opponent ${partnerTurn !== partnerColor ? '' : 'active-turn'}`}>
            <span className={`player-color-dot ${partnerColor === 'w' ? 'black' : 'white'}`}></span>
            <span className="player-name">{partnerOpponent?.name || 'Opponent'}</span>
          </div>

          <div className="partner-board-container">
            {/* Partner's chess board */}
            <ChessBoard
              boardIndex={partnerBoardIndex}
              board={partnerBoard}
              isPlayerBoard={false}
              playerColor={partnerColor}
              currentTurn={partnerTurn}
              isMainBoard={false}
            />

            {/* Partner's piece bank */}
            <PieceBank
              playerPosition={partnerPosition}
              isOwnBank={false}
              vertical={true}
            />
          </div>

          {/* Partner info (bottom) */}
          <div className={`player-bar small self ${partnerTurn === partnerColor ? 'active-turn' : ''}`}>
            <span className={`player-color-dot ${partnerColor}`}></span>
            <span className="player-name">{partnerPlayer?.name || 'Partner'}</span>
          </div>
        </div>
      </div>

      <Chat
        isCollapsed={chatCollapsed}
        onToggle={() => setChatCollapsed(!chatCollapsed)}
      />
    </div>
  );
}

export default GameRoom;
