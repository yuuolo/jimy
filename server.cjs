const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 读取并随机选择图片
function selectRandomImages() {
  try {
    const publicDir = path.join(__dirname, 'public');
    
    // 读取backcard目录
    const backcardDir = path.join(publicDir, 'png', 'backcard');
    const backcardImages = fs.readdirSync(backcardDir).filter(file => {
      return /\.(jpg|jpeg|png|gif|svg)$/i.test(file);
    }).map(file => `/png/backcard/${file}`);
    
    // 读取endcard目录
    const endcardConfig = userPreferences.endcardConfig || {};
    const endcardDir = path.join(publicDir, endcardConfig.directory || 'png/endcard');
    const endcardImages = fs.readdirSync(endcardDir).filter(file => {
      return /\.(jpg|jpeg|png|gif|svg)$/i.test(file);
    }).map(file => `/${endcardConfig.directory || 'png/endcard'}/${file}`);
    
    // 根据选择模式选择背景牌
    let selectedBackcards = [];
    const selectionMode = userPreferences.backcardSelectionMode || 'random';
    const selectionCount = userPreferences.backcardSelectionCount || 3;
    
    if (selectionMode === 'all') {
      // 使用所有背景牌
      selectedBackcards = backcardImages.length > 0 ? backcardImages : ['/png/backcard/2.jpg'];
    } else if (selectionMode === 'fixed') {
      // 使用固定的背景牌列表
      const fixedBackcards = userPreferences.selectedBackcards || [];
      if (fixedBackcards.length > 0) {
        selectedBackcards = fixedBackcards.filter(filename => 
          backcardImages.some(img => img.includes(filename))
        ).map(filename => `/png/backcard/${filename}`);
      }
      if (selectedBackcards.length === 0) {
        selectedBackcards = ['/png/backcard/2.jpg'];
      }
    } else {
      // 随机选择模式（默认）
      const shuffledBackcards = [...backcardImages].sort(() => Math.random() - 0.5);
      const count = Math.min(selectionCount, backcardImages.length);
      selectedBackcards = shuffledBackcards.slice(0, count);
    }
    
    // 如果没有背景牌，使用默认图片
    if (selectedBackcards.length === 0) {
      selectedBackcards = ['/png/backcard/2.jpg'];
    }
    
    // 从endcard目录随机选择1张图片
    let selectedEndcard = '';
    if (endcardImages.length > 0) {
      selectedEndcard = endcardImages[Math.floor(Math.random() * endcardImages.length)];
    }
    
    return {
      backcardImages: selectedBackcards,
      endcardImage: selectedEndcard
    };
  } catch (error) {
    Logger.error('选择随机图片失败', { error: error.message });
    // 回退到默认图片
    return {
      backcardImages: ['/png/backcard/2.jpg'],
      endcardImage: `/${userPreferences.endcardConfig?.directory || 'png/endcard'}/${userPreferences.endcardConfig?.defaultImage || '1.jpg'}`
    };
  }
}

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

// 默认配置
const defaultPreferences = {
  defaultCardCount: 9,
  defaultColumns: 3,
  gameTitle: '',
  timeoutMinutes: 3,
  itemFlipCountThreshold: 3,
  reverseItemFlipCountThreshold: 2,

  drinkTextConfig: {
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
  },
  // 口头禅文本配置
 口头禅TextConfig: {
    enabled: true,
    texts: [
      '勇敢的心！',
      '再来一杯！',
      '干了这杯！',
      '好酒！',
      '喝起来！'
    ]
  },
  // 显示控制选项
  displayConfig: {
    showFlipCount: true,
    showDrinkCount: true,
    showCountdownToggle: true,
    showCountdownText: true,
    showTurnImage: false,
    turnImageUrl: ''
  },
  // 队列控制选项
  queueControl: {
    allowJoinQueue: true,
    allowExitQueue: true
  }
};

// 存储用户偏好设置 - 优先使用 config.json 文件中的配置，缺失字段使用默认值
const configData = readConfig() || {};
let userPreferences = {
  ...defaultPreferences,
  ...configData
};



// 配置归档管理
const CONFIGURATIONS_DIR = path.join(__dirname, 'public', 'configurations');
// 确保配置目录存在
if (!fs.existsSync(CONFIGURATIONS_DIR)) {
  fs.mkdirSync(CONFIGURATIONS_DIR, { recursive: true });
}

// 境哥牌图片信息缓存
let endcardCache = {
  data: {},
  timestamp: 0
};

// 检查缓存是否过期
function isCacheExpired() {
  const expiryMinutes = userPreferences.endcardConfig?.cacheExpiryMinutes || 30;
  return Date.now() - endcardCache.timestamp > expiryMinutes * 60 * 1000;
}

// 清除过期缓存
function clearExpiredCache() {
  if (isCacheExpired()) {
    endcardCache = {
      data: {},
      timestamp: Date.now()
    };
    Logger.info('境哥牌缓存已过期并清除');
  }
}

// 缓存境哥牌图片信息
function cacheEndcardInfo(filename, info) {
  if (userPreferences.endcardConfig?.cacheEnabled !== false) {
    endcardCache.data[filename] = {
      info: info,
      timestamp: Date.now()
    };
    endcardCache.timestamp = Date.now();
  }
}

// 获取缓存的境哥牌图片信息
function getCachedEndcardInfo(filename) {
  if (userPreferences.endcardConfig?.cacheEnabled !== false) {
    clearExpiredCache();
    const cached = endcardCache.data[filename];
    if (cached) {
      Logger.debug('从缓存获取境哥牌信息', { filename });
      return cached.info;
    }
  }
  return null;
}

// 全局游戏状态
let gameState = {
  id:1,
  status: 'waiting', // waiting, playing, ended
  cardCount: 9,
  cards: [],
  gameOver: false,
  winner: null,
  queueState: null,
  drinkCount: 1,
  showCountdown: false,
  item: {
    hasItem: false,
    itemPlayerId: null,
    itemUsed: false,
    reverseItem: {
      hasItem: false,
      itemPlayerId: null,
      itemUsed: false
    }
  }
};

// 房主权限管理
let ownerState = {
  ownerId: null,         // 当前房主ID
  ownerSocketId: null,   // 当前房主SocketID
  transferRequest: null, // 转让请求
  cooldown: {}           // 抢房冷却
};

// 插播配置管理
let intermissionConfig = userPreferences.intermissionConfig || {
  enabled: true,
  items: [
    // {
    //   id: '1',
    //   type: 'image', // image or video
    //   url: 'https://example.com/image.jpg',
    //   duration: 3000, // 播放时长（毫秒）
    //   audio: 'https://example.com/audio.mp3', // 音效（可选）
    //   triggers: {
    //     useItem: true, // 使用指定技能时触发
    //     useReverseItem: true, // 使用反转技能时触发
    //     drinkCount: 5 // 酒量达到此值时触发
    //   }
    // }
  ]
};

// 中间件
app.use(express.json());

// 配置multer用于插播视频上传
const intermissionVideoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const videoDir = path.join(__dirname, 'public', 'upload', 'video');
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }
    cb(null, videoDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = file.originalname.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_');
    cb(null, uniqueSuffix + '-' + originalName);
  }
});

const uploadIntermissionVideo = multer({
  storage: intermissionVideoStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB限制
  },
  fileFilter: function (req, file, cb) {
    // 只接受视频文件
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('只接受视频文件'), false);
    }
    cb(null, true);
  }
});

// 配置multer用于插播图片上传
const intermissionImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const imageDir = path.join(__dirname, 'public', 'upload', 'image');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }
    cb(null, imageDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = file.originalname.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_');
    cb(null, uniqueSuffix + '-' + originalName);
  }
});

const uploadIntermissionImage = multer({
  storage: intermissionImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: function (req, file, cb) {
    // 只接受图片文件
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只接受图片文件'), false);
    }
    cb(null, true);
  }
});

// 配置multer用于插播音效上传
const intermissionAudioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const audioDir = path.join(__dirname, 'public', 'upload', 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    cb(null, audioDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = file.originalname.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_');
    cb(null, uniqueSuffix + '-' + originalName);
  }
});

const uploadIntermissionAudio = multer({
  storage: intermissionAudioStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: function (req, file, cb) {
    // 只接受音频文件
    if (!file.mimetype.startsWith('audio/')) {
      return cb(new Error('只接受音频文件'), false);
    }
    cb(null, true);
  }
});

// 插播配置API端点
app.get('/api/intermission', (req, res) => {
  try {
    res.json(intermissionConfig);
  } catch (error) {
    Logger.error('获取插播配置失败', { error: error.message });
    res.status(500).json({ error: '获取插播配置失败' });
  }
});

app.post('/api/intermission', (req, res) => {
  try {
    intermissionConfig = req.body;
    userPreferences.intermissionConfig = intermissionConfig;
    writeConfig(userPreferences);
    Logger.info('更新插播配置', { itemsCount: intermissionConfig.items.length });
    res.json({ success: true });
  } catch (error) {
    Logger.error('更新插播配置失败', { error: error.message });
    res.status(500).json({ error: '更新插播配置失败' });
  }
});

// 上传插播视频
app.post('/api/upload-intermission-video', uploadIntermissionVideo.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }
    
    const file = req.file;
    const videoUrl = `/upload/video/${file.filename}`;
    
    Logger.info('插播视频上传成功', { 
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      videoUrl: videoUrl
    });
    
    res.json({ 
      success: true, 
      message: '插播视频上传成功',
      videoUrl: videoUrl
    });
  } catch (error) {
    Logger.error('插播视频上传失败', { error: error.message });
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

// 上传插播图片
app.post('/api/upload-intermission-image', uploadIntermissionImage.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }
    
    const file = req.file;
    const imageUrl = `/upload/image/${file.filename}`;
    
    Logger.info('插播图片上传成功', { 
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      imageUrl: imageUrl
    });
    
    res.json({ 
      success: true, 
      message: '插播图片上传成功',
      imageUrl: imageUrl
    });
  } catch (error) {
    Logger.error('插播图片上传失败', { error: error.message });
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

// 上传插播音效
app.post('/api/upload-intermission-audio', uploadIntermissionAudio.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }
    
    const file = req.file;
    const audioUrl = `/upload/audio/${file.filename}`;
    
    Logger.info('插播音效上传成功', { 
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      audioUrl: audioUrl
    });
    
    res.json({ 
      success: true, 
      message: '插播音效上传成功',
      audioUrl: audioUrl
    });
  } catch (error) {
    Logger.error('插播音效上传失败', { error: error.message });
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

// 获取插播文件列表
app.get('/api/intermission-files', (req, res) => {
  try {
    const videoDir = path.join(__dirname, 'public', 'upload', 'video');
    const imageDir = path.join(__dirname, 'public', 'upload', 'image');
    const audioDir = path.join(__dirname, 'public', 'upload', 'audio');
    
    const videoFiles = fs.existsSync(videoDir) ? fs.readdirSync(videoDir).filter(file => /\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i.test(file)).map(file => ({
      type: 'video',
      name: file,
      url: `/upload/video/${file}`
    })) : [];
    
    const imageFiles = fs.existsSync(imageDir) ? fs.readdirSync(imageDir).filter(file => /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(file)).map(file => ({
      type: 'image',
      name: file,
      url: `/upload/image/${file}`
    })) : [];
    
    const audioFiles = fs.existsSync(audioDir) ? fs.readdirSync(audioDir).filter(file => /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(file)).map(file => ({
      type: 'audio',
      name: file,
      url: `/upload/audio/${file}`
    })) : [];
    
    res.json({
      success: true,
      files: {
        video: videoFiles,
        image: imageFiles,
        audio: audioFiles
      }
    });
  } catch (error) {
    Logger.error('获取插播文件列表失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取文件列表失败' });
  }
});

// 删除插播文件
app.delete('/api/intermission-file', (req, res) => {
  try {
    const { type, filename } = req.query;
    
    if (!type || !filename) {
      return res.status(400).json({ success: false, message: '缺少参数' });
    }
    
    let filePath;
    if (type === 'video') {
      filePath = path.join(__dirname, 'public', 'upload', 'video', filename);
    } else if (type === 'image') {
      filePath = path.join(__dirname, 'public', 'upload', 'image', filename);
    } else if (type === 'audio') {
      filePath = path.join(__dirname, 'public', 'upload', 'audio', filename);
    } else {
      return res.status(400).json({ success: false, message: '无效的文件类型' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }
    
    fs.unlinkSync(filePath);
    Logger.info('插播文件删除成功', { type, filename });
    
    res.json({ success: true, message: '文件删除成功' });
  } catch (error) {
    Logger.error('插播文件删除失败', { error: error.message });
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

app.use(express.static('dist'));
app.use(express.static('public'));

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/png/ini/');
  },
  filename: function (req, file, cb) {
    cb(null, 'gameini.jpg');
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  }
});

// 配置multer用于背景牌上传
const backcardStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/png/backcard/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadBackcard = multer({
  storage: backcardStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: function (req, file, cb) {
    // 只接受图片文件
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只接受图片文件'), false);
    }
    cb(null, true);
  }
});

// 配置multer用于境哥牌上传
const endcardStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/png/endcard/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadEndcard = multer({
  storage: endcardStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: function (req, file, cb) {
    // 只接受图片文件
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只接受图片文件'), false);
    }
    cb(null, true);
  }
});

// 配置multer用于回合图片上传
const turnImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const turnImageDir = path.join(__dirname, 'public', 'png', 'turn-image');
    // 确保目录存在
    if (!fs.existsSync(turnImageDir)) {
      fs.mkdirSync(turnImageDir, { recursive: true });
    }
    cb(null, turnImageDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadTurnImage = multer({
  storage: turnImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: function (req, file, cb) {
    // 只接受图片文件
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只接受图片文件'), false);
    }
    cb(null, true);
  }
});

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
  const { 
    defaultCardCount, 
    defaultColumns, 
    gameTitle, 
    autoRestartSeconds, 
    drinkParameter, 
    firstCardDrinkCount, 
    lastCardDrinkCount,
    turnTimeoutSeconds,
    itemFlipCountThreshold,
    reverseItemFlipCountThreshold,
    backcardSelectionMode,
    backcardSelectionCount,
    selectedBackcards,
    displayConfig,
    口头禅TextConfig
  } = req.body;
  let updated = false;
  
  // 更新默认牌数量
  if (defaultCardCount && typeof defaultCardCount === 'number' && defaultCardCount >= 6 && defaultCardCount <= 60) {
    userPreferences.defaultCardCount = defaultCardCount;
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
  

  
  // 更新自动重启时间
  if (autoRestartSeconds && typeof autoRestartSeconds === 'number' && autoRestartSeconds >= 5 && autoRestartSeconds <= 60) {
    userPreferences.autoRestartSeconds = autoRestartSeconds;
    Logger.info('自动重启时间已更新', { autoRestartSeconds });
    updated = true;
  }
  
  // 更新喝酒参数
  if (drinkParameter && typeof drinkParameter === 'number' && drinkParameter >= 1 && drinkParameter <= 100) {
    userPreferences.drinkParameter = drinkParameter;
    Logger.info('喝酒参数已更新', { drinkParameter });
    updated = true;
  }
  
  // 更新第一种算法参数
  if (firstCardDrinkCount && typeof firstCardDrinkCount === 'number' && firstCardDrinkCount >= 1 && firstCardDrinkCount <= 100) {
    userPreferences.firstCardDrinkCount = firstCardDrinkCount;
    Logger.info('第一种算法参数已更新', { firstCardDrinkCount });
    updated = true;
  }
  
  // 更新第三种算法参数
  if (lastCardDrinkCount && typeof lastCardDrinkCount === 'number' && lastCardDrinkCount >= 1 && lastCardDrinkCount <= 100) {
    userPreferences.lastCardDrinkCount = lastCardDrinkCount;
    Logger.info('第三种算法参数已更新', { lastCardDrinkCount });
    updated = true;
  }
  
  // 更新回合超时时间
  if (turnTimeoutSeconds && typeof turnTimeoutSeconds === 'number' && turnTimeoutSeconds >= 5 && turnTimeoutSeconds <= 300) {
    userPreferences.turnTimeoutSeconds = turnTimeoutSeconds;
    Logger.info('回合超时时间已更新', { turnTimeoutSeconds });
    updated = true;
  }
  
  // 更新道具翻牌数阈值
  if (itemFlipCountThreshold && typeof itemFlipCountThreshold === 'number' && itemFlipCountThreshold >= 1 && itemFlipCountThreshold <= 20) {
    userPreferences.itemFlipCountThreshold = itemFlipCountThreshold;
    Logger.info('道具翻牌数阈值已更新', { itemFlipCountThreshold });
    updated = true;
  }
  
  // 更新反转道具翻牌数阈值
  if (reverseItemFlipCountThreshold && typeof reverseItemFlipCountThreshold === 'number' && reverseItemFlipCountThreshold >= 1 && reverseItemFlipCountThreshold <= 20) {
    userPreferences.reverseItemFlipCountThreshold = reverseItemFlipCountThreshold;
    Logger.info('反转道具翻牌数阈值已更新', { reverseItemFlipCountThreshold });
    updated = true;
  }
  
  // 更新背景牌选择模式
  if (backcardSelectionMode && typeof backcardSelectionMode === 'string' && ['random', 'all', 'fixed'].includes(backcardSelectionMode)) {
    userPreferences.backcardSelectionMode = backcardSelectionMode;
    Logger.info('背景牌选择模式已更新', { backcardSelectionMode });
    updated = true;
  }
  
  // 更新背景牌选择数量
  if (backcardSelectionCount && typeof backcardSelectionCount === 'number' && backcardSelectionCount >= 1 && backcardSelectionCount <= 50) {
    userPreferences.backcardSelectionCount = backcardSelectionCount;
    Logger.info('背景牌选择数量已更新', { backcardSelectionCount });
    updated = true;
  }
  
  // 更新固定背景牌列表
  if (selectedBackcards && Array.isArray(selectedBackcards)) {
    userPreferences.selectedBackcards = selectedBackcards;
    Logger.info('固定背景牌列表已更新', { selectedBackcards });
    updated = true;
  }
  
  // 更新显示配置
  if (displayConfig && typeof displayConfig === 'object') {
    userPreferences.displayConfig = {
      ...userPreferences.displayConfig,
      ...displayConfig
    };
    Logger.info('显示配置已更新', { displayConfig });
    updated = true;
  }
  
  // 更新口头禅文本配置
  if (口头禅TextConfig && typeof 口头禅TextConfig === 'object') {
    userPreferences.口头禅TextConfig = {
      ...userPreferences.口头禅TextConfig,
      ...口头禅TextConfig
    };
    Logger.info('口头禅文本配置已更新', { 口头禅TextConfig });
    updated = true;
  }
  
  if (updated) {
    writeConfig(userPreferences);
    io.emit('preferencesUpdated', userPreferences);
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
    this.turnFlipCount = 0;
    this.turnTimer = null;
    this.turnCountdown = 0;
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
      
      if (this.turnTimer) {
        clearInterval(this.turnTimer);
      }
      
      this.turnCountdown = userPreferences.turnTimeoutSeconds || 10;
      io.emit('turnCountdownUpdated', { countdown: this.turnCountdown });
      
      this.turnTimer = setInterval(() => {
        this.turnCountdown--;
        io.emit('turnCountdownUpdated', { countdown: this.turnCountdown });
        
        if (this.turnCountdown <= 0) {
          clearInterval(this.turnTimer);
          this.turnTimer = null;
          
          // 检查游戏是否已经结束
          if (gameState.gameOver) {
            Logger.info('游戏已结束，跳过自动操作');
            return;
          }
          
          // 回合倒计时结束，不再执行自动操作
          Logger.info('回合倒计时结束，不执行自动操作');
        }
      }, 1000);
      
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
      
      // 不再自动进入下一回合，即使断开连接的是当前回合玩家
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

  // 将玩家移到第2位置
  movePlayerToSecondPosition(playerId) {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1 && playerIndex > 0) {
      const player = this.players.splice(playerIndex, 1)[0];
      this.players.splice(1, 0, player);
      Logger.info('玩家被移到第2位置', { playerId, nickname: player.nickname });
      return true;
    }
    return false;
  }

  // 反转队列顺序（第2位到最后一位反转）
  reverseQueueOrder() {
    if (this.players.length > 2) {
      const firstPlayer = this.players[0];
      const remainingPlayers = this.players.slice(1);
      const reversedRemaining = remainingPlayers.reverse();
      this.players = [firstPlayer, ...reversedRemaining];
      this.turnPlayer = this.players[0];
      Logger.info('队列顺序已反转', { queueLength: this.players.length });
      return true;
    }
    return false;
  }

  // 下一回合
  nextTurn() {
    if (this.players.length > 0) {
      if (this.turnPlayer) {
        this.movePlayerToEnd(this.turnPlayer.id);
      }
      
      this.turnPlayer = this.players[0];
      this.turnFlipCount = 0;
      
      if (this.turnTimer) {
        clearInterval(this.turnTimer);
      }
      
      this.turnCountdown = userPreferences.turnTimeoutSeconds || 10;
      io.emit('turnCountdownUpdated', { countdown: this.turnCountdown });
      
      // 发送回合开始事件
      io.emit('turnStarted', {
        playerId: this.turnPlayer.id,
        playerNickname: this.turnPlayer.nickname,
        countdown: this.turnCountdown
      });
      
      this.turnTimer = setInterval(() => {
        this.turnCountdown--;
        io.emit('turnCountdownUpdated', { countdown: this.turnCountdown });
        
        if (this.turnCountdown <= 0) {
          clearInterval(this.turnTimer);
          this.turnTimer = null;
          
          // 检查游戏是否已经结束
          if (gameState.gameOver) {
            Logger.info('游戏已结束，跳过自动操作');
            return;
          }
          
          // 回合倒计时结束，不再执行自动操作
          Logger.info('回合倒计时结束，不执行自动操作');
        }
      }, 1000);
      
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
        const player = this.players[playerIndex];
        Logger.info('玩家超时被踢出队列', { playerId, nickname: player.nickname });
        
        // 从队列中移除玩家
        this.players.splice(playerIndex, 1);
        
        // 清理相关数据
        this.playerSockets.delete(player.socketId);
        this.playerLastSeen.delete(playerId);
        
        // 检查是否需要更新当前回合玩家
        if (this.turnPlayer && this.turnPlayer.id === playerId) {
          this.nextTurn();
          // 重置道具状态，使下个回合可以重新获得
          gameState.item.hasItem = false;
          gameState.item.itemPlayerId = null;
          gameState.item.itemUsed = false;
          
          gameState.item.reverseItem.hasItem = false;
          gameState.item.reverseItem.itemPlayerId = null;
          gameState.item.reverseItem.itemUsed = false;
        }
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
        // 重置道具状态
        gameState.item.hasItem = false;
        gameState.item.itemPlayerId = null;
        gameState.item.itemUsed = false;
        
        gameState.item.reverseItem.hasItem = false;
        gameState.item.reverseItem.itemPlayerId = null;
        gameState.item.reverseItem.itemUsed = false;
        
        // 如果队列中还有其他玩家，开始新回合
        if (this.players.length > 0) {
          this.nextTurn();
          Logger.info('当前回合玩家退出队列，开始新回合', { playerId, nickname: player.nickname });
        } else {
          // 队列中没有其他玩家，取消当前回合
          this.turnPlayer = null;
          this.turnFlipCount = 0;
          if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
          }
          this.turnCountdown = 0;
          io.emit('turnCountdownUpdated', { countdown: 0 });
          Logger.info('取消当前回合相关属性，队列中无其他玩家', { playerId, nickname: player.nickname });
        }
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
  
  // 随机选择图片
  const selectedImages = selectRandomImages();
  
  gameState = {
    ...gameState,
    status: 'playing',
    cardCount: cardCount,
    cards: newCards,
    gameOver: false,
    winner: null,
    queueState: playerQueue.getQueueState(),
    drinkCount: 1,
    selectedImages: selectedImages,
    item: {
      hasItem: false,
      itemPlayerId: null,
      itemUsed: false,
      reverseItem: {
        hasItem: false,
        itemPlayerId: null,
        itemUsed: false
      }
    }
  };
  
  Logger.info('游戏初始化成功', { gameState });
  io.emit('gameState', gameState);
  
  checkIntermission('gameStart', null, io, Logger);
}

// 检查技能获得的公共方法
function checkSkillAward(skillType, threshold, flipCount, playerId, userPreferences, playerQueue, gameState, io, Logger) {
  if (skillType === 'item' && flipCount === threshold && !gameState.item.hasItem) {
    gameState.item.hasItem = true;
    gameState.item.itemPlayerId = playerId;
    gameState.item.itemUsed = false;
    Logger.info('玩家获得点名道具', { 
      playerId, 
      nickname: playerQueue.turnPlayer?.nickname, 
      flipCount, 
      itemThreshold: threshold,
      queuePosition: playerQueue.players.findIndex(p => p.id === playerId) + 1,
      queueLength: playerQueue.players.length
    });
    io.emit('itemAwarded', { playerId, nickname: playerQueue.turnPlayer?.nickname });
    
    checkIntermission('getItem', null, io, Logger);
  } else if (skillType === 'reverseItem' && flipCount === threshold && !gameState.item.reverseItem.hasItem) {
    gameState.item.reverseItem.hasItem = true;
    gameState.item.reverseItem.itemPlayerId = playerId;
    gameState.item.reverseItem.itemUsed = false;
    Logger.info('玩家获得反转道具', { 
      playerId, 
      nickname: playerQueue.turnPlayer?.nickname, 
      flipCount, 
      reverseItemThreshold: threshold,
      queuePosition: playerQueue.players.findIndex(p => p.id === playerId) + 1,
      queueLength: playerQueue.players.length
    });
    io.emit('reverseItemAwarded', { playerId, nickname: playerQueue.turnPlayer?.nickname });
    
    checkIntermission('getItem', null, io, Logger);
  }
}

// 验证玩家数量的公共函数
function validatePlayerCount(players, minCount, skillName, socket, Logger) {
  if (players.length < minCount) {
    const message = `队列中至少需要${minCount}名玩家才能使用${skillName}`;
    Logger.warn(`${skillName} - 队列中玩家不足`, { playerCount: players.length, required: minCount });
    socket.emit('error', { message });
    return false;
  }
  return true;
}

// 检测并触发插播
function checkIntermission(triggertype, data, io, Logger) {
  if (!intermissionConfig.enabled || intermissionConfig.items.length === 0) {
    return;
  }
  
  const triggeredItems = intermissionConfig.items.filter(item => {
    if (triggertype === 'useItem' && item.triggers.useItem) {
      return true;
    }
    if (triggertype === 'useReverseItem' && item.triggers.useReverseItem) {
      return true;
    }
    if (triggertype === 'drinkCount' && item.triggers.drinkCount && data === item.triggers.drinkCount) {
      return true;
    }
    if (triggertype === 'getItem' && item.triggers.getItem) {
      return true;
    }
    if (triggertype === 'jingCard' && item.triggers.jingCard) {
      return true;
    }
    if (triggertype === 'gameStart' && item.triggers.gameStart) {
      return true;
    }
    return false;
  });
  
  if (triggeredItems.length > 0) {
    const selectedItem = triggeredItems[Math.floor(Math.random() * triggeredItems.length)];
    Logger.info('触发插播', { type: selectedItem.type, triggers: triggertype });
    
    io.emit('intermission', selectedItem);
  }
}

// WebSocket连接处理
io.on('connection', (socket) => {
  Logger.info('新用户连接', { socketId: socket.id });
  
  // 发送欢迎消息和初始游戏状态
  socket.emit('welcome', {
    gameState: gameState
  });

  // 发送用户偏好设置
  socket.emit('preferencesUpdated', userPreferences);
  
  // 发送房主状态
  socket.emit('ownerState', {
    ownerId: ownerState.ownerId,
    isOwner: socket.id === ownerState.ownerSocketId
  });

  // 玩家加入队列
  socket.on('joinQueue', (playerData) => {
    Logger.info('玩家加入队列', { socketId: socket.id, playerId: playerData.id, nickname: playerData.nickname });
    
    if (!userPreferences.queueControl?.allowJoinQueue) {
      Logger.warn('加入队列已被禁止', { socketId: socket.id, playerId: playerData.id });
      socket.emit('error', { message: '房主已禁止加入队列' });
      return;
    }
    
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
    
    // 重新获取当前游戏队列，把当前回合给到1号位的玩家
    if (playerQueue.players.length > 0) {
      playerQueue.turnPlayer = playerQueue.players[0];
      playerQueue.turnFlipCount = 0;
      
      if (playerQueue.turnTimer) {
        clearInterval(playerQueue.turnTimer);
      }
      
      playerQueue.turnCountdown = userPreferences.turnTimeoutSeconds || 10;
      io.emit('turnCountdownUpdated', { countdown: playerQueue.turnCountdown });
      
      playerQueue.turnTimer = setInterval(() => {
        playerQueue.turnCountdown--;
        io.emit('turnCountdownUpdated', { countdown: playerQueue.turnCountdown });
        
        if (playerQueue.turnCountdown <= 0) {
          clearInterval(playerQueue.turnTimer);
          playerQueue.turnTimer = null;
          
          // 检查游戏是否已经结束
          if (gameState.gameOver) {
            Logger.info('游戏已结束，跳过自动操作');
            return;
          }
          
          // 回合倒计时结束，不再执行自动操作
          Logger.info('回合倒计时结束，不执行自动操作');
        }
      }, 1000);
      
      Logger.info('游戏启动，设置当前回合玩家为1号位', { playerId: playerQueue.turnPlayer.id, nickname: playerQueue.turnPlayer.nickname });
      
      // 更新游戏状态
      gameState.queueState = playerQueue.getQueueState();
      io.emit('gameState', gameState);
    }
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
    
    // 检查技能获得
    checkSkillAward('item', userPreferences.itemFlipCountThreshold || 3, flipCount, playerId, userPreferences, playerQueue, gameState, io, Logger);
    checkSkillAward('reverseItem', userPreferences.reverseItemFlipCountThreshold || 2, flipCount, playerId, userPreferences, playerQueue, gameState, io, Logger);
    
    // 重置倒计时
    if (playerQueue.turnTimer) {
      clearInterval(playerQueue.turnTimer);
    }
    
    playerQueue.turnCountdown = userPreferences.turnTimeoutSeconds || 10;
    io.emit('turnCountdownUpdated', { countdown: playerQueue.turnCountdown });
    
    playerQueue.turnTimer = setInterval(() => {
      playerQueue.turnCountdown--;
      io.emit('turnCountdownUpdated', { countdown: playerQueue.turnCountdown });
      
      if (playerQueue.turnCountdown <= 0) {
        clearInterval(playerQueue.turnTimer);
        playerQueue.turnTimer = null;
        
        // 检查游戏是否已经结束
        if (gameState.gameOver) {
          Logger.info('游戏已结束，跳过自动翻牌和结束回合');
          return;
        }
        

      }
    }, 1000);
    
    let drinkCount = gameState.drinkCount;
    
    const result = flipCount - userPreferences.drinkParameter;
    if (result > 0) {
      drinkCount = gameState.drinkCount + 1;
      gameState.drinkCount = drinkCount;
      Logger.info('酒杯数量增加', { flipCount, drinkParameter: userPreferences.drinkParameter, result, drinkCount });
      
      // 检查是否触发插播
      checkIntermission('drinkCount', drinkCount, io, Logger);
    }
    
    const updatedCards = gameState.cards.map(card => {
      if (card.id === cardId && !card.isFlipped) {
        if (card.isJingCard) {
          gameState.gameOver = true;
          gameState.status = 'ended';
          gameState.winner = playerQueue.turnPlayer;
          
          const allCardsUnflipped = gameState.cards.every(c => !c.isFlipped || c.id === cardId);
          if (flipCount === 1 && allCardsUnflipped) {
            drinkCount = userPreferences.firstCardDrinkCount;
            gameState.drinkCount = drinkCount;
            Logger.info('所有牌都还没翻，第一张牌就摸到境哥牌，酒杯数量', { drinkCount });
          } else {
            const unflippedCards = gameState.cards.filter(c => !c.isFlipped && c.id !== cardId);
            if (unflippedCards.length === 0) {
              drinkCount = gameState.drinkCount + userPreferences.lastCardDrinkCount;
              gameState.drinkCount = drinkCount;
              Logger.info('摸到最后一张牌是境哥牌，酒杯数量+' + userPreferences.lastCardDrinkCount, { drinkCount });
            }
          }
          

          
          Logger.info('境哥牌被找到，游戏结束', { socketId: socket.id, cardId, winner: playerQueue.turnPlayer, drinkCount });
          
          io.emit('jingCardFound', {
            player: playerQueue.turnPlayer,
            flipCount: flipCount,
            drinkCount: drinkCount
          });
          
          checkIntermission('jingCard', null, io, Logger);

          if (playerQueue.turnPlayer && !playerQueue.turnPlayer.isActive) {
            Logger.info('当前回合玩家离线，5秒后自动重新启动游戏', { playerId: playerQueue.turnPlayer.id, nickname: playerQueue.turnPlayer.nickname });
            setTimeout(() => {
              Logger.info('自动重新启动游戏');
              initializeGame(gameState.cardCount);
            }, 5000);
          }
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
    
    // 重置道具状态，使下个回合可以重新获得
    gameState.item.hasItem = false;
    gameState.item.itemPlayerId = null;
    gameState.item.itemUsed = false;
    
    gameState.item.reverseItem.hasItem = false;
    gameState.item.reverseItem.itemPlayerId = null;
    gameState.item.reverseItem.itemUsed = false;
    
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

  // 使用点名道具
  socket.on('useItem', (data) => {
    const { playerId, targetPlayerId } = data;
    Logger.info('收到使用道具请求', { socketId: socket.id, playerId, targetPlayerId });
    
    // 检查是否有道具
    if (!gameState.item.hasItem) {
      Logger.warn('没有可用的道具', { playerId });
      socket.emit('error', { message: '没有可用的道具' });
      return;
    }
    
    // 检查是否是道具拥有者
    if (gameState.item.itemPlayerId !== playerId) {
      Logger.warn('不是道具拥有者', { playerId, itemPlayerId: gameState.item.itemPlayerId });
      socket.emit('error', { message: '你不是道具拥有者' });
      return;
    }
    
    // 检查道具是否已使用
    if (gameState.item.itemUsed) {
      Logger.warn('道具已使用', { playerId });
      socket.emit('error', { message: '道具已使用' });
      return;
    }
    
    // 检查队列中是否至少有3名玩家
    const players = playerQueue.players;
    if (!validatePlayerCount(players, 3, '点名道具', socket, Logger)) {
      return;
    }
    
    // 检查是否选择了自己
    if (targetPlayerId === playerId) {
      Logger.warn('不能选择自己', { playerId, targetPlayerId });
      socket.emit('error', { message: '不能选择自己' });
      return;
    }
    
    // 将目标玩家移到第2位置
    const success = playerQueue.movePlayerToSecondPosition(targetPlayerId);
    if (success) {
      // 标记道具已使用
      gameState.item.itemUsed = true;
      
      // 更新游戏状态
      gameState.queueState = playerQueue.getQueueState();
      
      // 广播游戏状态给所有玩家
      io.emit('gameState', gameState);
      
      // 广播道具使用信息
      io.emit('itemUsed', { playerId, targetPlayerId });
      
      // 触发插播
      checkIntermission('useItem', null, io, Logger);
      
      Logger.info('点名道具使用成功', { playerId, targetPlayerId });
    } else {
      Logger.warn('移动玩家到第2位置失败', { playerId, targetPlayerId });
      socket.emit('error', { message: '移动玩家到第2位置失败' });
    }
  });

  // 使用反转道具
  socket.on('useReverseItem', (data) => {
    const { playerId } = data;
    Logger.info('收到使用反转道具请求', { socketId: socket.id, playerId });
    
    // 检查是否有反转道具
    if (!gameState.item.reverseItem.hasItem) {
      Logger.warn('没有可用的反转道具', { playerId });
      socket.emit('error', { message: '没有可用的反转道具' });
      return;
    }
    
    // 检查是否是道具拥有者
    if (gameState.item.reverseItem.itemPlayerId !== playerId) {
      Logger.warn('不是反转道具拥有者', { playerId, itemPlayerId: gameState.item.reverseItem.itemPlayerId });
      socket.emit('error', { message: '你不是反转道具拥有者' });
      return;
    }
    
    // 检查道具是否已使用
    if (gameState.item.reverseItem.itemUsed) {
      Logger.warn('反转道具已使用', { playerId });
      socket.emit('error', { message: '反转道具已使用' });
      return;
    }
    
    // 检查队列中是否至少有3名玩家
    const players = playerQueue.players;
    if (!validatePlayerCount(players, 3, '反转道具', socket, Logger)) {
      return;
    }
    
    // 反转队列顺序
    const success = playerQueue.reverseQueueOrder();
    if (success) {
      // 标记道具已使用
      gameState.item.reverseItem.itemUsed = true;
      
      // 更新游戏状态
      gameState.queueState = playerQueue.getQueueState();
      
      // 广播游戏状态给所有玩家
      io.emit('gameState', gameState);
      
      // 广播反转道具使用信息
      io.emit('reverseItemUsed', { playerId });
      
      // 触发插播
      checkIntermission('useReverseItem', null, io, Logger);
      
      Logger.info('反转道具使用成功', { playerId });
    } else {
      Logger.warn('反转队列顺序失败', { playerId });
      socket.emit('error', { message: '反转队列顺序失败' });
    }
  });

  // 境哥牌点击事件
  socket.on('jingCardClick', (data) => {
    const { src, relativeX, relativeY } = data;
    Logger.info('收到境哥牌点击事件', { socketId: socket.id, src, relativeX, relativeY });
    
    // 广播给所有玩家
    io.emit('jingCardClick', {
      src,
      relativeX,
      relativeY
    });
  });

  // 重新开始游戏
  socket.on('restartGame', (data) => {
    const { cardCount, playerId } = data;
    const finalCardCount = cardCount || gameState.cardCount;
    Logger.info('收到重新开始游戏请求', { socketId: socket.id, cardCount: finalCardCount, playerId });
    
    // 游戏结束状态时不检查权限，允许任何玩家重新开始游戏
    // 只在游戏进行中时检查权限
    if (!gameState.gameOver && playerId && playerId !== 'admin' && playerQueue.turnPlayer && playerQueue.turnPlayer.id !== playerId) {
      Logger.warn('无权限重新开始游戏', { socketId: socket.id, playerId });
      socket.emit('error', { message: '不是你的回合，无法重新开始游戏' });
      return;
    }
    
    playerQueue.turnFlipCount = 0;
    initializeGame(finalCardCount);
    
    // 重新获取当前游戏队列，把当前回合给到1号位的玩家
    if (playerQueue.players.length > 0) {
      playerQueue.turnPlayer = playerQueue.players[0];
      playerQueue.turnFlipCount = 0;
      
      if (playerQueue.turnTimer) {
        clearInterval(playerQueue.turnTimer);
      }
      
      playerQueue.turnCountdown = userPreferences.turnTimeoutSeconds || 10;
      io.emit('turnCountdownUpdated', { countdown: playerQueue.turnCountdown });
      
      playerQueue.turnTimer = setInterval(() => {
        playerQueue.turnCountdown--;
        io.emit('turnCountdownUpdated', { countdown: playerQueue.turnCountdown });
        
        if (playerQueue.turnCountdown <= 0) {
          clearInterval(playerQueue.turnTimer);
          playerQueue.turnTimer = null;
          
          // 检查游戏是否已经结束
          if (gameState.gameOver) {
            Logger.info('游戏已结束，跳过自动操作');
            return;
          }
          
          // 回合倒计时结束，不再执行自动操作
          Logger.info('回合倒计时结束，不执行自动操作');
        }
      }, 1000);
      
      Logger.info('游戏重新启动，设置当前回合玩家为1号位', { playerId: playerQueue.turnPlayer.id, nickname: playerQueue.turnPlayer.nickname });
      
      // 更新游戏状态
      gameState.queueState = playerQueue.getQueueState();
      io.emit('gameState', gameState);
    }
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
    
    if (!userPreferences.queueControl?.allowExitQueue) {
      Logger.warn('退出队列已被禁止', { socketId: socket.id, playerId });
      socket.emit('error', { message: '房主已禁止退出队列' });
      return;
    }
    
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

  // 更新队列控制
  socket.on('updateQueueControl', (data) => {
    Logger.info('更新队列控制', { socketId: socket.id, queueControl: data });
    
    if (data.allowJoinQueue !== undefined) {
      userPreferences.queueControl.allowJoinQueue = data.allowJoinQueue;
    }
    if (data.allowExitQueue !== undefined) {
      userPreferences.queueControl.allowExitQueue = data.allowExitQueue;
    }
    
    writeConfig(userPreferences);
    io.emit('preferencesUpdated', userPreferences);
    io.emit('gameState', gameState);
    
    Logger.info('队列控制已更新', { queueControl: userPreferences.queueControl });
  });

  // 处理倒计时显示状态切换
  socket.on('toggleCountdown', (data) => {
    Logger.info('倒计时显示状态切换', { showCountdown: data.showCountdown });
    gameState.showCountdown = data.showCountdown;
    // 广播游戏状态给所有玩家
    io.emit('gameState', gameState);
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
        
        // 记录是否是当前回合玩家
        const isTurnPlayer = playerQueue.turnPlayer && playerQueue.turnPlayer.id === playerId;
        
        // 从队列中移除玩家
        playerQueue.players.splice(playerIndex, 1);
        
        // 清理相关数据
        playerQueue.playerSockets.delete(player.socketId);
        playerQueue.playerLastSeen.delete(playerId);
        
        // 检查是否需要更新当前回合玩家
        if (isTurnPlayer) {
          // 重置道具状态
          gameState.item.hasItem = false;
          gameState.item.itemPlayerId = null;
          gameState.item.itemUsed = false;
          
          gameState.item.reverseItem.hasItem = false;
          gameState.item.reverseItem.itemPlayerId = null;
          gameState.item.reverseItem.itemUsed = false;
          
          // 如果队列中还有其他玩家，开始新回合
          if (playerQueue.players.length > 0) {
            playerQueue.nextTurn();
            Logger.info('当前回合玩家被踢走，开始新回合', { playerId, nickname: player.nickname });
          } else {
            // 队列中没有其他玩家，取消当前回合
            playerQueue.turnPlayer = null;
            playerQueue.turnFlipCount = 0;
            if (playerQueue.turnTimer) {
              clearInterval(playerQueue.turnTimer);
              playerQueue.turnTimer = null;
            }
            playerQueue.turnCountdown = 0;
            io.emit('turnCountdownUpdated', { countdown: 0 });
            Logger.info('取消当前回合相关属性，队列中无其他玩家', { playerId, nickname: player.nickname });
          }
        }
        
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
        
        // 重置道具状态，使下个回合可以重新获得
        gameState.item.hasItem = false;
        gameState.item.itemPlayerId = null;
        gameState.item.itemUsed = false;
        
        gameState.item.reverseItem.hasItem = false;
        gameState.item.reverseItem.itemPlayerId = null;
        gameState.item.reverseItem.itemUsed = false;
        
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

  // 声明房主权限
  socket.on('claimOwner', (playerId) => {
    Logger.info('玩家声明房主权限', { socketId: socket.id, playerId });
    
    // 如果还没有房主，设置当前玩家为房主
    if (!ownerState.ownerId) {
      ownerState.ownerId = playerId;
      ownerState.ownerSocketId = socket.id;
      Logger.info('玩家成为房主', { socketId: socket.id, playerId });
      
      // 广播房主状态变更
      io.emit('ownerState', {
        ownerId: playerId,
        isOwner: false
      });
      
      // 告诉新房主他是房主
      socket.emit('ownerState', {
        ownerId: playerId,
        isOwner: true
      });
    }
  });
  
  // 请求转让房主权限
  socket.on('requestTransfer', (data) => {
    const { playerId, nickname } = data;
    Logger.info('玩家请求转让房主权限', { socketId: socket.id, playerId, nickname });
    
    // 检查冷却
    if (ownerState.cooldown[playerId] && Date.now() < ownerState.cooldown[playerId]) {
      const remaining = Math.ceil((ownerState.cooldown[playerId] - Date.now()) / 1000);
      socket.emit('error', { message: `抢房冷却中，请${remaining}秒后再试` });
      return;
    }
    
    // 如果已经有房主，发送转让请求
    if (ownerState.ownerId) {
      ownerState.transferRequest = {
        fromPlayerId: playerId,
        fromSocketId: socket.id,
        fromNickname: nickname,
        timestamp: Date.now()
      };
      
      // 告诉当前房主有转让请求
      if (ownerState.ownerSocketId) {
        io.to(ownerState.ownerSocketId).emit('transferRequest', {
          fromPlayerId: playerId,
          fromNickname: nickname
        });
      }
      
      // 设置10秒后自动同意
      setTimeout(() => {
        if (ownerState.transferRequest && ownerState.transferRequest.fromPlayerId === playerId) {
          // 自动同意转让
          Logger.info('自动同意房主转让请求', { fromPlayerId: playerId });
          
          // 更新房主
          ownerState.ownerId = playerId;
          ownerState.ownerSocketId = socket.id;
          ownerState.transferRequest = null;
          
          // 设置冷却
          ownerState.cooldown[playerId] = Date.now() + 60 * 1000;
          
          // 广播房主状态变更
          io.emit('ownerState', {
            ownerId: playerId,
            isOwner: false
          });
          
          // 告诉新房主
          socket.emit('ownerState', {
            ownerId: playerId,
            isOwner: true
          });
          
          // 通知原房主
          if (ownerState.ownerSocketId) {
            io.to(ownerState.ownerSocketId).emit('transferResult', { success: true, autoAccepted: true });
          }
        }
      }, 10000);
    }
  });
  
  // 响应转让请求
  socket.on('respondTransfer', (data) => {
    const { accept } = data;
    Logger.info('房主响应转让请求', { socketId: socket.id, accept });
    
    // 检查是否是当前房主
    if (socket.id !== ownerState.ownerSocketId) {
      socket.emit('error', { message: '你不是当前房主' });
      return;
    }
    
    if (ownerState.transferRequest) {
      const { fromPlayerId, fromSocketId, fromNickname } = ownerState.transferRequest;
      
      if (accept) {
        // 同意转让
        Logger.info('房主同意转让权限', { toPlayerId: fromPlayerId, toNickname: fromNickname });
        
        // 更新房主
        ownerState.ownerId = fromPlayerId;
        ownerState.ownerSocketId = fromSocketId;
        
        // 设置冷却
        ownerState.cooldown[fromPlayerId] = Date.now() + 60 * 1000;
        
        // 广播房主状态变更
        io.emit('ownerState', {
          ownerId: fromPlayerId,
          isOwner: false
        });
        
        // 告诉新房主
        io.to(fromSocketId).emit('ownerState', {
          ownerId: fromPlayerId,
          isOwner: true
        });
        io.to(fromSocketId).emit('transferResult', { success: true, autoAccepted: false });
        
        // 通知原房主
        socket.emit('transferResult', { success: true, autoAccepted: false });
      } else {
        // 拒绝转让
        Logger.info('房主拒绝转让权限', { toPlayerId: fromPlayerId, toNickname: fromNickname });
        
        // 设置冷却
        ownerState.cooldown[fromPlayerId] = Date.now() + 60 * 1000;
        
        // 通知请求者
        io.to(fromSocketId).emit('transferResult', { success: false });
        
        // 通知原房主
        socket.emit('transferResult', { success: false });
      }
      
      // 清空转让请求
      ownerState.transferRequest = null;
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
    
    // 如果断开连接的是房主，清空房主状态
    if (socket.id === ownerState.ownerSocketId) {
      ownerState.ownerId = null;
      ownerState.ownerSocketId = null;
      if (ownerState.transferRequest) {
        ownerState.transferRequest = null;
      }
      // 广播房主状态变更
      io.emit('ownerState', {
        ownerId: null,
        isOwner: false
      });
    }
  });
});

// 插播配置API端点
app.get('/api/intermission', (req, res) => {
  try {
    res.json(intermissionConfig);
  } catch (error) {
    Logger.error('获取插播配置失败', { error: error.message });
    res.status(500).json({ error: '获取插播配置失败' });
  }
});

app.post('/api/intermission', (req, res) => {
  try {
    intermissionConfig = req.body;
    userPreferences.intermissionConfig = intermissionConfig;
    writeConfig(userPreferences);
    Logger.info('更新插播配置', { itemsCount: intermissionConfig.items.length });
    res.json({ success: true });
  } catch (error) {
    Logger.error('更新插播配置失败', { error: error.message });
    res.status(500).json({ error: '更新插播配置失败' });
  }
});

// 获取图片列表的API端点
app.get('/api/images', (req, res) => {
  try {
    const publicDir = path.join(__dirname, 'public');
    
    // 读取backcard目录
    const backcardDir = path.join(publicDir, 'png', 'backcard');
    const backcardImages = fs.readdirSync(backcardDir).filter(file => {
      return /\.(jpg|jpeg|png|gif|svg)$/i.test(file);
    }).map(file => `/png/backcard/${file}`);
    
    // 读取endcard目录
    const endcardDir = path.join(publicDir, 'png', 'endcard');
    const endcardImages = fs.readdirSync(endcardDir).filter(file => {
      return /\.(jpg|jpeg|png|gif|svg)$/i.test(file);
    }).map(file => `/png/endcard/${file}`);
    
    res.json({
      backcard: backcardImages,
      endcard: endcardImages
    });
  } catch (error) {
    Logger.error('获取图片列表失败', { error: error.message });
    res.status(500).json({ error: '获取图片列表失败' });
  }
});

// 获取背景牌列表
app.get('/api/backcards', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const backcardDir = path.join(__dirname, 'public/png/backcard');
    
    if (!fs.existsSync(backcardDir)) {
      fs.mkdirSync(backcardDir, { recursive: true });
      return res.json({ success: true, backcards: [] });
    }
    
    const files = fs.readdirSync(backcardDir)
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(backcardDir, a));
        const statB = fs.statSync(path.join(backcardDir, b));
        return statB.mtimeMs - statA.mtimeMs;
      });
    
    const backcards = files.map(file => ({
      filename: file,
      url: `/png/backcard/${file}`
    }));
    
    res.json({ success: true, backcards });
  } catch (error) {
    Logger.error('获取背景牌列表失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取背景牌列表失败' });
  }
});

// 上传背景牌
app.post('/api/upload-backcard', uploadBackcard.array('backcards', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }
    
    const uploadedFiles = [];
    for (const file of req.files) {
      Logger.info('背景牌上传成功', { 
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype 
      });
      uploadedFiles.push({
        filename: file.filename,
        url: `/png/backcard/${file.filename}`
      });
    }
    
    res.json({ 
      success: true, 
      message: '背景牌上传成功',
      uploadedFiles: uploadedFiles.length,
      files: uploadedFiles
    });
  } catch (error) {
    Logger.error('背景牌上传失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message || '上传失败' });
  }
});

// 上传境哥牌
app.post('/api/upload-endcard', uploadEndcard.array('endcards', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }
    
    const uploadedFiles = [];
    for (const file of req.files) {
      Logger.info('境哥牌上传成功', { 
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype 
      });
      uploadedFiles.push({
        filename: file.filename,
        url: `/png/endcard/${file.filename}`
      });
    }
    
    res.json({ 
      success: true, 
      message: '境哥牌上传成功',
      uploadedFiles: uploadedFiles.length,
      files: uploadedFiles
    });
  } catch (error) {
    Logger.error('境哥牌上传失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message || '上传失败' });
  }
});

// 上传回合图片
app.post('/api/upload-turn-image', uploadTurnImage.single('turnImage'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }
    
    const file = req.file;
    const imageUrl = `/png/turn-image/${file.filename}`;
    
    Logger.info('回合图片上传成功', { 
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      imageUrl: imageUrl
    });
    
    res.json({ 
      success: true, 
      message: '回合图片上传成功',
      imageUrl: imageUrl
    });
  } catch (error) {
    Logger.error('回合图片上传失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message || '上传失败' });
  }
});

// 获取境哥牌列表
app.get('/api/endcards', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const endcardDir = path.join(__dirname, 'public/png/endcard');
    
    if (!fs.existsSync(endcardDir)) {
      fs.mkdirSync(endcardDir, { recursive: true });
    }
    
    const files = fs.readdirSync(endcardDir).filter(file => {
      return /\.(jpg|jpeg|png|gif|svg)$/i.test(file);
    });
    
    const endcards = files.map(filename => ({
      filename: filename,
      url: `/png/endcard/${filename}`
    }));
    
    res.json({ success: true, endcards: endcards });
  } catch (error) {
    Logger.error('获取境哥牌列表失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取境哥牌列表失败' });
  }
});

// 删除境哥牌
app.delete('/api/endcards/:filename', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'public/png/endcard', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }
    
    fs.unlinkSync(filePath);
    Logger.info('境哥牌删除成功', { filename });
    
    res.json({ success: true, message: '境哥牌删除成功' });
  } catch (error) {
    Logger.error('境哥牌删除失败', { error: error.message });
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 获取已归档的配置列表
app.get('/api/configurations', (req, res) => {
  try {
    const configFiles = fs.readdirSync(CONFIGURATIONS_DIR).filter(file => {
      return file.endsWith('.json');
    });
    
    const configurations = configFiles.map(file => {
      const configPath = path.join(CONFIGURATIONS_DIR, file);
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return configData;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ success: true, configurations });
  } catch (error) {
    Logger.error('获取配置列表失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取配置列表失败' });
  }
});

// 保存新配置
app.post('/api/configurations', (req, res) => {
  try {
    const { name, config, resources } = req.body;
    
    if (!name || !config) {
      return res.status(400).json({ success: false, message: '配置名称和内容不能为空' });
    }
    
    const configId = `config_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const backupDir = path.join(__dirname, 'public', 'png', 'backup', name);
    const backcardBackupDir = path.join(backupDir, 'backcard');
    const endcardBackupDir = path.join(backupDir, 'endcard');
    const intermissionBackupDir = path.join(backupDir, 'intermission');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    if (!fs.existsSync(backcardBackupDir)) {
      fs.mkdirSync(backcardBackupDir, { recursive: true });
    }
    if (!fs.existsSync(endcardBackupDir)) {
      fs.mkdirSync(endcardBackupDir, { recursive: true });
    }
    if (!fs.existsSync(intermissionBackupDir)) {
      fs.mkdirSync(intermissionBackupDir, { recursive: true });
    }
    
    // 复制backcard目录下的所有图片文件
    const backcardSourceDir = path.join(__dirname, 'public', 'png', 'backcard');
    if (fs.existsSync(backcardSourceDir)) {
      const backcardFiles = fs.readdirSync(backcardSourceDir);
      backcardFiles.forEach(file => {
        const sourcePath = path.join(backcardSourceDir, file);
        const destPath = path.join(backcardBackupDir, file);
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
        }
      });
    }
    
    // 复制endcard目录下的所有图片文件
    const endcardSourceDir = path.join(__dirname, 'public', 'png', 'endcard');
    if (fs.existsSync(endcardSourceDir)) {
      const endcardFiles = fs.readdirSync(endcardSourceDir);
      endcardFiles.forEach(file => {
        const sourcePath = path.join(endcardSourceDir, file);
        const destPath = path.join(endcardBackupDir, file);
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
        }
      });
    }
    
    const intermissionVideoSourceDir = path.join(__dirname, 'public', 'upload', 'video');
    const intermissionVideoBackupDir = path.join(intermissionBackupDir, 'video');
    if (fs.existsSync(intermissionVideoSourceDir)) {
      if (!fs.existsSync(intermissionVideoBackupDir)) {
        fs.mkdirSync(intermissionVideoBackupDir, { recursive: true });
      }
      const videoFiles = fs.readdirSync(intermissionVideoSourceDir);
      videoFiles.forEach(file => {
        const sourcePath = path.join(intermissionVideoSourceDir, file);
        const destPath = path.join(intermissionVideoBackupDir, file);
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
        }
      });
    }
    
    const intermissionImageSourceDir = path.join(__dirname, 'public', 'upload', 'image');
    const intermissionImageBackupDir = path.join(intermissionBackupDir, 'image');
    if (fs.existsSync(intermissionImageSourceDir)) {
      if (!fs.existsSync(intermissionImageBackupDir)) {
        fs.mkdirSync(intermissionImageBackupDir, { recursive: true });
      }
      const imageFiles = fs.readdirSync(intermissionImageSourceDir);
      imageFiles.forEach(file => {
        const sourcePath = path.join(intermissionImageSourceDir, file);
        const destPath = path.join(intermissionImageBackupDir, file);
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
        }
      });
    }
    
    const intermissionAudioSourceDir = path.join(__dirname, 'public', 'upload', 'audio');
    const intermissionAudioBackupDir = path.join(intermissionBackupDir, 'audio');
    if (fs.existsSync(intermissionAudioSourceDir)) {
      if (!fs.existsSync(intermissionAudioBackupDir)) {
        fs.mkdirSync(intermissionAudioBackupDir, { recursive: true });
      }
      const audioFiles = fs.readdirSync(intermissionAudioSourceDir);
      audioFiles.forEach(file => {
        const sourcePath = path.join(intermissionAudioSourceDir, file);
        const destPath = path.join(intermissionAudioBackupDir, file);
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
        }
      });
    }
    
    const configData = {
      id: configId,
      name,
      config,
      resources,
      createdAt: new Date().toISOString()
    };
    
    const configPath = path.join(CONFIGURATIONS_DIR, `${configId}.json`);
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
    
    Logger.info('配置归档成功', { name, id: configId });
    res.json({ success: true, message: '配置归档成功', id: configId });
  } catch (error) {
    Logger.error('配置归档失败', { error: error.message });
    res.status(500).json({ success: false, message: '配置归档失败' });
  }
});

// 应用配置
app.post('/api/configurations/:id/apply', (req, res) => {
  try {
    const { id } = req.params;
    const configPath = path.join(CONFIGURATIONS_DIR, `${id}.json`);
    
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ success: false, message: '配置不存在' });
    }
    
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const { config, name } = configData;
    
    // 删除backcard目录下的所有图片文件
    const backcardDir = path.join(__dirname, 'public', 'png', 'backcard');
    if (fs.existsSync(backcardDir)) {
      const backcardFiles = fs.readdirSync(backcardDir);
      backcardFiles.forEach(file => {
        const filePath = path.join(backcardDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    // 删除endcard目录下的所有图片文件
    const endcardDir = path.join(__dirname, 'public', 'png', 'endcard');
    if (fs.existsSync(endcardDir)) {
      const endcardFiles = fs.readdirSync(endcardDir);
      endcardFiles.forEach(file => {
        const filePath = path.join(endcardDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    // 从backup目录复制图片回来
    const backupDir = path.join(__dirname, 'public', 'png', 'backup', name);
    const backcardBackupDir = path.join(backupDir, 'backcard');
    const endcardBackupDir = path.join(backupDir, 'endcard');
    const intermissionBackupDir = path.join(backupDir, 'intermission');
    
    if (fs.existsSync(backcardBackupDir)) {
      const backcardFiles = fs.readdirSync(backcardBackupDir);
      backcardFiles.forEach(file => {
        const sourcePath = path.join(backcardBackupDir, file);
        const destPath = path.join(backcardDir, file);
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
        }
      });
    }
    
    if (fs.existsSync(endcardBackupDir)) {
      const endcardFiles = fs.readdirSync(endcardBackupDir);
      endcardFiles.forEach(file => {
        const sourcePath = path.join(endcardBackupDir, file);
        const destPath = path.join(endcardDir, file);
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
        }
      });
    }
    
    const intermissionVideoDir = path.join(__dirname, 'public', 'upload', 'video');
    const intermissionImageDir = path.join(__dirname, 'public', 'upload', 'image');
    const intermissionAudioDir = path.join(__dirname, 'public', 'upload', 'audio');
    
    if (fs.existsSync(intermissionVideoDir)) {
      const videoFiles = fs.readdirSync(intermissionVideoDir);
      videoFiles.forEach(file => {
        const filePath = path.join(intermissionVideoDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    if (fs.existsSync(intermissionImageDir)) {
      const imageFiles = fs.readdirSync(intermissionImageDir);
      imageFiles.forEach(file => {
        const filePath = path.join(intermissionImageDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    if (fs.existsSync(intermissionAudioDir)) {
      const audioFiles = fs.readdirSync(intermissionAudioDir);
      audioFiles.forEach(file => {
        const filePath = path.join(intermissionAudioDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    if (fs.existsSync(intermissionBackupDir)) {
      const intermissionVideoBackupDir = path.join(intermissionBackupDir, 'video');
      if (fs.existsSync(intermissionVideoBackupDir)) {
        if (!fs.existsSync(intermissionVideoDir)) {
          fs.mkdirSync(intermissionVideoDir, { recursive: true });
        }
        const videoFiles = fs.readdirSync(intermissionVideoBackupDir);
        videoFiles.forEach(file => {
          const sourcePath = path.join(intermissionVideoBackupDir, file);
          const destPath = path.join(intermissionVideoDir, file);
          if (fs.statSync(sourcePath).isFile()) {
            fs.copyFileSync(sourcePath, destPath);
          }
        });
      }
      
      const intermissionImageBackupDir = path.join(intermissionBackupDir, 'image');
      if (fs.existsSync(intermissionImageBackupDir)) {
        if (!fs.existsSync(intermissionImageDir)) {
          fs.mkdirSync(intermissionImageDir, { recursive: true });
        }
        const imageFiles = fs.readdirSync(intermissionImageBackupDir);
        imageFiles.forEach(file => {
          const sourcePath = path.join(intermissionImageBackupDir, file);
          const destPath = path.join(intermissionImageDir, file);
          if (fs.statSync(sourcePath).isFile()) {
            fs.copyFileSync(sourcePath, destPath);
          }
        });
      }
      
      const intermissionAudioBackupDir = path.join(intermissionBackupDir, 'audio');
      if (fs.existsSync(intermissionAudioBackupDir)) {
        if (!fs.existsSync(intermissionAudioDir)) {
          fs.mkdirSync(intermissionAudioDir, { recursive: true });
        }
        const audioFiles = fs.readdirSync(intermissionAudioBackupDir);
        audioFiles.forEach(file => {
          const sourcePath = path.join(intermissionAudioBackupDir, file);
          const destPath = path.join(intermissionAudioDir, file);
          if (fs.statSync(sourcePath).isFile()) {
            fs.copyFileSync(sourcePath, destPath);
          }
        });
      }
    }
    
    // 更新用户偏好设置
    if (config) {
      Object.assign(userPreferences, config);
      writeConfig(userPreferences);
      
      if (config.defaultCardCount) {
        gameState.cardCount = config.defaultCardCount;
      }
      
      if (config.intermissionConfig) {
        intermissionConfig = config.intermissionConfig;
        const intermissionConfigPath = path.join(__dirname, 'intermission-config.json');
        fs.writeFileSync(intermissionConfigPath, JSON.stringify(intermissionConfig, null, 2), 'utf8');
      }
      
      Logger.info('配置应用成功', { id: configData.id, name: configData.name });
    }
    
    res.json({ success: true, message: '配置应用成功', config });
  } catch (error) {
    Logger.error('配置应用失败', { error: error.message });
    res.status(500).json({ success: false, message: '配置应用失败' });
  }
});

// 删除配置
app.delete('/api/configurations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    // 验证口令
    if (password !== '7879') {
      return res.status(403).json({ success: false, message: '口令错误' });
    }
    
    const configPath = path.join(CONFIGURATIONS_DIR, `${id}.json`);
    
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ success: false, message: '配置不存在' });
    }
    
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const { name } = configData;
    
    // 删除backup目录下的对应文件夹
    const backupDir = path.join(__dirname, 'public', 'png', 'backup', name);
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    
    fs.unlinkSync(configPath);
    Logger.info('配置删除成功', { id, name });
    res.json({ success: true, message: '配置删除成功' });
  } catch (error) {
    Logger.error('配置删除失败', { error: error.message });
    res.status(500).json({ success: false, message: '配置删除失败' });
  }
});

// 获取通俗语配置
app.get('/api/drink-texts', (req, res) => {
  try {
    const drinkTextConfig = userPreferences.drinkTextConfig || {
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
    };
    
    res.json({ 
      success: true, 
      enabled: drinkTextConfig.enabled, 
      texts: drinkTextConfig.texts 
    });
  } catch (error) {
    Logger.error('获取通俗语配置失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取通俗语配置失败' });
  }
});

// 保存通俗语配置
app.post('/api/drink-texts', (req, res) => {
  try {
    const { enabled, texts } = req.body;
    
    userPreferences.drinkTextConfig = {
      enabled: Boolean(enabled),
      texts: texts || {
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
    };
    
    // 保存到配置文件
    writeConfig(userPreferences);
    
    Logger.info('通俗语配置保存成功', { enabled });
    res.json({ success: true, message: '通俗语配置保存成功' });
  } catch (error) {
    Logger.error('保存通俗语配置失败', { error: error.message });
    res.status(500).json({ success: false, message: '保存通俗语配置失败' });
  }
});

// 删除背景牌
app.delete('/api/backcards/:filename', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'public/png/backcard', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }
    
    fs.unlinkSync(filePath);
    Logger.info('背景牌删除成功', { filename });
    
    res.json({ success: true, message: '背景牌删除成功' });
  } catch (error) {
    Logger.error('背景牌删除失败', { error: error.message });
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 上传游戏说明图片
app.post('/api/upload-gameini', upload.single('gameini'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }
    
    Logger.info('游戏说明图片上传成功', { 
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype 
    });
    
    // 广播通知所有客户端游戏说明图片已更新
    io.emit('gameIniUpdated', {
      filename: req.file.filename,
      timestamp: new Date().getTime()
    });
    
    res.json({ 
      success: true, 
      message: '游戏说明图片上传成功',
      filename: req.file.filename
    });
  } catch (error) {
    Logger.error('游戏说明图片上传失败', { error: error.message });
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  Logger.info(`服务器运行在 http://jimy.novrein.com:${PORT}`);
});
