import React from 'react';
import { useGame } from '../context/GameContext';

const PIECE_SYMBOLS = {
  k: { w: '♔', b: '♚' },
  q: { w: '♕', b: '♛' },
  r: { w: '♖', b: '♜' },
  b: { w: '♗', b: '♝' },
  n: { w: '♘', b: '♞' },
  p: { w: '♙', b: '♟' }
};

const PIECE_ORDER = ['q', 'r', 'b', 'n', 'p'];

function PieceBank({ playerPosition, isOwnBank, onPieceSelect }) {
  const { gameState, getPlayerColor } = useGame();

  if (!gameState) return null;

  const bank = gameState.pieceBanks[playerPosition] || [];
  const playerColor = playerPosition % 2 === 0 ? 'w' : 'b';

  // Group pieces by type
  const groupedPieces = PIECE_ORDER.reduce((acc, type) => {
    acc[type] = bank.filter(p => p.type === type).length;
    return acc;
  }, {});

  const handlePieceClick = (pieceType) => {
    if (isOwnBank && onPieceSelect) {
      onPieceSelect(pieceType);
    }
  };

  const handleDragStart = (e, pieceType) => {
    if (!isOwnBank) return;
    e.dataTransfer.setData('pieceType', pieceType);
    e.dataTransfer.effectAllowed = 'move';
    if (onPieceSelect) {
      onPieceSelect(pieceType);
    }
  };

  return (
    <div className={`piece-bank ${isOwnBank ? 'own-bank' : 'opponent-bank'}`}>
      <div className="bank-label">
        {isOwnBank ? 'Your Bank' : 'Bank'}
      </div>
      <div className="bank-pieces">
        {PIECE_ORDER.map(type => {
          const count = groupedPieces[type];
          if (count === 0) return null;

          return (
            <div
              key={type}
              className={`bank-piece ${isOwnBank ? 'clickable' : ''}`}
              onClick={() => handlePieceClick(type)}
              draggable={isOwnBank}
              onDragStart={(e) => handleDragStart(e, type)}
            >
              <span className={`piece-symbol ${playerColor === 'w' ? 'white-piece' : 'black-piece'}`}>
                {PIECE_SYMBOLS[type][playerColor]}
              </span>
              {count > 1 && <span className="piece-count">×{count}</span>}
            </div>
          );
        })}
        {bank.length === 0 && (
          <div className="empty-bank">Empty</div>
        )}
      </div>
    </div>
  );
}

export default PieceBank;
