import React, { useState, useEffect, useRef } from 'react';
import './BGMCard.css';
import Fuse from 'fuse.js';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

function BGMCard({ bgm, onNext, allSongs, onGuess, isMultiplayer, countdown }) {
  const [guess, setGuess] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [playerError, setPlayerError] = useState(false);
  const [volume, setVolume] = useState(50);
  const [startTime, setStartTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(countdown || 30);
  const playerRef = useRef(null);
  const timerRef = useRef(null);
  const fuseRef = useRef(null);
  const playerContainerRef = useRef(null);
  const countdownRef = useRef(countdown || 30);
  const intervalRunning = useRef(false); // Flag to check if interval is already running

  useEffect(() => {
    // Initialize Fuse for fuzzy search
    if (allSongs && allSongs.length > 0) {
      fuseRef.current = new Fuse(allSongs, {
        keys: ['metadata.title', 'description'],
        threshold: 0.3,
        includeScore: true,
        minMatchCharLength: 2
      });
    }
  }, [allSongs]);

  useEffect(() => {
    if (!bgm || !bgm.youtube) return;

    // Load YouTube API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    // Define the callback function
    window.onYouTubeIframeAPIReady = () => {
      try {
        if (playerRef.current) {
          playerRef.current.destroy();
        }

        playerRef.current = new window.YT.Player('youtube-player', {
          videoId: bgm.youtube,
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            showinfo: 0,
            mute: 0,
          },
          events: {
            onReady: onPlayerReady,
            onError: (event) => {
              console.error('YouTube Player Error:', event.data);
              setPlayerError(true);
            }
          },
        });
      } catch (error) {
        console.error('Error initializing YouTube player:', error);
        setPlayerError(true);
      }
    };

    // If YouTube API is already loaded, initialize the player
    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.error('Error destroying YouTube player:', error);
        }
      }
    };
  }, [bgm?.youtube]);

  // Handle countdown for single-player mode
  useEffect(() => {
    // Only run timer if in single-player mode and should start
    if (!isMultiplayer && !showAnswer) {
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
  
      // Start a new timer
      timerRef.current = setInterval(() => {
        countdownRef.current -= 1;
        setTimeLeft(countdownRef.current);
  
        if (countdownRef.current <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          handleTimeUp();
        }
      }, 1000);
    }
  
    // Cleanup timer when effect deps change or component unmounts
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isMultiplayer, showAnswer, countdown]);

  const onPlayerReady = (event) => {
    try {
      const player = event.target;
      const duration = player.getDuration();
      
      // Calculate random start time (at least 30 seconds before the end)
      const maxStartTime = Math.max(0, duration - 30);
      const newStartTime = Math.floor(Math.random() * maxStartTime);
      setStartTime(newStartTime);
      
      // Set volume
      player.setVolume(volume);
      
      // Seek to random position and play
      player.seekTo(newStartTime);
      player.playVideo();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error in onPlayerReady:', error);
      setPlayerError(true);
    }
  };

  const handleTimeUp = () => {
    if (!showAnswer) {
      setShowAnswer(true);
      setIsCorrect(false);
      onGuess(false);
      if (isMultiplayer) {
        socket.emit('submitGuess', { guess: '' });
      }
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (playerRef.current) {
      try {
        playerRef.current.setVolume(newVolume);
      } catch (error) {
        console.error('Error setting volume:', error);
      }
    }
  };

  const handleGuessChange = (e) => {
    const value = e.target.value;
    setGuess(value);

    if (value.length >= 2 && fuseRef.current) {
      const results = fuseRef.current.search(value);
      setSuggestions(results.slice(0, 15).map(result => ({
        title: result.item.metadata.title,
        description: result.item.description
      })));
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setGuess(suggestion.title);
    setSuggestions([]);
  };

  if (!bgm) {
    return (
      <div className="bgm-card">
        <div className="no-songs-message">
          No songs available with the current filters. Try adjusting your settings.
        </div>
      </div>
    );
  }

  const handleGuessSubmit = (e) => {
    e.preventDefault();
    if (!guess.trim()) return;

    const isCorrect = guess.toLowerCase() === bgm.metadata.title.toLowerCase();
    setShowAnswer(true);
    setIsCorrect(isCorrect);
    setGuess('');
    setSuggestions([]);
    onGuess(isCorrect);

    if (isMultiplayer) {
      socket.emit('submitGuess', { guess });
    }
  };

  const handleNext = () => {
    // Clear previous interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  
    // Reset everything
    countdownRef.current = 30;
    setTimeLeft(30);
    setGuess('');
    setShowAnswer(false);
    setIsCorrect(false);
    setSuggestions([]);
    setPlayerError(false);
    onNext(); // Trigger whatever logic you have for moving to the next song/round
  };

  return (
    <div className="bgm-card">
      <div className="audio-container">
        <div 
          ref={playerContainerRef}
          className={`youtube-player-container ${!showAnswer ? 'hidden-player' : ''}`}
        >
          <div 
            id="youtube-player" 
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          ></div>
        </div>
        <div className="audio-controls">
          {!isMultiplayer && (
            <div className="time-left">
              Time Left: {timeLeft}s
            </div>
          )}
          <div className="volume-control">
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider"
            />
          </div>
        </div>
      </div>
      
      <form onSubmit={handleGuessSubmit} className={`guess-form ${showAnswer ? 'hidden' : ''}`}>
        <div className="guess-input-container">
          <input
            type="text"
            value={guess}
            onChange={handleGuessChange}
            placeholder="Guess the song title..."
            disabled={showAnswer}
            className="guess-input"
          />
          {suggestions.length > 0 && (
            <div className="suggestions">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="suggestion-item"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <div className="suggestion-title">{suggestion.title}</div>
                  <div className="suggestion-description">{suggestion.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="submit" disabled={showAnswer} className="guess-button">
          Submit Guess
        </button>
      </form>

      {showAnswer && (
        <div className={`answer ${isCorrect ? 'correct' : 'incorrect'}`}>
          <p>{isCorrect ? 'Correct!' : 'Incorrect!'}</p>
          <p>The correct answer was: {bgm.metadata.title}</p>
          {!isMultiplayer && (
            <button onClick={handleNext} className="next-button">
              Next Song
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default BGMCard; 