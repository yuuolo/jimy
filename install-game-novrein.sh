#!/bin/bash

# 游戏安装配置脚本
# 适用于Linux服务器，安装并配置卡牌游戏应用

set -e  # 遇到错误时退出脚本

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 卡牌游戏安装配置脚本 ===${NC}"

# 1. 检查并安装必要的依赖
echo -e "${YELLOW}1. 检查并安装必要的依赖...${NC}"

# 检查Node.js是否已安装
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js未安装，开始安装...${NC}"
    
    # 安装Node.js 18（LTS版本）
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ -f /etc/redhat-release ]; then
        # CentOS/RHEL
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo -E bash -
        sudo yum install -y nodejs
    else
        echo -e "${RED}不支持的Linux发行版，请手动安装Node.js 18或更高版本${NC}"
        exit 1
    fi
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}Node.js已安装: $NODE_VERSION${NC}"
fi

# 检查npm是否已安装
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm未安装，请先安装Node.js${NC}"
    exit 1
else
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}npm已安装: $NPM_VERSION${NC}"
fi

# 2. 创建游戏目录
echo -e "${YELLOW}2. 创建游戏目录...${NC}"
GAME_DIR="/opt/jimy-game"
sudo mkdir -p $GAME_DIR
sudo chown -R $USER:$USER $GAME_DIR
cd $GAME_DIR

# 3. 克隆或复制项目文件
echo -e "${YELLOW}3. 获取项目文件...${NC}"
echo -e "${GREEN}请将项目文件复制到 $GAME_DIR 目录，或使用git克隆项目${NC}"
echo -e "${GREEN}例如: git clone <your-repository-url> .${NC}"
echo -e "${YELLOW}按Enter键继续...${NC}"
read

# 4. 安装项目依赖
echo -e "${YELLOW}4. 安装项目依赖...${NC}"
if [ -f "package.json" ]; then
    npm install
    echo -e "${GREEN}依赖安装完成${NC}"
else
    echo -e "${RED}未找到package.json文件，请确保项目文件已正确复制${NC}"
    exit 1
fi

# 5. 构建前端应用
echo -e "${YELLOW}5. 构建前端应用...${NC}"
npm run build
echo -e "${GREEN}前端构建完成${NC}"

# 6. 创建环境变量配置文件
echo -e "${YELLOW}6. 配置环境变量...${NC}"
cat > .env << EOF
# 游戏配置环境变量
VITE_API_URL=http://$(hostname -I | awk '{print $1}'):3001
VITE_SOCKET_URL=http://$(hostname -I | awk '{print $1}'):3001
EOF

echo -e "${GREEN}环境变量配置完成${NC}"
echo -e "${YELLOW}当前配置:${NC}"
cat .env

# 7. 创建启动脚本
echo -e "${YELLOW}7. 创建启动脚本...${NC}"
cat > start-game.sh << EOF
#!/bin/bash

# 启动游戏服务
cd $GAME_DIR

# 启动后端服务器
echo "启动后端服务器..."
node server.cjs
EOF

chmod +x start-game.sh

# 8. 创建systemd服务文件（可选）
echo -e "${YELLOW}8. 创建systemd服务文件...${NC}"
cat > jimy-game.service << EOF
[Unit]
Description=Jimy Card Game Server
After=network.target

[Service]
User=$USER
WorkingDirectory=$GAME_DIR
ExecStart=$GAME_DIR/start-game.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo mv jimy-game.service /etc/systemd/system/
sudo systemctl daemon-reload

# 9. 启动游戏服务
echo -e "${YELLOW}9. 启动游戏服务...${NC}"
echo -e "${GREEN}启动游戏服务（后台运行）...${NC}"
sudo systemctl start jimy-game

# 10. 设置开机自启（可选）
echo -e "${YELLOW}10. 设置开机自启...${NC}"
sudo systemctl enable jimy-game

# 11. 显示服务状态
echo -e "${YELLOW}11. 显示服务状态...${NC}"
sudo systemctl status jimy-game --no-pager

# 12. 显示访问信息
SERVER_IP=$(hostname -I | awk '{print $1}')
echo -e "${GREEN}=== 安装配置完成 ===${NC}"
echo -e "${GREEN}游戏服务已启动，可通过以下地址访问:${NC}"
echo -e "${GREEN}前端: http://$SERVER_IP:5173${NC}"
echo -e "${GREEN}后端API: http://$SERVER_IP:3001${NC}"
echo -e "${YELLOW}注意: 如需停止服务，请运行: sudo systemctl stop jimy-game${NC}"
echo -e "${YELLOW}如需查看服务日志，请运行: sudo journalctl -u jimy-game${NC}"