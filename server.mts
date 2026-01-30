import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// 创建Express应用
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// 数据库初始化
let db: any;

async function initDatabase() {
  try {
    // 打开SQLite数据库连接
    db = await open({
      filename: './game.db',
      driver: sqlite3.Database
    });

    // 创建用户表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建房间表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        max_players INTEGER DEFAULT 4,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建玩家房间关联表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS room_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    console.log('数据库初始化成功');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

// 初始化数据库
initDatabase();

// 中间件
app.use(express.json());
app.use(express.static('dist'));

// API路由

// 获取所有用户
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.all('SELECT * FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: '获取用户失败' });
  }
});

// 创建用户
app.post('/api/users', async (req, res) => {
  try {
    const { id, nickname } = req.body;
    await db.run('INSERT INTO users (id, nickname) VALUES (?, ?)', [id, nickname]);
    res.json({ id, nickname });
  } catch (error) {
    res.status(500).json({ error: '创建用户失败' });
  }
});

// 更新用户昵称
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname } = req.body;
    await db.run('UPDATE users SET nickname = ? WHERE id = ?', [nickname, id]);
    res.json({ id, nickname });
  } catch (error) {
    res.status(500).json({ error: '更新用户失败' });
  }
});

// 获取所有房间
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await db.all('SELECT * FROM rooms');
    // 获取每个房间的玩家数量
    for (const room of rooms) {
      const playerCount = await db.get('SELECT COUNT(*) as count FROM room_players WHERE room_id = ?', [room.id]);
      room.playerCount = playerCount.count;
    }
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: '获取房间失败' });
  }
});

// 创建房间
app.post('/api/rooms', async (req, res) => {
  try {
    const { id, name, maxPlayers = 4 } = req.body;
    await db.run('INSERT INTO rooms (id, name, max_players) VALUES (?, ?, ?)', [id, name, maxPlayers]);
    res.json({ id, name, maxPlayers });
  } catch (error) {
    res.status(500).json({ error: '创建房间失败' });
  }
});

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('新用户连接:', socket.id);

  // 断开连接处理
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });
});

// 启动服务器
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`服务器运行在 http://jimy.novrein.com:${PORT}`);
});
