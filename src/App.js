import React, { useState, useEffect } from 'react';
import './App.css';
import BGMCard from './components/BGMCard';
import Settings from './components/Settings';
import MultiplayerLobby from './components/MultiplayerLobby';
import importedBGMData from './merged_bgm.json';

function App() {
  const [bgmData, setBGMData] = useState([]);
  const [currentBGM, setCurrentBGM] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [settings, setSettings] = useState({
    dateRange: {
      from: 2003,
      to: 2008
    }
  });
  const [gameMode, setGameMode] = useState('single'); // 'single' or 'multiplayer'

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Imported BGM Data structure:', {
          length: importedBGMData.length,
          firstItem: importedBGMData[0],
          sampleItem: importedBGMData[Math.floor(Math.random() * importedBGMData.length)]
        });
        setBGMData(importedBGMData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error setting BGM data:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!isLoading && bgmData.length > 0) {
      getRandomBGM();
    }
  }, [settings, isLoading, bgmData]);

  const getRandomBGM = () => {
    if (bgmData.length === 0) {
      console.log('No BGM data available for random selection');
      return;
    }

    const filteredData = filterBGMData();
    console.log('Getting random BGM from filtered data:', {
      total: filteredData.length,
      sample: filteredData[0]
    });
    
    if (filteredData.length === 0) {
      console.log('No songs match the current filters');
      setCurrentBGM(null);
      return;
    }

    const randomIndex = Math.floor(Math.random() * filteredData.length);
    setCurrentBGM(filteredData[randomIndex]);
  };

  const filterBGMData = () => {
    if (!bgmData || bgmData.length === 0) {
      console.log('No BGM data available');
      return [];
    }
    
    const filtered = bgmData.filter(bgm => {
      if (!bgm || !bgm.metadata || !bgm.metadata.year) {
        console.log('Invalid BGM item:', bgm);
        return false;
      }
      
      const year = parseInt(bgm.metadata.year);
      const yearMatch = year >= settings.dateRange.from && year <= settings.dateRange.to;
      
      console.log('Filtering item:', {
        title: bgm.metadata.title,
        year,
        yearRange: `${settings.dateRange.from}-${settings.dateRange.to}`,
        matches: { yearMatch }
      });
      
      return yearMatch;
    });
    
    console.log('Filtered results:', {
      totalItems: bgmData.length,
      filteredCount: filtered.length,
      settings: settings
    });
    
    return filtered;
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
      <div className="game-mode-selector">
        <button
          className={`mode-button ${gameMode === 'single' ? 'active' : ''}`}
          onClick={() => setGameMode('single')}
        >
          Single Player
        </button>
        <button
          className={`mode-button ${gameMode === 'multiplayer' ? 'active' : ''}`}
          onClick={() => setGameMode('multiplayer')}
        >
          Multiplayer
        </button>
      </div>

      {gameMode === 'single' ? (
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
                onNext={getRandomBGM}
                allSongs={filterBGMData()}
                onGuess={handleGuess}
              />
            )}
          </div>
        </>
      ) : (
        <MultiplayerLobby />
      )}
    </div>
  );
}

export default App; 