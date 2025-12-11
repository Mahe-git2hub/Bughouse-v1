import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import ChessPiece from './ChessPiece';

const PIECE_SYMBOLS = {
  k: { w: '♔', b: '♚' },
  q: { w: '♕', b: '♛' },
  r: { w: '♖', b: '♜' },
  b: { w: '♗', b: '♝' },
  n: { w: '♘', b: '♞' },
  p: { w: '♙', b: '♟' }
};

function ChessBoard({ boardIndex, board, isPlayerBoard, playerColor, currentTurn }) {
  const { getLegalMoves, makeMove, dropPiece, getDropSquares, playerPosition, gameState } = useGame();
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [dropSquares, setDropSquares] = useState([]);
  const [droppingPiece, setDroppingPiece] = useState(null);
  const [promotionSquare, setPromotionSquare] = useState(null);
  const [draggedPiece, setDraggedPiece] = useState(null);
  const boardRef = useRef(null);

  // Flip board for black players
  const shouldFlip = playerColor === 'b';

  // Check if it's player's turn
  const isMyTurn = isPlayerBoard && currentTurn === playerColor;

  // Clear selection when turn changes or game state updates
  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
    setDropSquares([]);
    setDroppingPiece(null);
  }, [currentTurn, gameState?.boards]);

  const handleSquareClick = useCallback(async (row, col) => {
    if (!isPlayerBoard) return;
    if (promotionSquare) return;

    // If dropping a piece
    if (droppingPiece) {
      const isValidDrop = dropSquares.some(s => s.row === row && s.col === col);
      if (isValidDrop) {
        dropPiece(droppingPiece, row, col);
      }
      setDroppingPiece(null);
      setDropSquares([]);
      return;
    }

    const piece = board[row][col];

    // If a square is already selected
    if (selectedSquare) {
      // Check if clicking on a legal move square
      const isLegalMove = legalMoves.some(m => m.toRow === row && m.toCol === col);

      if (isLegalMove) {
        const selectedPiece = board[selectedSquare.row][selectedSquare.col];

        // Check for pawn promotion
        if (selectedPiece.type === 'p') {
          const promotionRow = playerColor === 'w' ? 0 : 7;
          if (row === promotionRow) {
            setPromotionSquare({ row, col, from: selectedSquare });
            return;
          }
        }

        makeMove(boardIndex, selectedSquare, { row, col });
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // If clicking on own piece, select it
      if (piece && piece.color === playerColor) {
        if (!isMyTurn) {
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }
        const response = await getLegalMoves(boardIndex, row, col);
        setSelectedSquare({ row, col });
        setLegalMoves(response.moves || []);
        return;
      }

      // Clicking elsewhere clears selection
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // No square selected - select if it's own piece and own turn
    if (piece && piece.color === playerColor && isMyTurn) {
      const response = await getLegalMoves(boardIndex, row, col);
      setSelectedSquare({ row, col });
      setLegalMoves(response.moves || []);
    }
  }, [isPlayerBoard, selectedSquare, legalMoves, board, playerColor, isMyTurn, droppingPiece, dropSquares, boardIndex, getLegalMoves, makeMove, dropPiece, promotionSquare]);

  const handlePromotion = (pieceType) => {
    if (!promotionSquare) return;
    makeMove(boardIndex, promotionSquare.from, { row: promotionSquare.row, col: promotionSquare.col }, pieceType);
    setPromotionSquare(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  };

  const handleDragStart = useCallback((e, row, col) => {
    if (!isPlayerBoard || !isMyTurn) return;
    const piece = board[row][col];
    if (!piece || piece.color !== playerColor) return;

    setDraggedPiece({ row, col, piece });
    e.dataTransfer.effectAllowed = 'move';

    // Get legal moves for this piece
    getLegalMoves(boardIndex, row, col).then(response => {
      setLegalMoves(response.moves || []);
    });
  }, [isPlayerBoard, isMyTurn, board, playerColor, boardIndex, getLegalMoves]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, row, col) => {
    e.preventDefault();

    if (droppingPiece) {
      const isValidDrop = dropSquares.some(s => s.row === row && s.col === col);
      if (isValidDrop) {
        dropPiece(droppingPiece, row, col);
      }
      setDroppingPiece(null);
      setDropSquares([]);
      setDraggedPiece(null);
      return;
    }

    if (!draggedPiece) return;

    const isLegalMove = legalMoves.some(m => m.toRow === row && m.toCol === col);
    if (isLegalMove) {
      const selectedPiece = board[draggedPiece.row][draggedPiece.col];

      // Check for pawn promotion
      if (selectedPiece.type === 'p') {
        const promotionRow = playerColor === 'w' ? 0 : 7;
        if (row === promotionRow) {
          setPromotionSquare({ row, col, from: { row: draggedPiece.row, col: draggedPiece.col } });
          setDraggedPiece(null);
          setLegalMoves([]);
          return;
        }
      }

      makeMove(boardIndex, { row: draggedPiece.row, col: draggedPiece.col }, { row, col });
    }

    setDraggedPiece(null);
    setLegalMoves([]);
    setSelectedSquare(null);
  }, [draggedPiece, legalMoves, makeMove, boardIndex, board, playerColor, droppingPiece, dropSquares, dropPiece]);

  const handleDragEnd = useCallback(() => {
    setDraggedPiece(null);
    if (!selectedSquare) {
      setLegalMoves([]);
    }
  }, [selectedSquare]);

  // Handle piece drop from bank
  const handleBankPieceDrop = useCallback(async (pieceType) => {
    if (!isPlayerBoard || !isMyTurn) return;

    const response = await getDropSquares(pieceType);
    setDropSquares(response.squares || []);
    setDroppingPiece(pieceType);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [isPlayerBoard, isMyTurn, getDropSquares]);

  // Expose drop handler to parent
  useEffect(() => {
    if (boardRef.current) {
      boardRef.current.handleBankPieceDrop = handleBankPieceDrop;
    }
  }, [handleBankPieceDrop]);

  const renderSquare = (row, col) => {
    const displayRow = shouldFlip ? 7 - row : row;
    const displayCol = shouldFlip ? 7 - col : col;
    const actualRow = shouldFlip ? 7 - displayRow : displayRow;
    const actualCol = shouldFlip ? 7 - displayCol : displayCol;

    const piece = board[actualRow][actualCol];
    const isLight = (displayRow + displayCol) % 2 === 0;
    const isSelected = selectedSquare?.row === actualRow && selectedSquare?.col === actualCol;
    const isLegalMove = legalMoves.some(m => m.toRow === actualRow && m.toCol === actualCol);
    const isDropSquare = dropSquares.some(s => s.row === actualRow && s.col === actualCol);
    const isCapture = isLegalMove && piece;

    let squareClass = `square ${isLight ? 'light' : 'dark'}`;
    if (isSelected) squareClass += ' selected';
    if (isLegalMove) squareClass += ' legal-move';
    if (isCapture) squareClass += ' capture-move';
    if (isDropSquare) squareClass += ' drop-square';

    return (
      <div
        key={`${displayRow}-${displayCol}`}
        className={squareClass}
        onClick={() => handleSquareClick(actualRow, actualCol)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, actualRow, actualCol)}
      >
        {piece && (
          <ChessPiece
            piece={piece}
            draggable={isPlayerBoard && piece.color === playerColor && isMyTurn}
            onDragStart={(e) => handleDragStart(e, actualRow, actualCol)}
            onDragEnd={handleDragEnd}
          />
        )}
        {isLegalMove && !piece && <div className="move-indicator" />}
        {isDropSquare && <div className="drop-indicator" />}

        {/* Rank and file labels */}
        {displayCol === 0 && (
          <span className="rank-label">{8 - displayRow}</span>
        )}
        {displayRow === 7 && (
          <span className="file-label">{String.fromCharCode(97 + displayCol)}</span>
        )}
      </div>
    );
  };

  const boardClasses = `chess-board ${isPlayerBoard ? 'player-board' : 'opponent-board'} ${isMyTurn ? 'my-turn' : ''}`;

  return (
    <div className="board-wrapper" ref={boardRef}>
      <div className="board-header">
        <span className="board-label">Board {boardIndex + 1}</span>
        <span className={`turn-indicator ${currentTurn === 'w' ? 'white-turn' : 'black-turn'}`}>
          {currentTurn === 'w' ? 'White' : 'Black'}'s turn
        </span>
      </div>
      <div className={boardClasses}>
        {Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => renderSquare(row, col))
        )}
      </div>

      {/* Promotion dialog */}
      {promotionSquare && (
        <div className="promotion-dialog">
          <div className="promotion-options">
            {['q', 'r', 'b', 'n'].map(type => (
              <button
                key={type}
                className="promotion-piece"
                onClick={() => handlePromotion(type)}
              >
                {PIECE_SYMBOLS[type][playerColor]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Check indicator */}
      {gameState?.boards[boardIndex]?.isCheck && (
        <div className="check-indicator">Check!</div>
      )}
    </div>
  );
}

export default ChessBoard;
