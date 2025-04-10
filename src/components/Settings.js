import React, { useState } from 'react';
import './Settings.css';

function Settings({ settings, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClientChange = (e) => {
    onChange({
      ...settings,
      selectedClient: e.target.value
    });
  };

  const handleYearChange = (e, type) => {
    const value = parseInt(e.target.value);
    onChange({
      ...settings,
      dateRange: {
        ...settings.dateRange,
        [type]: value
      }
    });
  };

  return (
    <div className={`settings-container ${isOpen ? 'open' : ''}`}>
      <button 
        className="settings-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        ⚙️
      </button>
      
      <div className="settings-panel">
        <div className="settings-section">
          <h3>Year Range</h3>
          <div className="year-range-container">
            <div className="year-slider-container">
              <input
                type="range"
                min="2003"
                max="2024"
                value={settings.dateRange.from}
                onChange={(e) => handleYearChange(e, 'from')}
                className="year-slider"
              />
              <div className="year-display">
                From: {settings.dateRange.from}
              </div>
            </div>
            <div className="year-slider-container">
              <input
                type="range"
                min="2003"
                max="2024"
                value={settings.dateRange.to}
                onChange={(e) => handleYearChange(e, 'to')}
                className="year-slider"
              />
              <div className="year-display">
                To: {settings.dateRange.to}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings; 