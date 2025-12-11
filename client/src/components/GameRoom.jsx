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
    getPlayerTeam,
    getDropSquares,
    dropPiece
  } = useGame();

  const [chatCollapsed, setChatCollapsed] = useState(true);
  const board1Ref = useRef(null);
  const board2Ref = useRef(null);

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

  // Get player info by position
  const getPlayerByPosition = (pos) => {
    return roomState.players.find(p => p.position === pos);
  };

  const handlePieceSelect = useCallback(async (pieceType) => {
    if (isSpectator) return;

    const boardRef = playerBoard === 0 ? board1Ref : board2Ref;
    if (boardRef.current?.handleBankPieceDrop) {
      boardRef.current.handleBankPieceDrop(pieceType);
    }
  }, [playerBoard, isSpectator]);

  const renderBoardSection = (boardIndex) => {
    const board = boards[boardIndex]?.board || [];
    const currentTurn = boards[boardIndex]?.turn;
    const isPlayerBoard = playerBoard === boardIndex;

    // Positions for this board
    const whitePos = boardIndex === 0 ? 0 : 2;
    const blackPos = boardIndex === 0 ? 1 : 3;

    const whitePlayer = getPlayerByPosition(whitePos);
    const blackPlayer = getPlayerByPosition(blackPos);

    return (
      <div className={`board-section ${isPlayerBoard ? 'player-section' : ''}`}>
        <div className="board-players">
          {/* Top player (opponent from player's perspective or black if spectating) */}
          <div className={`player-info ${currentTurn === 'b' ? 'active-turn' : ''} ${blackPos === playerPosition ? 'is-you' : ''}`}>
            <span className="player-color black"></span>
            <span className="player-name">
              {blackPlayer?.name || 'Waiting...'}
              {blackPos === playerPosition && ' (You)'}
            </span>
            <span className={`team-badge team-${getPlayerTeamByPos(blackPos)}`}>
              Team {getPlayerTeamByPos(blackPos)}
            </span>
          </div>
        </div>

        <div className="board-and-banks">
          {/* Opponent's bank (top) */}
          <PieceBank
            playerPosition={playerColor === 'w' ? blackPos : whitePos}
            isOwnBank={false}
          />

          <ChessBoard
            ref={boardIndex === 0 ? board1Ref : board2Ref}
            boardIndex={boardIndex}
            board={board}
            isPlayerBoard={isPlayerBoard && !isSpectator}
            playerColor={isSpectator ? 'w' : playerColor}
            currentTurn={currentTurn}
          />

          {/* Player's bank (bottom) - only show for player's board */}
          {isPlayerBoard && !isSpectator && (
            <PieceBank
              playerPosition={playerPosition}
              isOwnBank={true}
              onPieceSelect={handlePieceSelect}
            />
          )}
        </div>

        <div className="board-players">
          {/* Bottom player (player's color or white if spectating) */}
          <div className={`player-info ${currentTurn === 'w' ? 'active-turn' : ''} ${whitePos === playerPosition ? 'is-you' : ''}`}>
            <span className="player-color white"></span>
            <span className="player-name">
              {whitePlayer?.name || 'Waiting...'}
              {whitePos === playerPosition && ' (You)'}
            </span>
            <span className={`team-badge team-${getPlayerTeamByPos(whitePos)}`}>
              Team {getPlayerTeamByPos(whitePos)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const getPlayerTeamByPos = (pos) => {
    return pos % 2 === 0 ? 'A' : 'B';
  };

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
        <div className="boards-container">
          {renderBoardSection(0)}
          <div className="boards-divider">
            <div className="vs-badge">VS</div>
          </div>
          {renderBoardSection(1)}
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
