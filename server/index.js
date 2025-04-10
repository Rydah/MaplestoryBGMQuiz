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

// Store active lobbies
const lobbies = new Map();

// Store active games
const games = new Map();

// Store song data
let songData = [];

// Load song data
const loadSongData = async () => {
  try {
    const response = await fetch('https://raw.githubusercontent.com/your-repo/merged_bgm.json');
    songData = await response.json();
    console.log('Song data loaded successfully');
  } catch (error) {
    console.error('Error loading song data:', error);
  }
};

loadSongData();

io.on('connection', (socket) => {
  console.log('New client connected');

  // Create a new lobby
  socket.on('createLobby', ({ playerName }) => {
    try {
      const lobbyId = Math.random().toString(36).substring(2, 8);
      const lobby = {
        id: lobbyId,
        host: socket.id,
        players: [{
          id: socket.id,
          name: playerName,
          score: 0
        }],
        gameState: 'waiting', // waiting, playing, finished
        currentSong: null,
        currentRound: 0,
        maxRounds: 10,
        playersGuessed: new Set()
      };
      
      lobbies.set(lobbyId, lobby);
      socket.join(lobbyId);
      socket.emit('lobbyCreated', lobby);
      console.log(`Lobby ${lobbyId} created by ${playerName}`);
    } catch (error) {
      console.error('Error creating lobby:', error);
      socket.emit('error', { message: 'Failed to create lobby' });
    }
  });

  // Join an existing lobby
  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    try {
      const lobby = lobbies.get(lobbyId);
      if (!lobby) {
        socket.emit('error', { message: 'Lobby not found' });
        return;
      }

      if (lobby.players.length >= 4) {
        socket.emit('error', { message: 'Lobby is full' });
        return;
      }

      if (lobby.players.some(p => p.id === socket.id)) {
        socket.emit('error', { message: 'You are already in this lobby' });
        return;
      }

      lobby.players.push({
        id: socket.id,
        name: playerName,
        score: 0
      });

      socket.join(lobbyId);
      io.to(lobbyId).emit('lobbyUpdated', lobby);
      console.log(`${playerName} joined lobby ${lobbyId}`);
    } catch (error) {
      console.error('Error joining lobby:', error);
      socket.emit('error', { message: 'Failed to join lobby' });
    }
  });

  // Leave a lobby
  socket.on('leaveLobby', ({ lobbyId }) => {
    try {
      const lobby = lobbies.get(lobbyId);
      if (!lobby) return;

      const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const playerName = lobby.players[playerIndex].name;
        lobby.players.splice(playerIndex, 1);
        
        if (lobby.players.length === 0) {
          lobbies.delete(lobbyId);
          console.log(`Lobby ${lobbyId} deleted as it's empty`);
        } else {
          // If host left, assign new host
          if (lobby.host === socket.id) {
            lobby.host = lobby.players[0].id;
            console.log(`New host assigned in lobby ${lobbyId}`);
          }
          io.to(lobbyId).emit('lobbyUpdated', lobby);
          console.log(`${playerName} left lobby ${lobbyId}`);
        }
      }
    } catch (error) {
      console.error('Error leaving lobby:', error);
    }
  });

  // Start the game
  socket.on('startGame', ({ lobbyId }) => {
    try {
      const lobby = lobbies.get(lobbyId);
      if (!lobby || lobby.host !== socket.id) return;

      // Select first song
      const randomIndex = Math.floor(Math.random() * songData.length);
      lobby.currentSong = songData[randomIndex];
      lobby.currentRound = 1;
      lobby.playersGuessed.clear();
      lobby.gameState = 'playing';

      io.to(lobbyId).emit('gameStarted', {
        ...lobby,
        currentSong: lobby.currentSong
      });
      console.log(`Game started in lobby ${lobbyId}`);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Failed to start game' });
    }
  });

  // Handle player guesses
  socket.on('playerGuess', ({ lobbyId, guess }) => {
    try {
      const lobby = lobbies.get(lobbyId);
      if (!lobby || lobby.gameState !== 'playing') return;

      const player = lobby.players.find(p => p.id === socket.id);
      if (!player || lobby.playersGuessed.has(socket.id)) return;

      const isCorrect = guess.toLowerCase() === lobby.currentSong.metadata.title.toLowerCase();
      player.score += isCorrect ? 1 : 0;
      lobby.playersGuessed.add(socket.id);

      // Check if all players have guessed
      if (lobby.playersGuessed.size === lobby.players.length) {
        // Wait 3 seconds before moving to next round
        setTimeout(() => {
          if (lobby.currentRound < lobby.maxRounds) {
            // Select next song
            const randomIndex = Math.floor(Math.random() * songData.length);
            lobby.currentSong = songData[randomIndex];
            lobby.currentRound++;
            lobby.playersGuessed.clear();
            
            io.to(lobbyId).emit('nextRound', {
              ...lobby,
              currentSong: lobby.currentSong
            });
          } else {
            // Game finished
            lobby.gameState = 'finished';
            io.to(lobbyId).emit('gameFinished', lobby);
          }
        }, 3000);
      }

      io.to(lobbyId).emit('scoreUpdated', {
        playerId: socket.id,
        score: player.score,
        isCorrect,
        playersGuessed: Array.from(lobby.playersGuessed)
      });
    } catch (error) {
      console.error('Error handling guess:', error);
    }
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // Find and remove player from lobbies
    for (const [lobbyId, lobby] of lobbies.entries()) {
      const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const playerName = lobby.players[playerIndex].name;
        lobby.players.splice(playerIndex, 1);
        
        if (lobby.players.length === 0) {
          lobbies.delete(lobbyId);
          console.log(`Lobby ${lobbyId} deleted as it's empty`);
        } else {
          // If host left, assign new host
          if (lobby.host === socket.id) {
            lobby.host = lobby.players[0].id;
            console.log(`New host assigned in lobby ${lobbyId}`);
          }
          io.to(lobbyId).emit('lobbyUpdated', lobby);
          console.log(`${playerName} disconnected from lobby ${lobbyId}`);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 