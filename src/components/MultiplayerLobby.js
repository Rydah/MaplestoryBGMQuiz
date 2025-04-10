import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import BGMCard from './BGMCard';
import './MultiplayerLobby.css';

function MultiplayerLobby() {
  const [playerName, setPlayerName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, showingResults
  const [players, setPlayers] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const isJoiningRef = useRef(false);
  const [hasJoinedLobby, setHasJoinedLobby] = useState(false);


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

    socket.on('gameStarted', ({ song, countdown: newCountdown }) => {
      setCurrentSong(song);
      setCountdown(newCountdown);
      setGameState('playing');
    });

    socket.on('countdownUpdate', (newCountdown) => {
      setCountdown(newCountdown);
    });

    socket.on('playerGuessed', ({ playerName: name, hasGuessed }) => {
      setPlayers(prevPlayers => 
        prevPlayers.map(p => p.name === name ? { ...p, hasGuessed } : p)
      );
    });

    socket.on('roundEnded', ({ correctAnswer, players: finalPlayers }) => {
      setGameState('showingResults');
      setPlayers(finalPlayers);
    });

    socket.on('error', (message) => {
      setError(message);
      setTimeout(() => setError(''), 3000);
      isJoiningRef.current = false;
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

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
    if (socketRef.current) {
      socketRef.current.emit('startGame');
    }
  };

  const handleNextSong = () => {
    if (socketRef.current) {
      socketRef.current.emit('nextSong');
    }
  };

  const handleGuess = (isCorrect) => {
    // This will be handled by the BGMCard component
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
          />
        </div>
      )}

      {gameState === 'showingResults' && isHost && (
        <button onClick={handleNextSong} className="next-song-button">
          Next Song
        </button>
      )}
    </div>
  );
}

export default MultiplayerLobby; 