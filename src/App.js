import React, { useState, useEffect } from 'react';
import './App.css';
import BGMCard from './components/BGMCard';
import Settings from './components/Settings';
import Fuse from 'fuse.js';

function App() {
  const [bgmData, setBGMData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [currentBGM, setCurrentBGM] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
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
      const response = await fetch('/merged_bgm.json');
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
    if (filtered.length > 0) {
      getRandomBGM(filtered);
    } else {
      setCurrentBGM(null);
    }
  };

  const getRandomBGM = (data = filteredData) => {
    if (data.length === 0) return;
    const randomBGM = data[Math.floor(Math.random() * data.length)];
    setCurrentBGM(randomBGM);
  };

  return (
    <div className="app-container">
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
            allSongs={filteredData}
          />
        )}
      </div>
    </div>
  );
}

export default App; 