import React, { useState } from 'react';

interface GameSettingsProps {
  onStartGame: (cardCount: number) => void;
  onBack: () => void;
}

const GameSettings: React.FC<GameSettingsProps> = ({ onStartGame, onBack }) => {
  const [cardCount, setCardCount] = useState(9); // 默认9张牌

  const handleStartGame = () => {
    onStartGame(cardCount);
  };

  return (
    <div className="game-settings">
      <h2>游戏设置</h2>
      <p>所有玩家将加入同一个游戏，实时同步游戏状态</p>
      
      <div className="setting-item">
        <label htmlFor="cardCount">牌数: {cardCount}</label>
        <input
          type="range"
          id="cardCount"
          min="6"
          max="60"
          value={cardCount}
          onChange={(e) => setCardCount(Number(e.target.value))}
          className="card-count-slider"
        />
        <div className="range-labels">
          <span>6</span>
          <span>60</span>
        </div>
      </div>

      <div className="settings-buttons">
        <button onClick={handleStartGame} className="start-button">
          开始游戏
        </button>
        <button onClick={onBack} className="back-button">
          返回
        </button>
      </div>

    </div>
  );
};

export default GameSettings;