const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// 日志系统
class Logger {
  static levels = {
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR',
    debug: 'DEBUG'
  };

  static getTimestamp() {
    return new Date().toISOString();
  }

  static log(level, message, data = {}) {
    const timestamp = this.getTimestamp();
    const logMessage = {
      timestamp,
      level,
      message,
      ...data
    };
    
    console.log(JSON.stringify(logMessage));
  }

  static info(message, data = {}) {
    this.log(this.levels.info, message, data);
  }

  static warn(message, data = {}) {
    this.log(this.levels.warn, message, data);
  }

  static error(message, data = {}) {
    this.log(this.levels.error, message, data);
  }

  static debug(message, data = {}) {
    this.log(this.levels.debug, message, data);
  }
}

// 创建Express应用
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(express.json());
app.use(express.static('dist'));
app.use(express.static('public'));

// 简单的健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '服务器运行正常' });
});

// 获取默认牌数量
app.get('/api/preferences', (req, res) => {
  res.json(userPreferences);
});

// 保存默认牌数量
app.post('/api/preferences', (req, res) => {
  const { defaultCardCount } = req.body;
  if (defaultCardCount && typeof defaultCardCount === 'number' && defaultCardCount >= 6 && defaultCardCount <= 60) {
    userPreferences.defaultCardCount = defaultCardCount;
    // 更新游戏状态中的牌数量
    gameState.cardCount = defaultCardCount;
    Logger.info('默认牌数量已更新', { defaultCardCount });
    // 广播牌数量更新给所有客户端
    io.emit('preferencesUpdated', userPreferences);
    // 同时广播游戏状态更新
    io.emit('gameState', gameState);
    res.json({ success: true, data: userPreferences });
  } else {
    Logger.warn('无效的牌数量', { defaultCardCount });
    res.status(400).json({ success: false, message: '牌数量必须在6-60之间' });
  }
});

// 全局游戏状态
let gameState = {
  id: 1,
  status: 'waiting', // waiting, playing, ended
  cardCount: 9,
  cards: [],
  gameOver: false,
  winner: null
};

// 存储用户偏好设置
let userPreferences = {
  defaultCardCount: 9
};

// 初始化游戏
function initializeGame(cardCount) {
  const newCards = [];
  // 随机位置放置境哥牌
  const jingCardPosition = Math.floor(Math.random() * cardCount);
  
  for (let i = 0; i < cardCount; i++) {
    newCards.push({
      id: i,
      isFlipped: false,
      isJingCard: i === jingCardPosition
    });
  }
  
  gameState = {
    ...gameState,
    status: 'playing',
    cardCount: cardCount,
    cards: newCards,
    gameOver: false,
    winner: null
  };
  
  Logger.info('游戏初始化成功', { gameState });
  // 广播游戏状态给所有玩家
  io.emit('gameState', gameState);
}

// WebSocket连接处理
io.on('connection', (socket) => {
  Logger.info('新用户连接', { socketId: socket.id });
  
  // 发送欢迎消息和初始游戏状态
  socket.emit('welcome', {
    gameState: gameState
  });

  // 开始游戏
  socket.on('startGame', (data) => {
    const { cardCount } = data;
    Logger.info('收到开始游戏请求', { socketId: socket.id, cardCount });
    initializeGame(cardCount);
  });

  // 处理卡片翻转
  socket.on('flipCard', (cardId) => {
    Logger.debug('收到卡片翻转请求', { socketId: socket.id, cardId });
    
    if (gameState.gameOver) {
      Logger.warn('游戏已结束，忽略卡片翻转请求', { socketId: socket.id, cardId });
      return;
    }
    
    // 更新游戏状态
    const updatedCards = gameState.cards.map(card => {
      if (card.id === cardId && !card.isFlipped) {
        // 检查是否是境哥牌
        if (card.isJingCard) {
          // 游戏结束
          gameState.gameOver = true;
          gameState.status = 'ended';
          Logger.info('境哥牌被找到，游戏结束', { socketId: socket.id, cardId });
        } else {
          Logger.debug('普通牌被翻转', { socketId: socket.id, cardId });
        }
        return { ...card, isFlipped: true };
      }
      return card;
    });
    
    gameState.cards = updatedCards;
    
    // 广播游戏状态给所有玩家
    io.emit('gameState', gameState);
    Logger.debug('游戏状态已更新并广播', { gameState: { ...gameState, cards: gameState.cards.length } });
  });

  // 重新开始游戏
  socket.on('restartGame', (data) => {
    const { cardCount } = data;
    const finalCardCount = cardCount || gameState.cardCount;
    Logger.info('收到重新开始游戏请求', { socketId: socket.id, cardCount: finalCardCount });
    initializeGame(finalCardCount);
  });

  // 断开连接处理
  socket.on('disconnect', () => {
    Logger.info('用户断开连接', { socketId: socket.id });
  });
});

// 启动服务器
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  Logger.info(`服务器运行在 http://localhost:${PORT}`);
});
