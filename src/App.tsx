import { useState, useEffect } from 'react';
import FlipCardGame from './components/FlipCardGame';
import AdminPage from './components/AdminPage';
import { io, Socket } from 'socket.io-client';

// 生成随机昵称的函数
const generateRandomNickname = (): string => {
  const prefix = '点我改昵称';
  const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${suffix}`;
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
  const [gameTitle, setGameTitle] = useState('');
  const [autoRestartSeconds, setAutoRestartSeconds] = useState(10);
  const [drinkParameter, setDrinkParameter] = useState(1);
  const [firstCardDrinkCount, setFirstCardDrinkCount] = useState(3);
  const [lastCardDrinkCount, setLastCardDrinkCount] = useState(2);
  const [turnTimeoutSeconds, setTurnTimeoutSeconds] = useState(30);
  const [itemFlipCountThreshold, setItemFlipCountThreshold] = useState(3);
  const [reverseItemFlipCountThreshold, setReverseItemFlipCountThreshold] = useState(2);
  
  // 显示配置
  const [displayConfig, setDisplayConfig] = useState({
    showFlipCount: true,
    showDrinkCount: true,
    showCountdownToggle: true,
    showCountdownText: true,
    showTurnImage: false,
    turnImageUrl: ''
  });
  
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
          if (data.autoRestartSeconds && typeof data.autoRestartSeconds === 'number') {
            setAutoRestartSeconds(data.autoRestartSeconds);
          }
          if (data.drinkParameter && typeof data.drinkParameter === 'number') {
            setDrinkParameter(data.drinkParameter);
          }
          if (data.firstCardDrinkCount && typeof data.firstCardDrinkCount === 'number') {
            setFirstCardDrinkCount(data.firstCardDrinkCount);
          }
          if (data.lastCardDrinkCount && typeof data.lastCardDrinkCount === 'number') {
            setLastCardDrinkCount(data.lastCardDrinkCount);
          }
          if (data.turnTimeoutSeconds && typeof data.turnTimeoutSeconds === 'number') {
            setTurnTimeoutSeconds(data.turnTimeoutSeconds);
          }
          if (data.itemFlipCountThreshold && typeof data.itemFlipCountThreshold === 'number') {
            setItemFlipCountThreshold(data.itemFlipCountThreshold);
          }
          if (data.displayConfig && typeof data.displayConfig === 'object') {
            setDisplayConfig(data.displayConfig);
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
        if (preferences.autoRestartSeconds && typeof preferences.autoRestartSeconds === 'number') {
          setAutoRestartSeconds(preferences.autoRestartSeconds);
        }
        if (preferences.drinkParameter && typeof preferences.drinkParameter === 'number') {
          setDrinkParameter(preferences.drinkParameter);
        }
        if (preferences.firstCardDrinkCount && typeof preferences.firstCardDrinkCount === 'number') {
          setFirstCardDrinkCount(preferences.firstCardDrinkCount);
        }
        if (preferences.lastCardDrinkCount && typeof preferences.lastCardDrinkCount === 'number') {
          setLastCardDrinkCount(preferences.lastCardDrinkCount);
        }
        if (preferences.turnTimeoutSeconds && typeof preferences.turnTimeoutSeconds === 'number') {
          setTurnTimeoutSeconds(preferences.turnTimeoutSeconds);
        }
        if (preferences.itemFlipCountThreshold && typeof preferences.itemFlipCountThreshold === 'number') {
          setItemFlipCountThreshold(preferences.itemFlipCountThreshold);
        }
        if (preferences.reverseItemFlipCountThreshold && typeof preferences.reverseItemFlipCountThreshold === 'number') {
          setReverseItemFlipCountThreshold(preferences.reverseItemFlipCountThreshold);
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
          drinkParameter={drinkParameter}
          firstCardDrinkCount={firstCardDrinkCount}
          lastCardDrinkCount={lastCardDrinkCount}
          autoRestartSeconds={autoRestartSeconds}
          turnTimeoutSeconds={turnTimeoutSeconds}
          itemFlipCountThreshold={itemFlipCountThreshold}
          reverseItemFlipCountThreshold={reverseItemFlipCountThreshold}
        />
      ) : (
        <main className="main">
          <FlipCardGame
            cardCount={selectedCardCount}
            columns={columns}
            gameTitle={gameTitle}
            autoRestartSeconds={autoRestartSeconds}
            displayConfig={displayConfig}
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
