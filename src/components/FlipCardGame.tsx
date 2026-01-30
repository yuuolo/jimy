import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

// 设备类型检测相关代码（暂时注释，后续可用于更复杂的设备特定逻辑）
/*
// 设备类型检测函数
const isMobileDevice = (): boolean => {
  // 检测屏幕宽度
  const screenWidth = window.innerWidth;
  const isSmallScreen = screenWidth < 768;
  
  // 检测用户代理
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  // 检测触摸事件支持
  const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // 综合判断
  return isSmallScreen || isMobileUA || hasTouchSupport;
};

// 设备类型检测钩子
const useDeviceType = () => {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  useEffect(() => {
    // 初始检测
    setIsMobile(isMobileDevice());
    
    // 监听窗口大小变化
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return isMobile;
};
*/

// 用户数据类型
interface User {
  id: string;
  nickname: string;
  isLoggedIn: boolean;
}

interface FlipCardGameProps {
  cardCount: number;
  columns: number;
  gameTitle: string;
  onBack: () => void;
  socket: Socket | null;
  gameState: any;
  user: User;
  isEditingNickname: boolean;
  newNickname: string;
  onNicknameChange: (nickname: string | null) => void;
  onStartEditNickname: () => void;
  onCancelEditNickname: () => void;
  onAdminClick: () => void;
}

interface Card {
  id: number;
  isFlipped: boolean;
  isJingCard: boolean;
}

const FlipCardGame: React.FC<FlipCardGameProps> = ({ cardCount, columns, gameTitle, socket, gameState, user, isEditingNickname, newNickname, onNicknameChange, onStartEditNickname, onCancelEditNickname, onAdminClick }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [showJingCard, setShowJingCard] = useState(false);
  const [showWinnerBroadcast, setShowWinnerBroadcast] = useState(false);
  const [winnerData, setWinnerData] = useState<any>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [currentFlipCount, setCurrentFlipCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const flipAudioRef = useRef<HTMLAudioElement | null>(null);
  const jingAudioRef = useRef<HTMLAudioElement | null>(null);
  const restartAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // 使用设备类型检测钩子（暂时注释，后续可用于更复杂的设备特定逻辑）
  // const isMobile = useDeviceType();

  // 获取适合当前屏幕的列数
  const getOptimalColumns = (): number => {
    const count = cards.length;
    if (count === 0) return columns; // 默认使用传入的列数
    
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // 计算最佳列数，确保卡片能够填满屏幕
    let optimalColumns = columns;
    
    // 根据屏幕宽度动态调整列数
    if (screenWidth < 360) {
      // 小屏幕手机，最多3列
      optimalColumns = Math.min(columns, 3);
    } else if (screenWidth < 480) {
      // 手机屏幕，最多4列
      optimalColumns = Math.min(columns, 4);
    } else if (screenWidth < 768) {
      // 平板屏幕，最多6列
      optimalColumns = Math.min(columns, 6);
    } else if (screenWidth < 1024) {
      // 小屏幕桌面，最多8列
      optimalColumns = Math.min(columns, 8);
    } else if (screenWidth < 1440) {
      // 中等屏幕桌面，最多12列
      optimalColumns = Math.min(columns, 12);
    } else {
      // 大屏幕桌面，根据卡片数量和屏幕宽度计算最佳列数
      // 确保所有卡片都能完整显示
      const maxPossibleColumns = Math.floor(screenWidth / 120); // 每张卡片最小宽度120px
      optimalColumns = Math.min(columns, maxPossibleColumns, count);
    }
    
    return optimalColumns;
  };

  // 初始化游戏
  useEffect(() => {
    if (gameState && gameState.cards) {
      setCards(gameState.cards);
      setGameOver(gameState.gameOver);
      
      // 更新队列状态
      if (gameState.queueState) {
        // 检查是否是当前玩家的回合
        const isTurn = gameState.queueState.turnPlayer && 
                      gameState.queueState.turnPlayer.id === user.id;
        setIsMyTurn(isTurn);
        
        // 更新当前回合翻牌数
        setCurrentFlipCount(gameState.queueState.turnFlipCount || 0);
      }
      
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
  }, [gameState, user.id]);

  // 初始化游戏卡片
  const initializeGame = () => {
    if (socket) {
      socket.emit('restartGame', { cardCount, playerId: user.id });
    }
  };

  // 处理卡片翻转
  const handleCardClick = (cardId: number) => {
    if (gameOver) return;
    
    // 检查是否是当前玩家的回合
    if (!isMyTurn) {
      console.warn('不是你的回合，无法翻牌');
      return;
    }
    
    // 检查卡片是否已经翻转
    const clickedCard = cards.find(card => card.id === cardId);
    if (clickedCard && clickedCard.isFlipped) {
      console.warn('卡片已经翻转，无法再次翻转');
      return;
    }
    
    // 检查当前点击的卡片是否是境哥牌
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
      socket.emit('flipCard', { cardId, playerId: user.id });
    }
  };

  // 重新开始游戏
  const handleRestartGame = () => {
    // 检查是否是当前玩家的回合
    if (!isMyTurn) {
      console.warn('不是你的回合，无法重新开始游戏');
      return;
    }
    
    // 播放重新开始音效
    if (restartAudioRef.current) {
      restartAudioRef.current.currentTime = 0;
      restartAudioRef.current.play().catch(err => {
        console.warn('重新开始音效播放失败，游戏继续:', err);
      });
    }
    
    initializeGame();
  };

  // 结束回合
  const handleEndTurn = () => {
    if (socket && isMyTurn) {
      socket.emit('endTurn', user.id);
    }
  };

  // 退出队列
  const handleExitQueue = () => {
    if (socket && user.id) {
      socket.emit('exitQueue', user.id);
      // 可以添加一些用户反馈
      console.log('已发送退出队列请求');
    }
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

  // 处理WebSocket事件
  useEffect(() => {
    if (socket) {
      // 处理境哥牌被找到
      const handleJingCardFound = (data: any) => {
        console.log('境哥牌被找到:', data);
        setWinnerData(data);
        setShowWinnerBroadcast(true);
        
        // 3秒后隐藏广播
        const timer = setTimeout(() => {
          setShowWinnerBroadcast(false);
        }, 3000);
        
        return () => clearTimeout(timer);
      };

      // 处理回合结束
      const handleTurnEnded = (data: any) => {
        console.log('回合结束:', data);
        // 可以显示回合结束提示
      };

      // 处理错误消息
      const handleError = (error: any) => {
        console.error('服务器错误:', error);
        // 可以显示错误提示
      };

      // 注册事件监听器
      socket.on('jingCardFound', handleJingCardFound);
      socket.on('turnEnded', handleTurnEnded);
      socket.on('error', handleError);

      // 清理函数
      return () => {
        socket.off('jingCardFound', handleJingCardFound);
        socket.off('turnEnded', handleTurnEnded);
        socket.off('error', handleError);
      };
    }
  }, [socket]);

  // 滚动监听，显示/隐藏管理按钮
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    const adminContainer = document.querySelector('.mobile-admin-container');
    if (!adminContainer) return;

    let hideTimer: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;

      // 当滚动到底部时
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        // 显示管理按钮
        adminContainer.classList.add('show');

        // 清除之前的定时器
        if (hideTimer) {
          clearTimeout(hideTimer);
        }

        // 1秒后隐藏
        hideTimer = setTimeout(() => {
          adminContainer.classList.remove('show');
        }, 1000);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, []);

  return (
    <div className="flip-card-game">
      {/* 右侧布局区域 */}
      <div className="right-layout">
        {/* 游戏头部 */}
        <div className="game-header">
          <div className="game-header-top">
            <h2>{gameTitle}</h2>
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
                    onKeyPress={(e) => e.key === 'Enter' && onNicknameChange && onNicknameChange(null)}
                  />
                  <button onClick={() => onNicknameChange && onNicknameChange(null)} className="save-button">保存</button>
                  <button onClick={onCancelEditNickname} className="cancel-button">取消</button>
                </div>
              ) : (
                <div className="nickname-display">
                  <span className="nickname">{user?.nickname || '玩家'}</span>
                  <button onClick={onStartEditNickname} className="edit-button">编辑</button>
                  <button onClick={onAdminClick} className="admin-button">管理</button>
                  <button onClick={() => handleExitQueue()} className="exit-queue-button">退出队列</button>
                </div>
              )}
            </div>
          </div>
          
          {/* 回合信息 */}
          {gameState.queueState && (
            <div className="turn-info">
              <div className="current-turn-player">
                当前回合: {gameState.queueState.turnPlayer?.nickname || '无'}
              </div>
              <div className="flip-count">
                本回合翻牌数: {currentFlipCount}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 主游戏区域 */}
      <div className="game-main">

        {/* 操作控制区 */}
        <div className="game-controls-top">
          {isMyTurn && (
            <button onClick={handleEndTurn} className="end-turn-button">
              结束回合
            </button>
          )}
          {!isMyTurn && (
            <div className="waiting-message">
              等待其他玩家...
            </div>
          )}
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
              className={`card ${card.isFlipped ? 'flipped' : ''} ${!isMyTurn ? 'disabled' : ''}`}
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

      {/* 赢家昵称放大广播 */}
      {showWinnerBroadcast && winnerData && (
        <div className="winner-broadcast">
          <div className="winner-message">
            <h2>{winnerData.player.nickname}</h2>
            <p>找到了境哥牌！</p>
            <p>本回合翻了 {winnerData.flipCount} 张牌</p>
          </div>
        </div>
      )}

      {/* 玩家队列显示 */}
      {gameState.queueState && (
        <div className="player-queue">
          <h3>游戏队列</h3>
          <div className="queue-list">
            {gameState.queueState.players.map((player: any, index: number) => (
              <div 
                key={player.id} 
                className={`queue-item ${player.isTurn ? 'current-turn' : ''} ${!player.isActive ? 'inactive' : ''}`}
              >
                <span className="queue-number">{index + 1}</span>
                <span className="queue-nickname">{player.nickname}</span>
                {player.isTurn && <span className="turn-indicator">当前回合</span>}
                {!player.isActive && <span className="inactive-indicator">离线</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部管理按钮 - 手机端 */}
      <div className="mobile-admin-container">
        <button onClick={onAdminClick} className="mobile-admin-button">管理</button>
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