import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';

interface User {
  id: string;
  nickname: string;
  isLoggedIn: boolean;
}

interface GameState {
  cards: Card[];
  gameOver: boolean;
  status: string;
  queueState: QueueState | null;
  winMessage: string | null;
  drinkCount: number;
  selectedImages?: {
    backcardImages: string[];
    endcardImage: string;
  };
  showCountdown?: boolean;
  item?: {
    hasItem: boolean;
    itemPlayerId: string | null;
    itemUsed: boolean;
  };
}

interface QueueState {
  players: Player[];
  turnPlayer: Player | null;
  turnFlipCount: number;
}

interface Player {
  id: string;
  nickname: string;
  isTurn: boolean;
  isActive: boolean;
}

interface Card {
  id: number;
  isFlipped: boolean;
  isJingCard: boolean;
}

interface FlipCardGameProps {
  cardCount: number;
  columns: number;
  gameTitle: string;
  autoRestartSeconds: number;
  onBack: () => void;
  socket: Socket | null;
  gameState: GameState;
  user: User;
  isEditingNickname: boolean;
  newNickname: string;
  onNicknameChange: (nickname: string | null) => void;
  onStartEditNickname: () => void;
  onCancelEditNickname: () => void;
  onAdminClick: () => void;
}

const FlipCardGame: React.FC<FlipCardGameProps> = ({ 
  cardCount, 
  columns, 
  gameTitle, 
  autoRestartSeconds,
  socket, 
  gameState, 
  user, 
  isEditingNickname, 
  newNickname, 
  onNicknameChange, 
  onStartEditNickname, 
  onCancelEditNickname, 
  onAdminClick 
}) => {
  const [showJingCard, setShowJingCard] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [currentFlipCount, setCurrentFlipCount] = useState(0);
  const [randomWinMessage, setRandomWinMessage] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [turnCountdown, setTurnCountdown] = useState(0);
  const [logoImage, setLogoImage] = useState<{ src: string; x: number; y: number } | null>(null);
  const [isSelectingPlayer, setIsSelectingPlayer] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const flipAudioRef = useRef<HTMLAudioElement | null>(null);
  const jingAudioRef = useRef<HTMLAudioElement | null>(null);
  const restartAudioRef = useRef<HTMLAudioElement | null>(null);
  const heartbeatAudioRef = useRef<HTMLAudioElement | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getDrinkArtText = useCallback((drinkCount: number | undefined): string => {
    return (drinkCount || 0).toString();
  }, []);

  // 监听酒杯数量变化，播放心跳声
  useEffect(() => {
    // 检查是否需要播放心跳声
    if (gameState.drinkCount >= 5 && !gameState.gameOver) {
      if (heartbeatAudioRef.current) {
        heartbeatAudioRef.current.currentTime = 0;
        heartbeatAudioRef.current.play().catch(err => {
          console.warn('心跳声播放失败:', err);
        });
      }
    } else {
      // 停止心跳声
      if (heartbeatAudioRef.current) {
        heartbeatAudioRef.current.pause();
        heartbeatAudioRef.current.currentTime = 0;
      }
    }
  }, [gameState.drinkCount, gameState.gameOver]);

  const playAudio = useCallback((audioRef: React.RefObject<HTMLAudioElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.warn('音频播放失败，游戏继续:', err);
      });
    }
  }, []);

  const getOptimalColumns = useCallback((): number => {
    const count = gameState.cards?.length || 0;
    if (count === 0) return columns;
    
    const screenWidth = window.innerWidth;
    
    if (screenWidth < 360) {
      return Math.min(columns, 3);
    } else if (screenWidth < 480) {
      return Math.min(columns, 4);
    } else if (screenWidth < 768) {
      return Math.min(columns, 6);
    } else if (screenWidth < 1024) {
      return Math.min(columns, 8);
    } else if (screenWidth < 1440) {
      return Math.min(columns, 12);
    } else {
      const maxPossibleColumns = Math.floor(screenWidth / 120);
      return Math.min(columns, maxPossibleColumns, count);
    }
  }, [gameState.cards?.length, columns]);

  const handleJingCardClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!socket) return;
    
    const logoImages = [
      '/png/logo/paipai.jpg'
    ];
    const randomLogo = logoImages[Math.floor(Math.random() * logoImages.length)];
    
    const relativeX = (e.clientX / window.innerWidth) * 100;
    const relativeY = (e.clientY / window.innerHeight) * 100;
    
    socket.emit('jingCardClick', {
      src: randomLogo,
      relativeX,
      relativeY
    });
  }, [socket]);

  const handleFlipCard = useCallback((cardId: number) => {
    if (gameState.gameOver) return;
    
    if (!isMyTurn) {
      console.warn('不是你的回合，无法翻牌');
      return;
    }
    
    const clickedCard = gameState.cards?.find(card => card.id === cardId);
    if (clickedCard && clickedCard.isFlipped) {
      console.warn('卡片已经翻转，无法再次翻转');
      return;
    }
    
    if (clickedCard?.isJingCard) {
      playAudio(jingAudioRef);
      if (socket) {
        socket.emit('jingCardAudio', { playerId: user.id });
      }
    } else {
      playAudio(flipAudioRef);
    }
    
    if (socket) {
      socket.emit('flipCard', { cardId, playerId: user.id });
    }
  }, [gameState.gameOver, gameState.cards, isMyTurn, socket, user.id, playAudio]);

  const handleRestartGame = useCallback(() => {
    if (!isMyTurn) {
      console.warn('不是你的回合，无法重新开始游戏');
      return;
    }
    
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    
    playAudio(restartAudioRef);
    if (socket) {
      socket.emit('restartGame', { cardCount, playerId: user.id });
    }
  }, [isMyTurn, playAudio, socket, cardCount, user.id]);

  const handleEndTurn = useCallback(() => {
    if (socket && isMyTurn && currentFlipCount > 0) {
      socket.emit('endTurn', user.id);
    }
  }, [socket, isMyTurn, currentFlipCount, user.id]);

  const handleExitQueue = useCallback(() => {
    if (socket && user.id) {
      socket.emit('exitQueue', user.id);
      console.log('已发送退出队列请求');
    }
  }, [socket, user.id, playAudio, jingAudioRef]);

  const handleJoinQueue = useCallback(() => {
    if (socket && user.id) {
      socket.emit('joinQueue', { id: user.id, nickname: user.nickname });
      console.log('已发送加入队列请求');
    }
  }, [socket, user.id, user.nickname]);

  const isUserInQueue = useMemo(() => {
    return gameState.queueState?.players.some((p: Player) => p.id === user.id) ?? false;
  }, [gameState.queueState, user.id]);

  useEffect(() => {
    if (gameState) {
      console.log('游戏状态变化:', { 
        gameOver: gameState.gameOver, 
        status: gameState.status,
        queueState: gameState.queueState,
        winMessage: gameState.winMessage
      });
      
      if (gameState.queueState) {
        const isTurn = !!(gameState.queueState.turnPlayer && 
                      gameState.queueState.turnPlayer.id === user.id);
        setIsMyTurn(isTurn);
        setCurrentFlipCount(gameState.queueState.turnFlipCount || 0);
      }
      
      if (gameState.gameOver && gameState.status === 'ended') {
        console.log('游戏结束，开始倒计时:', autoRestartSeconds);
        setShowJingCard(true);
        if (gameState.winMessage) {
          setRandomWinMessage(gameState.winMessage);
        }
        
        // 不管当前回合玩家是否离线，或者游戏队列是否有玩家，都自动重新开始游戏
        setCountdown(autoRestartSeconds);
        countdownTimerRef.current = setInterval(() => {
          setCountdown((prev: number) => {
            if (prev <= 1) {
              clearInterval(countdownTimerRef.current!);
              handleRestartGame();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        return () => {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
        };
      } else {
        setShowJingCard(false);
        setRandomWinMessage('');
        setCountdown(0);
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
      }
    }
  }, [gameState, user.id, isMyTurn, handleRestartGame, autoRestartSeconds]);

  useEffect(() => {
    if (gameState.gameOver && gameState.status === 'ended' && audioRef.current) {
      if (audioRef.current.readyState >= 2) {
        audioRef.current.play().catch(err => {
          console.warn('音频播放失败，游戏继续:', err);
        });
      } else {
        const handleCanPlay = () => {
          audioRef.current?.play().catch(err => {
            console.warn('音频播放失败，游戏继续:', err);
          });
        };
        
        audioRef.current.addEventListener('canplaythrough', handleCanPlay);
        
        return () => {
          audioRef.current?.removeEventListener('canplaythrough', handleCanPlay);
        };
      }
    }
  }, [gameState.gameOver, gameState.status]);

  useEffect(() => {
    if (!socket) return;

    const handleJingCardFound = (data: any) => {
      console.log('境哥牌被找到:', data);
      setCurrentFlipCount(0);
    };

    const handleTurnEnded = (data: any) => {
      console.log('回合结束:', data);
    };

    const handleTurnCountdownUpdated = (data: any) => {
      console.log('倒计时更新:', data);
      setTurnCountdown(data.countdown);
    };

    const handleError = (error: any) => {
      console.error('服务器错误:', error);
    };

    const handleJingCardClick = (data: any) => {
      console.log('境哥牌被点击:', data);
      setLogoImage({
        src: data.src,
        x: data.relativeX,
        y: data.relativeY
      });
      
      setTimeout(() => {
        setLogoImage(null);
      }, 2000);
    };

    const handleJingCardAudio = (data: any) => {
      console.log('播放境哥牌音频:', data);
      playAudio(jingAudioRef);
    };

    const handleItemObtained = (data: any) => {
      console.log('获得道具:', data);
    };

    const handleItemUsed = (data: any) => {
      console.log('道具已使用:', data);
      setIsSelectingPlayer(false);
    };

    socket.on('jingCardFound', handleJingCardFound);
    socket.on('turnEnded', handleTurnEnded);
    socket.on('turnCountdownUpdated', handleTurnCountdownUpdated);
    socket.on('error', handleError);
    socket.on('jingCardClick', handleJingCardClick);
    socket.on('jingCardAudio', handleJingCardAudio);
    socket.on('itemObtained', handleItemObtained);
    socket.on('itemUsed', handleItemUsed);

    return () => {
      socket.off('jingCardFound', handleJingCardFound);
      socket.off('turnEnded', handleTurnEnded);
      socket.off('turnCountdownUpdated', handleTurnCountdownUpdated);
      socket.off('error', handleError);
      socket.off('jingCardClick', handleJingCardClick);
      socket.off('jingCardAudio', handleJingCardAudio);
      socket.off('itemObtained', handleItemObtained);
      socket.off('itemUsed', handleItemUsed);
    };
  }, [socket, user.id, playAudio, jingAudioRef]);

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

      if (scrollTop + clientHeight >= scrollHeight - 50) {
        adminContainer.classList.add('show');

        if (hideTimer) {
          clearTimeout(hideTimer);
        }

        hideTimer = setTimeout(() => {
          adminContainer.classList.remove('show');
        }, 1000);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, []);

  return (
    <div className="flip-card-game">
      <div className="right-layout">
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
                    onKeyDown={(e) => e.key === 'Enter' && onNicknameChange && onNicknameChange(null)}
                  />
                  <button onClick={() => onNicknameChange && onNicknameChange(null)} className="save-button">保存</button>
                  <button onClick={onCancelEditNickname} className="cancel-button">取消</button>
                </div>
              ) : (
                <div className="nickname-display">
                  <span className="nickname" onClick={onStartEditNickname}>{user?.nickname || '玩家'}</span>
                  <button onClick={onAdminClick} className="admin-button">管理</button>
                  {isUserInQueue ? (
                    <button onClick={handleExitQueue} className="exit-queue-button">退出队列</button>
                  ) : (
                    <button onClick={handleJoinQueue} className="join-queue-button">加入队列</button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {gameState.queueState && (
            <div className="turn-info">
              <div className="flip-count">
                翻牌:{currentFlipCount}
              </div>
              <div className="drink-count">
                酒量:{gameState.drinkCount}
              </div>
              <div className="countdown-toggle">
                <svg 
                  className="clock-icon" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  onClick={() => socket && socket.emit('toggleCountdown', { showCountdown: !gameState.showCountdown })}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 2V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 20V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M2 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M20 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M4.93 4.93L6.34 6.34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M17.66 17.66L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M4.93 19.07L6.34 17.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M17.66 6.34L19.07 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {gameState.showCountdown && (
                  <span className="countdown-text">{turnCountdown}s</span>
                )}
              </div>
              {gameState.item?.hasItem && gameState.item.itemPlayerId === user.id && !gameState.item.itemUsed && (
                <div className="item-button-container">
                  <button 
                    className="item-button"
                    onClick={() => setIsSelectingPlayer(true)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                    </svg>
                    点名
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div 
            className="drink-art-text"
            style={{
              animationDuration: `${Math.max(0.2, 2 - gameState.drinkCount * 0.3)}s`
            }}
          >
            {getDrinkArtText(gameState.drinkCount)}
          </div>
        </div>
      </div>

      <div className="game-main">
        <div className="game-controls-top">
          {gameState.queueState?.turnPlayer ? (
            <div className="turn-controls">
              {!isMyTurn && (
                <div className="current-player">
                  当前: {gameState.queueState.turnPlayer.nickname}
                </div>
              )}
              {isMyTurn && (
                <button 
                  onClick={handleEndTurn} 
                  className="end-turn-button"
                  disabled={currentFlipCount === 0}
                >
                  结束回合
                </button>
              )}
            </div>
          ) : (
            <div className="waiting-message">
              等待玩家加入...
            </div>
          )}
        </div>

        <div 
          className="card-grid"
          style={{
            gridTemplateColumns: `repeat(${getOptimalColumns()}, 1fr)`
          }}
        >
          {gameState.cards?.map((card, index) => (
            <div
              key={card.id}
              className={`card ${card.isFlipped ? 'flipped' : ''} ${isUserInQueue && !isMyTurn ? 'disabled' : ''}`}
              onClick={() => handleFlipCard(card.id)}
            >
              <div className="card-inner">
                {!card.isFlipped ? (
                  <div className="card-front">
                    <img src={gameState.selectedImages?.backcardImages[index % (gameState.selectedImages?.backcardImages.length || 1)] || '/png/backcard/2.jpg'} alt="牌背" />
                  </div>
                ) : null}
                {!card.isFlipped && (
                  <div className="card-back">
                    {card.isJingCard ? (
                      <img src={gameState.selectedImages?.endcardImage || '/png/endcard/1.jpg'} alt="境哥牌" />
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

      {showJingCard && (
        <div className="jing-card-overlay">
          <div className="jing-card-container">
            <img 
              src={gameState.selectedImages?.endcardImage || '/png/endcard/1.jpg'} 
              alt="境哥牌" 
              className="jing-card-large"
              onClick={handleJingCardClick}
              style={{ cursor: 'pointer' }}
            />
            <div className="jing-card-text">
              <h3>{randomWinMessage || '恭喜你找到境哥牌！'}</h3>
              <p className="drink-punishment">{gameState.queueState?.turnPlayer?.nickname || '玩家'}罚酒{gameState.drinkCount}杯</p>
            </div>
            <div className="jing-card-buttons">
              <button 
                onClick={handleRestartGame} 
                className="restart-button"
                disabled={!isMyTurn}
              >
                {countdown > 0 ? `${countdown}秒后重新开始` : '重新开始'}
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState.queueState && (
        <div className="player-queue">
          <h3>游戏队列</h3>
          <div className="queue-list">
            {gameState.queueState.players.slice(0, 10).map((player: Player, index: number) => (
              <div 
                key={player.id} 
                className={`queue-item ${player.isTurn ? 'current-turn' : ''} ${!player.isActive ? 'inactive' : ''} ${isSelectingPlayer && player.id !== user.id ? 'selectable' : ''}`}
                onClick={() => {
                  if (isSelectingPlayer && player.id !== user.id && socket) {
                    socket.emit('useItem', { playerId: user.id, targetPlayerId: player.id });
                  }
                }}
              >
                <span className="queue-number">{index + 1}</span>
                <span className="queue-nickname">{player.nickname}</span>
                {player.isTurn && <span className="turn-indicator">当前回合</span>}
                {!player.isActive && <span className="inactive-indicator">离线</span>}
                {isSelectingPlayer && player.id !== user.id && <span className="select-indicator">点击选择</span>}
              </div>
            ))}
            {gameState.queueState.players.length > 10 && (
              <div className="queue-more">
                还有 {gameState.queueState.players.length - 10} 位玩家在队列中...
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mobile-admin-container">
        <button onClick={onAdminClick} className="mobile-admin-button">管理</button>
      </div>

      {logoImage && (
        <div 
          className="logo-image-container"
          style={{
            position: 'fixed',
            left: `${logoImage.x}%`,
            top: `${logoImage.y}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            animation: 'fadeInOut 2s ease-in-out forwards'
          }}
        >
          <img 
            src={logoImage.src} 
            alt="logo" 
            style={{
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          />
        </div>
      )}

      <audio ref={audioRef} src="/sounds/tuboshu.mp3" preload="auto">
        您的浏览器不支持音频元素。
      </audio>
      
      <audio ref={flipAudioRef} src="/sounds/button-17.mp3" preload="auto">
        您的浏览器不支持音频元素。
      </audio>
      
      <audio ref={jingAudioRef} src="/sounds/tuboshu1.mp3" preload="auto">
        您的浏览器不支持音频元素。
      </audio>
      
      <audio ref={restartAudioRef} src="/sounds/button-7.mp3" preload="auto">
        您的浏览器不支持音频元素。
      </audio>
      
      <audio ref={heartbeatAudioRef} src="/sounds/heartbeat.mp3" preload="auto" loop>
        您的浏览器不支持音频元素。
      </audio>
    </div>
  );
};

export default FlipCardGame;
