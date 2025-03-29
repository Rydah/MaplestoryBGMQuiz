import React from 'react';
import './BGMCard.css';

function BGMCard({ bgm }) {
  if (!bgm) return null;

  return (
    <div className="bgm-card">
      <div className="bgm-title">{bgm.metadata.title}</div>
      <div className="bgm-description">{bgm.description}</div>
      <div className="metadata">
        <div className="metadata-item">
          <div className="metadata-label">Artist</div>
          <div className="metadata-value">{bgm.metadata.artist}</div>
        </div>
        <div className="metadata-item">
          <div className="metadata-label">Album Artist</div>
          <div className="metadata-value">{bgm.metadata.albumArtist}</div>
        </div>
        <div className="metadata-item">
          <div className="metadata-label">Year</div>
          <div className="metadata-value">{bgm.metadata.year}</div>
        </div>
      </div>
      <div className="filename">{bgm.filename}</div>
    </div>
  );
}

export default BGMCard; 