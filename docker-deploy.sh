#!/bin/bash

# 好嗨靓仔境翻牌游戏 - Docker部署脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 检查Docker是否安装
check_docker() {
    log_step "检查Docker..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装"
        log_info "请先安装Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装"
        log_info "请先安装Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    log_info "Docker版本: $(docker --version)"
    log_info "Docker Compose版本: $(docker-compose --version)"
}

# 构建镜像
build_image() {
    log_step "构建Docker镜像..."
    
    docker-compose build
    
    log_info "镜像构建完成"
}

# 启动容器
start_containers() {
    log_step "启动容器..."
    
    docker-compose up -d
    
    log_info "容器已启动"
}

# 检查容器状态
check_containers() {
    log_step "检查容器状态..."
    
    docker-compose ps
    
    # 检查应用容器
    if docker-compose ps | grep -q "online-chess-game.*Up"; then
        log_info "应用容器运行正常"
    else
        log_error "应用容器启动失败"
        docker-compose logs app
        exit 1
    fi
    
    # 检查Nginx容器
    if docker-compose ps | grep -q "online-chess-game-nginx.*Up"; then
        log_info "Nginx容器运行正常"
    else
        log_warn "Nginx容器启动失败（可选）"
    fi
}

# 显示部署信息
show_deployment_info() {
    log_step "部署完成！"
    echo ""
    echo "=========================================="
    echo "  好嗨靓仔境翻牌游戏 - Docker部署信息"
    echo "=========================================="
    echo ""
    echo "容器管理命令:"
    echo "  查看容器状态: docker-compose ps"
    echo "  查看容器日志: docker-compose logs -f"
    echo "  停止容器: docker-compose down"
    echo "  重启容器: docker-compose restart"
    echo "  重新构建: docker-compose up -d --build"
    echo ""
    echo "访问地址:"
    echo "  应用: http://localhost:3001"
    echo "  Nginx: http://localhost"
    echo ""
    echo "日志查看:"
    echo "  应用日志: docker-compose logs -f app"
    echo "  Nginx日志: docker-compose logs -f nginx"
    echo ""
    echo "=========================================="
    echo ""
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  好嗨靓仔境翻牌游戏 - Docker部署"
    echo "=========================================="
    echo ""
    
    # 检查Docker
    check_docker
    
    # 构建镜像
    build_image
    
    # 启动容器
    start_containers
    
    # 检查容器
    check_containers
    
    # 显示部署信息
    show_deployment_info
    
    log_info "部署成功完成！"
}

# 运行主函数
main
