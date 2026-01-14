import React from 'react';

const PIECE_SYMBOLS = {
  k: { w: '♔', b: '♚' },
  q: { w: '♕', b: '♛' },
  r: { w: '♖', b: '♜' },
  b: { w: '♗', b: '♝' },
  n: { w: '♘', b: '♞' },
  p: { w: '♙', b: '♟' }
};

function ChessPiece({ piece, draggable, onDragStart, onDragEnd, onClick }) {
  const symbol = PIECE_SYMBOLS[piece.type]?.[piece.color] || '?';

  return (
    <span
      className={`chess-piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      {symbol}
    </span>
  );
}

export default ChessPiece;
