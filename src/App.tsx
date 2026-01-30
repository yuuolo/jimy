import { useState, useEffect } from 'react';
import FlipCardGame from './components/FlipCardGame';
import AdminPage from './components/AdminPage';
import { io, Socket } from 'socket.io-client';

// 生成随机昵称的函数
const generateRandomNickname = (): string => {
  const adjectives = ['快乐的', '勇敢的', '聪明的', '友善的', '活泼的'];
  const nouns = ['熊猫', '老虎', '狮子', '大象', '长颈鹿'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
};

// 用户数据类型
interface User {
  id: string;
  nickname: string;
  isLoggedIn: boolean;
}

function App() {
  // 用户状态
  const [user, setUser] = useState<User>({
    id: '',
    nickname: '',
    isLoggedIn: false
  });
  
  // 昵称编辑状态
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  
  // 游戏状态
  const [selectedCardCount, setSelectedCardCount] = useState(9);
  const [columns, setColumns] = useState(3);
  const [gameTitle, setGameTitle] = useState('壹城翻牌游戏');
  
  // Socket连接状态
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<any>({
    id: 1,
    status: 'waiting',
    cardCount: 9,
    cards: [],
    gameOver: false,
    winner: null
  });
  
  // 管理页面状态
  const [showAdminPage, setShowAdminPage] = useState(false);

  // 自动登录和随机昵称生成，直接进入游戏
  useEffect(() => {
    // 检查本地存储中是否有用户数据
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      // 如果有存储的用户数据，使用它
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    } else {
      // 如果没有，生成新用户
      const newUser: User = {
        id: `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        nickname: generateRandomNickname(),
        isLoggedIn: true
      };
      // 存储到本地存储
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
    }
    
    // 从服务器获取默认设置
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`)
        .then(response => response.json())
        .then(data => {
          if (data.defaultCardCount) {
            setSelectedCardCount(data.defaultCardCount);
          }
          if (data.defaultColumns) {
            setColumns(data.defaultColumns);
          }
          if (data.gameTitle) {
            setGameTitle(data.gameTitle);
          }
        })
        .catch(error => {
          console.warn('获取默认设置失败，使用默认值:', error);
        });
  }, []);

  // 初始化Socket连接
  useEffect(() => {
    if (user.isLoggedIn) {
      // 创建Socket连接
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://jimy.novrein.com:3001';
      const newSocket = io(socketUrl);
      setSocket(newSocket);

      // 处理连接成功
      newSocket.on('connect', () => {
        console.log('Socket连接成功:', newSocket.id);
        // 连接成功后加入队列
        newSocket.emit('joinQueue', user);
      });

      // 处理欢迎消息
      newSocket.on('welcome', (data) => {
        console.log('欢迎消息:', data);
        setGameState(data.gameState);
      });

      // 处理游戏状态更新
      newSocket.on('gameState', (state) => {
        console.log('游戏状态更新:', state);
        setGameState(state);
      });

      // 处理队列状态更新
      newSocket.on('queueUpdated', (queueState) => {
        console.log('队列状态更新:', queueState);
        // 更新游戏状态中的队列信息
        setGameState((prev: any) => ({
          ...prev,
          queueState
        }));
      });

      // 处理偏好设置更新
      newSocket.on('preferencesUpdated', (preferences) => {
        console.log('偏好设置更新:', preferences);
        if (preferences.defaultCardCount) {
          setSelectedCardCount(preferences.defaultCardCount);
        }
        if (preferences.defaultColumns) {
          setColumns(preferences.defaultColumns);
        }
        if (preferences.gameTitle) {
          setGameTitle(preferences.gameTitle);
        }
      });

      // 处理错误消息
      newSocket.on('error', (error) => {
        console.error('服务器错误:', error);
      });

      // 心跳机制，每30秒发送一次心跳
      const heartbeatInterval = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit('heartbeat', user.id);
        }
      }, 30000);

      // 清理函数
      return () => {
        clearInterval(heartbeatInterval);
        newSocket.disconnect();
      };
    }
  }, [user]);

  // 处理昵称修改
  const handleNicknameChange = (nickname?: string) => {
    const finalNickname = nickname || newNickname;
    if (finalNickname?.trim()) {
      const updatedUser = {
        ...user,
        nickname: finalNickname.trim()
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setIsEditingNickname(false);
    }
  };

  // 开始编辑昵称
  const startEditNickname = () => {
    setNewNickname(user.nickname);
    setIsEditingNickname(true);
  };

  // 取消编辑昵称
  const cancelEditNickname = () => {
    setIsEditingNickname(false);
  };

  return (
    <div className="app">
      {showAdminPage ? (
        <AdminPage 
          socket={socket} 
          onBack={() => setShowAdminPage(false)} 
        />
      ) : (
        <main className="main">
          <FlipCardGame
            cardCount={selectedCardCount}
            columns={columns}
            gameTitle={gameTitle}
            onBack={() => {}}
            socket={socket}
            gameState={gameState}
            user={user}
            isEditingNickname={isEditingNickname}
            newNickname={newNickname}
            onNicknameChange={(nickname) => {
              if (typeof nickname === 'string') {
                setNewNickname(nickname);
              } else {
                handleNicknameChange();
              }
            }}
            onStartEditNickname={startEditNickname}
            onCancelEditNickname={cancelEditNickname}
            onAdminClick={() => {
              setShowAdminPage(true);
            }}
          />
        </main>
      )}
    </div>
  );
}

export default App;
