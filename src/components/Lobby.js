import React, { useState, useEffect } from 'react';
import './Lobby.css';
import io from 'socket.io-client';

const Lobby = ({ onGameStart, onNextRound, onGameFinished }) => {
  const [socket, setSocket] = useState(null);
  const [lobbyCode, setLobbyCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, finished

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('lobbyCreated', (lobby) => {
      setLobbyCode(lobby.code);
      setPlayers(lobby.players);
      setIsHost(true);
      setGameState('waiting');
    });

    newSocket.on('playerJoined', (lobby) => {
      setPlayers(lobby.players);
    });

    newSocket.on('playerLeft', (lobby) => {
      setPlayers(lobby.players);
      if (lobby.players.length === 0) {
        setLobbyCode('');
        setIsHost(false);
      }
    });

    newSocket.on('gameStarted', (lobby) => {
      setGameState('playing');
      onGameStart(lobby);
    });

    newSocket.on('nextRound', (lobby) => {
      onNextRound(lobby);
    });

    newSocket.on('gameFinished', (lobby) => {
      setGameState('finished');
      onGameFinished(lobby);
    });

    newSocket.on('error', (message) => {
      setError(message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [onGameStart, onNextRound, onGameFinished]);

  const createLobby = () => {
    socket.emit('createLobby');
  };

  const joinLobby = (code) => {
    socket.emit('joinLobby', code);
  };

  const leaveLobby = () => {
    socket.emit('leaveLobby', lobbyCode);
  };

  const startGame = () => {
    socket.emit('startGame', lobbyCode);
  };

  if (gameState === 'playing' || gameState === 'finished') {
    return null;
  }

  return (
    <div className="lobby-container">
      <h2>Lobby</h2>
      {error && <div className="error-message">{error}</div>}
      
      {!lobbyCode ? (
        <div className="lobby-actions">
          <button onClick={createLobby} className="create-lobby-button">
            Create Lobby
          </button>
          <div className="join-lobby">
            <input
              type="text"
              placeholder="Enter lobby code"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value)}
            />
            <button onClick={() => joinLobby(lobbyCode)} className="join-lobby-button">
              Join Lobby
            </button>
          </div>
        </div>
      ) : (
        <div className="lobby-info">
          <div className="lobby-code">
            <h3>Lobby Code: {lobbyCode}</h3>
            <button onClick={leaveLobby} className="leave-lobby-button">
              Leave Lobby
            </button>
          </div>
          <div className="players-list">
            <h3>Players ({players.length}/4):</h3>
            <ul>
              {players.map((player, index) => (
                <li key={index}>
                  {player.name} {player.isHost ? '(Host)' : ''}
                </li>
              ))}
            </ul>
          </div>
          {isHost && players.length > 1 && (
            <button onClick={startGame} className="start-game-button">
              Start Game
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Lobby; 