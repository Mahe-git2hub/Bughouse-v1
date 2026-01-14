# Bughouse Chess

A complete, self-hostable 4-player Chess Bughouse web application built with React and Node.js.

## What is Bughouse?

Bughouse is a popular chess variant where two teams of 2 players each compete on separate boards simultaneously:

- **Team A**: Player 1 (Board 1, White) + Player 3 (Board 2, White)
- **Team B**: Player 2 (Board 1, Black) + Player 4 (Board 2, Black)

When a piece is captured on one board, it goes to the teammate's "piece bank" and can be dropped onto their board instead of making a normal move. The first team to achieve checkmate on either board wins!

## Features

### Core Game Features
- Two interactive chess boards with full chess rules
- Piece banks - captured pieces are transferred to teammates
- Drop pieces from your bank onto the board
- Legal move validation and check/checkmate detection
- Turn-based gameplay with clear visual indicators

### Multiplayer
- Real-time WebSocket communication via Socket.io
- Room/lobby system with unique room codes
- Supports 4 players + spectators
- Easy room sharing - just share the 6-character code

### Chat System
- In-game chat during gameplay
- Team-only chat option (private messages to teammate)
- Chat history persists during game session

### Cross-Platform
- Responsive design for mobile, tablet, and desktop
- Touch-friendly piece movement (tap-to-move and drag-and-drop)
- Adaptive layout that reorganizes for different screen sizes
- Works in any modern browser

## Quick Start

### Prerequisites
- Node.js 16+ installed

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Bughouse-v1

# Install all dependencies
npm run install:all
```

### Development Mode

Run the server and client separately for development:

```bash
# Terminal 1 - Start the server
npm run start:server

# Terminal 2 - Start the client dev server
npm run start:client
```

Or use the combined command:
```bash
npm run dev
```

- Server runs on: http://localhost:3001
- Client dev server runs on: http://localhost:5173

### Production Mode

```bash
# Build the client
npm run build

# Start the server (serves built client)
npm start
```

The application will be available at http://localhost:3001

## How to Play

1. **Create or Join a Room**
   - Enter your name and create a new room, or
   - Enter a room code to join an existing room

2. **Wait for Players**
   - 4 players are required to start
   - Share the room code with friends
   - Click "Ready" when prepared to play

3. **Gameplay**
   - Make moves on your assigned board
   - Captured pieces appear in your teammate's bank
   - Drop pieces from your bank by clicking them, then clicking a valid square
   - Use drag-and-drop or tap-to-move

4. **Win Condition**
   - First team to checkmate on either board wins!

## Project Structure

```
Bughouse-v1/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── context/        # React context for state management
│   │   ├── App.jsx         # Main application component
│   │   ├── main.jsx        # Entry point
│   │   └── index.css       # Styles
│   ├── index.html
│   └── vite.config.js
├── server/                 # Node.js backend
│   ├── index.js            # Express + Socket.io server
│   └── chess.js            # Chess game logic
├── package.json            # Root package with scripts
└── README.md
```

## Technology Stack

- **Frontend**: React 18, Vite
- **Backend**: Node.js, Express
- **Real-time**: Socket.io
- **Styling**: CSS3 with CSS Variables

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Server port |

## Hosting

This application is designed to be self-hosted. To deploy:

1. Build the client: `npm run build`
2. Set the `PORT` environment variable if needed
3. Start the server: `npm start`

The server will serve the built React app and handle WebSocket connections.

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm run install:all
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## License

MIT License
