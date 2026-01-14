import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';

function Chat({ isCollapsed, onToggle }) {
  const { chatMessages, sendMessage, playerId, getPlayerTeam } = useGame();
  const [message, setMessage] = useState('');
  const [isTeamOnly, setIsTeamOnly] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const playerTeam = getPlayerTeam();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage(message.trim(), isTeamOnly);
      setMessage('');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isCollapsed) {
    return (
      <button className="chat-toggle collapsed" onClick={onToggle}>
        <span className="chat-icon">💬</span>
        {chatMessages.length > 0 && (
          <span className="chat-badge">{chatMessages.length}</span>
        )}
      </button>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat</h3>
        <button className="chat-close" onClick={onToggle}>×</button>
      </div>

      <div className="chat-messages">
        {chatMessages.length === 0 ? (
          <div className="chat-empty">No messages yet</div>
        ) : (
          chatMessages.map((msg) => {
            // Filter team messages - only show if it's your team or not team-only
            if (msg.isTeamOnly && msg.team !== playerTeam) {
              return null;
            }

            const isOwnMessage = msg.senderId === playerId;
            return (
              <div
                key={msg.id}
                className={`chat-message ${isOwnMessage ? 'own' : ''} ${msg.isTeamOnly ? 'team-only' : ''}`}
              >
                <div className="message-header">
                  <span className="sender-name">{msg.sender}</span>
                  {msg.isTeamOnly && <span className="team-badge">Team</span>}
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="message-content">{msg.message}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <div className="chat-options">
          <label className="team-toggle">
            <input
              type="checkbox"
              checked={isTeamOnly}
              onChange={(e) => setIsTeamOnly(e.target.checked)}
            />
            <span>Team only</span>
          </label>
        </div>
        <div className="chat-input-row">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isTeamOnly ? "Message team..." : "Message everyone..."}
            maxLength={200}
          />
          <button type="submit" disabled={!message.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

export default Chat;
