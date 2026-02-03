import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface AdminPageProps {
  socket: Socket | null;
  onBack?: () => void;
  drinkParameter: number;
  firstCardDrinkCount: number;
  lastCardDrinkCount: number;
  autoRestartSeconds: number;
  turnTimeoutSeconds: number;
  itemFlipCountThreshold: number;
  reverseItemFlipCountThreshold: number;
}

interface Player {
  id: string;
  nickname: string;
  isTurn: boolean;
  isActive: boolean;
}

const AdminPage: React.FC<AdminPageProps> = ({ socket, onBack, drinkParameter: propDrinkParameter, firstCardDrinkCount: propFirstCardDrinkCount, lastCardDrinkCount: propLastCardDrinkCount, autoRestartSeconds: propAutoRestartSeconds, turnTimeoutSeconds: propTurnTimeoutSeconds, itemFlipCountThreshold: propItemFlipCountThreshold, reverseItemFlipCountThreshold: propReverseItemFlipCountThreshold }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [timeoutMinutes, setTimeoutMinutes] = useState(3);
  const [turnTimeoutSeconds, setTurnTimeoutSeconds] = useState(propTurnTimeoutSeconds || 30);
  const [gameTitle, setGameTitle] = useState('壹城翻牌游戏');
  const [cardCount, setCardCount] = useState(9);
  const [columns, setColumns] = useState(3);
  const [winMessages, setWinMessages] = useState<string[]>([
    '恭喜你找到境哥牌！',
    '太棒了，你找到了！',
    '运气真好，境哥牌被你找到了！',
    '恭喜恭喜，你找到了境哥牌！',
    '厉害了，境哥牌归你了！'
  ]);
  const [newWinMessage, setNewWinMessage] = useState('');
  const [autoRestartSeconds, setAutoRestartSeconds] = useState(propAutoRestartSeconds || 10);
  const [drinkParameter, setDrinkParameter] = useState(propDrinkParameter);
  const [firstCardDrinkCount, setFirstCardDrinkCount] = useState(propFirstCardDrinkCount);
  const [lastCardDrinkCount, setLastCardDrinkCount] = useState(propLastCardDrinkCount);
  const [itemFlipCountThreshold, setItemFlipCountThreshold] = useState(propItemFlipCountThreshold || 3);
  const [reverseItemFlipCountThreshold, setReverseItemFlipCountThreshold] = useState(propReverseItemFlipCountThreshold || 2);
  const [gameIniFile, setGameIniFile] = useState<File | null>(null);
  const [uploadingGameIni, setUploadingGameIni] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [backcards, setBackcards] = useState<any[]>([]);
  const [backcardFiles, setBackcardFiles] = useState<File[]>([]);
  const [uploadingBackcard, setUploadingBackcard] = useState(false);
  const [backcardMessage, setBackcardMessage] = useState('');
  const [backcardSelectionMode, setBackcardSelectionMode] = useState('random');
  const [backcardSelectionCount, setBackcardSelectionCount] = useState(3);
  const [selectedBackcards, setSelectedBackcards] = useState<string[]>([]);
  
  // 境哥牌管理
  const [endcards, setEndcards] = useState<any[]>([]);
  const [endcardFiles, setEndcardFiles] = useState<File[]>([]);
  const [uploadingEndcard, setUploadingEndcard] = useState(false);
  const [endcardMessage, setEndcardMessage] = useState('');
  
  const isInitialized = useRef(false);

  // 加载保存的偏好设置
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
        const response = await fetch(`${apiUrl}/api/preferences`);
        const data = await response.json();
        
        // 加载背景牌选择模式设置
        if (data.backcardSelectionMode) {
          setBackcardSelectionMode(data.backcardSelectionMode);
        }
        if (data.backcardSelectionCount) {
          setBackcardSelectionCount(data.backcardSelectionCount);
        }
        if (data.selectedBackcards) {
          setSelectedBackcards(data.selectedBackcards);
        }
        
        isInitialized.current = true;
      } catch (error) {
        console.error('加载偏好设置失败:', error);
        isInitialized.current = true;
      }
    };
    
    loadPreferences();
  }, []);

  // 监听 propAutoRestartSeconds 的变化
  useEffect(() => {
    setAutoRestartSeconds(propAutoRestartSeconds || 10);
  }, [propAutoRestartSeconds]);

  // 监听 propTurnTimeoutSeconds 的变化
  useEffect(() => {
    setTurnTimeoutSeconds(propTurnTimeoutSeconds || 30);
  }, [propTurnTimeoutSeconds]);

  // 监听 propFirstCardDrinkCount 的变化
  useEffect(() => {
    setFirstCardDrinkCount(propFirstCardDrinkCount);
  }, [propFirstCardDrinkCount]);

  // 监听 propLastCardDrinkCount 的变化
  useEffect(() => {
    setLastCardDrinkCount(propLastCardDrinkCount);
  }, [propLastCardDrinkCount]);

  // 监听 propTurnTimeoutSeconds 的变化
  useEffect(() => {
    setTurnTimeoutSeconds(propTurnTimeoutSeconds || 30);
  }, [propTurnTimeoutSeconds]);

  // 自动保存自动重启时间
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && autoRestartSeconds >= 5 && autoRestartSeconds <= 60) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ autoRestartSeconds })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('自动重启时间更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新自动重启时间失败:', error);
      });
    }
  }, [autoRestartSeconds, isAuthenticated]);

  // 自动保存喝酒参数
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && drinkParameter >= 1 && drinkParameter <= 100) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ drinkParameter })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('喝酒参数更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新喝酒参数失败:', error);
      });
    }
  }, [drinkParameter, isAuthenticated]);

  // 自动保存第一种算法参数
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && firstCardDrinkCount >= 1 && firstCardDrinkCount <= 100) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ firstCardDrinkCount })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('第一种算法参数更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新第一种算法参数失败:', error);
      });
    }
  }, [firstCardDrinkCount, isAuthenticated]);

  // 自动保存第三种算法参数
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && lastCardDrinkCount >= 1 && lastCardDrinkCount <= 100) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lastCardDrinkCount })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('第三种算法参数更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新第三种算法参数失败:', error);
      });
    }
  }, [lastCardDrinkCount, isAuthenticated]);

  // 自动保存道具翻牌数阈值
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && itemFlipCountThreshold >= 1 && itemFlipCountThreshold <= 20) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemFlipCountThreshold })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('道具翻牌数阈值更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新道具翻牌数阈值失败:', error);
      });
    }
  }, [itemFlipCountThreshold, isAuthenticated]);

  // 自动保存反转道具翻牌数阈值
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && reverseItemFlipCountThreshold >= 1 && reverseItemFlipCountThreshold <= 20) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reverseItemFlipCountThreshold })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('反转道具翻牌数阈值更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新反转道具翻牌数阈值失败:', error);
      });
    }
  }, [reverseItemFlipCountThreshold, isAuthenticated]);

  // 自动保存背景牌选择模式
  useEffect(() => {
    if (isInitialized.current && isAuthenticated) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ backcardSelectionMode })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('背景牌选择模式更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新背景牌选择模式失败:', error);
      });
    }
  }, [backcardSelectionMode, isAuthenticated]);

  // 自动保存背景牌选择数量
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && backcardSelectionCount >= 1 && backcardSelectionCount <= 50) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ backcardSelectionCount })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('背景牌选择数量更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新背景牌选择数量失败:', error);
      });
    }
  }, [backcardSelectionCount, isAuthenticated]);

  // 自动保存固定背景牌列表
  useEffect(() => {
    if (isInitialized.current && isAuthenticated) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ selectedBackcards })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('固定背景牌列表更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新固定背景牌列表失败:', error);
      });
    }
  }, [selectedBackcards, isAuthenticated]);

  // 获取背景牌列表
  useEffect(() => {
    const fetchBackcards = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
        const response = await fetch(`${apiUrl}/api/backcards`);
        const data = await response.json();
        if (data.success) {
          setBackcards(data.backcards);
        }
      } catch (error) {
        console.error('获取背景牌列表失败:', error);
      }
    };

    fetchBackcards();
  }, []);

  // 获取境哥牌列表
  useEffect(() => {
    const fetchEndcards = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
        const response = await fetch(`${apiUrl}/api/endcards`);
        const data = await response.json();
        if (data.success) {
          setEndcards(data.endcards);
        }
      } catch (error) {
        console.error('获取境哥牌列表失败:', error);
      }
    };

    fetchEndcards();
  }, []);

  // 处理背景牌上传

  // 自动保存超时时间
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && timeoutMinutes >= 1 && timeoutMinutes <= 30) {
      socket?.emit('admin:setTimeout', timeoutMinutes);
    }
  }, [timeoutMinutes, isAuthenticated, socket]);

  // 自动保存回合超时时间
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && turnTimeoutSeconds >= 5 && turnTimeoutSeconds <= 300) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ turnTimeoutSeconds })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('回合超时时间更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新回合超时时间失败:', error);
      });
    }
  }, [turnTimeoutSeconds, isAuthenticated]);

  // 自动保存游戏标题
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && gameTitle.trim().length > 0) {
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
        if (!data.success) {
          console.error('游戏标题更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新游戏标题失败:', error);
      });
    }
  }, [gameTitle, isAuthenticated]);

  // 自动保存牌数
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && cardCount >= 6 && cardCount <= 60) {
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
        if (!data.success) {
          console.error('牌数更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新牌数失败:', error);
      });
    }
  }, [cardCount, isAuthenticated]);

  // 自动保存牌列数
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && columns >= 3 && columns <= 6) {
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
        if (!data.success) {
          console.error('牌列数更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新牌列数失败:', error);
      });
    }
  }, [columns, isAuthenticated]);

  // 自动保存获胜文字列表
  useEffect(() => {
    if (isInitialized.current && isAuthenticated && winMessages.length > 0) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      fetch(`${apiUrl}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ winMessages })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          console.error('获胜文字列表更新失败:', data.message);
        }
      })
      .catch(error => {
        console.error('更新获胜文字列表失败:', error);
      });
    }
  }, [winMessages, isAuthenticated]);

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
          if (data.winMessages && Array.isArray(data.winMessages)) {
            setWinMessages(data.winMessages);
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
          isInitialized.current = true;
        })
        .catch(error => {
          console.warn('获取配置失败:', error);
          isInitialized.current = true;
        });
    }

    return () => {
      socket?.off('admin:playersList');
      socket?.off('admin:currentTimeout');
    };
  }, [isAuthenticated, socket]);

  // 处理添加获胜文字
  const handleAddWinMessage = () => {
    if (newWinMessage.trim().length > 0) {
      setWinMessages([...winMessages, newWinMessage.trim()]);
      setNewWinMessage('');
    }
  };

  // 处理删除获胜文字
  const handleDeleteWinMessage = (index: number) => {
    setWinMessages(winMessages.filter((_, i) => i !== index));
  };

  // 处理游戏说明图片上传
  const handleGameIniUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadMessage('请上传图片文件');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadMessage('图片大小不能超过5MB');
      return;
    }

    setGameIniFile(file);
    setUploadMessage('');
  };

  // 提交游戏说明图片上传
  const handleSubmitGameIniUpload = async () => {
    if (!gameIniFile) {
      setUploadMessage('请选择要上传的图片');
      return;
    }

    setUploadingGameIni(true);
    setUploadMessage('');

    const formData = new FormData();
    formData.append('gameini', gameIniFile);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      const response = await fetch(`${apiUrl}/api/upload-gameini`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setUploadMessage('游戏说明图片上传成功！');
        setGameIniFile(null);
      } else {
        setUploadMessage(data.message || '上传失败');
      }
    } catch (error) {
      console.error('上传游戏说明图片失败:', error);
      setUploadMessage('上传失败，请重试');
    } finally {
      setUploadingGameIni(false);
    }
  };

  // 处理背景牌上传
  const handleBackcardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    let errorMessage = '';

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        errorMessage = '请上传图片文件';
        break;
      }

      if (file.size > 5 * 1024 * 1024) {
        errorMessage = '图片大小不能超过5MB';
        break;
      }

      validFiles.push(file);
    }

    if (errorMessage) {
      setBackcardMessage(errorMessage);
      setBackcardFiles([]);
      return;
    }

    setBackcardFiles(validFiles);
    setBackcardMessage(`已选择 ${validFiles.length} 个文件`);
  };

  // 提交背景牌上传
  const handleSubmitBackcardUpload = async () => {
    if (backcardFiles.length === 0) {
      setBackcardMessage('请选择要上传的图片');
      return;
    }

    setUploadingBackcard(true);
    setBackcardMessage('');

    const formData = new FormData();
    backcardFiles.forEach((file) => {
      formData.append('backcards', file);
    });

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      const response = await fetch(`${apiUrl}/api/upload-backcard`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setBackcardMessage(`背景牌上传成功！共上传 ${data.uploadedFiles || 1} 个文件`);
        setBackcardFiles([]);
        // 重新获取背景牌列表
        const listResponse = await fetch(`${apiUrl}/api/backcards`);
        const listData = await listResponse.json();
        if (listData.success) {
          setBackcards(listData.backcards);
        }
      } else {
        setBackcardMessage(data.message || '上传失败');
      }
    } catch (error) {
      console.error('上传背景牌失败:', error);
      setBackcardMessage('上传失败，请重试');
    } finally {
      setUploadingBackcard(false);
    }
  };

  // 删除背景牌
  const handleDeleteBackcard = async (filename: string) => {
    if (!confirm('确定要删除这张背景牌吗？')) {
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      const response = await fetch(`${apiUrl}/api/backcards/${filename}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setBackcards(backcards.filter(b => b.filename !== filename));
      } else {
        alert(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除背景牌失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 处理境哥牌上传
  const handleEndcardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    let errorMessage = '';

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        errorMessage = '请上传图片文件';
        break;
      }

      if (file.size > 5 * 1024 * 1024) {
        errorMessage = '图片大小不能超过5MB';
        break;
      }

      validFiles.push(file);
    }

    if (errorMessage) {
      setEndcardMessage(errorMessage);
      setEndcardFiles([]);
      return;
    }

    setEndcardFiles(validFiles);
    setEndcardMessage(`已选择 ${validFiles.length} 个文件`);
  };

  // 提交境哥牌上传
  const handleSubmitEndcardUpload = async () => {
    if (endcardFiles.length === 0) {
      setEndcardMessage('请选择要上传的图片');
      return;
    }

    setUploadingEndcard(true);
    setEndcardMessage('');

    const formData = new FormData();
    endcardFiles.forEach((file) => {
      formData.append('endcards', file);
    });

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      const response = await fetch(`${apiUrl}/api/upload-endcard`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setEndcardMessage(`境哥牌上传成功！共上传 ${data.uploadedFiles || 1} 个文件`);
        setEndcardFiles([]);
        // 重新获取境哥牌列表
        const listResponse = await fetch(`${apiUrl}/api/endcards`);
        const listData = await listResponse.json();
        if (listData.success) {
          setEndcards(listData.endcards);
        }
      } else {
        setEndcardMessage(data.message || '上传失败');
      }
    } catch (error) {
      console.error('上传境哥牌失败:', error);
      setEndcardMessage('上传失败，请重试');
    } finally {
      setUploadingEndcard(false);
    }
  };

  // 删除境哥牌
  const handleDeleteEndcard = async (filename: string) => {
    if (!confirm('确定要删除这张境哥牌吗？')) {
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://jimy.novrein.com:3001';
      const response = await fetch(`${apiUrl}/api/endcards/${filename}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setEndcards(endcards.filter(e => e.filename !== filename));
      } else {
        alert(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除境哥牌失败:', error);
      alert('删除失败，请重试');
    }
  };

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
        <h3>自动重启时间设置</h3>
        <div className="auto-restart-setting">
          <label htmlFor="auto-restart-seconds">自动重启时间：{autoRestartSeconds}秒</label>
          <div className="slider-input-control">
            <input
              type="range"
              id="auto-restart-seconds"
              min="5"
              max="60"
              step="1"
              className="parameter-slider"
              value={autoRestartSeconds}
              onChange={(e) => setAutoRestartSeconds(parseInt(e.target.value))}
            />
            <div className="slider-value">{autoRestartSeconds}秒</div>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h3>酒杯算法参数设置</h3>
        <div className="drink-algorithm-setting">
          <div className="drink-parameter-item">
            <label htmlFor="drink-parameter">回合摸牌大于：{drinkParameter}</label>
            <div className="slider-input-control">
              <input
                type="range"
                id="drink-parameter"
                min="1"
                max="100"
                step="1"
                className="parameter-slider"
                value={drinkParameter}
                onChange={(e) => setDrinkParameter(parseInt(e.target.value))}
              />
              <div className="slider-value">{drinkParameter}</div>
            </div>
            <label>酒杯数量开始加1</label>
          </div>
          <div className="drink-parameter-item">
            <label htmlFor="first-card-drink-count">第一张牌酒杯数量：{firstCardDrinkCount}</label>
            <div className="slider-input-control">
              <input
                type="range"
                id="first-card-drink-count"
                min="1"
                max="100"
                step="1"
                className="parameter-slider"
                value={firstCardDrinkCount}
                onChange={(e) => setFirstCardDrinkCount(parseInt(e.target.value))}
              />
              <div className="slider-value">{firstCardDrinkCount}</div>
            </div>
          </div>
          <div className="drink-parameter-item">
            <label htmlFor="last-card-drink-count">最后一张牌酒杯增加数量：{lastCardDrinkCount}</label>
            <div className="slider-input-control">
              <input
                type="range"
                id="last-card-drink-count"
                min="1"
                max="100"
                step="1"
                className="parameter-slider"
                value={lastCardDrinkCount}
                onChange={(e) => setLastCardDrinkCount(parseInt(e.target.value))}
              />
              <div className="slider-value">{lastCardDrinkCount}</div>
            </div>
          </div>
          <div className="drink-parameter-item">
            <label htmlFor="item-flip-count-threshold">获得点名道具翻牌数：{itemFlipCountThreshold}</label>
            <div className="slider-input-control">
              <input
                type="range"
                id="item-flip-count-threshold"
                min="1"
                max="20"
                step="1"
                className="parameter-slider"
                value={itemFlipCountThreshold}
                onChange={(e) => setItemFlipCountThreshold(parseInt(e.target.value))}
              />
              <div className="slider-value">{itemFlipCountThreshold}</div>
            </div>
          </div>
          <div className="drink-parameter-item">
            <label htmlFor="reverse-item-flip-count-threshold">获得反转道具翻牌数：{reverseItemFlipCountThreshold}</label>
            <div className="slider-input-control">
              <input
                type="range"
                id="reverse-item-flip-count-threshold"
                min="1"
                max="20"
                step="1"
                className="parameter-slider"
                value={reverseItemFlipCountThreshold}
                onChange={(e) => setReverseItemFlipCountThreshold(parseInt(e.target.value))}
              />
              <div className="slider-value">{reverseItemFlipCountThreshold}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h3>游戏说明</h3>
        <div className="game-ini-upload">
          <div className="upload-input-wrapper">
            <input
              type="file"
              id="game-ini-file"
              accept="image/*"
              onChange={handleGameIniUpload}
              style={{ display: 'none' }}
            />
            <label htmlFor="game-ini-file" className="upload-button">
              {gameIniFile ? gameIniFile.name : '选择图片'}
            </label>
          </div>
          <button 
            onClick={handleSubmitGameIniUpload}
            disabled={uploadingGameIni || !gameIniFile}
            className="upload-submit-button"
          >
            {uploadingGameIni ? '上传中...' : '上传'}
          </button>
          {uploadMessage && (
            <div className={`upload-message ${uploadMessage.includes('成功') ? 'success' : 'error'}`}>
              {uploadMessage}
            </div>
          )}
        </div>
      </div>

      <div className="admin-section">
        <h3>背景牌管理</h3>
        
        <div className="backcard-settings">
          <div className="setting-item">
            <label htmlFor="backcard-selection-mode">背景牌选择模式：</label>
            <select
              id="backcard-selection-mode"
              value={backcardSelectionMode}
              onChange={(e) => setBackcardSelectionMode(e.target.value)}
              className="setting-select"
            >
              <option value="random">随机选择</option>
              <option value="all">使用所有</option>
              <option value="fixed">固定选择</option>
            </select>
          </div>
          
          {backcardSelectionMode === 'random' && (
            <div className="setting-item">
              <label htmlFor="backcard-selection-count">随机选择数量：{backcardSelectionCount}</label>
              <div className="slider-input-control">
                <input
                  type="range"
                  id="backcard-selection-count"
                  min="1"
                  max="50"
                  step="1"
                  className="parameter-slider"
                  value={backcardSelectionCount}
                  onChange={(e) => setBackcardSelectionCount(parseInt(e.target.value))}
                />
                <div className="slider-value">{backcardSelectionCount}</div>
              </div>
            </div>
          )}
          
          {backcardSelectionMode === 'fixed' && (
            <div className="setting-item">
              <label>选择固定背景牌：</label>
              <div className="fixed-backcards-selector">
                {backcards.map((backcard) => (
                  <div key={backcard.filename} className="fixed-backcard-option">
                    <input
                      type="checkbox"
                      id={`fixed-${backcard.filename}`}
                      checked={selectedBackcards.includes(backcard.filename)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBackcards([...selectedBackcards, backcard.filename]);
                        } else {
                          setSelectedBackcards(selectedBackcards.filter(f => f !== backcard.filename));
                        }
                      }}
                    />
                    <label htmlFor={`fixed-${backcard.filename}`} className="fixed-backcard-label">
                      <img src={backcard.url} alt={backcard.filename} />
                      <span>{backcard.filename}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="backcard-upload">
          <div className="upload-input-wrapper">
            <input
              type="file"
              id="backcard-file"
              accept="image/*"
              onChange={handleBackcardUpload}
              multiple
              style={{ display: 'none' }}
            />
            <label htmlFor="backcard-file" className="upload-button">
              {backcardFiles.length > 0 ? `已选择 ${backcardFiles.length} 个文件` : '选择图片'}
            </label>
          </div>
          <button 
            onClick={handleSubmitBackcardUpload}
            disabled={uploadingBackcard || backcardFiles.length === 0}
            className="upload-submit-button"
          >
            {uploadingBackcard ? '上传中...' : '上传'}
          </button>
          {backcardMessage && (
            <div className={`upload-message ${backcardMessage.includes('成功') ? 'success' : 'error'}`}>
              {backcardMessage}
            </div>
          )}
        </div>
        <div className="backcard-list">
          {backcards.length === 0 ? (
            <div className="empty-backcards">暂无背景牌</div>
          ) : (
            backcards.map((backcard) => (
              <div key={backcard.filename} className="backcard-item">
                <img 
                  src={backcard.url} 
                  alt={backcard.filename}
                  className="backcard-preview"
                />
                <div className="backcard-info">
                  <span className="backcard-filename">{backcard.filename}</span>
                  <button 
                    onClick={() => handleDeleteBackcard(backcard.filename)}
                    className="delete-backcard-button"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="admin-section">
        <h3>境哥牌管理</h3>
        
        <div className="endcard-upload">
          <div className="upload-input-wrapper">
            <input
              type="file"
              id="endcard-file"
              accept="image/*"
              onChange={handleEndcardUpload}
              multiple
              style={{ display: 'none' }}
            />
            <label htmlFor="endcard-file" className="upload-button">
              {endcardFiles.length > 0 ? `已选择 ${endcardFiles.length} 个文件` : '选择图片'}
            </label>
          </div>
          <button 
            onClick={handleSubmitEndcardUpload}
            disabled={uploadingEndcard || endcardFiles.length === 0}
            className="upload-submit-button"
          >
            {uploadingEndcard ? '上传中...' : '上传'}
          </button>
          {endcardMessage && (
            <div className={`upload-message ${endcardMessage.includes('成功') ? 'success' : 'error'}`}>
              {endcardMessage}
            </div>
          )}
        </div>
        <div className="backcard-list">
          {endcards.length === 0 ? (
            <div className="empty-backcards">暂无境哥牌</div>
          ) : (
            endcards.map((endcard) => (
              <div key={endcard.filename} className="backcard-item">
                <img 
                  src={endcard.url} 
                  alt={endcard.filename}
                  className="backcard-preview"
                />
                <div className="backcard-info">
                  <span className="backcard-filename">{endcard.filename}</span>
                  <button 
                    onClick={() => handleDeleteEndcard(endcard.filename)}
                    className="delete-backcard-button"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="admin-section">
        <h3>超时设置</h3>
        <div className="timeout-setting">
          <label htmlFor="timeout">玩家离线超时时间：{timeoutMinutes}分钟</label>
          <div className="slider-input-control">
            <input
              type="range"
              id="timeout"
              min="1"
              max="30"
              step="1"
              className="parameter-slider"
              value={timeoutMinutes}
              onChange={handleTimeoutChange}
            />
            <div className="slider-value">{timeoutMinutes}分钟</div>
          </div>
        </div>
        <div className="timeout-setting">
          <label htmlFor="turn-timeout">回合超时时间：{turnTimeoutSeconds}秒</label>
          <div className="slider-input-control">
            <input
              type="range"
              id="turn-timeout"
              min="5"
              max="300"
              step="5"
              className="parameter-slider"
              value={turnTimeoutSeconds}
              onChange={(e) => setTurnTimeoutSeconds(Number(e.target.value))}
            />
            <div className="slider-value">{turnTimeoutSeconds}秒</div>
          </div>
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
        </div>
      </div>

      <div className="admin-section">
        <h3>获胜文字设置</h3>
        <div className="win-messages-setting">
          <div className="win-messages-list">
            {winMessages.map((message, index) => (
              <div key={index} className="win-message-item">
                <span className="win-message-text">{message}</span>
                <button
                  className="delete-button"
                  onClick={() => handleDeleteWinMessage(index)}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
          <div className="win-message-add">
            <input
              type="text"
              value={newWinMessage}
              onChange={(e) => setNewWinMessage(e.target.value)}
              placeholder="输入新的获胜文字"
              className="win-message-input"
              onKeyPress={(e) => e.key === 'Enter' && handleAddWinMessage()}
            />
            <button
              className="add-button"
              onClick={handleAddWinMessage}
            >
              添加
            </button>
          </div>
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