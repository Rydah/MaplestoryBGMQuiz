const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Game state
const lobbies = new Map();
const players = new Map();

// Helper function to generate a random lobby code
function generateLobbyCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create a new lobby
  socket.on('createLobby', (playerName) => {
    const lobbyCode = generateLobbyCode();
    const lobby = {
      code: lobbyCode,
      host: socket.id,
      players: new Map([[socket.id, { name: playerName, score: 0, hasGuessed: false }]]),
      currentSong: null,
      gameState: 'waiting', // waiting, playing, showingResults
      countdown: 30,
      timer: null
    };
    
    lobbies.set(lobbyCode, lobby);
    players.set(socket.id, lobbyCode);
    
    socket.join(lobbyCode);
    socket.emit('lobbyCreated', lobbyCode);
    io.to(lobbyCode).emit('lobbyUpdate', {
      players: Array.from(lobby.players.values()),
      gameState: lobby.gameState
    });
  });

  // Join an existing lobby 
  socket.on('joinLobby', ({ lobbyCode, playerName }) => {
    const lobby = lobbies.get(lobbyCode);
    if (!lobby) {
      socket.emit('error', 'Lobby not found');
      return;
    }

    if (lobby.gameState !== 'waiting') {
      socket.emit('error', 'Game has already started');
      return;
    }

    lobby.players.set(socket.id, { name: playerName, score: 0, hasGuessed: false });
    players.set(socket.id, lobbyCode);
    socket.join(lobbyCode);

    io.to(lobbyCode).emit('lobbyUpdate', {
      players: Array.from(lobby.players.values()),
      gameState: lobby.gameState
    });
  });

  // Start the game (host only)
  socket.on('startGame', () => {
    const lobbyCode = players.get(socket.id);
    const lobby = lobbies.get(lobbyCode);

    if (!lobby || lobby.host !== socket.id) {
      socket.emit('error', 'Only the host can start the game');
      return;
    }

    lobby.gameState = 'playing';
    lobby.currentSong = null; // You'll need to implement song selection logic here
    lobby.countdown = 30;

    // Reset player states
    for (const player of lobby.players.values()) {
      player.hasGuessed = false;
    }

    io.to(lobbyCode).emit('gameStarted', {
      song: lobby.currentSong,
      countdown: lobby.countdown
    });

    // Start countdown
    lobby.timer = setInterval(() => {
      lobby.countdown--;
      io.to(lobbyCode).emit('countdownUpdate', lobby.countdown);

      if (lobby.countdown <= 0) {
        clearInterval(lobby.timer);
        endRound(lobbyCode);
      }
    }, 1000);
  });

  // Handle player guesses
  socket.on('submitGuess', ({ guess }) => {
    const lobbyCode = players.get(socket.id);
    const lobby = lobbies.get(lobbyCode);
    if (!lobby || lobby.gameState !== 'playing') return;

    const player = lobby.players.get(socket.id);
    if (!player || player.hasGuessed) return;

    player.hasGuessed = true;
    const isCorrect = guess.toLowerCase() === lobby.currentSong.metadata.title.toLowerCase();
    if (isCorrect) {
      player.score += Math.ceil(lobby.countdown / 3); // More points for faster guesses
    }

    io.to(lobbyCode).emit('playerGuessed', {
      playerId: socket.id,
      playerName: player.name,
      hasGuessed: true
    });

    // Check if all players have guessed
    if (Array.from(lobby.players.values()).every(p => p.hasGuessed)) {
      endRound(lobbyCode);
    }
  });

  // Next song (host only)
  socket.on('nextSong', () => {
    const lobbyCode = players.get(socket.id);
    const lobby = lobbies.get(lobbyCode);

    if (!lobby || lobby.host !== socket.id || lobby.gameState !== 'showingResults') {
      socket.emit('error', 'Invalid action');
      return;
    }

    lobby.gameState = 'waiting';
    io.to(lobbyCode).emit('lobbyUpdate', {
      players: Array.from(lobby.players.values()),
      gameState: lobby.gameState
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const lobbyCode = players.get(socket.id);
    if (lobbyCode) {
      const lobby = lobbies.get(lobbyCode);
      if (lobby) {
        lobby.players.delete(socket.id);
        players.delete(socket.id);

        // If host disconnects, assign new host or close lobby
        if (lobby.host === socket.id && lobby.players.size > 0) {
          lobby.host = Array.from(lobby.players.keys())[0];
        } else if (lobby.players.size === 0) {
          lobbies.delete(lobbyCode);
          return;
        }

        io.to(lobbyCode).emit('lobbyUpdate', {
          players: Array.from(lobby.players.values()),
          gameState: lobby.gameState,
          host: lobby.host
        });
      }
    }
  });
});

// Helper function to end a round
function endRound(lobbyCode) {
  const lobby = lobbies.get(lobbyCode);
  if (!lobby) return;

  clearInterval(lobby.timer);
  lobby.gameState = 'showingResults';

  io.to(lobbyCode).emit('roundEnded', {
    correctAnswer: lobby.currentSong.metadata.title,
    players: Array.from(lobby.players.values())
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 