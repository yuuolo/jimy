const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

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

// 添加CORS中间件
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// 配置文件路径
const configFile = path.join(__dirname, 'config.json');

// 读取配置文件
function readConfig() {
  try {
    if (fs.existsSync(configFile)) {
      const data = fs.readFileSync(configFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    Logger.error('读取配置文件失败', { error: error.message });
  }
  return null;
}

// 写入配置文件
function writeConfig(config) {
  try {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
    Logger.info('配置文件已保存');
  } catch (error) {
    Logger.error('写入配置文件失败', { error: error.message });
  }
}

// 存储用户偏好设置
let userPreferences = readConfig() || {
  defaultCardCount: 9,
  defaultColumns: 3,
  gameTitle: '壹城翻牌游戏',
  timeoutMinutes: 3
};

// 全局游戏状态
let gameState = {
  id: 1,
  status: 'waiting', // waiting, playing, ended
  cardCount: 9,
  cards: [],
  gameOver: false,
  winner: null,
  queueState: null
};

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

// 保存偏好设置
app.post('/api/preferences', (req, res) => {
  const { defaultCardCount, defaultColumns, gameTitle } = req.body;
  let updated = false;
  
  // 更新默认牌数量
  if (defaultCardCount && typeof defaultCardCount === 'number' && defaultCardCount >= 6 && defaultCardCount <= 60) {
    userPreferences.defaultCardCount = defaultCardCount;
    // 更新游戏状态中的牌数量
    gameState.cardCount = defaultCardCount;
    Logger.info('默认牌数量已更新', { defaultCardCount });
    updated = true;
  }
  
  // 更新默认牌列数
  if (defaultColumns && typeof defaultColumns === 'number' && defaultColumns >= 3 && defaultColumns <= 6) {
    userPreferences.defaultColumns = defaultColumns;
    Logger.info('默认牌列数已更新', { defaultColumns });
    updated = true;
  }
  
  // 更新游戏标题
  if (gameTitle && typeof gameTitle === 'string' && gameTitle.trim().length > 0) {
    userPreferences.gameTitle = gameTitle.trim();
    Logger.info('游戏标题已更新', { gameTitle: userPreferences.gameTitle });
    updated = true;
  }
  
  if (updated) {
    // 保存配置到文件
    writeConfig(userPreferences);
    // 广播偏好设置更新给所有客户端
    io.emit('preferencesUpdated', userPreferences);
    // 同时广播游戏状态更新
    io.emit('gameState', gameState);
    res.json({ success: true, data: userPreferences });
  } else {
    res.status(400).json({ success: false, message: '没有有效的更新数据' });
  }
});

// 玩家队列管理
class PlayerQueue {
  constructor() {
    this.players = []; // 玩家队列
    this.playerSockets = new Map(); // socketId -> player
    this.playerLastSeen = new Map(); // playerId -> last seen timestamp
    this.OFFLINE_TIMEOUT = 3 * 60 * 1000; // 3分钟超时
    this.turnPlayer = null; // 当前回合玩家
    this.turnFlipCount = 0; // 当前回合翻牌数
  }

  // 添加玩家到队列
  addPlayer(socket, playerData) {
    const existingPlayer = this.players.find(p => p.id === playerData.id);
    
    if (existingPlayer) {
      // 玩家已存在，更新信息
      existingPlayer.nickname = playerData.nickname;
      existingPlayer.socketId = socket.id;
      existingPlayer.isActive = true; // 确保玩家状态为活跃
      this.playerSockets.set(socket.id, existingPlayer);
      this.playerLastSeen.set(playerData.id, Date.now());
      
      // 检查是否超时
      const lastSeen = this.playerLastSeen.get(playerData.id);
      const now = Date.now();
      
      if (now - lastSeen > this.OFFLINE_TIMEOUT) {
        // 超时，移到队尾
        this.movePlayerToEnd(playerData.id);
        Logger.info('玩家超时，移到队尾', { playerId: playerData.id, nickname: playerData.nickname });
      } else {
        // 未超时，直接更新状态为活跃
        Logger.info('玩家重连，状态更新为活跃', { playerId: playerData.id, nickname: playerData.nickname });
      }
    } else {
      // 新玩家，添加到队尾
      const newPlayer = {
        id: playerData.id,
        nickname: playerData.nickname,
        socketId: socket.id,
        isActive: true
      };
      
      this.players.push(newPlayer);
      this.playerSockets.set(socket.id, newPlayer);
      this.playerLastSeen.set(playerData.id, Date.now());
      
      Logger.info('新玩家加入队列', { playerId: playerData.id, nickname: playerData.nickname, queueLength: this.players.length });
    }
    
    // 设置当前回合玩家（如果没有）
    if (!this.turnPlayer && this.players.length > 0) {
      this.turnPlayer = this.players[0];
      this.turnFlipCount = 0;
      Logger.info('设置当前回合玩家', { playerId: this.turnPlayer.id, nickname: this.turnPlayer.nickname });
    }
    
    return this.getQueueState();
  }

  // 移除玩家
  removePlayer(socketId) {
    const player = this.playerSockets.get(socketId);
    if (player) {
      // 不是真正移除，而是标记为非活跃
      player.isActive = false;
      this.playerLastSeen.set(player.id, Date.now());
      this.playerSockets.delete(socketId);
      
      Logger.info('玩家断开连接', { playerId: player.id, nickname: player.nickname });
      
      // 检查是否需要更新当前回合玩家
      if (this.turnPlayer && this.turnPlayer.id === player.id) {
        this.nextTurn();
      }
    }
    return this.getQueueState();
  }

  // 移动玩家到队尾
  movePlayerToEnd(playerId) {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1 && playerIndex < this.players.length - 1) {
      const player = this.players.splice(playerIndex, 1)[0];
      this.players.push(player);
      return true;
    }
    return false;
  }

  // 下一回合
  nextTurn() {
    if (this.players.length > 0) {
      // 移动当前回合玩家到队尾
      if (this.turnPlayer) {
        this.movePlayerToEnd(this.turnPlayer.id);
      }
      
      // 设置新的当前回合玩家
      this.turnPlayer = this.players[0];
      this.turnFlipCount = 0;
      Logger.info('新回合开始', { playerId: this.turnPlayer.id, nickname: this.turnPlayer.nickname });
      return true;
    }
    return false;
  }

  // 检查玩家是否有操作权限
  hasPermission(playerId) {
    // 管理员有所有权限
    if (playerId === 'admin') {
      return true;
    }
    return this.turnPlayer && this.turnPlayer.id === playerId;
  }

  // 增加翻牌计数
  incrementFlipCount() {
    this.turnFlipCount++;
    return this.turnFlipCount;
  }

  // 获取队列状态
  getQueueState() {
    return {
      players: this.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        isActive: p.isActive,
        isTurn: this.turnPlayer && p.id === this.turnPlayer.id
      })),
      turnPlayer: this.turnPlayer ? {
        id: this.turnPlayer.id,
        nickname: this.turnPlayer.nickname
      } : null,
      turnFlipCount: this.turnFlipCount,
      queueLength: this.players.length
    };
  }

  // 清理超时玩家
  cleanupTimeoutPlayers() {
    const now = Date.now();
    const timeoutPlayers = [];
    
    for (const [playerId, lastSeen] of this.playerLastSeen.entries()) {
      if (now - lastSeen > this.OFFLINE_TIMEOUT) {
        timeoutPlayers.push(playerId);
      }
    }
    
    for (const playerId of timeoutPlayers) {
      const playerIndex = this.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        Logger.info('玩家超时被清理', { playerId });
        // 超时玩家移到队尾
        this.movePlayerToEnd(playerId);
      }
    }
  }

  // 心跳更新
  updatePlayerActivity(playerId) {
    this.playerLastSeen.set(playerId, Date.now());
  }

  // 玩家主动退出队列
  exitQueue(playerId) {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      const player = this.players[playerIndex];
      // 从队列中移除玩家
      this.players.splice(playerIndex, 1);
      
      // 清理相关数据
      this.playerSockets.delete(player.socketId);
      this.playerLastSeen.delete(playerId);
      
      // 检查是否需要更新当前回合玩家
      if (this.turnPlayer && this.turnPlayer.id === playerId) {
        this.nextTurn();
      }
      
      return true;
    }
    return false;
  }
}

// 初始化玩家队列
const playerQueue = new PlayerQueue();

// 从配置文件设置超时时间
if (userPreferences.timeoutMinutes) {
  playerQueue.OFFLINE_TIMEOUT = userPreferences.timeoutMinutes * 60 * 1000;
  Logger.info('从配置文件加载超时时间', { timeoutMinutes: userPreferences.timeoutMinutes });
}

// 定期清理超时玩家
setInterval(() => {
  playerQueue.cleanupTimeoutPlayers();
}, 30000); // 每30秒检查一次



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
    winner: null,
    queueState: playerQueue.getQueueState()
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

  // 玩家加入队列
  socket.on('joinQueue', (playerData) => {
    Logger.info('玩家加入队列', { socketId: socket.id, playerId: playerData.id, nickname: playerData.nickname });
    
    // 添加玩家到队列
    const queueState = playerQueue.addPlayer(socket, playerData);
    
    // 更新游戏状态
    gameState.queueState = queueState;
    
    // 广播游戏状态给所有玩家
    io.emit('gameState', gameState);
    
    // 广播队列状态给所有玩家
    io.emit('queueUpdated', queueState);
  });

  // 开始游戏
  socket.on('startGame', (data) => {
    const { cardCount, playerId } = data;
    Logger.info('收到开始游戏请求', { socketId: socket.id, cardCount, playerId });
    
    // 检查权限（只有当前回合玩家可以开始游戏）
    if (!playerQueue.hasPermission(playerId)) {
      Logger.warn('无权限开始游戏', { socketId: socket.id, playerId });
      socket.emit('error', { message: '不是你的回合，无法开始游戏' });
      return;
    }
    
    initializeGame(cardCount);
  });

  // 处理卡片翻转
  socket.on('flipCard', (data) => {
    const { cardId, playerId } = data;
    Logger.debug('收到卡片翻转请求', { socketId: socket.id, cardId, playerId });
    
    if (gameState.gameOver) {
      Logger.warn('游戏已结束，忽略卡片翻转请求', { socketId: socket.id, cardId });
      socket.emit('error', { message: '游戏已结束' });
      return;
    }
    
    // 检查权限
    if (!playerQueue.hasPermission(playerId)) {
      Logger.warn('无权限翻转卡片', { socketId: socket.id, playerId });
      socket.emit('error', { message: '不是你的回合，无法翻牌' });
      return;
    }
    
    // 增加翻牌计数
    const flipCount = playerQueue.incrementFlipCount();
    Logger.info('玩家翻牌', { playerId, cardId, flipCount });
    
    // 更新游戏状态
    const updatedCards = gameState.cards.map(card => {
      if (card.id === cardId && !card.isFlipped) {
        // 检查是否是境哥牌
        if (card.isJingCard) {
          // 游戏结束
          gameState.gameOver = true;
          gameState.status = 'ended';
          gameState.winner = playerQueue.turnPlayer; // 设置赢家
          Logger.info('境哥牌被找到，游戏结束', { socketId: socket.id, cardId, winner: playerQueue.turnPlayer });
          
          // 广播赢家信息
          io.emit('jingCardFound', {
            player: playerQueue.turnPlayer,
            flipCount: flipCount
          });
        } else {
          Logger.debug('普通牌被翻转', { socketId: socket.id, cardId });
        }
        return { ...card, isFlipped: true };
      }
      return card;
    });
    
    gameState.cards = updatedCards;
    gameState.queueState = playerQueue.getQueueState();
    
    // 广播游戏状态给所有玩家
    io.emit('gameState', gameState);
    Logger.debug('游戏状态已更新并广播', { gameState: { ...gameState, cards: gameState.cards.length } });
  });

  // 结束回合
  socket.on('endTurn', (playerId) => {
    Logger.info('收到结束回合请求', { socketId: socket.id, playerId });
    
    // 检查权限
    if (!playerQueue.hasPermission(playerId)) {
      Logger.warn('无权限结束回合', { socketId: socket.id, playerId });
      socket.emit('error', { message: '不是你的回合，无法结束' });
      return;
    }
    
    // 获取当前回合翻牌数
    const flipCount = playerQueue.turnFlipCount;
    
    // 结束回合，移到队尾
    playerQueue.nextTurn();
    
    // 更新游戏状态
    gameState.queueState = playerQueue.getQueueState();
    
    // 广播游戏状态给所有玩家
    io.emit('gameState', gameState);
    
    // 广播回合结束信息
    io.emit('turnEnded', {
      playerId: playerId,
      flipCount: flipCount,
      nextTurnPlayer: playerQueue.turnPlayer
    });
    
    Logger.info('回合结束', { playerId, flipCount, nextTurnPlayer: playerQueue.turnPlayer });
  });

  // 重新开始游戏
  socket.on('restartGame', (data) => {
    const { cardCount, playerId } = data;
    const finalCardCount = cardCount || gameState.cardCount;
    Logger.info('收到重新开始游戏请求', { socketId: socket.id, cardCount: finalCardCount, playerId });
    
    // 检查权限
    if (!playerQueue.hasPermission(playerId)) {
      Logger.warn('无权限重新开始游戏', { socketId: socket.id, playerId });
      socket.emit('error', { message: '不是你的回合，无法重新开始游戏' });
      return;
    }
    
    initializeGame(finalCardCount);
  });

  // 心跳更新
  socket.on('heartbeat', (playerId) => {
    if (playerId) {
      playerQueue.updatePlayerActivity(playerId);
    }
  });

  // 玩家退出队列
  socket.on('exitQueue', (playerId) => {
    Logger.info('玩家退出队列', { socketId: socket.id, playerId });
    
    // 处理玩家退出队列
    const success = playerQueue.exitQueue(playerId);
    
    if (success) {
      // 更新游戏状态
      gameState.queueState = playerQueue.getQueueState();
      
      // 广播游戏状态给所有玩家
      io.emit('gameState', gameState);
      
      // 广播队列状态给所有玩家
      io.emit('queueUpdated', gameState.queueState);
      
      Logger.info('玩家成功退出队列', { socketId: socket.id, playerId });
    } else {
      Logger.warn('玩家退出队列失败，玩家不存在', { socketId: socket.id, playerId });
      socket.emit('error', { message: '退出队列失败，玩家不存在' });
    }
  });

  // 管理相关事件
  socket.on('admin:authenticated', () => {
    Logger.info('管理员认证成功', { socketId: socket.id });
    
    // 发送当前玩家列表
    socket.emit('admin:playersList', playerQueue.getQueueState().players);
    
    // 发送当前超时设置
    socket.emit('admin:currentTimeout', playerQueue.OFFLINE_TIMEOUT / (1000 * 60));
  });

  // 设置超时时间
  socket.on('admin:setTimeout', (minutes) => {
    if (minutes && typeof minutes === 'number' && minutes >= 1 && minutes <= 30) {
      const newTimeout = minutes * 60 * 1000;
      playerQueue.OFFLINE_TIMEOUT = newTimeout;
      // 更新用户偏好设置
      userPreferences.timeoutMinutes = minutes;
      // 保存配置到文件
      writeConfig(userPreferences);
      Logger.info('玩家离线超时时间已更新', { timeoutMinutes: minutes, timeoutMs: newTimeout });
    } else {
      Logger.warn('无效的超时时间设置', { minutes });
      socket.emit('error', { message: '超时时间必须在1-30分钟之间' });
    }
  });

  // 踢走玩家
  socket.on('admin:kickPlayer', (playerId) => {
    if (playerId) {
      const playerIndex = playerQueue.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        const player = playerQueue.players[playerIndex];
        Logger.info('管理员踢走玩家', { playerId, nickname: player.nickname });
        
        // 从队列中移除玩家
        playerQueue.players.splice(playerIndex, 1);
        
        // 更新游戏状态
        gameState.queueState = playerQueue.getQueueState();
        
        // 广播游戏状态给所有玩家
        io.emit('gameState', gameState);
        
        // 广播队列状态给所有玩家
        io.emit('queueUpdated', gameState.queueState);
        
        // 发送更新后的玩家列表给管理员
        socket.emit('admin:playersList', playerQueue.getQueueState().players);
      } else {
        Logger.warn('尝试踢走不存在的玩家', { playerId });
        socket.emit('error', { message: '玩家不存在' });
      }
    }
  });

  // 结束回合
  socket.on('admin:endTurn', (playerId) => {
    if (playerId) {
      const currentPlayer = playerQueue.turnPlayer;
      if (currentPlayer && currentPlayer.id === playerId) {
        // 获取当前回合翻牌数
        const flipCount = playerQueue.turnFlipCount;
        
        // 结束回合，移到队尾
        playerQueue.nextTurn();
        
        // 更新游戏状态
        gameState.queueState = playerQueue.getQueueState();
        
        // 广播游戏状态给所有玩家
        io.emit('gameState', gameState);
        
        // 广播回合结束信息
        io.emit('turnEnded', {
          playerId: playerId,
          flipCount: flipCount,
          nextTurnPlayer: playerQueue.turnPlayer
        });
        
        Logger.info('管理员强制结束回合', { playerId, flipCount, nextTurnPlayer: playerQueue.turnPlayer });
      }
    }
  });

  // 断开连接处理
  socket.on('disconnect', () => {
    Logger.info('用户断开连接', { socketId: socket.id });
    
    // 从队列中移除玩家
    const queueState = playerQueue.removePlayer(socket.id);
    
    // 更新游戏状态
    gameState.queueState = queueState;
    
    // 广播游戏状态给所有玩家
    io.emit('gameState', gameState);
    
    // 广播队列状态给所有玩家
    io.emit('queueUpdated', queueState);
  });
});

// 启动服务器
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  Logger.info(`服务器运行在 http://jimy.novrein.com:${PORT}`);
});
