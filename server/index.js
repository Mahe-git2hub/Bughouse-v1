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
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Game rooms storage
const rooms = new Map();
const playerRooms = new Map(); // Maps socket.id to roomId

// Team structure:
// Team A: Player 0 (Board 1, White) + Player 2 (Board 2, White)
// Team B: Player 1 (Board 1, Black) + Player 3 (Board 2, Black)
// When Player 0 captures, piece goes to Player 2's bank
// When Player 1 captures, piece goes to Player 3's bank
// When Player 2 captures, piece goes to Player 0's bank
// When Player 3 captures, piece goes to Player 1's bank

function createRoom(roomId, hostName) {
  return {
    id: roomId,
    players: [], // [{ id, name, ready, socketId }]
    spectators: [],
    gameStarted: false,
    boards: [createGameState(), createGameState()], // Two boards
    pieceBanks: {
      // Banks for each player position
      0: [], // Board 1 White's bank (receives from teammate Player 2)
      1: [], // Board 1 Black's bank (receives from teammate Player 3)
      2: [], // Board 2 White's bank (receives from teammate Player 0)
      3: []  // Board 2 Black's bank (receives from teammate Player 1)
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
  return playerIndex % 2 === 0 ? COLORS.WHITE : COLORS.BLACK;
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
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ playerName }, callback) => {
    const roomId = uuidv4().substring(0, 6).toUpperCase();
    const room = createRoom(roomId, playerName);

    const player = {
      id: uuidv4(),
      name: playerName,
      ready: false,
      socketId: socket.id,
      position: 0
    };

    room.players.push(player);
    rooms.set(roomId, room);
    playerRooms.set(socket.id, roomId);

    socket.join(roomId);

    callback({ success: true, roomId, playerId: player.id, position: 0 });
    broadcastRoomState(roomId);
  });

  socket.on('joinRoom', ({ roomId, playerName }, callback) => {
    const room = rooms.get(roomId);

    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    if (room.players.length >= 4) {
      // Join as spectator
      const spectator = {
        id: uuidv4(),
        name: playerName,
        socketId: socket.id
      };
      room.spectators.push(spectator);
      playerRooms.set(socket.id, roomId);
      socket.join(roomId);

      callback({ success: true, roomId, playerId: spectator.id, isSpectator: true });
      broadcastRoomState(roomId);
      return;
    }

    const player = {
      id: uuidv4(),
      name: playerName,
      ready: false,
      socketId: socket.id,
      position: room.players.length
    };

    room.players.push(player);
    playerRooms.set(socket.id, roomId);
    socket.join(roomId);

    callback({ success: true, roomId, playerId: player.id, position: player.position });
    broadcastRoomState(roomId);

    // Send chat history to new player
    socket.emit('chatHistory', room.chat);
  });

  socket.on('toggleReady', ({ roomId, playerId }) => {
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
    }
  });

  socket.on('getDropSquares', ({ roomId, playerId, pieceType }, callback) => {
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
      message,
      isTeamOnly,
      team: player ? getPlayerTeam(player.position) : null,
      timestamp: Date.now()
    };

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
    handlePlayerLeave(socket, roomId, playerId);
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
  }

  socket.leave(roomId);
  playerRooms.delete(socket.id);
}

// Catch-all route to serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Bughouse server running on port ${PORT}`);
});
