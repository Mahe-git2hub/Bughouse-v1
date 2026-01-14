const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  PIECES,
  COLORS,
  createGameState,
  getLegalMoves,
  makeMove,
  dropPiece,
  getValidDropSquares
} = require('./chess');

const app = express();
const server = http.createServer(app);

// Security: Configure allowed origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001', 'http://localhost:5173'];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.) in development
      if (!origin && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      if (!origin || ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"]
  },
  // Security: Limit payload size
  maxHttpBufferSize: 1e5 // 100KB
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Security: Limit JSON payload size
app.use(express.json({ limit: '10kb' }));

// Security: Input validation helpers
function sanitizeString(str, maxLength = 50) {
  if (typeof str !== 'string') return '';
  // Remove HTML tags and trim
  return str.replace(/<[^>]*>/g, '').trim().substring(0, maxLength);
}

function isValidBoardIndex(index) {
  return index === 0 || index === 1;
}

function isValidPosition(row, col) {
  return Number.isInteger(row) && Number.isInteger(col) &&
         row >= 0 && row <= 7 && col >= 0 && col <= 7;
}

function isValidPieceType(type) {
  return ['k', 'q', 'r', 'b', 'n', 'p'].includes(type);
}

// Security: Rate limiting for socket connections
const connectionAttempts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_CONNECTIONS_PER_IP = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const attempts = connectionAttempts.get(ip) || [];
  const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);

  if (recentAttempts.length >= MAX_CONNECTIONS_PER_IP) {
    return false;
  }

  recentAttempts.push(now);
  connectionAttempts.set(ip, recentAttempts);
  return true;
}

// Security: Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  connectionAttempts.forEach((attempts, ip) => {
    const recent = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);
    if (recent.length === 0) {
      connectionAttempts.delete(ip);
    } else {
      connectionAttempts.set(ip, recent);
    }
  });
}, RATE_LIMIT_WINDOW);

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Game rooms storage
const rooms = new Map();
const playerRooms = new Map(); // Maps socket.id to roomId

// Team structure for Bughouse:
// Teammates play OPPOSITE colors on different boards
// Team A: Player 0 (Board 0, White) + Player 2 (Board 1, Black)
// Team B: Player 1 (Board 0, Black) + Player 3 (Board 1, White)
// When Player 0 captures, piece goes to Player 2's bank (teammate)
// When Player 1 captures, piece goes to Player 3's bank (teammate)
// When Player 2 captures, piece goes to Player 0's bank (teammate)
// When Player 3 captures, piece goes to Player 1's bank (teammate)

function createRoom(roomId, hostName) {
  return {
    id: roomId,
    players: [], // [{ id, name, ready, socketId }]
    spectators: [],
    gameStarted: false,
    boards: [createGameState(), createGameState()], // Two boards
    pieceBanks: {
      // Banks for each player position (receives captures from teammate)
      0: [], // Board 0 White's bank (receives from teammate Player 2 - Board 1 Black)
      1: [], // Board 0 Black's bank (receives from teammate Player 3 - Board 1 White)
      2: [], // Board 1 Black's bank (receives from teammate Player 0 - Board 0 White)
      3: []  // Board 1 White's bank (receives from teammate Player 1 - Board 0 Black)
    },
    chat: [],
    createdAt: Date.now(),
    hostName: hostName
  };
}

function getTeammate(playerIndex) {
  // Team A: 0 <-> 2, Team B: 1 <-> 3
  const teammates = { 0: 2, 1: 3, 2: 0, 3: 1 };
  return teammates[playerIndex];
}

function getPlayerBoard(playerIndex) {
  return playerIndex < 2 ? 0 : 1;
}

function getPlayerColor(playerIndex) {
  // Bughouse: teammates play opposite colors on different boards
  // Board 0: Position 0 = White, Position 1 = Black
  // Board 1: Position 2 = Black, Position 3 = White
  // This means: Positions 0,3 are White; Positions 1,2 are Black
  return (playerIndex === 0 || playerIndex === 3) ? COLORS.WHITE : COLORS.BLACK;
}

function getPlayerTeam(playerIndex) {
  return playerIndex % 2 === 0 ? 'A' : 'B';
}

function broadcastRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  io.to(roomId).emit('roomState', {
    id: room.id,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      position: p.position
    })),
    spectators: room.spectators.length,
    gameStarted: room.gameStarted,
    boards: room.boards,
    pieceBanks: room.pieceBanks,
    hostName: room.hostName
  });
}

function broadcastGameState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  io.to(roomId).emit('gameState', {
    boards: room.boards,
    pieceBanks: room.pieceBanks,
    gameStarted: room.gameStarted
  });
}

// API Routes
app.get('/api/rooms', (req, res) => {
  const roomList = [];
  rooms.forEach((room, id) => {
    roomList.push({
      id,
      playerCount: room.players.length,
      spectatorCount: room.spectators.length,
      gameStarted: room.gameStarted,
      hostName: room.hostName
    });
  });
  res.json(roomList);
});

// Socket.io handling
io.on('connection', (socket) => {
  // Security: Rate limit connections
  const clientIp = socket.handshake.address;
  if (!checkRateLimit(clientIp)) {
    socket.emit('error', { message: 'Too many connections. Please try again later.' });
    socket.disconnect(true);
    return;
  }

  console.log('User connected:', socket.id);

  // Security: Store socket's player/room association for validation
  const socketAuth = {
    playerId: null,
    roomId: null
  };

  socket.on('createRoom', ({ playerName }, callback) => {
    if (typeof callback !== 'function') return;

    // Security: Validate and sanitize input
    const sanitizedName = sanitizeString(playerName, 20);
    if (!sanitizedName || sanitizedName.length < 1) {
      callback({ success: false, error: 'Invalid player name' });
      return;
    }

    // Security: Prevent creating multiple rooms
    if (socketAuth.roomId) {
      callback({ success: false, error: 'Already in a room' });
      return;
    }

    const roomId = uuidv4().substring(0, 6).toUpperCase();
    const room = createRoom(roomId, sanitizedName);

    const player = {
      id: uuidv4(),
      name: sanitizedName,
      ready: false,
      socketId: socket.id,
      position: 0
    };

    room.players.push(player);
    rooms.set(roomId, room);
    playerRooms.set(socket.id, roomId);

    // Security: Store auth info
    socketAuth.playerId = player.id;
    socketAuth.roomId = roomId;

    socket.join(roomId);

    callback({ success: true, roomId, playerId: player.id, position: 0 });
    broadcastRoomState(roomId);
  });

  socket.on('joinRoom', ({ roomId, playerName }, callback) => {
    if (typeof callback !== 'function') return;

    // Security: Validate and sanitize input
    const sanitizedName = sanitizeString(playerName, 20);
    const sanitizedRoomId = sanitizeString(roomId, 6).toUpperCase();

    if (!sanitizedName || sanitizedName.length < 1) {
      callback({ success: false, error: 'Invalid player name' });
      return;
    }

    if (!sanitizedRoomId || sanitizedRoomId.length !== 6) {
      callback({ success: false, error: 'Invalid room code' });
      return;
    }

    // Security: Prevent joining multiple rooms
    if (socketAuth.roomId) {
      callback({ success: false, error: 'Already in a room' });
      return;
    }

    const room = rooms.get(sanitizedRoomId);

    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    if (room.players.length >= 4) {
      // Join as spectator
      const spectator = {
        id: uuidv4(),
        name: sanitizedName,
        socketId: socket.id
      };
      room.spectators.push(spectator);
      playerRooms.set(socket.id, sanitizedRoomId);

      // Security: Store auth info
      socketAuth.playerId = spectator.id;
      socketAuth.roomId = sanitizedRoomId;

      socket.join(sanitizedRoomId);

      callback({ success: true, roomId: sanitizedRoomId, playerId: spectator.id, isSpectator: true });
      broadcastRoomState(sanitizedRoomId);
      return;
    }

    const player = {
      id: uuidv4(),
      name: sanitizedName,
      ready: false,
      socketId: socket.id,
      position: room.players.length
    };

    room.players.push(player);
    playerRooms.set(socket.id, sanitizedRoomId);

    // Security: Store auth info
    socketAuth.playerId = player.id;
    socketAuth.roomId = sanitizedRoomId;

    socket.join(sanitizedRoomId);

    callback({ success: true, roomId: sanitizedRoomId, playerId: player.id, position: player.position });
    broadcastRoomState(sanitizedRoomId);

    // Send chat history to new player (limit to last 50 messages)
    socket.emit('chatHistory', room.chat.slice(-50));
  });

  socket.on('toggleReady', ({ roomId, playerId }) => {
    // Security: Validate against socket's auth
    if (socketAuth.roomId !== roomId || socketAuth.playerId !== playerId) {
      return;
    }

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.ready = !player.ready;
      broadcastRoomState(roomId);

      // Check if all 4 players are ready
      if (room.players.length === 4 && room.players.every(p => p.ready)) {
        room.gameStarted = true;
        io.to(roomId).emit('gameStart');
        broadcastGameState(roomId);
      }
    }
  });

  socket.on('getLegalMoves', ({ roomId, boardIndex, row, col }, callback) => {
    if (typeof callback !== 'function') return;

    // Security: Validate input
    if (!isValidBoardIndex(boardIndex) || !isValidPosition(row, col)) {
      callback({ moves: [] });
      return;
    }

    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) {
      callback({ moves: [] });
      return;
    }

    const gameState = room.boards[boardIndex];
    const moves = getLegalMoves(gameState, row, col);
    callback({ moves });
  });

  socket.on('makeMove', ({ roomId, playerId, boardIndex, from, to, promotion }) => {
    // Security: Validate against socket's auth
    if (socketAuth.roomId !== roomId || socketAuth.playerId !== playerId) {
      return;
    }

    // Security: Validate input
    if (!isValidBoardIndex(boardIndex)) {
      socket.emit('moveError', { error: 'Invalid board' });
      return;
    }

    if (!from || !to || !isValidPosition(from.row, from.col) || !isValidPosition(to.row, to.col)) {
      socket.emit('moveError', { error: 'Invalid position' });
      return;
    }

    // Security: Validate promotion piece if provided
    if (promotion && !isValidPieceType(promotion)) {
      socket.emit('moveError', { error: 'Invalid promotion piece' });
      return;
    }

    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    const expectedBoard = getPlayerBoard(player.position);
    const expectedColor = getPlayerColor(player.position);

    if (boardIndex !== expectedBoard) {
      socket.emit('moveError', { error: 'Wrong board' });
      return;
    }

    const gameState = room.boards[boardIndex];
    if (gameState.turn !== expectedColor) {
      socket.emit('moveError', { error: 'Not your turn' });
      return;
    }

    const result = makeMove(gameState, from.row, from.col, to.row, to.col, promotion);

    if (!result.success) {
      socket.emit('moveError', { error: result.error });
      return;
    }

    room.boards[boardIndex] = result.gameState;

    // Transfer captured piece to teammate's bank
    if (result.capturedPiece) {
      const teammate = getTeammate(player.position);
      // Convert piece color to teammate's color
      const newPiece = {
        type: result.capturedPiece.type,
        color: getPlayerColor(teammate)
      };
      room.pieceBanks[teammate].push(newPiece);
    }

    broadcastGameState(roomId);

    // Check for game over
    if (result.gameState.isCheckmate) {
      const winningTeam = getPlayerTeam(player.position);
      io.to(roomId).emit('gameOver', {
        winner: winningTeam,
        reason: 'checkmate',
        boardIndex: boardIndex
      });
    } else if (result.gameState.isStalemate) {
      io.to(roomId).emit('gameOver', {
        winner: null,
        reason: 'stalemate',
        boardIndex: boardIndex
      });
    }
  });

  socket.on('dropPiece', ({ roomId, playerId, pieceType, row, col }) => {
    // Security: Validate against socket's auth
    if (socketAuth.roomId !== roomId || socketAuth.playerId !== playerId) {
      return;
    }

    // Security: Validate input
    if (!isValidPieceType(pieceType) || !isValidPosition(row, col)) {
      socket.emit('moveError', { error: 'Invalid input' });
      return;
    }

    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    const boardIndex = getPlayerBoard(player.position);
    const playerColor = getPlayerColor(player.position);
    const gameState = room.boards[boardIndex];

    if (gameState.turn !== playerColor) {
      socket.emit('moveError', { error: 'Not your turn' });
      return;
    }

    // Check if piece is in player's bank
    const bank = room.pieceBanks[player.position];
    const pieceIndex = bank.findIndex(p => p.type === pieceType && p.color === playerColor);

    if (pieceIndex === -1) {
      socket.emit('moveError', { error: 'Piece not in bank' });
      return;
    }

    const result = dropPiece(gameState, pieceType, row, col, playerColor);

    if (!result.success) {
      socket.emit('moveError', { error: result.error });
      return;
    }

    // Remove piece from bank
    bank.splice(pieceIndex, 1);
    room.boards[boardIndex] = result.gameState;

    broadcastGameState(roomId);

    // Check for game over
    if (result.gameState.isCheckmate) {
      const winningTeam = getPlayerTeam(player.position);
      io.to(roomId).emit('gameOver', {
        winner: winningTeam,
        reason: 'checkmate',
        boardIndex: boardIndex
      });
    } else if (result.gameState.isStalemate) {
      io.to(roomId).emit('gameOver', {
        winner: null,
        reason: 'stalemate',
        boardIndex: boardIndex
      });
    }
  });

  socket.on('getDropSquares', ({ roomId, playerId, pieceType }, callback) => {
    if (typeof callback !== 'function') return;

    // Security: Validate against socket's auth
    if (socketAuth.roomId !== roomId || socketAuth.playerId !== playerId) {
      callback({ squares: [] });
      return;
    }

    // Security: Validate input
    if (!isValidPieceType(pieceType)) {
      callback({ squares: [] });
      return;
    }

    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) {
      callback({ squares: [] });
      return;
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      callback({ squares: [] });
      return;
    }

    const boardIndex = getPlayerBoard(player.position);
    const playerColor = getPlayerColor(player.position);
    const gameState = room.boards[boardIndex];

    const squares = getValidDropSquares(gameState.board, pieceType, playerColor);
    callback({ squares });
  });

  socket.on('chatMessage', ({ roomId, playerId, message, isTeamOnly }) => {
    // Security: Validate against socket's auth
    if (socketAuth.roomId !== roomId || socketAuth.playerId !== playerId) {
      return;
    }

    // Security: Validate and sanitize message
    const sanitizedMessage = sanitizeString(message, 200);
    if (!sanitizedMessage || sanitizedMessage.length < 1) {
      return;
    }

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    const spectator = room.spectators.find(s => s.id === playerId);
    const sender = player || spectator;

    if (!sender) return;

    const chatMessage = {
      id: uuidv4(),
      sender: sender.name,
      senderId: sender.id,
      message: sanitizedMessage,
      isTeamOnly: Boolean(isTeamOnly),
      team: player ? getPlayerTeam(player.position) : null,
      timestamp: Date.now()
    };

    // Security: Limit chat history to prevent memory issues
    if (room.chat.length > 200) {
      room.chat = room.chat.slice(-100);
    }
    room.chat.push(chatMessage);

    if (isTeamOnly && player) {
      // Send only to team members
      const team = getPlayerTeam(player.position);
      room.players.forEach(p => {
        if (getPlayerTeam(p.position) === team) {
          io.to(p.socketId).emit('chatMessage', chatMessage);
        }
      });
    } else {
      io.to(roomId).emit('chatMessage', chatMessage);
    }
  });

  socket.on('restartGame', ({ roomId }) => {
    // Security: Validate against socket's auth
    if (socketAuth.roomId !== roomId) {
      return;
    }

    const room = rooms.get(roomId);
    if (!room) return;

    // Reset game state
    room.boards = [createGameState(), createGameState()];
    room.pieceBanks = { 0: [], 1: [], 2: [], 3: [] };
    room.gameStarted = false;
    room.players.forEach(p => p.ready = false);

    io.to(roomId).emit('gameRestart');
    broadcastRoomState(roomId);
  });

  socket.on('leaveRoom', ({ roomId, playerId }) => {
    // Security: Validate against socket's auth
    if (socketAuth.roomId !== roomId || socketAuth.playerId !== playerId) {
      return;
    }

    handlePlayerLeave(socket, roomId, playerId);
    socketAuth.roomId = null;
    socketAuth.playerId = null;
  });

  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find(p => p.socketId === socket.id);
        const spectator = room.spectators.find(s => s.socketId === socket.id);
        if (player) {
          handlePlayerLeave(socket, roomId, player.id);
        } else if (spectator) {
          room.spectators = room.spectators.filter(s => s.socketId !== socket.id);
          broadcastRoomState(roomId);
        }
      }
      playerRooms.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

function handlePlayerLeave(socket, roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex !== -1) {
    room.players.splice(playerIndex, 1);

    // Reassign positions
    room.players.forEach((p, idx) => p.position = idx);

    if (room.players.length === 0) {
      rooms.delete(roomId);
    } else {
      // If game was started, end it
      if (room.gameStarted) {
        room.gameStarted = false;
        room.boards = [createGameState(), createGameState()];
        room.pieceBanks = { 0: [], 1: [], 2: [], 3: [] };
        room.players.forEach(p => p.ready = false);
        io.to(roomId).emit('playerLeft', { message: 'A player left. Game reset.' });
      }
      broadcastRoomState(roomId);
    }
  } else {
    const spectatorIndex = room.spectators.findIndex(s => s.id === playerId);
    if (spectatorIndex !== -1) {
      room.spectators.splice(spectatorIndex, 1);
      broadcastRoomState(roomId);
    }
  }

  socket.leave(roomId);
  playerRooms.delete(socket.id);
}

// Catch-all route to serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Security: Clean up abandoned rooms periodically (every 5 minutes)
const ROOM_TIMEOUT = 30 * 60 * 1000; // 30 minutes
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, roomId) => {
    // Remove rooms older than 30 minutes with no active players
    if (room.players.length === 0 && now - room.createdAt > ROOM_TIMEOUT) {
      rooms.delete(roomId);
      console.log(`Cleaned up abandoned room: ${roomId}`);
    }
    // Also clean up rooms that have been inactive for too long
    // (players still listed but likely disconnected without proper cleanup)
    if (now - room.createdAt > ROOM_TIMEOUT * 2) {
      rooms.delete(roomId);
      console.log(`Cleaned up stale room: ${roomId}`);
    }
  });
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Bughouse server running on port ${PORT}`);
});
