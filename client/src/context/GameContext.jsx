import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext(null);

const SOCKET_URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';

export function GameProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [playerPosition, setPlayerPosition] = useState(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [error, setError] = useState(null);
  const [gameOver, setGameOver] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from server');
    });

    newSocket.on('roomState', (state) => {
      setRoomState(state);
    });

    newSocket.on('gameState', (state) => {
      setGameState(state);
    });

    newSocket.on('gameStart', () => {
      setGameOver(null);
    });

    newSocket.on('gameOver', (data) => {
      setGameOver(data);
    });

    newSocket.on('gameRestart', () => {
      setGameOver(null);
    });

    newSocket.on('chatMessage', (message) => {
      setChatMessages(prev => [...prev, message]);
    });

    newSocket.on('chatHistory', (history) => {
      setChatMessages(history);
    });

    newSocket.on('moveError', ({ error }) => {
      setError(error);
      setTimeout(() => setError(null), 3000);
    });

    newSocket.on('playerLeft', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 5000);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const createRoom = useCallback((name) => {
    if (!socket) return;
    setPlayerName(name);
    socket.emit('createRoom', { playerName: name }, (response) => {
      if (response.success) {
        setRoomId(response.roomId);
        setPlayerId(response.playerId);
        setPlayerPosition(response.position);
        setIsSpectator(false);
      } else {
        setError(response.error);
      }
    });
  }, [socket]);

  const joinRoom = useCallback((id, name) => {
    if (!socket) return;
    setPlayerName(name);
    socket.emit('joinRoom', { roomId: id, playerName: name }, (response) => {
      if (response.success) {
        setRoomId(response.roomId);
        setPlayerId(response.playerId);
        setPlayerPosition(response.position);
        setIsSpectator(response.isSpectator || false);
      } else {
        setError(response.error);
      }
    });
  }, [socket]);

  const toggleReady = useCallback(() => {
    if (!socket || !roomId || !playerId) return;
    socket.emit('toggleReady', { roomId, playerId });
  }, [socket, roomId, playerId]);

  const getLegalMoves = useCallback((boardIndex, row, col) => {
    return new Promise((resolve) => {
      if (!socket || !roomId) {
        resolve({ moves: [] });
        return;
      }
      socket.emit('getLegalMoves', { roomId, boardIndex, row, col }, resolve);
    });
  }, [socket, roomId]);

  const makeMove = useCallback((boardIndex, from, to, promotion = null) => {
    if (!socket || !roomId || !playerId) return;
    socket.emit('makeMove', { roomId, playerId, boardIndex, from, to, promotion });
  }, [socket, roomId, playerId]);

  const dropPiece = useCallback((pieceType, row, col) => {
    if (!socket || !roomId || !playerId) return;
    socket.emit('dropPiece', { roomId, playerId, pieceType, row, col });
  }, [socket, roomId, playerId]);

  const getDropSquares = useCallback((pieceType) => {
    return new Promise((resolve) => {
      if (!socket || !roomId || !playerId) {
        resolve({ squares: [] });
        return;
      }
      socket.emit('getDropSquares', { roomId, playerId, pieceType }, resolve);
    });
  }, [socket, roomId, playerId]);

  const sendMessage = useCallback((message, isTeamOnly = false) => {
    if (!socket || !roomId || !playerId) return;
    socket.emit('chatMessage', { roomId, playerId, message, isTeamOnly });
  }, [socket, roomId, playerId]);

  const restartGame = useCallback(() => {
    if (!socket || !roomId) return;
    socket.emit('restartGame', { roomId });
  }, [socket, roomId]);

  const leaveRoom = useCallback(() => {
    if (!socket || !roomId || !playerId) return;
    socket.emit('leaveRoom', { roomId, playerId });
    setRoomId(null);
    setPlayerId(null);
    setPlayerPosition(null);
    setRoomState(null);
    setGameState(null);
    setChatMessages([]);
    setGameOver(null);
    setIsSpectator(false);
  }, [socket, roomId, playerId]);

  const getPlayerBoard = useCallback(() => {
    if (playerPosition === null) return null;
    return playerPosition < 2 ? 0 : 1;
  }, [playerPosition]);

  const getPlayerColor = useCallback(() => {
    if (playerPosition === null) return null;
    // Bughouse: teammates play opposite colors on different boards
    // Board 0: Position 0 = White, Position 1 = Black
    // Board 1: Position 2 = Black, Position 3 = White
    return (playerPosition === 0 || playerPosition === 3) ? 'w' : 'b';
  }, [playerPosition]);

  const getPlayerTeam = useCallback(() => {
    if (playerPosition === null) return null;
    return playerPosition % 2 === 0 ? 'A' : 'B';
  }, [playerPosition]);

  const value = {
    socket,
    connected,
    roomId,
    playerId,
    playerName,
    playerPosition,
    isSpectator,
    roomState,
    gameState,
    chatMessages,
    error,
    gameOver,
    createRoom,
    joinRoom,
    toggleReady,
    getLegalMoves,
    makeMove,
    dropPiece,
    getDropSquares,
    sendMessage,
    restartGame,
    leaveRoom,
    getPlayerBoard,
    getPlayerColor,
    getPlayerTeam
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
