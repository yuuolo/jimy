#!/bin/bash

# 好嗨靓仔境翻牌游戏 - Ubuntu一键部署脚本
# 作者: Auto-generated
# 日期: 2026-01-28

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_NAME="online-chess-game"
APP_DIR="/opt/${PROJECT_NAME}"
SERVICE_USER="www-data"
BACKEND_PORT=3001
FRONTEND_PORT=5173
DOMAIN_NAME=""  # 如果有域名，请修改此处

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用root用户运行此脚本"
        log_info "使用命令: sudo bash deploy.sh"
        exit 1
    fi
}

# 检查系统信息
check_system() {
    log_step "检查系统信息..."
    
    if [ ! -f /etc/os-release ]; then
        log_error "无法检测操作系统"
        exit 1
    fi
    
    . /etc/os-release
    
    if [ "$ID" != "ubuntu" ]; then
        log_warn "此脚本专为Ubuntu系统设计，当前系统为: $ID"
        read -p "是否继续? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log_info "系统: $PRETTY_NAME"
    log_info "内核: $(uname -r)"
}

# 更新系统
update_system() {
    log_step "更新系统软件包..."
    apt update -y
    apt upgrade -y
}

# 安装依赖
install_dependencies() {
    log_step "安装系统依赖..."
    
    # 安装Node.js
    if ! command -v node &> /dev/null; then
        log_info "安装Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt install -y nodejs
    else
        log_info "Node.js已安装: $(node -v)"
    fi
    
    # 安装npm
    if ! command -v npm &> /dev/null; then
        log_info "安装npm..."
        apt install -y npm
    else
        log_info "npm已安装: $(npm -v)"
    fi
    
    # 安装其他依赖
    apt install -y git build-essential nginx sqlite3
    
    log_info "所有依赖安装完成"
}

# 创建应用目录
create_app_directory() {
    log_step "创建应用目录..."
    
    if [ -d "$APP_DIR" ]; then
        log_warn "目录已存在: $APP_DIR"
        read -p "是否删除并重新创建? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$APP_DIR"
        else
            log_error "部署取消"
            exit 1
        fi
    fi
    
    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/logs"
    log_info "应用目录创建完成: $APP_DIR"
}

# 复制项目文件
copy_project_files() {
    log_step "复制项目文件..."
    
    # 获取当前脚本所在目录
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    
    if [ ! -f "$SCRIPT_DIR/package.json" ]; then
        log_error "未找到package.json文件，请确保在项目根目录运行此脚本"
        exit 1
    fi
    
    # 复制所有文件
    cp -r "$SCRIPT_DIR"/* "$APP_DIR/"
    
    # 设置权限
    chown -R $SERVICE_USER:$SERVICE_USER "$APP_DIR"
    
    log_info "项目文件复制完成"
}

# 安装Node.js依赖
install_node_dependencies() {
    log_step "安装Node.js依赖..."
    
    cd "$APP_DIR"
    
    # 安装生产依赖
    log_info "安装依赖包..."
    sudo -u $SERVICE_USER npm install --production
    
    # 安装开发依赖（用于构建）
    log_info "安装开发依赖..."
    sudo -u $SERVICE_USER npm install
    
    log_info "Node.js依赖安装完成"
}

# 构建前端
build_frontend() {
    log_step "构建前端..."
    
    cd "$APP_DIR"
    
    # 构建前端
    sudo -u $SERVICE_USER npm run build
    
    if [ ! -d "$APP_DIR/dist" ]; then
        log_error "前端构建失败"
        exit 1
    fi
    
    log_info "前端构建完成"
}

# 配置systemd服务
configure_systemd_services() {
    log_step "配置systemd服务..."
    
    # 创建后端服务文件
    cat > /etc/systemd/system/${PROJECT_NAME}-backend.service <<EOF
[Unit]
Description=Online Chess Game Backend Service
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/server.cjs
Restart=always
RestartSec=10
StandardOutput=append:$APP_DIR/logs/backend.log
StandardError=append:$APP_DIR/logs/backend-error.log
Environment=NODE_ENV=production
Environment=PORT=$BACKEND_PORT

[Install]
WantedBy=multi-user.target
EOF
    
    # 创建前端服务文件（可选，如果使用Nginx则不需要）
    cat > /etc/systemd/system/${PROJECT_NAME}-frontend.service <<EOF
[Unit]
Description=Online Chess Game Frontend Service
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT
Restart=always
RestartSec=10
StandardOutput=append:$APP_DIR/logs/frontend.log
StandardError=append:$APP_DIR/logs/frontend-error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    # 重载systemd
    systemctl daemon-reload
    
    log_info "systemd服务配置完成"
}

# 配置Nginx
configure_nginx() {
    log_step "配置Nginx..."
    
    # 创建Nginx配置文件
    cat > /etc/nginx/sites-available/${PROJECT_NAME} <<EOF
server {
    listen 80;
    server_name _;

    # 前端静态文件
    location / {
        root $APP_DIR/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # API代理到后端
    location /api/ {
        proxy_pass http://localhost:$BACKEND_PORT/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket代理
    location /socket.io/ {
        proxy_pass http://localhost:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # 静态资源
    location /png/ {
        alias $APP_DIR/public/png/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /sounds/ {
        alias $APP_DIR/public/sounds/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:$BACKEND_PORT/health;
        access_log off;
    }

    # 日志
    access_log $APP_DIR/logs/nginx-access.log;
    error_log $APP_DIR/logs/nginx-error.log;
}
EOF
    
    # 启用站点
    ln -sf /etc/nginx/sites-available/${PROJECT_NAME} /etc/nginx/sites-enabled/
    
    # 删除默认站点
    rm -f /etc/nginx/sites-enabled/default
    
    # 测试Nginx配置
    nginx -t
    
    if [ $? -eq 0 ]; then
        log_info "Nginx配置测试通过"
    else
        log_error "Nginx配置测试失败"
        exit 1
    fi
    
    log_info "Nginx配置完成"
}

# 配置防火墙
configure_firewall() {
    log_step "配置防火墙..."
    
    if command -v ufw &> /dev/null; then
        # 允许SSH
        ufw allow OpenSSH
        
        # 允许HTTP
        ufw allow 80/tcp
        
        # 允许HTTPS（如果配置了SSL）
        ufw allow 443/tcp
        
        # 启用防火墙
        ufw --force enable
        
        log_info "防火墙配置完成"
    else
        log_warn "未找到ufw防火墙，跳过防火墙配置"
    fi
}

# 启动服务
start_services() {
    log_step "启动服务..."
    
    # 启动后端服务
    systemctl enable ${PROJECT_NAME}-backend
    systemctl start ${PROJECT_NAME}-backend
    
    log_info "后端服务已启动"
    
    # 启动Nginx
    systemctl enable nginx
    systemctl restart nginx
    
    log_info "Nginx已启动"
    
    # 等待服务启动
    sleep 3
}

# 检查服务状态
check_services() {
    log_step "检查服务状态..."
    
    # 检查后端服务
    if systemctl is-active --quiet ${PROJECT_NAME}-backend; then
        log_info "后端服务运行正常"
    else
        log_error "后端服务启动失败"
        systemctl status ${PROJECT_NAME}-backend
        exit 1
    fi
    
    # 检查Nginx
    if systemctl is-active --quiet nginx; then
        log_info "Nginx运行正常"
    else
        log_error "Nginx启动失败"
        systemctl status nginx
        exit 1
    fi
    
    # 检查端口
    if netstat -tuln | grep -q ":$BACKEND_PORT "; then
        log_info "后端端口 $BACKEND_PORT 监听正常"
    else
        log_warn "后端端口 $BACKEND_PORT 未监听"
    fi
    
    if netstat -tuln | grep -q ":80 "; then
        log_info "HTTP端口 80 监听正常"
    else
        log_warn "HTTP端口 80 未监听"
    fi
}

# 显示部署信息
show_deployment_info() {
    log_step "部署完成！"
    echo ""
    echo "=========================================="
    echo "  好嗨靓仔境翻牌游戏 - 部署信息"
    echo "=========================================="
    echo ""
    echo "应用目录: $APP_DIR"
    echo "后端端口: $BACKEND_PORT"
    echo "前端端口: 80 (通过Nginx)"
    echo ""
    echo "服务管理命令:"
    echo "  后端服务:"
    echo "    启动: systemctl start ${PROJECT_NAME}-backend"
    echo "    停止: systemctl stop ${PROJECT_NAME}-backend"
    echo "    重启: systemctl restart ${PROJECT_NAME}-backend"
    echo "    状态: systemctl status ${PROJECT_NAME}-backend"
    echo ""
    echo "  Nginx服务:"
    echo "    启动: systemctl start nginx"
    echo "    停止: systemctl stop nginx"
    echo "    重启: systemctl restart nginx"
    echo "    状态: systemctl status nginx"
    echo ""
    echo "日志查看:"
    echo "  后端日志: tail -f $APP_DIR/logs/backend.log"
    echo "  后端错误日志: tail -f $APP_DIR/logs/backend-error.log"
    echo "  Nginx访问日志: tail -f $APP_DIR/logs/nginx-access.log"
    echo "  Nginx错误日志: tail -f $APP_DIR/logs/nginx-error.log"
    echo ""
    echo "访问地址:"
    echo "  http://$(hostname -I | awk '{print $1}')"
    echo ""
    echo "=========================================="
    echo ""
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  好嗨靓仔境翻牌游戏 - 一键部署脚本"
    echo "=========================================="
    echo ""
    
    # 检查root权限
    check_root
    
    # 检查系统
    check_system
    
    # 更新系统
    update_system
    
    # 安装依赖
    install_dependencies
    
    # 创建应用目录
    create_app_directory
    
    # 复制项目文件
    copy_project_files
    
    # 安装Node.js依赖
    install_node_dependencies
    
    # 构建前端
    build_frontend
    
    # 配置systemd服务
    configure_systemd_services
    
    # 配置Nginx
    configure_nginx
    
    # 配置防火墙
    configure_firewall
    
    # 启动服务
    start_services
    
    # 检查服务
    check_services
    
    # 显示部署信息
    show_deployment_info
    
    log_info "部署成功完成！"
}

# 运行主函数
main
