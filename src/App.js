import React, { useState, useEffect } from 'react';
import './App.css';
import BGMCard from './components/BGMCard';

function App() {
  const [bgmData, setBGMData] = useState([]);
  const [currentBGM, setCurrentBGM] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBGMData();
  }, []);

  const loadBGMData = async () => {
    try {
      console.log("Testing");
      const response = await fetch('/merged_bgm.json');
      const data = await response.json();
      console.log(data);

      setBGMData(data);
      getRandomBGM(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading BGM data:', error);
      setLoading(false);
    }
  };

  const getRandomBGM = (data = bgmData) => {
    if (data.length === 0) return;
    const randomBGM = data[Math.floor(Math.random() * data.length)];
    setCurrentBGM(randomBGM);
  };

  return (
    <div className="container">
      <h1>MapleStory BGM Randomizer</h1>
      {loading ? (
        <div className="bgm-card">
          <div className="bgm-title">Loading...</div>
        </div>
      ) : (
        <>
          <BGMCard bgm={currentBGM} />
          <button onClick={() => getRandomBGM()}>Get Another BGM</button>
        </>
      )}
    </div>
  );
}

export default App; 