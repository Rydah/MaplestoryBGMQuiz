import React, { useState, useEffect } from 'react';
import './App.css';
import BGMCard from './components/BGMCard';
import Settings from './components/Settings';
import Lobby from './components/Lobby';
import Fuse from 'fuse.js';

function App() {
  const [bgmData, setBGMData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [currentBGM, setCurrentBGM] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [gameState, setGameState] = useState('lobby'); // lobby, playing, finished
  const [currentLobby, setCurrentLobby] = useState(null);
  const [settings, setSettings] = useState({
    selectedClient: '',
    dateRange: {
      from: 2003,
      to: 2008
    }
  });

  useEffect(() => {
    loadBGMData();
  }, []);

  useEffect(() => {
    filterBGMData();
  }, [settings, bgmData]);

  const loadBGMData = async () => {
    try {
      const response = await fetch(`${process.env.PUBLIC_URL}/merged_bgm.json`);
      const data = await response.json();
      setBGMData(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading BGM data:', error);
      setIsLoading(false);
    }
  };

  const filterBGMData = () => {
    let filtered = [...bgmData];

    // Filter by client
    if (settings.selectedClient) {
      filtered = filtered.filter(bgm => bgm.source.client === settings.selectedClient);
    }

    // Filter by date range
    filtered = filtered.filter(bgm => {
      const year = parseInt(bgm.source.date);
      return year >= settings.dateRange.from && year <= settings.dateRange.to;
    });

    setFilteredData(filtered);
  };

  const handleGameStart = (lobby) => {
    setCurrentLobby(lobby);
    setGameState('playing');
    setCurrentBGM(lobby.currentSong);
  };

  const handleNextRound = (lobby) => {
    setCurrentLobby(lobby);
    setCurrentBGM(lobby.currentSong);
  };

  const handleGameFinished = (lobby) => {
    setCurrentLobby(lobby);
    setGameState('finished');
  };

  const handleGuess = (isCorrect) => {
    setScore(prev => ({
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      total: prev.total + 1
    }));
  };

  const getPercentage = () => {
    if (score.total === 0) return 0;
    return Math.round((score.correct / score.total) * 100);
  };

  return (
    <div className="app-container">
      {gameState === 'lobby' ? (
        <Lobby 
          onGameStart={handleGameStart}
          onNextRound={handleNextRound}
          onGameFinished={handleGameFinished}
        />
      ) : (
        <>
          <div className="score-panel">
            <div className="score-item">
              <h3>Score</h3>
              <p>{score.correct}/{score.total}</p>
            </div>
            <div className="score-item">
              <h3>Accuracy</h3>
              <p>{getPercentage()}%</p>
            </div>
            {currentLobby && (
              <div className="score-item">
                <h3>Round</h3>
                <p>{currentLobby.currentRound}/{currentLobby.maxRounds}</p>
              </div>
            )}
          </div>
          <Settings 
            settings={settings} 
            onChange={setSettings}
          />
          <div className="main-content">
            <h1>MapleStory BGM Guessing Game</h1>
            {isLoading ? (
              <div className="loading">Loading...</div>
            ) : (
              <BGMCard
                bgm={currentBGM}
                allSongs={filteredData}
                onGuess={handleGuess}
                currentLobby={currentLobby}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App; 