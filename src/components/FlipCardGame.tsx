import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface FlipCardGameProps {
  cardCount: number;
  onBack: () => void;
  socket: Socket | null;
  gameState: any;
  user: any;
  isEditingNickname: boolean;
  newNickname: string;
  onNicknameChange: (nickname: string | undefined) => void;
  onStartEditNickname: () => void;
  onCancelEditNickname: () => void;
  onCardCountChange?: (count: number) => void;
}

interface Card {
  id: number;
  isFlipped: boolean;
  isJingCard: boolean;
}

const FlipCardGame: React.FC<FlipCardGameProps> = ({ cardCount, socket, gameState, user, isEditingNickname, newNickname, onNicknameChange, onStartEditNickname, onCancelEditNickname, onCardCountChange }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [showJingCard, setShowJingCard] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const flipAudioRef = useRef<HTMLAudioElement | null>(null);
  const jingAudioRef = useRef<HTMLAudioElement | null>(null);
  const restartAudioRef = useRef<HTMLAudioElement | null>(null);

  // 计算最佳列数：考虑更多列数选项，选择余数最少且最适合的
  const calculateBestColumns = (count: number): number => {
    // 根据卡片数量考虑不同的列数选项
    const divisors = count <= 12 ? [2, 3, 4] : 
                    count <= 24 ? [3, 4, 5, 6] : 
                    count <= 40 ? [4, 5, 6, 8] : 
                    [5, 6, 8, 10];
    
    // 计算每个除数的余数
    const remainders = divisors.map(divisor => count % divisor);
    const minRemainder = Math.min(...remainders);
    
    // 找到余数最少的除数
    const bestDivisors = divisors.filter((_, index) => remainders[index] === minRemainder);
    
    // 选择中间值，避免列数过多或过少
    return bestDivisors[Math.floor(bestDivisors.length / 2)];
  };

  // 获取适合当前屏幕的列数
  const getOptimalColumns = (): number => {
    const count = cards.length;
    if (count === 0) return 3; // 默认值
    
    const bestColumns = calculateBestColumns(count);
    const screenWidth = window.innerWidth;
    
    // 根据屏幕宽度调整列数
    if (screenWidth < 360) {
      // 小屏幕手机，最多3列
      return Math.min(bestColumns, 3);
    } else if (screenWidth < 480) {
      // 手机屏幕，最多4列
      return Math.min(bestColumns, 4);
    } else if (screenWidth < 768) {
      // 平板屏幕，最多6列
      return Math.min(bestColumns, 6);
    } else if (screenWidth < 1024) {
      // 小屏幕桌面，最多8列
      return Math.min(bestColumns, 8);
    }
    // 大屏幕桌面，最多10列
    return Math.min(bestColumns, 10);
  };

  // 初始化游戏
  useEffect(() => {
    if (gameState && gameState.cards) {
      setCards(gameState.cards);
      setGameOver(gameState.gameOver);
      
      // 摸到境哥牌后，延迟1秒再显示放大效果
      if (gameState.gameOver && gameState.status === 'ended') {
        const timer = setTimeout(() => {
          setShowJingCard(true);
        }, 1000);
        
        // 清理函数
        return () => clearTimeout(timer);
      } else {
        setShowJingCard(false);
      }
    }
  }, [gameState]);

  // 初始化游戏卡片
  const initializeGame = () => {
    if (socket) {
      socket.emit('restartGame', { cardCount });
    }
  };

  // 处理卡片翻转
  const handleCardClick = (cardId: number) => {
    if (gameOver) return;
    
    // 检查当前点击的卡片是否是境哥牌
    const clickedCard = cards.find(card => card.id === cardId);
    if (!clickedCard?.isJingCard) {
      // 只有非境哥牌才播放翻牌音效
      if (flipAudioRef.current) {
        flipAudioRef.current.currentTime = 0;
        flipAudioRef.current.play().catch(err => {
          console.warn('翻牌音效播放失败，游戏继续:', err);
        });
      }
    } else {
      // 境哥牌播放特殊音效
      if (jingAudioRef.current) {
        jingAudioRef.current.currentTime = 0;
        jingAudioRef.current.play().catch(err => {
          console.warn('境哥牌音效播放失败，游戏继续:', err);
        });
      }
    }
    
    if (socket) {
      socket.emit('flipCard', cardId);
    }
  };

  // 重新开始游戏
  const handleRestartGame = () => {
    // 播放重新开始音效
    if (restartAudioRef.current) {
      restartAudioRef.current.currentTime = 0;
      restartAudioRef.current.play().catch(err => {
        console.warn('重新开始音效播放失败，游戏继续:', err);
      });
    }
    
    initializeGame();
  };

  // 监听游戏状态变化，处理境哥牌播放
  useEffect(() => {
    if (gameState.gameOver && gameState.status === 'ended') {
      if (audioRef.current) {
        // 检查音频是否已加载且有效
        if (audioRef.current.readyState >= 2) {
          audioRef.current.play().catch(err => {
            console.warn('音频播放失败，游戏继续:', err);
          });
        } else {
          // 音频未加载完成，等待加载完成后播放
          audioRef.current.addEventListener('canplaythrough', () => {
            audioRef.current?.play().catch(err => {
              console.warn('音频播放失败，游戏继续:', err);
            });
          });
        }
      }
    }
  }, [gameState.gameOver, gameState.status]);

  // 音频加载错误处理
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.addEventListener('error', (e) => {
        console.warn('音频加载错误，游戏继续:', e);
      });
    }
  }, []);

  return (
    <div className="flip-card-game">
      <div className="game-header">
        <div className="game-header-top">
          <h2>好嗨靓仔境</h2>
          <div className="user-info">
            {isEditingNickname ? (
              <div className="nickname-edit">
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => onNicknameChange && onNicknameChange(e.target.value)}
                  className="nickname-input"
                  placeholder="输入昵称"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && onNicknameChange && onNicknameChange(undefined)}
                />
                <button onClick={() => onNicknameChange && onNicknameChange(undefined)} className="save-button">保存</button>
                <button onClick={onCancelEditNickname} className="cancel-button">取消</button>
              </div>
            ) : (
              <div className="nickname-display">
                <span className="nickname">{user?.nickname || '玩家'}</span>
                <button onClick={onStartEditNickname} className="edit-button">编辑</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div 
        className="card-grid"
        style={{
          gridTemplateColumns: `repeat(${getOptimalColumns()}, 1fr)`
        }}
      >
        {cards.map(card => (
          <div
            key={card.id}
            className={`card ${card.isFlipped ? 'flipped' : ''}`}
            onClick={() => handleCardClick(card.id)}
          >
            <div className="card-inner">
              {!card.isFlipped ? (
                <div className="card-front">
                  <img src="/png/2.jpg" alt="牌背" />
                </div>
              ) : null}
              {!card.isFlipped && (
                <div className="card-back">
                  {card.isJingCard ? (
                    <img src="/png/1.jpg" alt="境哥牌" />
                  ) : (
                    <div className="empty-card"></div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 境哥牌放大效果 */}
      {showJingCard && (
        <div className="jing-card-overlay">
          <div className="jing-card-container">
            <img src="/png/1.jpg" alt="境哥牌" className="jing-card-large" />
            <div className="jing-card-text">
              <h3>恭喜你找到境哥牌！</h3>
              <p>游戏结束</p>
            </div>
            <div className="jing-card-buttons">
              <button onClick={handleRestartGame} className="restart-button">
                重新开始
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 牌数选择栏 - 页面底部 */}
      <div className="game-controls-bottom">
        <div className="card-count-selector">
          <label htmlFor="card-count">牌数：{cardCount}</label>
          <input
            type="range"
            id="card-count"
            min="6"
            max="60"
            step="1"
            value={cardCount}
            onChange={(e) => onCardCountChange && onCardCountChange(parseInt(e.target.value))}
            className="card-count-slider"
          />
        </div>
        <button onClick={handleRestartGame} className="restart-button">
          重新开始
        </button>
      </div>

      {/* 音频元素 */}
      <audio ref={audioRef} src="/sounds/tuboshu.mp3" preload="auto">
        您的浏览器不支持音频元素。
      </audio>
      
      {/* 翻牌音效 */}
      <audio ref={flipAudioRef} src="/sounds/button-17.mp3" preload="auto">
        您的浏览器不支持音频元素。
      </audio>
      
      {/* 境哥牌音效 */}
      <audio ref={jingAudioRef} src="/sounds/tuboshu1.mp3" preload="auto">
        您的浏览器不支持音频元素。
      </audio>
      
      {/* 重新开始音效 */}
      <audio ref={restartAudioRef} src="/sounds/button-7.mp3" preload="auto">
        您的浏览器不支持音频元素。
      </audio>
    </div>
  );
};

export default FlipCardGame;