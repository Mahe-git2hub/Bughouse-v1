import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

function Lobby() {
  const { connected, createRoom, joinRoom, error } = useGame();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [rooms, setRooms] = useState([]);
  const [view, setView] = useState('main'); // 'main', 'create', 'join'

  useEffect(() => {
    // Fetch available rooms
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        const data = await res.json();
        setRooms(data);
      } catch (err) {
        console.error('Failed to fetch rooms:', err);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      createRoom(playerName.trim());
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (playerName.trim() && roomCode.trim()) {
      joinRoom(roomCode.trim().toUpperCase(), playerName.trim());
    }
  };

  const handleQuickJoin = (roomId) => {
    if (playerName.trim()) {
      joinRoom(roomId, playerName.trim());
    } else {
      setView('join');
      setRoomCode(roomId);
    }
  };

  if (!connected) {
    return (
      <div className="lobby">
        <div className="lobby-container">
          <h1 className="lobby-title">Bughouse Chess</h1>
          <div className="connecting">
            <div className="spinner"></div>
            <p>Connecting to server...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby">
      <div className="lobby-container">
        <h1 className="lobby-title">Bughouse Chess</h1>
        <p className="lobby-subtitle">4-Player Team Chess</p>

        {error && <div className="error-message">{error}</div>}

        {view === 'main' && (
          <>
            <div className="lobby-actions">
              <button
                className="btn btn-primary btn-large"
                onClick={() => setView('create')}
              >
                Create Room
              </button>
              <button
                className="btn btn-secondary btn-large"
                onClick={() => setView('join')}
              >
                Join Room
              </button>
            </div>

            {rooms.length > 0 && (
              <div className="available-rooms">
                <h3>Available Rooms</h3>
                <div className="room-list">
                  {rooms.map(room => (
                    <div key={room.id} className="room-item">
                      <div className="room-info">
                        <span className="room-code">{room.id}</span>
                        <span className="room-host">Host: {room.hostName}</span>
                        <span className="room-players">
                          {room.playerCount}/4 Players
                          {room.gameStarted && ' (In Game)'}
                        </span>
                      </div>
                      <button
                        className="btn btn-small"
                        onClick={() => handleQuickJoin(room.id)}
                        disabled={room.playerCount >= 4 && !room.gameStarted}
                      >
                        {room.playerCount >= 4 ? 'Spectate' : 'Join'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rules-preview">
              <h3>How to Play</h3>
              <ul>
                <li>Two teams of 2 players each</li>
                <li>Each team has one board</li>
                <li>Captured pieces go to your teammate's bank</li>
                <li>Drop pieces from your bank instead of moving</li>
                <li>First checkmate wins for the team!</li>
              </ul>
            </div>
          </>
        )}

        {view === 'create' && (
          <form onSubmit={handleCreateRoom} className="lobby-form">
            <h3>Create New Room</h3>
            <input
              type="text"
              placeholder="Your Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setView('main')}>
                Back
              </button>
              <button type="submit" className="btn btn-primary" disabled={!playerName.trim()}>
                Create
              </button>
            </div>
          </form>
        )}

        {view === 'join' && (
          <form onSubmit={handleJoinRoom} className="lobby-form">
            <h3>Join Room</h3>
            <input
              type="text"
              placeholder="Your Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <input
              type="text"
              placeholder="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setView('main')}>
                Back
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!playerName.trim() || !roomCode.trim()}
              >
                Join
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Lobby;
