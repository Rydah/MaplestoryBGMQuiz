import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import BGMCard from './BGMCard';
import './MultiplayerLobby.css';

// Define lobbies as a Map
const lobbies = new Map();

// Define the endRound function
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

function MultiplayerLobby() {
  const [playerName, setPlayerName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, showingResults
  const [players, setPlayers] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [error, setError] = useState('');
  const [yearRange, setYearRange] = useState({ from: 2003, to: 2010 });
  const [roundResults, setRoundResults] = useState(null);
  const socketRef = useRef(null);
  const isJoiningRef = useRef(false);
  const [hasJoinedLobby, setHasJoinedLobby] = useState(false);
  const [allSongs, setAllSongs] = useState([]);
  const [volume, setVolume] = useState(50);
  const playerRef = useRef(null);
  const [playerGuessedCorrectly, setPlayerGuessedCorrectly] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('http://localhost:3001', {
      autoConnect: false
    });

    const socket = socketRef.current;
    socket.connect();

    socket.on('lobbyCreated', (code) => {
      setLobbyCode(code);
      setIsHost(true);
      isJoiningRef.current = false;
    });

    socket.on('lobbyUpdate', ({ players: lobbyPlayers, gameState: newGameState }) => {
      setPlayers(lobbyPlayers);
      setGameState(newGameState);
    });

    socket.on('gameStarted', ({ song, countdown: newCountdown, allSongs }) => {
      setCurrentSong(song);
      setCountdown(newCountdown);
      setGameState('playing');
      setAllSongs(allSongs);
      setPlayerGuessedCorrectly(false);
    });

    socket.on('countdownUpdate', (newCountdown) => {
      setCountdown(newCountdown);
    });

    socket.on('playerGuessed', ({ playerName: name, hasGuessed, isCorrect, score }) => {
      console.log('playerGuessed event received:', { name, playerName, isCorrect });
      setPlayers(prevPlayers => {
        const newPlayers = prevPlayers.map(p => p.name === name ? { ...p, hasGuessed, isCorrect, score } : p);
        console.log('Updated players:', newPlayers);
        return newPlayers;
      });
      
      // If this is the current player's guess, update their correct/incorrect status
      if (name === playerName) {
        console.log('Updating playerGuessedCorrectly to:', isCorrect);
        setPlayerGuessedCorrectly(isCorrect);
      }
    });

    socket.on('roundEnded', ({ correctAnswer, players: finalPlayers }) => {
      setGameState('showingResults');
      setPlayers(finalPlayers);
      setRoundResults({
        correctAnswer,
        players: finalPlayers
      });
    });

    socket.on('error', (message) => {
      setError(message);
      setTimeout(() => setError(''), 3000);
      isJoiningRef.current = false;
    });

    socket.on('submitGuess', ({ guess }) => {
      const lobbyCode = players.get(socket.id);
      const lobby = lobbies.get(lobbyCode);
      if (!lobby || lobby.gameState !== 'playing') return;

      const player = lobby.players.get(socket.id);
      if (!player || player.hasGuessed) return;

      player.hasGuessed = true;
      const isCorrect = guess.toLowerCase() === lobby.currentSong.metadata.title.toLowerCase();
      if (isCorrect) {
        player.score += 1;
      }

      io.to(lobbyCode).emit('playerGuessed', {
        playerName: player.name,
        hasGuessed: true
      });

      // Stop countdown if all players have guessed
      if (Array.from(lobby.players.values()).every(p => p.hasGuessed)) {
        clearInterval(lobby.timer);
        endRound(lobbyCode);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      socket.off('playerGuessed');
      socket.off('roundEnded');
    };
  }, [playerName]);

  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  // Add effect to reset playerGuessedCorrectly when game state changes
  useEffect(() => {
    if (gameState === 'waiting') {
      setPlayerGuessedCorrectly(false);
    }
  }, [gameState]);

  const handleCreateLobby = () => {
    if (!playerName.trim() || isJoiningRef.current) return;
    if (socketRef.current) {
      isJoiningRef.current = true;
      socketRef.current.emit('createLobby', playerName);
    }
  };

  const handleJoinLobby = () => {
    if (!playerName.trim() || !lobbyCode.trim() || isJoiningRef.current) return;
    if (socketRef.current) {
      isJoiningRef.current = true;
      socketRef.current.emit('joinLobby', { lobbyCode, playerName });
      setHasJoinedLobby(true); // Add this
    }
  };
  

  const handleStartGame = () => {
    if (socketRef.current && socketRef.current.connected) {
      console.log("Emitting startGame event", yearRange);
      socketRef.current.emit('startGame', { fromYear: yearRange.from, toYear: yearRange.to });
    } else {
      console.error("Socket not connected");
    }
  };

  const handleNext = () => {
    if (socketRef.current) {
      // Reset local states
      setGameState('waiting');
      setCurrentSong(null);
      setCountdown(30);
      
      // Reset players' guess states
      setPlayers(prevPlayers => 
        prevPlayers.map(player => ({
          ...player,
          hasGuessed: false,
          //isCorrect: false
        }))
      );

      // Emit next song event
      socketRef.current.emit('nextSong');
    }
  };

  const handleGuess = (guess) => {
    if (socketRef.current) {
      console.log("Emitting submitGuess event", guess);
      socketRef.current.emit('submitGuess', { guess: guess });
    }
  };

  if (!hasJoinedLobby) {
    return (
      <div className="lobby-join">
        <h2>Join or Create a Lobby</h2>
        {error && <div className="error-message">{error}</div>}
        <div className="create-form">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Your Name"
          />
          <button onClick={handleCreateLobby} disabled={isJoiningRef.current}>
            Create Lobby
          </button>
        </div>
        <div className="join-form">
          <input
            type="text"
            value={lobbyCode}
            onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
            placeholder="Lobby Code"
          />
          <button onClick={handleJoinLobby} disabled={isJoiningRef.current}>
            Join Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="multiplayer-lobby">
      <div className="lobby-info">
        <h2>Lobby: {lobbyCode}</h2>
        <div className="players-list">
          <h3>Players:</h3>
          {players.map((player, index) => (
            <div key={index} className="player">
              {player.name} - {player.score} points
              {player.hasGuessed && <span className="guessed">✓</span>}
            </div>
          ))}
        </div>
        <div className="year-range-container">
          <h3>Year Range</h3>
          <div className="year-slider-container">
            <input
              type="range"
              min="2003"
              max="2024"
              value={yearRange.from}
              onChange={(e) => setYearRange({ ...yearRange, from: parseInt(e.target.value) })}
              className="year-slider"
            />
            <div className="year-display">
              From: {yearRange.from}
            </div>
          </div>
          <div className="year-slider-container">
            <input
              type="range"
              min="2003"
              max="2024"
              value={yearRange.to}
              onChange={(e) => setYearRange({ ...yearRange, to: parseInt(e.target.value) })}
              className="year-slider"
            />
            <div className="year-display">
              To: {yearRange.to}
            </div>
          </div>
        </div>
      </div>

      {gameState === 'waiting' && isHost && (
        <button onClick={handleStartGame} className="start-game-button">
          Start Game
        </button>
      )}

      {gameState === 'playing' && (
        <div className="game-area">
          <div className="countdown">Time Left: {countdown}s</div>
          <BGMCard
            bgm={currentSong}
            onGuess={handleGuess}
            isMultiplayer={true}
            countdown={countdown}
            allSongs={allSongs}
            volume={volume}
            onNext={handleNext}
            showAnswer={players.every(player => player.hasGuessed)}
            isCorrect={playerGuessedCorrectly}
          />
          {players.every(player => player.hasGuessed) && (
            <div className="result-container">
              <div className={`answer ${playerGuessedCorrectly ? 'correct' : 'incorrect'}`}>
                <p>{playerGuessedCorrectly ? 'Correct!' : 'Incorrect!'}</p>
                <p>The correct answer was: {currentSong.metadata.title}</p>
                {isHost && (
                  <button onClick={handleNext} className="next-button">
                    Next Song
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {gameState === 'showingResults' && (
        <div className="game-area">
          <BGMCard
            bgm={currentSong}
            onGuess={handleGuess}
            isMultiplayer={true}
            countdown={countdown}
            allSongs={allSongs}
            volume={volume}
            onNext={handleNext}
            showAnswer={true}
          />
          <div className={`answer ${playerGuessedCorrectly ? 'correct' : 'incorrect'}`}>
            <p>{playerGuessedCorrectly ? 'Correct!' : 'Incorrect!'}</p>
            <p>The correct answer was: {roundResults?.correctAnswer}</p>
            {isHost && (
              <button onClick={handleNext} className="next-button">
                Next Song
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiplayerLobby; 