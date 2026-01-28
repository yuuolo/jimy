# 好嗨靓仔境翻牌游戏 - Docker部署指南

本文档提供使用Docker部署"好嗨靓仔境"翻牌游戏的详细指南。

## 前置要求

- Docker 20.10 或更高版本
- Docker Compose 1.29 或更高版本
- 至少 1GB 可用内存
- 至少 2GB 可用磁盘空间

## 快速开始

### 1. 一键部署

```bash
# 给脚本添加执行权限
chmod +x docker-deploy.sh

# 运行Docker部署脚本
./docker-deploy.sh
```

### 2. 手动部署

```bash
# 构建镜像
docker-compose build

# 启动容器
docker-compose up -d

# 查看容器状态
docker-compose ps
```

### 3. 访问应用

部署完成后，您可以通过以下方式访问应用：

```bash
# 应用直接访问
http://localhost:3001

# 通过Nginx访问
http://localhost
```

## Docker命令参考

### 容器管理

```bash
# 启动容器
docker-compose up -d

# 停止容器
docker-compose down

# 重启容器
docker-compose restart

# 查看容器状态
docker-compose ps

# 查看容器日志
docker-compose logs -f

# 查看应用日志
docker-compose logs -f app

# 查看Nginx日志
docker-compose logs -f nginx
```

### 镜像管理

```bash
# 构建镜像
docker-compose build

# 重新构建镜像
docker-compose build --no-cache

# 查看镜像
docker images | grep online-chess-game

# 删除镜像
docker rmi online-chess-game-app
```

### 网络管理

```bash
# 查看网络
docker network ls | grep chess-game

# 查看网络详情
docker network inspect online-chess-game_chess-game-network
```

## 配置说明

### 端口配置

编辑 `docker-compose.yml` 文件修改端口映射：

```yaml
ports:
  - "3001:3001"  # 应用端口
  - "80:80"      # HTTP端口
  - "443:443"    # HTTPS端口
```

### 环境变量

编辑 `docker-compose.yml` 文件修改环境变量：

```yaml
environment:
  - NODE_ENV=production
  - PORT=3001
```

### 数据卷

编辑 `docker-compose.yml` 文件修改数据卷映射：

```yaml
volumes:
  - ./logs:/app/logs              # 日志目录
  - ./game.db:/app/game.db        # 数据库文件
  - ./dist:/usr/share/nginx/html  # 前端构建文件
  - ./public:/usr/share/nginx/public  # 静态资源
```

## 更新应用

### 使用Docker Compose更新

```bash
# 1. 停止容器
docker-compose down

# 2. 重新构建镜像
docker-compose build --no-cache

# 3. 启动容器
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```

### 滚动更新

```bash
# 重新构建并启动
docker-compose up -d --build

# 查看更新状态
docker-compose ps
```

## 备份与恢复

### 备份数据

```bash
# 备份数据库
docker cp online-chess-game:/app/game.db ./backup/game.db

# 备份日志
docker cp online-chess-game:/app/logs ./backup/logs

# 创建备份压缩包
tar -czf backup-$(date +%Y%m%d).tar.gz backup/
```

### 恢复数据

```bash
# 恢复数据库
docker cp ./backup/game.db online-chess-game:/app/game.db

# 重启容器
docker-compose restart app
```

## 监控与日志

### 查看实时日志

```bash
# 查看所有容器日志
docker-compose logs -f

# 查看应用日志
docker-compose logs -f app

# 查看Nginx日志
docker-compose logs -f nginx

# 查看最近100行日志
docker-compose logs --tail=100 app
```

### 查看容器资源使用

```bash
# 查看容器资源使用情况
docker stats

# 查看特定容器
docker stats online-chess-game online-chess-game-nginx
```

### 查看容器详细信息

```bash
# 查看容器详细信息
docker inspect online-chess-game

# 查看容器进程
docker top online-chess-game

# 查看容器端口映射
docker port online-chess-game
```

## 故障排除

### 问题1: 容器无法启动

```bash
# 查看容器日志
docker-compose logs app

# 检查容器状态
docker-compose ps

# 查看容器详细信息
docker inspect online-chess-game
```

### 问题2: 端口冲突

```bash
# 检查端口占用
sudo netstat -tuln | grep -E ':(3001|80|443)'

# 修改docker-compose.yml中的端口映射
ports:
  - "3002:3001"  # 使用不同的主机端口
```

### 问题3: 权限问题

```bash
# 修复文件权限
sudo chown -R $USER:$USER ./logs
sudo chown -R $USER:$USER ./game.db

# 重新启动容器
docker-compose restart
```

### 问题4: 网络连接问题

```bash
# 检查网络连接
docker network inspect online-chess-game_chess-game-network

# 重建网络
docker-compose down
docker-compose up -d
```

## 性能优化

### 资源限制

编辑 `docker-compose.yml` 添加资源限制：

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 日志轮转

编辑 `docker-compose.yml` 配置日志轮转：

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 健康检查

健康检查已在 `docker-compose.yml` 中配置：

```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## 安全建议

1. **使用非root用户运行容器**

编辑 `Dockerfile`：

```dockerfile
FROM node:18-alpine

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置工作目录
WORKDIR /app

# 复制文件并设置权限
COPY --chown=nodejs:nodejs . .

# 切换到非root用户
USER nodejs

CMD ["node", "server.cjs"]
```

2. **使用私有镜像仓库**

```bash
# 登录到私有镜像仓库
docker login your-registry.com

# 推送镜像
docker tag online-chess-game-app your-registry.com/online-chess-game-app:latest
docker push your-registry.com/online-chess-game-app:latest
```

3. **定期更新镜像**

```bash
# 更新基础镜像
docker pull node:18-alpine

# 重新构建应用镜像
docker-compose build --no-cache
```

4. **使用网络隔离**

```yaml
networks:
  chess-game-network:
    driver: bridge
    internal: false  # 设置为true可以完全隔离网络
```

## 生产环境部署

### 使用环境变量文件

创建 `.env` 文件：

```env
NODE_ENV=production
PORT=3001
```

修改 `docker-compose.yml`：

```yaml
services:
  app:
    env_file:
      - .env
```

### 使用多阶段构建

优化 `Dockerfile` 减小镜像大小：

```dockerfile
# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY server.cjs .

EXPOSE 3001
CMD ["node", "server.cjs"]
```

### 使用Docker Swarm

```bash
# 初始化Swarm
docker swarm init

# 部署栈
docker stack deploy -c docker-compose.yml chess-game

# 查看服务
docker service ls

# 扩展服务
docker service scale chess-game_app=3
```

## 清理

### 清理未使用的资源

```bash
# 清理停止的容器
docker container prune

# 清理未使用的镜像
docker image prune

# 清理未使用的卷
docker volume prune

# 清理未使用的网络
docker network prune

# 清理所有未使用的资源
docker system prune -a
```

### 完全清理

```bash
# 停止并删除所有容器
docker-compose down

# 删除所有相关镜像
docker rmi online-chess-game-app

# 删除所有相关卷
docker volume rm online-chess-game_logs online-chess-game_db

# 删除所有相关网络
docker network rm online-chess-game_chess-game-network
```

## 附录

### Docker Compose命令速查

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 构建镜像
docker-compose build

# 重新构建并启动
docker-compose up -d --build

# 查看资源使用
docker-compose top
```

### 目录结构

```
.
├── Dockerfile              # Docker镜像构建文件
├── docker-compose.yml      # Docker Compose配置
├── docker-deploy.sh       # Docker部署脚本
├── logs/                  # 日志目录
├── dist/                  # 前端构建输出
├── public/                # 静态资源
└── game.db               # 数据库文件
```

## 技术支持

如遇问题，请查看：
1. 容器日志：`docker-compose logs -f`
2. 容器状态：`docker-compose ps`
3. 详细文档：`DEPLOYMENT.md`

---

祝您部署顺利！
