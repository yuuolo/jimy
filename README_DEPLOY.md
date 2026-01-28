# 好嗨靓仔境翻牌游戏 - 快速部署指南

## 一键部署

```bash
# 1. 给脚本添加执行权限
chmod +x deploy.sh update.sh uninstall.sh

# 2. 运行部署脚本（需要root权限）
sudo bash deploy.sh
```

## 访问应用

部署完成后，在浏览器中访问：

```bash
http://your-server-ip
```

## 常用命令

### 服务管理

```bash
# 查看后端服务状态
sudo systemctl status online-chess-game-backend

# 重启后端服务
sudo systemctl restart online-chess-game-backend

# 查看Nginx状态
sudo systemctl status nginx

# 重启Nginx
sudo systemctl restart nginx
```

### 日志查看

```bash
# 查看后端日志
sudo tail -f /opt/online-chess-game/logs/backend.log

# 查看Nginx访问日志
sudo tail -f /opt/online-chess-game/logs/nginx-access.log

# 查看所有日志
sudo tail -f /opt/online-chess-game/logs/*.log
```

### 更新应用

```bash
# 更新到最新版本
sudo bash update.sh
```

### 卸载应用

```bash
# 完全卸载应用
sudo bash uninstall.sh
```

## 配置说明

### 修改端口

编辑 `deploy.sh` 文件：

```bash
BACKEND_PORT=3001    # 后端端口
FRONTEND_PORT=5173   # 前端端口（开发模式）
```

### 修改域名

编辑 `deploy.sh` 文件：

```bash
DOMAIN_NAME="yourdomain.com"
```

### 修改应用目录

编辑 `deploy.sh` 文件：

```bash
APP_DIR="/opt/online-chess-game"
```

## SSL证书配置

```bash
# 1. 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. 获取SSL证书
sudo certbot --nginx -d yourdomain.com

# 3. 自动续期
sudo certbot renew --dry-run
```

## 故障排除

### 检查服务状态

```bash
sudo systemctl status online-chess-game-backend
sudo systemctl status nginx
```

### 检查端口占用

```bash
sudo netstat -tuln | grep -E ':(3001|80)'
```

### 查看详细日志

```bash
sudo journalctl -u online-chess-game-backend -n 50
```

## 系统要求

- Ubuntu 18.04 或更高版本
- 至少 1GB RAM
- 至少 2GB 可用磁盘空间
- 互联网连接

## 详细文档

详细的部署指南请参考 [DEPLOYMENT.md](DEPLOYMENT.md)

## 文件说明

- `deploy.sh` - 一键部署脚本
- `update.sh` - 更新脚本
- `uninstall.sh` - 卸载脚本
- `backend.service` - systemd服务配置
- `nginx.conf` - Nginx配置（HTTP）
- `nginx-ssl.conf` - Nginx配置（HTTPS）
- `DEPLOYMENT.md` - 详细部署文档

## 技术支持

如遇问题，请查看：
1. 日志文件：`/opt/online-chess-game/logs/`
2. 服务状态：`systemctl status`
3. 详细文档：`DEPLOYMENT.md`
