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
  drinkCount: number;
  selectedImages?: {
    backcardImages: string[];
    endcardImage: string;
    endcardInfo?: {
      filename: string;
      path: string;
      size?: number;
      lastModified?: string;
    };
  };
  showCountdown?: boolean;
  item?: {
    hasItem: boolean;
    itemPlayerId: string | null;
    itemUsed: boolean;
    reverseItem: {
      hasItem: boolean;
      itemPlayerId: string | null;
      itemUsed: boolean;
    };
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
  displayConfig: {
    showFlipCount: boolean;
    showDrinkCount: boolean;
    showCountdownToggle: boolean;
    showCountdownText: boolean;
    showTurnImage: boolean;
    turnImageUrl: string;
  };
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
  displayConfig,
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
  const [countdown, setCountdown] = useState(0);
  const [turnCountdown, setTurnCountdown] = useState(0);
  const [logoImage, setLogoImage] = useState<{ src: string; x: number; y: number } | null>(null);
  const [isSelectingPlayer, setIsSelectingPlayer] = useState(false);
  const [showGameIni, setShowGameIni] = useState(false);
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);
  const [gameIniTimestamp, setGameIniTimestamp] = useState<number>(Date.now());
  const [skillMessage, setSkillMessage] = useState<string | null>(null);
  const [targetPlayerId, setTargetPlayerId] = useState<string | null>(null);
  const [isReverseEffectActive, setIsReverseEffectActive] = useState(false);
  const [ownerState, setOwnerState] = useState<{ ownerId: string | null; isOwner: boolean }>({ ownerId: null, isOwner: false });
  const [transferRequest, setTransferRequest] = useState<{ fromPlayerId: string; fromNickname: string } | null>(null);
  const [transferTimeout, setTransferTimeout] = useState<NodeJS.Timeout | null>(null);
  const [transferCountdown, setTransferCountdown] = useState<number>(0);
  const [cooldown, setCooldown] = useState<number>(0);
  const [intermissionConfig, setIntermissionConfig] = useState<any>({
    enabled: true,
    items: []
  });
  const [currentIntermission, setCurrentIntermission] = useState<any>(null);
  const [intermissionAudio, setIntermissionAudio] = useState<HTMLAudioElement | null>(null);
  const [shakingCardId, setShakingCardId] = useState<number | null>(null);
  const [queueControl, setQueueControl] = useState({
    allowJoinQueue: true,
    allowExitQueue: true
  });
  const prevIsMyTurnRef = useRef(false);
  
  interface DrinkTextConfig {
    enabled: boolean;
    texts: {
      '1': string;
      '2': string;
      '3': string;
      '4': string;
      '5': string;
      '6': string;
      '7': string;
      '8': string;
      '9': string;
      '10': string;
      '>10': string;
      [key: string]: string;
    };
  }
  
  interface 口头禅TextConfig {
    enabled: boolean;
    texts: string[];
  }
  
  const [drinkTextConfig, setDrinkTextConfig] = useState<DrinkTextConfig>({
    enabled: false,
    texts: {
      '1': '',
      '2': '',
      '3': '',
      '4': '',
      '5': '',
      '6': '',
      '7': '',
      '8': '',
      '9': '',
      '10': '',
      '>10': ''
    }
  });
  
  const [口头禅TextConfig, set口头禅TextConfig] = useState<口头禅TextConfig>({
    enabled: true,
    texts: [
      '勇敢的心！',
      '再来一杯！',
      '干了这杯！',
      '好酒！',
      '喝起来！'
    ]
  });
  
  const [random口头禅Text, setRandom口头禅Text] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const flipAudioRef = useRef<HTMLAudioElement | null>(null);
  const jingAudioRef = useRef<HTMLAudioElement | null>(null);
  const restartAudioRef = useRef<HTMLAudioElement | null>(null);
  const heartbeatAudioRef = useRef<HTMLAudioElement | null>(null);
  const paidaAudioRef = useRef<HTMLAudioElement | null>(null);
  const turnStartAudioRef = useRef<HTMLAudioElement | null>(null);
  const countdownWarningAudioRef = useRef<HTMLAudioElement | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getDrinkArtText = useCallback((drinkCount: number | undefined): string => {
    const count = drinkCount || 0;
    
    if (drinkTextConfig.enabled) {
      if (count > 10) {
        return drinkTextConfig.texts['>10'] || count.toString();
      } else {
        return drinkTextConfig.texts[count.toString()] || count.toString();
      }
    }
    
    return count.toString();
  }, [drinkTextConfig]);

  // 加载通俗语配置
  useEffect(() => {
    const loadDrinkTextConfig = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
        const response = await fetch(`${apiUrl}/api/drink-texts`);
        const data = await response.json();
        if (data.success) {
          setDrinkTextConfig({
            enabled: data.enabled || false,
            texts: data.texts || {
              '1': '',
              '2': '',
              '3': '',
              '4': '',
              '5': '',
              '6': '',
              '7': '',
              '8': '',
              '9': '',
              '10': '',
              '>10': ''
            }
          });
        }
      } catch (error) {
        console.error('加载通俗语配置失败:', error);
      }
    };
    
    loadDrinkTextConfig();
  }, []);
  
  // 加载口头禅文本配置
  const load口头禅TextConfig = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      const response = await fetch(`${apiUrl}/api/preferences`);
      const data = await response.json();
      if (data.口头禅TextConfig) {
        set口头禅TextConfig({
          enabled: data.口头禅TextConfig.enabled || false,
          texts: data.口头禅TextConfig.texts || []
        });
      }
    } catch (error) {
      console.error('加载口头禅文本配置失败:', error);
    }
  };
  
  // 组件挂载时加载口头禅文本配置
  useEffect(() => {
    load口头禅TextConfig();
  }, []);
  
  // 监听游戏状态变化，当游戏重新开始时加载口头禅文本配置
  useEffect(() => {
    // 当游戏从结束状态变为非结束状态时，认为游戏重新开始了
    if (!gameState.gameOver && gameState.status === 'playing') {
      load口头禅TextConfig();
    }
  }, [gameState.gameOver, gameState.status]);
  
  // 随机获取口头禅文本
  const getRandom口头禅Text = useCallback((): string => {
    if (!口头禅TextConfig.enabled ||口头禅TextConfig.texts.length === 0) {
      return '';
    }
    const randomIndex = Math.floor(Math.random() * 口头禅TextConfig.texts.length);
    return 口头禅TextConfig.texts[randomIndex] || '';
  }, [口头禅TextConfig]);
  
  // 当口头禅文本配置变化时，随机获取一条口头禅文本
  useEffect(() => {
    setRandom口头禅Text(getRandom口头禅Text());
  }, [口头禅TextConfig, getRandom口头禅Text]);

  // 当境哥牌显示时，随机获取一条口头禅文本
  useEffect(() => {
    if (showJingCard) {
      setRandom口头禅Text(getRandom口头禅Text());
    }
  }, [showJingCard, getRandom口头禅Text]);

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

  // 文字转语音函数
  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const speech = new SpeechSynthesisUtterance(text);
      speech.lang = 'zh-CN';
      speech.rate = 1;
      speech.pitch = 1;
      speech.volume = 1;
      speechSynthesis.speak(speech);
    }
  }, []);

  // 背景牌预加载
  useEffect(() => {
    const preloadImages = () => {
      const images = gameState.selectedImages?.backcardImages || [];
      const defaultImage = '/png/backcard/2.jpg';
      const imagesToPreload = images.length > 0 ? images : [defaultImage];
      
      // 预加载背景牌图片
      imagesToPreload.forEach((src) => {
        const img = new Image();
        img.src = src;
        img.onerror = () => {
          console.warn('背景牌图片加载失败:', src);
        };
      });
      
      // 预加载境哥牌图片
      const endcardImage = gameState.selectedImages?.endcardImage;
      if (endcardImage) {
        const endcardImg = new Image();
        endcardImg.src = endcardImage;
        endcardImg.onerror = () => {
          console.warn('境哥牌图片加载失败:', endcardImage);
          // 可以在这里设置默认图片作为回退
        };
      }
    };

    preloadImages();
  }, [gameState.selectedImages?.backcardImages, gameState.selectedImages?.endcardImage]);

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
    
    // 播放拍打卡片音效
    playAudio(paidaAudioRef);
    
    socket.emit('jingCardClick', {
      src: randomLogo,
      relativeX,
      relativeY
    });
  }, [socket, playAudio]);

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
    if (!queueControl.allowExitQueue) {
      alert('房主已禁止退出队列');
      return;
    }
    if (socket && user.id) {
      socket.emit('exitQueue', user.id);
      console.log('已发送退出队列请求');
    }
  }, [socket, user.id, playAudio, jingAudioRef, speakText, queueControl.allowExitQueue]);
  
  // 声明房主权限
  const handleClaimOwner = useCallback(() => {
    if (socket && user) {
      socket.emit('claimOwner', user.id);
    }
  }, [socket, user]);
  
  // 请求转让房主权限
  const handleRequestTransfer = useCallback(() => {
    if (socket && user && cooldown === 0) {
      socket.emit('requestTransfer', {
        playerId: user.id,
        nickname: user.nickname || '玩家'
      });
    }
  }, [socket, user, cooldown]);
  
  // 响应转让请求
  const handleRespondTransfer = useCallback((accept: boolean) => {
    if (socket) {
      socket.emit('respondTransfer', { accept });
    }
    setTransferRequest(null);
    setTransferCountdown(0);
    if (transferTimeout) {
      clearTimeout(transferTimeout);
      setTransferTimeout(null);
    }
  }, [socket, transferTimeout]);
  
  // 加载插播配置
  const loadIntermissionConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/intermission');
      if (response.ok) {
        const config = await response.json();
        setIntermissionConfig(config);
      }
    } catch (error) {
      console.error('加载插播配置失败:', error);
    }
  }, []);
  
  // 保存插播配置
  const saveIntermissionConfig = useCallback(async (config: any) => {
    try {
      const response = await fetch('/api/intermission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        setIntermissionConfig(config);
        alert('保存成功');
      } else {
        alert('保存失败');
      }
    } catch (error) {
      console.error('保存插播配置失败:', error);
      alert('保存失败');
    }
  }, []);
  
  // 处理插播
  const handleIntermission = useCallback((item: any) => {
    setCurrentIntermission(item);
    
    // 播放音效（如果有）
    if (item.audio) {
      const audio = new Audio(item.audio);
      audio.play().catch(error => console.error('播放音效失败:', error));
      setIntermissionAudio(audio);
    }
    
    // 定时关闭插播
    setTimeout(() => {
      setCurrentIntermission(null);
      if (intermissionAudio) {
        intermissionAudio.pause();
        setIntermissionAudio(null);
      }
    }, item.duration || 3000);
  }, [intermissionAudio]);

  const handleJoinQueue = useCallback(() => {
    if (!queueControl.allowJoinQueue) {
      alert('房主已禁止加入队列');
      return;
    }
    if (socket && user.id) {
      socket.emit('joinQueue', { id: user.id, nickname: user.nickname });
      console.log('已发送加入队列请求');
    }
  }, [socket, user.id, user.nickname, queueControl.allowJoinQueue]);

  const isUserInQueue = useMemo(() => {
    return gameState.queueState?.players.some((p: Player) => p.id === user.id) ?? false;
  }, [gameState.queueState, user.id]);

  useEffect(() => {
    if (gameState) {
      console.log('游戏状态变化:', { 
        gameOver: gameState.gameOver, 
        status: gameState.status,
        queueState: gameState.queueState
      });
      
      if (gameState.queueState) {
        const isTurn = !!(gameState.queueState.turnPlayer && 
                      gameState.queueState.turnPlayer.id === user.id);
        
        // 当回合变为当前用户时播放提醒音效
        if (isTurn && !prevIsMyTurnRef.current) {
          // 播放音效
          if (turnStartAudioRef.current) {
            turnStartAudioRef.current.play().catch(e => console.error('播放音效失败:', e));
          }
          
          // 播放文字转语音
          speakText(`轮到你了，${user.nickname}`);
          
          // 显示浏览器通知
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('轮到你了！', {
              body: `现在是你的回合，${user.nickname}`,
              icon: '/favicon.ico'
            });
          }
        }
        
        setIsMyTurn(isTurn);
        prevIsMyTurnRef.current = isTurn;
        setCurrentFlipCount(gameState.queueState.turnFlipCount || 0);
      }
      
      if (gameState.gameOver && gameState.status === 'ended') {
        console.log('游戏结束，开始倒计时:', autoRestartSeconds);
        setShowJingCard(true);
        
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
        setCountdown(0);
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
      }
    }
  }, [gameState, user.id, user.nickname, handleRestartGame, autoRestartSeconds, speakText]);

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

  // 监听倒计时变化，播放警告音效
  useEffect(() => {
    if (turnCountdown > 0 && turnCountdown <= 3 && isMyTurn) {
      // 播放倒计时警告音效
      if (countdownWarningAudioRef.current) {
        countdownWarningAudioRef.current.play().catch(e => console.error('播放音效失败:', e));
      }
    }
  }, [turnCountdown, isMyTurn]);

  // 监听倒计时，小于5秒或等于0秒时每2秒随机晃动一张牌
  useEffect(() => {
    let shakeInterval: NodeJS.Timeout | null = null;
    
    const startShaking = () => {
      if (gameState.cards) {
        const unflippedCards = gameState.cards.filter(card => !card.isFlipped);
        if (unflippedCards.length > 0) {
          // 使用基于倒计时值的确定性选择，确保所有玩家看到相同的晃动效果
          const seed = turnCountdown + Math.floor(Date.now() / 2000);
          const deterministicIndex = Math.abs(seed % unflippedCards.length);
          const selectedCard = unflippedCards[deterministicIndex];
          setShakingCardId(selectedCard.id);
          // 0.5秒后停止晃动，准备下一次
          setTimeout(() => {
            setShakingCardId(null);
          }, 500);
        }
      }
    };
    
    if ((turnCountdown < 5 || turnCountdown === 0) && gameState.cards) {
      // 立即开始晃动
      startShaking();
      // 每2秒晃动一次
      shakeInterval = setInterval(startShaking, 2000);
    }
    
    return () => {
      if (shakeInterval) {
        clearInterval(shakeInterval);
      }
      setShakingCardId(null);
    };
  }, [turnCountdown, isMyTurn, gameState.cards]);

  // 请求通知权限
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        console.log('通知权限:', permission);
      });
    }
  }, []);

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
      speakText('恭喜获得指定道具！');
      setSkillMessage('恭喜获得指定道具！');
      setTimeout(() => {
        setSkillMessage(null);
      }, 2000);
    };

    const handleItemUsed = (data: any) => {
      console.log('道具已使用:', data);
      setIsSelectingPlayer(false);
      // 设置被点名的玩家ID，用于闪烁效果
      if (data.targetPlayerId) {
        setTargetPlayerId(data.targetPlayerId);
        // 1秒后清除闪烁效果
        setTimeout(() => {
          setTargetPlayerId(null);
        }, 1000);
      }
      // 显示点名技能使用提示
      setSkillMessage('指定技能使用成功！');
      // 2秒后清除提示
      setTimeout(() => {
        setSkillMessage(null);
      }, 2000);
    };

    const handleReverseItemAwarded = (data: any) => {
      console.log('获得反转道具:', data);
      speakText('恭喜获得反转道具！');
      setSkillMessage('恭喜获得反转道具！');
      setTimeout(() => {
        setSkillMessage(null);
      }, 2000);
    };

    const handleReverseItemUsed = (data: any) => {
      console.log('反转道具已使用:', data);
      // 激活反转效果，使所有玩家闪烁
      setIsReverseEffectActive(true);
      // 1秒后清除闪烁效果
      setTimeout(() => {
        setIsReverseEffectActive(false);
      }, 1000);
      // 显示反转技能使用提示
      setSkillMessage('反转技能使用成功！');
      // 2秒后清除提示
      setTimeout(() => {
        setSkillMessage(null);
      }, 2000);
    };

    const handleTurnStarted = (data: any) => {
      console.log('回合开始:', data);
      if (data.playerId === user.id) {
        speakText(`轮到你了，${data.playerNickname}`);
      }
    };

    socket.on('jingCardFound', handleJingCardFound);
    socket.on('turnEnded', handleTurnEnded);
    socket.on('turnStarted', handleTurnStarted);
    socket.on('turnCountdownUpdated', handleTurnCountdownUpdated);
    socket.on('error', handleError);
    socket.on('jingCardClick', handleJingCardClick);
    socket.on('jingCardAudio', handleJingCardAudio);
    socket.on('itemAwarded', handleItemObtained);
    socket.on('itemUsed', handleItemUsed);
    socket.on('reverseItemAwarded', handleReverseItemAwarded);
    socket.on('reverseItemUsed', handleReverseItemUsed);
    socket.on('gameIniUpdated', () => {
      setGameIniTimestamp(Date.now());
    });
    socket.on('preferencesUpdated', (preferences: any) => {
      if (preferences.queueControl) {
        setQueueControl(preferences.queueControl);
      }
    });
    
    // 监听房主状态
    socket.on('ownerState', (state: { ownerId: string | null; isOwner: boolean }) => {
      setOwnerState(state);
    });
    
    // 监听转让请求
    socket.on('transferRequest', (request: { fromPlayerId: string; fromNickname: string }) => {
      setTransferRequest(request);
      // 10秒后自动同意
      if (transferTimeout) {
        clearTimeout(transferTimeout);
      }
      setTransferCountdown(10);
      const countdownInterval = setInterval(() => {
        setTransferCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      const timeout = setTimeout(() => {
        clearInterval(countdownInterval);
        setTransferCountdown(0);
        setTransferRequest(null);
      }, 10000);
      setTransferTimeout(timeout);
    });
    
    // 监听转让结果
    socket.on('transferResult', (result: { success: boolean; autoAccepted?: boolean }) => {
      if (result.success) {
        if (result.autoAccepted) {
          alert('房主权限已自动转让给你');
        } else {
          alert('房主已同意转让权限');
        }
      } else {
        alert('房主拒绝了转让请求');
      }
      setTransferRequest(null);
      setTransferCountdown(0);
      if (transferTimeout) {
        clearTimeout(transferTimeout);
        setTransferTimeout(null);
      }
      // 开始冷却
      setCooldown(60);
      const countdown = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(countdown);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });
    
    // 监听插播事件
    socket.on('intermission', (item: any) => {
      handleIntermission(item);
    });

    return () => {
      socket.off('jingCardFound', handleJingCardFound);
      socket.off('turnEnded', handleTurnEnded);
      socket.off('turnStarted', handleTurnStarted);
      socket.off('turnCountdownUpdated', handleTurnCountdownUpdated);
      socket.off('error', handleError);
      socket.off('jingCardClick', handleJingCardClick);
      socket.off('jingCardAudio', handleJingCardAudio);
      socket.off('itemAwarded', handleItemObtained);
      socket.off('itemUsed', handleItemUsed);
      socket.off('reverseItemAwarded', handleReverseItemAwarded);
      socket.off('reverseItemUsed', handleReverseItemUsed);
      socket.off('gameIniUpdated');
      socket.off('preferencesUpdated');
      socket.off('ownerState');
      socket.off('transferRequest');
      socket.off('transferResult');
      socket.off('intermission');
      if (transferTimeout) {
        clearTimeout(transferTimeout);
      }
    };
  }, [socket, user.id, playAudio, jingAudioRef, speakText]);
  
  // 加载插播配置
  useEffect(() => {
    loadIntermissionConfig();
  }, [loadIntermissionConfig]);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    const adminContainer = document.querySelector('.mobile-admin-container');
    const infoContainer = document.querySelector('.mobile-info-container');
    const ownerContainer = document.querySelector('.mobile-owner-container');
    const exitContainer = document.querySelector('.mobile-exit-container');
    if (!adminContainer || !infoContainer || !ownerContainer || !exitContainer) return;

    let hideTimer: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;

      if (scrollTop + clientHeight >= scrollHeight - 50) {
        adminContainer.classList.add('show');
        infoContainer.classList.add('show');
        ownerContainer.classList.add('show');
        exitContainer.classList.add('show');

        if (hideTimer) {
          clearTimeout(hideTimer);
        }

        hideTimer = setTimeout(() => {
          adminContainer.classList.remove('show');
          infoContainer.classList.remove('show');
          ownerContainer.classList.remove('show');
          exitContainer.classList.remove('show');
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
      {/* 回合通知栏 */}
      {isMyTurn && (
        <div className="turn-notification">
          <div className="notification-content">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
            </svg>
            <span>当前是你的回合！</span>
          </div>
        </div>
      )}

      {/* 倒计时显示 */}
      {isMyTurn && turnCountdown > 0 && (
        <div className="turn-countdown">
          <div className={`countdown-circle ${turnCountdown <= 3 ? 'warning' : ''}`}>
            <span className="countdown-number">{turnCountdown}</span>
          </div>
          <span className="countdown-label">剩余时间</span>
        </div>
      )}

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
                  <button onClick={() => setShowGameIni(true)} className="info-button">说明</button>
                  <button onClick={onAdminClick} className="admin-button">系统</button>
                  {ownerState.isOwner ? (
                    <button onClick={() => setShowOwnerPanel(true)} className="owner-button">房主</button>
                  ) : ownerState.ownerId ? (
                    <button onClick={handleRequestTransfer} className="owner-button" disabled={cooldown > 0}>
                      {cooldown > 0 ? `抢房(${cooldown}s)` : '抢房'}
                    </button>
                  ) : (
                    <button onClick={handleClaimOwner} className="owner-button">房主</button>
                  )}
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
              {displayConfig.showFlipCount && (
                <div className="flip-count">
                  翻牌:{currentFlipCount}
                </div>
              )}
              {displayConfig.showDrinkCount && (
                <div className="drink-count">
                  酒量:{gameState.drinkCount}
                </div>
              )}
              {displayConfig.showCountdownToggle && (
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
                  {gameState.showCountdown && displayConfig.showCountdownText && (
                    <span className="countdown-text">{turnCountdown}s</span>
                  )}
                </div>
              )}
              {displayConfig.showTurnImage && displayConfig.turnImageUrl && (
                <div className="turn-image">
                  <img src={displayConfig.turnImageUrl} alt="回合图片" />
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
                  {gameState.queueState.turnPlayer.nickname} 的回合
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
              {skillMessage && (
                <div className="skill-message">
                  {skillMessage}
                </div>
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
              className={`card ${card.isFlipped ? 'flipped' : ''} ${isUserInQueue && !isMyTurn ? 'disabled' : ''} ${shakingCardId === card.id ? 'shaking' : ''}`}
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
                      <img 
                        src={gameState.selectedImages?.endcardImage || '/png/endcard/1.jpg'} 
                        alt="境哥牌" 
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/png/endcard/1.jpg'; // 加载失败时使用默认图片
                          console.warn('境哥牌图片加载失败，使用默认图片');
                        }}
                      />
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
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/png/endcard/1.jpg'; // 加载失败时使用默认图片
                console.warn('境哥牌图片加载失败，使用默认图片');
              }}
            />
            <div className="jing-card-text">
              {random口头禅Text && (
                <p className="口头禅-text">
                  {random口头禅Text}
                </p>
              )}
              <p className="drink-punishment">
                {gameState.queueState?.turnPlayer?.nickname || '玩家'}罚酒
                {drinkTextConfig.enabled ? (
                  gameState.drinkCount > 10 ? 
                    drinkTextConfig.texts['>10'] || gameState.drinkCount.toString() : 
                    drinkTextConfig.texts[gameState.drinkCount.toString()] || gameState.drinkCount.toString()
                ) : (
                  gameState.drinkCount
                )}
                {!drinkTextConfig.enabled && '杯'}
              </p>
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
          <div className="queue-header">
            <h3>游戏队列</h3>
            <div className="queue-buttons">
              {gameState.item?.hasItem && gameState.item.itemPlayerId === user.id && !gameState.item.itemUsed && (
                <button 
                  className={`item-button ${(gameState.queueState?.players?.length || 0) < 3 ? 'item-button-disabled' : ''}`}
                  onClick={() => {
                    if ((gameState.queueState?.players?.length || 0) >= 3) {
                      setIsSelectingPlayer(true);
                    }
                  }}
                  disabled={(gameState.queueState?.players?.length || 0) < 3}
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                  </svg>
                  指定
                </button>
              )}
              {gameState.item?.reverseItem?.hasItem && gameState.item.reverseItem.itemPlayerId === user.id && !gameState.item.reverseItem.itemUsed && (
                <button 
                  className={`item-button ${(gameState.queueState?.players?.length || 0) < 3 ? 'item-button-disabled' : ''}`}
                  onClick={() => {
                    if (socket && (gameState.queueState?.players?.length || 0) >= 3) {
                      socket.emit('useReverseItem', { playerId: user.id });
                    }
                  }}
                  disabled={(gameState.queueState?.players?.length || 0) < 3}
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" fill="currentColor" />
                  </svg>
                  反转
                </button>
              )}
            </div>
          </div>
          <div className="queue-list">
            {gameState.queueState.players.slice(0, 10).map((player: Player, index: number) => (
              <div 
                key={player.id} 
                className={`queue-item ${player.isTurn ? 'current-turn' : ''} ${!player.isActive ? 'inactive' : ''} ${isSelectingPlayer && player.id !== user.id ? 'selectable' : ''} ${targetPlayerId === player.id ? 'target-player' : ''} ${isReverseEffectActive ? 'reverse-effect' : ''} ${ownerState.ownerId === player.id ? 'owner' : ''}`}
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
                {ownerState.ownerId === player.id && <span className="owner-indicator">房主</span>}
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
        <button onClick={onAdminClick} className="mobile-admin-button">系统</button>
      </div>

      <div className="mobile-info-container">
        <button 
          className="mobile-info-button"
          onClick={() => setShowGameIni(true)}
        >说明</button>
      </div>

      <div className="mobile-owner-container">
        {ownerState.isOwner ? (
          <button onClick={() => setShowOwnerPanel(true)} className="mobile-owner-button">房主</button>
        ) : ownerState.ownerId ? (
          <button onClick={handleRequestTransfer} className="mobile-owner-button" disabled={cooldown > 0}>
            {cooldown > 0 ? `抢(${cooldown}s)` : '抢房'}
          </button>
        ) : (
          <button onClick={handleClaimOwner} className="mobile-owner-button">房主</button>
        )}
      </div>

      <div className="mobile-exit-container">
        {isUserInQueue ? (
          <button onClick={handleExitQueue} className="mobile-exit-button">退出</button>
        ) : (
          <button onClick={handleJoinQueue} className="mobile-exit-button">加入</button>
        )}
      </div>

      {showGameIni && (
        <div 
          className="game-ini-container"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999
          }}
        >
          <img 
            src={`/png/ini/gameini.jpg?timestamp=${gameIniTimestamp}`} 
            alt="游戏说明" 
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              cursor: 'pointer'
            }}
            onClick={() => setShowGameIni(false)}
          />
        </div>
      )}

      {showOwnerPanel && (
        <div 
          className="owner-panel-container"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999
          }}
        >
          <div 
            className="owner-panel"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '30px',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            <h2 
              style={{
                color: '#fff',
                textAlign: 'center',
                marginBottom: '20px',
                fontSize: '28px',
                fontWeight: 'bold'
              }}
            >
              房主管理
            </h2>
            
            <div 
              style={{
                marginBottom: '20px'
              }}
            >
              <h3 
                style={{
                  color: '#fff',
                  fontSize: '18px',
                  marginBottom: '15px',
                  fontWeight: 'bold'
                }}
              >
                游戏控制
              </h3>
              <button 
                onClick={() => {
                  if (window.confirm('确定要重新开始游戏吗？')) {
                    if (socket) {
                      socket.emit('restartGame', { cardCount, playerId: 'admin' });
                      alert('游戏已重新开始');
                      setShowOwnerPanel(false);
                    } else {
                      alert('无法连接到服务器，请刷新页面重试');
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '15px 30px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#fff',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                重新开始游戏
              </button>
            </div>
            
            <div>
              <h3 
                style={{
                  color: '#fff',
                  fontSize: '18px',
                  marginBottom: '15px',
                  fontWeight: 'bold'
                }}
              >
                玩家管理
              </h3>
              {gameState.queueState?.players && gameState.queueState.players.length > 0 ? (
                <table 
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    overflow: 'hidden'
                  }}
                >
                  <thead>
                    <tr 
                      style={{
                        background: 'rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <th 
                        style={{
                          padding: '12px',
                          color: '#fff',
                          fontSize: '14px',
                          textAlign: 'left',
                          border: 'none'
                        }}
                      >
                        序号
                      </th>
                      <th 
                        style={{
                          padding: '12px',
                          color: '#fff',
                          fontSize: '14px',
                          textAlign: 'left',
                          border: 'none'
                        }}
                      >
                        玩家昵称
                      </th>
                      <th 
                        style={{
                          padding: '12px',
                          color: '#fff',
                          fontSize: '14px',
                          textAlign: 'left',
                          border: 'none'
                        }}
                      >
                        状态
                      </th>
                      <th 
                        style={{
                          padding: '12px',
                          color: '#fff',
                          fontSize: '14px',
                          textAlign: 'left',
                          border: 'none'
                        }}
                      >
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameState.queueState.players.map((player: Player, index: number) => (
                      <tr 
                        key={player.id} 
                        style={{
                          background: player.id === gameState.queueState?.turnPlayer?.id ? 'rgba(240, 147, 251, 0.2)' : 'transparent',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        <td 
                          style={{
                            padding: '12px',
                            color: '#fff',
                            fontSize: '14px',
                            border: 'none'
                          }}
                        >
                          {index + 1}
                        </td>
                        <td 
                          style={{
                            padding: '12px',
                            color: '#fff',
                            fontSize: '14px',
                            border: 'none'
                          }}
                        >
                          {player.nickname}
                        </td>
                        <td 
                          style={{
                            padding: '12px',
                            border: 'none'
                          }}
                        >
                          {player.id === gameState.queueState?.turnPlayer?.id ? (
                            <span 
                              style={{
                                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}
                            >
                              当前回合
                            </span>
                          ) : (
                            <span 
                              style={{
                                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}
                            >
                              在线
                            </span>
                          )}
                        </td>
                        <td 
                          style={{
                            padding: '12px',
                            border: 'none'
                          }}
                        >
                          <button
                            onClick={() => {
                              if (window.confirm('确定要踢走这个玩家吗？')) {
                                if (socket) {
                                  socket.emit('admin:kickPlayer', player.id);
                                  if (player.id === gameState.queueState?.turnPlayer?.id) {
                                    socket.emit('admin:endTurn', player.id);
                                  }
                                }
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: '#fff',
                              background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'transform 0.2s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          >
                            踢走
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div 
                  style={{
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.7)',
                    padding: '20px',
                    fontSize: '14px'
                  }}
                >
                  暂无玩家
                </div>
              )}
            </div>
            
            <div>
              <h3 
                style={{
                  color: '#fff',
                  fontSize: '18px',
                  marginBottom: '15px',
                  fontWeight: 'bold'
                }}
              >
                队列控制
              </h3>
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px'
                  }}
                >
                  <span 
                    style={{
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    允许加入队列
                  </span>
                  <button
                    onClick={() => {
                      const newValue = !queueControl.allowJoinQueue;
                      setQueueControl(prev => ({ ...prev, allowJoinQueue: newValue }));
                      if (socket) {
                        socket.emit('updateQueueControl', { allowJoinQueue: newValue, allowExitQueue: queueControl.allowExitQueue });
                      }
                    }}
                    style={{
                      width: '50px',
                      height: '28px',
                      borderRadius: '14px',
                      background: queueControl.allowJoinQueue ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' : 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <div 
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: '3px',
                        left: queueControl.allowJoinQueue ? '25px' : '3px',
                        transition: 'left 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                      }}
                    />
                  </button>
                </div>
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px'
                  }}
                >
                  <span 
                    style={{
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    允许退出队列
                  </span>
                  <button
                    onClick={() => {
                      const newValue = !queueControl.allowExitQueue;
                      setQueueControl(prev => ({ ...prev, allowExitQueue: newValue }));
                      if (socket) {
                        socket.emit('updateQueueControl', { allowJoinQueue: queueControl.allowJoinQueue, allowExitQueue: newValue });
                      }
                    }}
                    style={{
                      width: '50px',
                      height: '28px',
                      borderRadius: '14px',
                      background: queueControl.allowExitQueue ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' : 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <div 
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: '3px',
                        left: queueControl.allowExitQueue ? '25px' : '3px',
                        transition: 'left 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>
            
            <div 
              style={{
                marginTop: '40px'
              }}
            >
              <h3 
                style={{
                  color: '#fff',
                  fontSize: '18px',
                  marginBottom: '15px',
                  fontWeight: 'bold'
                }}
              >
                插播管理
              </h3>
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}
              >
                <div 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '15px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px'
                  }}
                >
                  <span 
                    style={{
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    启用插播
                  </span>
                  <button
                    onClick={() => {
                      const newConfig = { ...intermissionConfig, enabled: !intermissionConfig.enabled };
                      saveIntermissionConfig(newConfig);
                    }}
                    style={{
                      width: '50px',
                      height: '28px',
                      borderRadius: '14px',
                      background: intermissionConfig.enabled ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' : 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <div 
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: '3px',
                        left: intermissionConfig.enabled ? '25px' : '3px',
                        transition: 'left 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                      }}
                    />
                  </button>
                </div>
                
                <div 
                  style={{
                    padding: '20px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px'
                  }}
                >
                  <h4 
                    style={{
                      color: '#fff',
                      fontSize: '16px',
                      marginBottom: '15px',
                      fontWeight: 'bold'
                    }}
                  >
                    插播列表 ({intermissionConfig.items.length})
                  </h4>
                  <button
                    onClick={() => {
                      const newItem = {
                        id: Date.now().toString(),
                        type: 'image',
                        url: '',
                        duration: 3000,
                        audio: '',
                        triggers: {
                          useItem: true,
                          useReverseItem: true,
                          drinkCount: 5
                        }
                      };
                      const newConfig = {
                        ...intermissionConfig,
                        items: [...intermissionConfig.items, newItem]
                      };
                      saveIntermissionConfig(newConfig);
                    }}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#fff',
                      background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease',
                      marginBottom: '15px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    添加插播
                  </button>
                  {intermissionConfig.items.map((item: any, index: number) => (
                    <div 
                      key={item.id}
                      style={{
                        padding: '15px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        marginBottom: '10px'
                      }}
                    >
                      <div 
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '10px'
                        }}
                      >
                        <span 
                          style={{
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                        >
                          {item.type === 'image' ? '图片' : '视频'} #{index + 1}
                        </span>
                        <button
                          onClick={() => {
                            const newConfig = {
                              ...intermissionConfig,
                              items: intermissionConfig.items.filter((i: any) => i.id !== item.id)
                            };
                            saveIntermissionConfig(newConfig);
                          }}
                          style={{
                            padding: '5px 10px',
                            fontSize: '12px',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          删除
                        </button>
                      </div>
                      <div 
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <input
                          type="text"
                          placeholder="资源URL"
                          value={item.url}
                          onChange={(e) => {
                            const newItems = [...intermissionConfig.items];
                            newItems[index].url = e.target.value;
                            const newConfig = { ...intermissionConfig, items: newItems };
                            saveIntermissionConfig(newConfig);
                          }}
                          style={{
                            padding: '8px',
                            fontSize: '14px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '4px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            color: '#fff'
                          }}
                        />
                        <input
                          type="number"
                          placeholder="播放时长（毫秒）"
                          value={item.duration}
                          onChange={(e) => {
                            const newItems = [...intermissionConfig.items];
                            newItems[index].duration = parseInt(e.target.value) || 3000;
                            const newConfig = { ...intermissionConfig, items: newItems };
                            saveIntermissionConfig(newConfig);
                          }}
                          style={{
                            padding: '8px',
                            fontSize: '14px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '4px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            color: '#fff'
                          }}
                        />
                        <input
                          type="text"
                          placeholder="音效URL（可选）"
                          value={item.audio}
                          onChange={(e) => {
                            const newItems = [...intermissionConfig.items];
                            newItems[index].audio = e.target.value;
                            const newConfig = { ...intermissionConfig, items: newItems };
                            saveIntermissionConfig(newConfig);
                          }}
                          style={{
                            padding: '8px',
                            fontSize: '14px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '4px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            color: '#fff'
                          }}
                        />
                        <div 
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                            marginTop: '5px'
                          }}
                        >
                          <label 
                            style={{
                              color: '#fff',
                              fontSize: '12px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            使用指定技能时触发
                            <input
                              type="checkbox"
                              checked={item.triggers.useItem}
                              onChange={(e) => {
                                const newItems = [...intermissionConfig.items];
                                newItems[index].triggers.useItem = e.target.checked;
                                const newConfig = { ...intermissionConfig, items: newItems };
                                saveIntermissionConfig(newConfig);
                              }}
                              style={{
                                width: '16px',
                                height: '16px'
                              }}
                            />
                          </label>
                          <label 
                            style={{
                              color: '#fff',
                              fontSize: '12px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            使用反转技能时触发
                            <input
                              type="checkbox"
                              checked={item.triggers.useReverseItem}
                              onChange={(e) => {
                                const newItems = [...intermissionConfig.items];
                                newItems[index].triggers.useReverseItem = e.target.checked;
                                const newConfig = { ...intermissionConfig, items: newItems };
                                saveIntermissionConfig(newConfig);
                              }}
                              style={{
                                width: '16px',
                                height: '16px'
                              }}
                            />
                          </label>
                          <div 
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <label 
                              style={{
                                color: '#fff',
                                fontSize: '12px'
                              }}
                            >
                              酒量达到时触发
                            </label>
                            <input
                              type="number"
                              value={item.triggers.drinkCount || 0}
                              onChange={(e) => {
                                const newItems = [...intermissionConfig.items];
                                newItems[index].triggers.drinkCount = parseInt(e.target.value) || 0;
                                const newConfig = { ...intermissionConfig, items: newItems };
                                saveIntermissionConfig(newConfig);
                              }}
                              style={{
                                padding: '4px',
                                fontSize: '12px',
                                width: '60px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '4px',
                                background: 'rgba(0, 0, 0, 0.3)',
                                color: '#fff'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowOwnerPanel(false)}
              style={{
                width: '100%',
                padding: '15px 30px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#fff',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                marginTop: '20px',
                transition: 'transform 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              关闭
            </button>
          </div>
        </div>
      )}

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
      <audio ref={paidaAudioRef} src="/sounds/paida.mp3" preload="auto">
        您的浏览器不支持音频元素。
       </audio>
      <audio ref={turnStartAudioRef} src="/sounds/turn-start.mp3" preload="auto">
        您的浏览器不支持音频元素。
       </audio>
      
      {/* 房主转让请求确认弹窗 */}
      {transferRequest && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999
          }}
          onClick={() => handleRespondTransfer(false)}
        >
          <div 
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '30px',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 
              style={{
                color: '#fff',
                marginBottom: '20px',
                fontSize: '24px',
                fontWeight: 'bold'
              }}
            >
              转让请求
            </h2>
            <p 
              style={{
                color: '#fff',
                fontSize: '16px',
                marginBottom: '30px'
              }}
            >
              {transferRequest.fromNickname} 请求成为房主
            </p>
            <div 
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '20px',
                marginBottom: '20px'
              }}
            >
              <button
                onClick={() => handleRespondTransfer(true)}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#fff',
                  background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                同意
              </button>
              <button
                onClick={() => handleRespondTransfer(false)}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#fff',
                  background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                拒绝
              </button>
            </div>
            <p 
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '12px'
              }}
            >
              {transferCountdown > 0 ? `${transferCountdown}秒后自动同意` : '10秒后自动同意'}
            </p>
          </div>
        </div>
      )}
      
      {/* 插播播放组件 */}
      {currentIntermission && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 999999
          }}
        >
          <div 
            style={{
              maxWidth: '50%',
              maxHeight: '50vh',
              textAlign: 'center'
            }}
          >
            {currentIntermission.type === 'image' ? (
              <img
                src={currentIntermission.url}
                alt="插播"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '8px'
                }}
              />
            ) : (
              <video
                src={currentIntermission.url}
                autoPlay
                muted
                playsInline
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '8px'
                }}
              />
            )}
          </div>
        </div>
      )}
      <audio ref={countdownWarningAudioRef} src="/sounds/countdown-warning.mp3" preload="auto">
        您的浏览器不支持音频元素。
      </audio>
    </div>
  );
};

export default FlipCardGame;
