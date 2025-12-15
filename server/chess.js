// Chess game logic for Bughouse
const PIECES = {
  KING: 'k',
  QUEEN: 'q',
  ROOK: 'r',
  BISHOP: 'b',
  KNIGHT: 'n',
  PAWN: 'p'
};

const COLORS = {
  WHITE: 'w',
  BLACK: 'b'
};

// Initial board setup
function createInitialBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));

  // Set up pawns
  for (let i = 0; i < 8; i++) {
    board[1][i] = { type: PIECES.PAWN, color: COLORS.BLACK };
    board[6][i] = { type: PIECES.PAWN, color: COLORS.WHITE };
  }

  // Set up back ranks
  const backRank = [PIECES.ROOK, PIECES.KNIGHT, PIECES.BISHOP, PIECES.QUEEN, PIECES.KING, PIECES.BISHOP, PIECES.KNIGHT, PIECES.ROOK];
  for (let i = 0; i < 8; i++) {
    board[0][i] = { type: backRank[i], color: COLORS.BLACK };
    board[7][i] = { type: backRank[i], color: COLORS.WHITE };
  }

  return board;
}

function createGameState() {
  return {
    board: createInitialBoard(),
    turn: COLORS.WHITE,
    castlingRights: {
      [COLORS.WHITE]: { kingSide: true, queenSide: true },
      [COLORS.BLACK]: { kingSide: true, queenSide: true }
    },
    enPassantTarget: null,
    moveHistory: [],
    capturedPieces: [], // Pieces captured go to teammate's bank
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    winner: null
  };
}

function cloneBoard(board) {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

function getPieceAt(board, row, col) {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  return board[row][col];
}

function isValidPosition(row, col) {
  return row >= 0 && row <= 7 && col >= 0 && col <= 7;
}

function findKing(board, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECES.KING && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

function isSquareAttacked(board, row, col, byColor) {
  // Check pawn attacks
  const pawnDir = byColor === COLORS.WHITE ? 1 : -1;
  const pawnAttacks = [
    { row: row + pawnDir, col: col - 1 },
    { row: row + pawnDir, col: col + 1 }
  ];
  for (const pos of pawnAttacks) {
    if (isValidPosition(pos.row, pos.col)) {
      const piece = board[pos.row][pos.col];
      if (piece && piece.type === PIECES.PAWN && piece.color === byColor) {
        return true;
      }
    }
  }

  // Check knight attacks
  const knightMoves = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  for (const [dr, dc] of knightMoves) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (isValidPosition(newRow, newCol)) {
      const piece = board[newRow][newCol];
      if (piece && piece.type === PIECES.KNIGHT && piece.color === byColor) {
        return true;
      }
    }
  }

  // Check king attacks (for adjacent squares)
  const kingMoves = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  for (const [dr, dc] of kingMoves) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (isValidPosition(newRow, newCol)) {
      const piece = board[newRow][newCol];
      if (piece && piece.type === PIECES.KING && piece.color === byColor) {
        return true;
      }
    }
  }

  // Check rook/queen attacks (straight lines)
  const straightDirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dr, dc] of straightDirs) {
    let newRow = row + dr;
    let newCol = col + dc;
    while (isValidPosition(newRow, newCol)) {
      const piece = board[newRow][newCol];
      if (piece) {
        if (piece.color === byColor && (piece.type === PIECES.ROOK || piece.type === PIECES.QUEEN)) {
          return true;
        }
        break;
      }
      newRow += dr;
      newCol += dc;
    }
  }

  // Check bishop/queen attacks (diagonals)
  const diagDirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [dr, dc] of diagDirs) {
    let newRow = row + dr;
    let newCol = col + dc;
    while (isValidPosition(newRow, newCol)) {
      const piece = board[newRow][newCol];
      if (piece) {
        if (piece.color === byColor && (piece.type === PIECES.BISHOP || piece.type === PIECES.QUEEN)) {
          return true;
        }
        break;
      }
      newRow += dr;
      newCol += dc;
    }
  }

  return false;
}

function isInCheck(board, color) {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  return isSquareAttacked(board, kingPos.row, kingPos.col, enemyColor);
}

function getPawnMoves(board, row, col, color, enPassantTarget) {
  const moves = [];
  const direction = color === COLORS.WHITE ? -1 : 1;
  const startRow = color === COLORS.WHITE ? 6 : 1;

  // Forward move
  const newRow = row + direction;
  if (isValidPosition(newRow, col) && !board[newRow][col]) {
    moves.push({ toRow: newRow, toCol: col });

    // Double move from start
    if (row === startRow) {
      const doubleRow = row + 2 * direction;
      if (!board[doubleRow][col]) {
        moves.push({ toRow: doubleRow, toCol: col });
      }
    }
  }

  // Captures
  for (const dc of [-1, 1]) {
    const captureCol = col + dc;
    if (isValidPosition(newRow, captureCol)) {
      const target = board[newRow][captureCol];
      if (target && target.color !== color) {
        moves.push({ toRow: newRow, toCol: captureCol, capture: true });
      }
      // En passant
      if (enPassantTarget && enPassantTarget.row === newRow && enPassantTarget.col === captureCol) {
        moves.push({ toRow: newRow, toCol: captureCol, enPassant: true });
      }
    }
  }

  return moves;
}

function getRookMoves(board, row, col, color) {
  const moves = [];
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (const [dr, dc] of directions) {
    let newRow = row + dr;
    let newCol = col + dc;
    while (isValidPosition(newRow, newCol)) {
      const piece = board[newRow][newCol];
      if (!piece) {
        moves.push({ toRow: newRow, toCol: newCol });
      } else {
        if (piece.color !== color) {
          moves.push({ toRow: newRow, toCol: newCol, capture: true });
        }
        break;
      }
      newRow += dr;
      newCol += dc;
    }
  }

  return moves;
}

function getBishopMoves(board, row, col, color) {
  const moves = [];
  const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  for (const [dr, dc] of directions) {
    let newRow = row + dr;
    let newCol = col + dc;
    while (isValidPosition(newRow, newCol)) {
      const piece = board[newRow][newCol];
      if (!piece) {
        moves.push({ toRow: newRow, toCol: newCol });
      } else {
        if (piece.color !== color) {
          moves.push({ toRow: newRow, toCol: newCol, capture: true });
        }
        break;
      }
      newRow += dr;
      newCol += dc;
    }
  }

  return moves;
}

function getKnightMoves(board, row, col, color) {
  const moves = [];
  const offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];

  for (const [dr, dc] of offsets) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (isValidPosition(newRow, newCol)) {
      const piece = board[newRow][newCol];
      if (!piece || piece.color !== color) {
        moves.push({ toRow: newRow, toCol: newCol, capture: !!piece });
      }
    }
  }

  return moves;
}

function getQueenMoves(board, row, col, color) {
  return [...getRookMoves(board, row, col, color), ...getBishopMoves(board, row, col, color)];
}

function getKingMoves(board, row, col, color, castlingRights) {
  const moves = [];
  const offsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];

  for (const [dr, dc] of offsets) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (isValidPosition(newRow, newCol)) {
      const piece = board[newRow][newCol];
      if (!piece || piece.color !== color) {
        moves.push({ toRow: newRow, toCol: newCol, capture: !!piece });
      }
    }
  }

  // Castling
  const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  if (castlingRights && !isSquareAttacked(board, row, col, enemyColor)) {
    // King side castling
    if (castlingRights.kingSide) {
      if (!board[row][5] && !board[row][6] &&
          !isSquareAttacked(board, row, 5, enemyColor) &&
          !isSquareAttacked(board, row, 6, enemyColor)) {
        moves.push({ toRow: row, toCol: 6, castling: 'kingSide' });
      }
    }
    // Queen side castling
    if (castlingRights.queenSide) {
      if (!board[row][1] && !board[row][2] && !board[row][3] &&
          !isSquareAttacked(board, row, 2, enemyColor) &&
          !isSquareAttacked(board, row, 3, enemyColor)) {
        moves.push({ toRow: row, toCol: 2, castling: 'queenSide' });
      }
    }
  }

  return moves;
}

function getPseudoLegalMoves(board, row, col, gameState) {
  const piece = board[row][col];
  if (!piece) return [];

  const { color, type } = piece;

  switch (type) {
    case PIECES.PAWN:
      return getPawnMoves(board, row, col, color, gameState.enPassantTarget);
    case PIECES.ROOK:
      return getRookMoves(board, row, col, color);
    case PIECES.BISHOP:
      return getBishopMoves(board, row, col, color);
    case PIECES.KNIGHT:
      return getKnightMoves(board, row, col, color);
    case PIECES.QUEEN:
      return getQueenMoves(board, row, col, color);
    case PIECES.KING:
      return getKingMoves(board, row, col, color, gameState.castlingRights[color]);
    default:
      return [];
  }
}

function getLegalMoves(gameState, row, col) {
  const { board } = gameState;
  const piece = board[row][col];
  if (!piece) return [];

  const pseudoMoves = getPseudoLegalMoves(board, row, col, gameState);
  const legalMoves = [];

  for (const move of pseudoMoves) {
    // Make the move on a copy of the board
    const testBoard = cloneBoard(board);
    testBoard[move.toRow][move.toCol] = piece;
    testBoard[row][col] = null;

    // Handle en passant capture
    if (move.enPassant) {
      const capturedPawnRow = piece.color === COLORS.WHITE ? move.toRow + 1 : move.toRow - 1;
      testBoard[capturedPawnRow][move.toCol] = null;
    }

    // Handle castling - move the rook
    if (move.castling) {
      if (move.castling === 'kingSide') {
        testBoard[move.toRow][5] = testBoard[move.toRow][7];
        testBoard[move.toRow][7] = null;
      } else {
        testBoard[move.toRow][3] = testBoard[move.toRow][0];
        testBoard[move.toRow][0] = null;
      }
    }

    // Check if king is in check after move
    if (!isInCheck(testBoard, piece.color)) {
      legalMoves.push(move);
    }
  }

  return legalMoves;
}

function makeMove(gameState, fromRow, fromCol, toRow, toCol, promotion = null) {
  const { board, turn } = gameState;
  const piece = board[fromRow][fromCol];

  if (!piece || piece.color !== turn) {
    return { success: false, error: 'Invalid piece or not your turn' };
  }

  const legalMoves = getLegalMoves(gameState, fromRow, fromCol);
  const move = legalMoves.find(m => m.toRow === toRow && m.toCol === toCol);

  if (!move) {
    return { success: false, error: 'Illegal move' };
  }

  const newBoard = cloneBoard(board);
  let capturedPiece = null;

  // Handle capture
  if (move.capture || newBoard[toRow][toCol]) {
    capturedPiece = newBoard[toRow][toCol];
  }

  // Handle en passant
  if (move.enPassant) {
    const capturedPawnRow = piece.color === COLORS.WHITE ? toRow + 1 : toRow - 1;
    capturedPiece = newBoard[capturedPawnRow][toCol];
    newBoard[capturedPawnRow][toCol] = null;
  }

  // Move piece
  newBoard[toRow][toCol] = { ...piece };
  newBoard[fromRow][fromCol] = null;

  // Handle pawn promotion
  if (piece.type === PIECES.PAWN) {
    const promotionRow = piece.color === COLORS.WHITE ? 0 : 7;
    if (toRow === promotionRow) {
      newBoard[toRow][toCol].type = promotion || PIECES.QUEEN;
    }
  }

  // Handle castling
  if (move.castling) {
    if (move.castling === 'kingSide') {
      newBoard[toRow][5] = newBoard[toRow][7];
      newBoard[toRow][7] = null;
    } else {
      newBoard[toRow][3] = newBoard[toRow][0];
      newBoard[toRow][0] = null;
    }
  }

  // Update castling rights
  const newCastlingRights = JSON.parse(JSON.stringify(gameState.castlingRights));
  if (piece.type === PIECES.KING) {
    newCastlingRights[piece.color].kingSide = false;
    newCastlingRights[piece.color].queenSide = false;
  }
  if (piece.type === PIECES.ROOK) {
    if (fromCol === 0) newCastlingRights[piece.color].queenSide = false;
    if (fromCol === 7) newCastlingRights[piece.color].kingSide = false;
  }
  // If rook captured
  if (capturedPiece && capturedPiece.type === PIECES.ROOK) {
    const capturedColor = capturedPiece.color;
    if (toCol === 0) newCastlingRights[capturedColor].queenSide = false;
    if (toCol === 7) newCastlingRights[capturedColor].kingSide = false;
  }

  // Update en passant target
  let newEnPassantTarget = null;
  if (piece.type === PIECES.PAWN && Math.abs(toRow - fromRow) === 2) {
    newEnPassantTarget = {
      row: (fromRow + toRow) / 2,
      col: fromCol
    };
  }

  const nextTurn = turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

  const newGameState = {
    ...gameState,
    board: newBoard,
    turn: nextTurn,
    castlingRights: newCastlingRights,
    enPassantTarget: newEnPassantTarget,
    moveHistory: [...gameState.moveHistory, {
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece: piece,
      captured: capturedPiece,
      castling: move.castling,
      enPassant: move.enPassant,
      promotion: promotion
    }],
    // Reset game-over flags - they will be recalculated below
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    winner: null
  };

  // Check for check/checkmate/stalemate
  newGameState.isCheck = isInCheck(newBoard, nextTurn);

  // Check if game is over
  let hasLegalMoves = false;
  for (let r = 0; r < 8 && !hasLegalMoves; r++) {
    for (let c = 0; c < 8 && !hasLegalMoves; c++) {
      const p = newBoard[r][c];
      if (p && p.color === nextTurn) {
        const moves = getLegalMoves(newGameState, r, c);
        if (moves.length > 0) hasLegalMoves = true;
      }
    }
  }

  if (!hasLegalMoves) {
    if (newGameState.isCheck) {
      newGameState.isCheckmate = true;
      newGameState.winner = turn;
    } else {
      newGameState.isStalemate = true;
    }
  }

  return {
    success: true,
    gameState: newGameState,
    capturedPiece: capturedPiece
  };
}

// Bughouse-specific: Drop a piece from bank onto the board
function canDropPiece(board, pieceType, row, col, color) {
  // Cannot drop on occupied square
  if (board[row][col]) return false;

  // Cannot drop pawns on first or last rank
  if (pieceType === PIECES.PAWN && (row === 0 || row === 7)) {
    return false;
  }

  return true;
}

function dropPiece(gameState, pieceType, row, col, color) {
  if (gameState.turn !== color) {
    return { success: false, error: 'Not your turn' };
  }

  if (!canDropPiece(gameState.board, pieceType, row, col, color)) {
    return { success: false, error: 'Cannot drop piece there' };
  }

  const newBoard = cloneBoard(gameState.board);
  newBoard[row][col] = { type: pieceType, color: color };

  // Check if drop puts own king in check (illegal)
  if (isInCheck(newBoard, color)) {
    return { success: false, error: 'Cannot drop piece - would be in check' };
  }

  const nextTurn = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

  const newGameState = {
    ...gameState,
    board: newBoard,
    turn: nextTurn,
    enPassantTarget: null,
    moveHistory: [...gameState.moveHistory, {
      drop: true,
      pieceType: pieceType,
      to: { row, col },
      color: color
    }],
    // Reset game-over flags - they will be recalculated below
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    winner: null
  };

  // Check for check/checkmate/stalemate
  newGameState.isCheck = isInCheck(newBoard, nextTurn);

  // Check if game is over
  let hasLegalMoves = false;
  for (let r = 0; r < 8 && !hasLegalMoves; r++) {
    for (let c = 0; c < 8 && !hasLegalMoves; c++) {
      const p = newBoard[r][c];
      if (p && p.color === nextTurn) {
        const moves = getLegalMoves(newGameState, r, c);
        if (moves.length > 0) hasLegalMoves = true;
      }
    }
  }

  if (!hasLegalMoves) {
    if (newGameState.isCheck) {
      newGameState.isCheckmate = true;
      newGameState.winner = color;
    } else {
      newGameState.isStalemate = true;
    }
  }

  return {
    success: true,
    gameState: newGameState
  };
}

function getValidDropSquares(board, pieceType, color) {
  const validSquares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (canDropPiece(board, pieceType, row, col, color)) {
        // Also check if drop would leave own king in check
        const testBoard = cloneBoard(board);
        testBoard[row][col] = { type: pieceType, color: color };
        if (!isInCheck(testBoard, color)) {
          validSquares.push({ row, col });
        }
      }
    }
  }
  return validSquares;
}

module.exports = {
  PIECES,
  COLORS,
  createGameState,
  createInitialBoard,
  cloneBoard,
  getLegalMoves,
  makeMove,
  dropPiece,
  getValidDropSquares,
  isInCheck,
  canDropPiece
};
