import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface AdminPageProps {
  socket: Socket | null;
  onBack?: () => void;
}

interface Player {
  id: string;
  nickname: string;
  isTurn: boolean;
  isActive: boolean;
}

const AdminPage: React.FC<AdminPageProps> = ({ socket, onBack }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [timeoutMinutes, setTimeoutMinutes] = useState(3);
  const [gameTitle, setGameTitle] = useState('壹城翻牌游戏');
  const [cardCount, setCardCount] = useState(9);
  const [columns, setColumns] = useState(3);

  // 处理密码验证
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '8574') {
      setIsAuthenticated(true);
      setError('');
      // 发送认证成功事件，获取当前状态
      socket?.emit('admin:authenticated');
    } else {
      setError('密码错误，请输入正确的管理密码');
    }
  };

  // 处理超时时间设置
  const handleTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 1 && value <= 30) {
      setTimeoutMinutes(value);
    }
  };

  const handleTimeoutSubmit = () => {
    socket?.emit('admin:setTimeout', timeoutMinutes);
    alert(`超时时间已设置为 ${timeoutMinutes} 分钟`);
  };

  // 处理游戏标题更新
  const handleGameTitleSubmit = () => {
    if (gameTitle.trim().length > 0) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gameTitle: gameTitle })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert(`游戏标题已更新为: ${gameTitle}`);
        } else {
          alert('游戏标题更新失败: ' + data.message);
        }
      })
      .catch(error => {
        console.error('更新游戏标题失败:', error);
        alert('更新游戏标题失败，请检查网络连接');
      });
    } else {
      alert('游戏标题不能为空');
    }
  };

  // 处理牌数更新
  const handleCardCountSubmit = () => {
    if (cardCount >= 6 && cardCount <= 60) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ defaultCardCount: cardCount })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert(`牌数已更新为: ${cardCount}`);
        } else {
          alert('牌数更新失败: ' + data.message);
        }
      })
      .catch(error => {
        console.error('更新牌数失败:', error);
        alert('更新牌数失败，请检查网络连接');
      });
    } else {
      alert('牌数必须在6-60之间');
    }
  };

  // 处理牌列数更新
  const handleColumnsSubmit = () => {
    if (columns >= 3 && columns <= 6) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ defaultColumns: columns })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert(`牌列数已更新为: ${columns}`);
        } else {
          alert('牌列数更新失败: ' + data.message);
        }
      })
      .catch(error => {
        console.error('更新牌列数失败:', error);
        alert('更新牌列数失败，请检查网络连接');
      });
    } else {
      alert('牌列数必须在3-6之间');
    }
  };

  // 处理重新开始游戏
  const handleRestartGame = () => {
    if (window.confirm('确定要重新开始游戏吗？')) {
      if (socket) {
        socket.emit('restartGame', { cardCount: cardCount, playerId: 'admin' });
        alert('游戏已重新开始');
      } else {
        alert('无法连接到服务器，请刷新页面重试');
      }
    }
  };

  // 处理踢人
  const handleKickPlayer = (playerId: string, isTurn: boolean) => {
    if (window.confirm('确定要踢走这个玩家吗？')) {
      socket?.emit('admin:kickPlayer', playerId);
      if (isTurn) {
        socket?.emit('admin:endTurn', playerId);
      }
    }
  };

  // 监听管理相关的事件
  useEffect(() => {
    if (isAuthenticated && socket) {
      // 获取当前玩家队列
      socket.on('admin:playersList', (data: Player[]) => {
        setPlayers(data);
      });

      // 获取当前超时设置
      socket.on('admin:currentTimeout', (data: number) => {
        setTimeoutMinutes(data);
      });

      // 监听玩家状态更新
      socket.on('queue:updated', (data: any) => {
        if (data.players) {
          setPlayers(data.players);
        }
      });

      // 从服务器获取配置
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`)
        .then(response => response.json())
        .then(data => {
          if (data.gameTitle) {
            setGameTitle(data.gameTitle);
          }
          if (data.defaultCardCount) {
            setCardCount(data.defaultCardCount);
          }
          if (data.defaultColumns) {
            setColumns(data.defaultColumns);
          }
        })
        .catch(error => {
          console.warn('获取配置失败:', error);
        });
    }

    return () => {
      socket?.off('admin:playersList');
      socket?.off('admin:currentTimeout');
    };
  }, [isAuthenticated, socket]);

  // 未认证时显示登录界面
  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-container">
          <h2>管理页面登录</h2>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="password">管理密码：</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入管理密码"
                required
              />
            </div>
            <div className="login-buttons">
              <button type="submit" className="login-button">
                登录
              </button>
              <button 
                type="button" 
                className="back-button"
                onClick={onBack}
              >
                返回游戏
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 认证后显示管理界面
  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>游戏管理页面</h2>
        <div className="header-buttons">
          <button 
            className="back-button"
            onClick={onBack}
          >
            返回游戏
          </button>
          <button 
            className="logout-button"
            onClick={() => setIsAuthenticated(false)}
          >
            退出登录
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h3>超时设置</h3>
        <div className="timeout-setting">
          <label htmlFor="timeout">玩家离线超时时间：</label>
          <div className="timeout-control">
            <input
              type="number"
              id="timeout"
              min="1"
              max="30"
              value={timeoutMinutes}
              onChange={handleTimeoutChange}
            />
            <span className="unit">分钟</span>
          </div>
          <button 
            className="save-button"
            onClick={handleTimeoutSubmit}
          >
            保存设置
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h3>游戏标题设置</h3>
        <div className="game-title-setting">
          <label htmlFor="game-title">游戏标题：</label>
          <div className="game-title-control">
            <input
              type="text"
              id="game-title"
              value={gameTitle}
              onChange={(e) => setGameTitle(e.target.value)}
              placeholder="请输入游戏标题"
              maxLength={20}
              className="game-title-input"
            />
          </div>
          <button 
            className="save-button"
            onClick={handleGameTitleSubmit}
          >
            保存设置
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h3>牌数设置</h3>
        <div className="card-count-setting">
          <label htmlFor="card-count">牌数：{cardCount}</label>
          <div className="card-count-control">
            <input
              type="range"
              id="card-count"
              min="6"
              max="60"
              step="1"
              value={cardCount}
              onChange={(e) => setCardCount(parseInt(e.target.value))}
              className="card-count-slider"
            />
          </div>
          <button 
            className="save-button"
            onClick={handleCardCountSubmit}
          >
            保存设置
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h3>牌列设置</h3>
        <div className="columns-setting">
          <label htmlFor="columns">牌列数：</label>
          <div className="columns-control">
            {[3, 4, 5, 6].map(col => (
              <button
                key={col}
                className={`column-button ${columns === col ? 'active' : ''}`}
                onClick={() => setColumns(col)}
              >
                {col} 列
              </button>
            ))}
          </div>
          <button 
            className="save-button"
            onClick={handleColumnsSubmit}
          >
            保存设置
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h3>游戏控制</h3>
        <div className="game-control-setting">
          <button 
            className="restart-button admin-restart-button"
            onClick={handleRestartGame}
          >
            重新开始游戏
          </button>
          <p className="control-description">点击此按钮将立即重新开始游戏，当前游戏进度将丢失。</p>
        </div>
      </div>

      <div className="admin-section">
        <h3>玩家管理</h3>
        <div className="players-list">
          {players.length === 0 ? (
            <div className="no-players">暂无玩家</div>
          ) : (
            <table className="players-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>玩家昵称</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => (
                  <tr key={player.id} className={player.isTurn ? 'current-turn' : ''}>
                    <td>{index + 1}</td>
                    <td>{player.nickname}</td>
                    <td>
                      {player.isTurn ? (
                        <span className="status current">当前回合</span>
                      ) : player.isActive ? (
                        <span className="status active">在线</span>
                      ) : (
                        <span className="status inactive">离线</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="kick-button"
                        onClick={() => handleKickPlayer(player.id, player.isTurn)}
                      >
                        踢走
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;