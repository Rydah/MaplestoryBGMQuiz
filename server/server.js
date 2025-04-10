const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Load songs from merged_bgm.json
const songsPath = path.join(__dirname, '../public/merged_bgm.json');
const songs = JSON.parse(fs.readFileSync(songsPath, 'utf8'));

// Game state
const lobbies = new Map();
const players = new Map();

// Helper function to generate a random lobby code
function generateLobbyCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Helper function to get a random song
function getRandomSong() {
  const randomIndex = Math.floor(Math.random() * songs.length);
  return songs[randomIndex];
}

// Helper function to filter songs by year range
function filterSongsByYear(fromYear, toYear) {
    console.log("Filtering songs by year", fromYear, toYear);
  return songs.filter(song => {
    const year = parseInt(song.metadata.year);
    return fromYear <= year && year <= toYear;
  });
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
      timer: null,
      allSongs: filterSongsByYear(2003, 2010)
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
  socket.on('startGame', ({ fromYear, toYear }) => {
    console.log("Received startGame event");
    const lobbyCode = players.get(socket.id);
    const lobby = lobbies.get(lobbyCode);

    if (!lobby || lobby.host !== socket.id) {
      console.log("Error: Only the host can start the game");
      socket.emit('error', 'Only the host can start the game');
      return;
    }

    const filteredSongs = filterSongsByYear(fromYear, toYear);
    if (filteredSongs.length === 0) {
      console.log("Error: No songs available for the selected year range");
      socket.emit('error', 'No songs available for the selected year range');
      return;
    }

    console.log("Starting game with filtered songs");
    lobby.gameState = 'playing';
    lobby.currentSong = filteredSongs[Math.floor(Math.random() * filteredSongs.length)];
    lobby.countdown = 30;

    // Reset player states
    for (const player of lobby.players.values()) {
      player.hasGuessed = false;
    }

    io.to(lobbyCode).emit('gameStarted', {
      song: lobby.currentSong,
      countdown: lobby.countdown,
      allSongs: filteredSongs
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
    console.log("Received guess:", guess);
    const isCorrect = guess.toLowerCase() === lobby.currentSong.metadata.title.toLowerCase();
    player.guessedCorrectly = isCorrect;

    if (isCorrect) {
      player.score += 1; // Always give one point for correct guesses
    }

    io.to(lobbyCode).emit('playerGuessed', {
      playerName: player.name,
      hasGuessed: true,
      isCorrect: isCorrect,
      score: player.score
    });
    console.log('Emitted playerGuessed event:', {
      playerName: player.name,
      isCorrect: isCorrect,
      score: player.score
    });

    // Check if all players have guessed
    if (Array.from(lobby.players.values()).every(p => p.hasGuessed)) {
      clearInterval(lobby.timer);
      endRound(lobbyCode);
    }
  });

  // Next song (host only)
  socket.on('nextSong', () => {
    const lobbyCode = players.get(socket.id);
    const lobby = lobbies.get(lobbyCode);

    if (!lobby || lobby.host !== socket.id) {
      socket.emit('error', 'Invalid action');
      return;
    }

    // Clear any existing timer
    if (lobby.timer) {
      clearInterval(lobby.timer);
      lobby.timer = null;
    }

    // Reset player states
    for (const player of lobby.players.values()) {
      player.hasGuessed = false;
    }

    // Select a new random song
    const randomIndex = Math.floor(Math.random() * lobby.allSongs.length);
    lobby.currentSong = lobby.allSongs[randomIndex];
    lobby.countdown = 30;
    lobby.gameState = 'playing';

    // Emit the new song and reset states
    io.to(lobbyCode).emit('gameStarted', {
      song: lobby.currentSong,
      countdown: lobby.countdown,
      allSongs: lobby.allSongs
    });

    // Start new countdown
    lobby.timer = setInterval(() => {
      lobby.countdown--;
      io.to(lobbyCode).emit('countdownUpdate', lobby.countdown);

      if (lobby.countdown <= 0) {
        clearInterval(lobby.timer);
        endRound(lobbyCode);
      }
    }, 1000);
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

  // Mark all players who haven't guessed as incorrect
  for (const player of lobby.players.values()) {
    if (!player.hasGuessed) {
      player.hasGuessed = true;
      player.guess = ''; // Empty guess indicates they didn't guess
    }
  }

  io.to(lobbyCode).emit('roundEnded', {
    correctAnswer: lobby.currentSong.metadata.title,
    players: Array.from(lobby.players.values())
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 