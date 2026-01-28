# 好嗨靓仔境翻牌游戏 - Ubuntu部署指南

本文档提供在Ubuntu系统上部署"好嗨靓仔境"翻牌游戏的详细指南。

## 目录

- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [详细部署步骤](#详细部署步骤)
- [配置说明](#配置说明)
- [服务管理](#服务管理)
- [日志查看](#日志查看)
- [更新应用](#更新应用)
- [卸载应用](#卸载应用)
- [故障排除](#故障排除)
- [SSL证书配置](#ssl证书配置)

## 系统要求

- **操作系统**: Ubuntu 18.04 或更高版本
- **内存**: 至少 1GB RAM
- **磁盘空间**: 至少 2GB 可用空间
- **网络**: 互联网连接（用于安装依赖）
- **权限**: root 或 sudo 权限

## 快速开始

### 1. 准备工作

确保您在项目根目录下，并且拥有以下文件：

```bash
ls -la
```

应该看到以下关键文件：
- `deploy.sh` - 部署脚本
- `update.sh` - 更新脚本
- `uninstall.sh` - 卸载脚本
- `package.json` - 项目配置
- `server.cjs` - 后端服务器
- `src/` - 前端源代码

### 2. 一键部署

```bash
# 给脚本添加执行权限
chmod +x deploy.sh update.sh uninstall.sh

# 运行部署脚本
sudo bash deploy.sh
```

部署脚本会自动完成以下操作：
- 更新系统软件包
- 安装 Node.js 和 npm
- 安装其他依赖（git, nginx, sqlite3）
- 创建应用目录
- 复制项目文件
- 安装 Node.js 依赖
- 构建前端
- 配置 systemd 服务
- 配置 Nginx
- 配置防火墙
- 启动服务

### 3. 访问应用

部署完成后，您可以通过以下方式访问应用：

```bash
# 获取服务器IP地址
ip addr show | grep inet

# 在浏览器中访问
http://your-server-ip
```

## 详细部署步骤

### 步骤1: 系统准备

```bash
# 更新系统
sudo apt update
sudo apt upgrade -y

# 安装基础工具
sudo apt install -y git curl wget
```

### 步骤2: 安装 Node.js

部署脚本会自动安装 Node.js 18.x，但您也可以手动安装：

```bash
# 使用 NodeSource 仓库安装
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node -v
npm -v
```

### 步骤3: 安装 Nginx

```bash
# 安装 Nginx
sudo apt install -y nginx

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 步骤4: 运行部署脚本

```bash
# 确保在项目根目录
cd /path/to/your/project

# 运行部署脚本
sudo bash deploy.sh
```

### 步骤5: 验证部署

```bash
# 检查后端服务状态
sudo systemctl status online-chess-game-backend

# 检查 Nginx 状态
sudo systemctl status nginx

# 检查端口监听
sudo netstat -tuln | grep -E ':(3001|80)'

# 测试健康检查
curl http://localhost/health
```

## 配置说明

### 修改端口配置

编辑 `deploy.sh` 文件，修改以下变量：

```bash
# 后端端口
BACKEND_PORT=3001

# 前端端口（开发模式）
FRONTEND_PORT=5173
```

### 修改域名配置

如果您有域名，可以修改 `deploy.sh` 中的 `DOMAIN_NAME` 变量：

```bash
DOMAIN_NAME="yourdomain.com"
```

### 修改应用目录

默认应用目录为 `/opt/online-chess-game`，可以在 `deploy.sh` 中修改：

```bash
APP_DIR="/opt/online-chess-game"
```

### 修改服务用户

默认使用 `www-data` 用户运行服务，可以在 `deploy.sh` 中修改：

```bash
SERVICE_USER="www-data"
```

## 服务管理

### 后端服务管理

```bash
# 启动服务
sudo systemctl start online-chess-game-backend

# 停止服务
sudo systemctl stop online-chess-game-backend

# 重启服务
sudo systemctl restart online-chess-game-backend

# 查看服务状态
sudo systemctl status online-chess-game-backend

# 查看服务日志
sudo journalctl -u online-chess-game-backend -f

# 启用开机自启
sudo systemctl enable online-chess-game-backend

# 禁用开机自启
sudo systemctl disable online-chess-game-backend
```

### Nginx 服务管理

```bash
# 启动 Nginx
sudo systemctl start nginx

# 停止 Nginx
sudo systemctl stop nginx

# 重启 Nginx
sudo systemctl restart nginx

# 重新加载配置
sudo systemctl reload nginx

# 查看 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 日志
sudo journalctl -u nginx -f

# 测试 Nginx 配置
sudo nginx -t
```

## 日志查看

### 应用日志位置

所有日志文件位于 `/opt/online-chess-game/logs/` 目录：

```bash
# 后端日志
/opt/online-chess-game/logs/backend.log

# 后端错误日志
/opt/online-chess-game/logs/backend-error.log

# Nginx 访问日志
/opt/online-chess-game/logs/nginx-access.log

# Nginx 错误日志
/opt/online-chess-game/logs/nginx-error.log
```

### 实时查看日志

```bash
# 查看后端日志
sudo tail -f /opt/online-chess-game/logs/backend.log

# 查看后端错误日志
sudo tail -f /opt/online-chess-game/logs/backend-error.log

# 查看 Nginx 访问日志
sudo tail -f /opt/online-chess-game/logs/nginx-access.log

# 查看 Nginx 错误日志
sudo tail -f /opt/online-chess-game/logs/nginx-error.log

# 查看所有日志
sudo tail -f /opt/online-chess-game/logs/*.log
```

### 使用 journalctl 查看系统日志

```bash
# 查看后端服务日志
sudo journalctl -u online-chess-game-backend -f

# 查看最近100行日志
sudo journalctl -u online-chess-game-backend -n 100

# 查看今天的日志
sudo journalctl -u online-chess-game-backend --since today
```

## 更新应用

### 使用更新脚本

```bash
# 在项目根目录运行更新脚本
sudo bash update.sh
```

更新脚本会自动完成以下操作：
- 备份当前版本
- 复制更新文件
- 更新依赖
- 重新构建前端
- 重启服务
- 验证服务状态

### 手动更新

```bash
# 1. 停止服务
sudo systemctl stop online-chess-game-backend

# 2. 备份当前版本
sudo cp -r /opt/online-chess-game /opt/online-chess-game-backup

# 3. 复制更新文件
sudo cp -r src/ server.cjs package.json /opt/online-chess-game/

# 4. 更新依赖
cd /opt/online-chess-game
sudo -u www-data npm install

# 5. 重新构建前端
sudo -u www-data npm run build

# 6. 启动服务
sudo systemctl start online-chess-game-backend

# 7. 检查服务状态
sudo systemctl status online-chess-game-backend
```

## 卸载应用

### 使用卸载脚本

```bash
# 运行卸载脚本
sudo bash uninstall.sh
```

卸载脚本会自动完成以下操作：
- 停止所有服务
- 删除 systemd 服务
- 删除 Nginx 配置
- 删除应用文件
- 删除备份目录

### 手动卸载

```bash
# 1. 停止服务
sudo systemctl stop online-chess-game-backend
sudo systemctl disable online-chess-game-backend

# 2. 删除 systemd 服务
sudo rm /etc/systemd/system/online-chess-game-backend.service
sudo systemctl daemon-reload

# 3. 删除 Nginx 配置
sudo rm /etc/nginx/sites-available/online-chess-game
sudo rm /etc/nginx/sites-enabled/online-chess-game
sudo systemctl reload nginx

# 4. 删除应用目录
sudo rm -rf /opt/online-chess-game

# 5. 删除备份目录
sudo rm -rf /opt/online-chess-game-backup-*
```

## 故障排除

### 问题1: 端口被占用

```bash
# 检查端口占用
sudo netstat -tuln | grep :3001
sudo netstat -tuln | grep :80

# 查找占用端口的进程
sudo lsof -i :3001
sudo lsof -i :80

# 杀死占用端口的进程
sudo kill -9 <PID>
```

### 问题2: 服务启动失败

```bash
# 查看服务状态
sudo systemctl status online-chess-game-backend

# 查看详细日志
sudo journalctl -u online-chess-game-backend -n 50

# 检查配置文件
sudo cat /etc/systemd/system/online-chess-game-backend.service
```

### 问题3: 前端无法访问

```bash
# 检查 Nginx 配置
sudo nginx -t

# 检查 Nginx 状态
sudo systemctl status nginx

# 检查防火墙
sudo ufw status

# 允许 HTTP 流量
sudo ufw allow 80/tcp
```

### 问题4: WebSocket 连接失败

```bash
# 检查后端服务
sudo systemctl status online-chess-game-backend

# 检查 Nginx WebSocket 配置
sudo cat /etc/nginx/sites-available/online-chess-game | grep -A 10 "socket.io"

# 检查浏览器控制台错误
# 打开浏览器开发者工具 (F12) 查看 Console 和 Network 标签
```

### 问题5: 音频无法播放

```bash
# 检查音频文件是否存在
ls -la /opt/online-chess-game/public/sounds/

# 检查文件权限
sudo chmod 644 /opt/online-chess-game/public/sounds/*.mp3

# 检查 Nginx 配置中的音频路径
sudo cat /etc/nginx/sites-available/online-chess-game | grep sounds
```

## SSL证书配置

### 使用 Let's Encrypt 免费证书

```bash
# 1. 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. 获取 SSL 证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 3. 自动续期
sudo certbot renew --dry-run

# 4. 设置自动续期
sudo crontab -e
# 添加以下行：
# 0 0 * * * certbot renew --quiet
```

### 使用 SSL 配置文件

```bash
# 1. 复制 SSL 配置文件
sudo cp nginx-ssl.conf /etc/nginx/sites-available/online-chess-game-ssl

# 2. 修改配置文件中的域名
sudo nano /etc/nginx/sites-available/online-chess-game-ssl
# 将 yourdomain.com 替换为您的域名

# 3. 启用 SSL 配置
sudo ln -s /etc/nginx/sites-available/online-chess-game-ssl /etc/nginx/sites-enabled/

# 4. 测试配置
sudo nginx -t

# 5. 重启 Nginx
sudo systemctl restart nginx
```

### 强制 HTTPS 重定向

在 `nginx-ssl.conf` 中已经配置了 HTTP 到 HTTPS 的重定向：

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## 性能优化

### 启用 Gzip 压缩

Nginx 配置文件中已经启用了 Gzip 压缩，可以显著减少传输数据量。

### 配置缓存

静态资源（图片、音频）已经配置了30天的缓存：

```nginx
location /png/ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 优化 Node.js 性能

```bash
# 设置 Node.js 环境变量
export NODE_ENV=production

# 增加 Node.js 内存限制
node --max-old-space-size=4096 server.cjs
```

## 安全建议

1. **定期更新系统**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **配置防火墙**
   ```bash
   sudo ufw enable
   sudo ufw status
   ```

3. **使用强密码**
   - 为服务器设置强密码
   - 使用 SSH 密钥认证

4. **定期备份数据**
   ```bash
   # 备份应用目录
   sudo tar -czf backup-$(date +%Y%m%d).tar.gz /opt/online-chess-game
   ```

5. **监控日志**
   ```bash
   # 定期检查错误日志
   sudo tail -f /opt/online-chess-game/logs/backend-error.log
   ```

## 联系支持

如果您在部署过程中遇到问题，可以：

1. 查看日志文件获取详细错误信息
2. 检查服务状态和配置
3. 参考故障排除部分
4. 提交 Issue 到项目仓库

## 附录

### 目录结构

```
/opt/online-chess-game/
├── dist/                    # 前端构建输出
├── logs/                    # 日志文件
│   ├── backend.log
│   ├── backend-error.log
│   ├── nginx-access.log
│   └── nginx-error.log
├── node_modules/            # Node.js 依赖
├── public/                  # 静态资源
│   ├── png/
│   └── sounds/
├── src/                     # 前端源代码
├── package.json             # 项目配置
├── server.cjs              # 后端服务器
└── tsconfig.json           # TypeScript 配置
```

### 端口说明

- **3001**: 后端 API 和 WebSocket 服务
- **80**: HTTP (通过 Nginx)
- **443**: HTTPS (通过 Nginx，如果配置了 SSL)

### 服务说明

- **online-chess-game-backend**: 后端服务
- **nginx**: Web 服务器和反向代理

---

祝您部署顺利！
