import { useState, useEffect } from 'react';
import FlipCardGame from './components/FlipCardGame';
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
    
    // 从服务器获取默认牌数量
    fetch('/api/preferences')
      .then(response => response.json())
      .then(data => {
        if (data.defaultCardCount) {
          setSelectedCardCount(data.defaultCardCount);
        }
      })
      .catch(error => {
        console.warn('获取默认牌数量失败，使用默认值:', error);
      });
  }, []);

  // 初始化Socket连接
  useEffect(() => {
    if (user.isLoggedIn) {
      // 创建Socket连接
      const newSocket = io('http://jimy.novrein.com:3001');
      setSocket(newSocket);

      // 处理连接成功
      newSocket.on('connect', () => {
        console.log('Socket连接成功:', newSocket.id);
        // 连接成功后不自动开始游戏，等待后端发送的初始游戏状态
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

      // 处理偏好设置更新
      newSocket.on('preferencesUpdated', (preferences) => {
        console.log('偏好设置更新:', preferences);
        if (preferences.defaultCardCount) {
          setSelectedCardCount(preferences.defaultCardCount);
        }
      });

      // 清理函数
      return () => {
        newSocket.disconnect();
      };
    }
  }, [user.isLoggedIn]);

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
      <main className="main">
        <FlipCardGame
          cardCount={selectedCardCount}
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
          onCardCountChange={(count) => {
            setSelectedCardCount(count);
            // 保存牌数量到服务器
            fetch('/api/preferences', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ defaultCardCount: count })
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                console.log('牌数量保存成功:', data.data.defaultCardCount);
              } else {
                console.warn('牌数量保存失败:', data.message);
              }
            })
            .catch(error => {
              console.warn('保存牌数量到服务器失败:', error);
            });
          }}
        />
      </main>
    </div>
  );
}

export default App;
