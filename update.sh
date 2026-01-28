#!/bin/bash

# 好嗨靓仔境翻牌游戏 - 更新部署脚本
# 用于更新已部署的应用

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
BACKUP_DIR="/opt/${PROJECT_NAME}_backup_$(date +%Y%m%d_%H%M%S)"

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
        log_info "使用命令: sudo bash update.sh"
        exit 1
    fi
}

# 检查应用是否存在
check_app_exists() {
    if [ ! -d "$APP_DIR" ]; then
        log_error "应用目录不存在: $APP_DIR"
        log_info "请先运行 deploy.sh 进行初始部署"
        exit 1
    fi
}

# 备份当前版本
backup_current_version() {
    log_step "备份当前版本..."
    
    cp -r "$APP_DIR" "$BACKUP_DIR"
    
    log_info "备份完成: $BACKUP_DIR"
}

# 复制更新文件
copy_updated_files() {
    log_step "复制更新文件..."
    
    # 获取当前脚本所在目录
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    
    # 复制所有文件（排除node_modules和dist）
    rsync -av --exclude='node_modules' --exclude='dist' --exclude='logs' \
          "$SCRIPT_DIR/" "$APP_DIR/"
    
    log_info "文件复制完成"
}

# 更新依赖
update_dependencies() {
    log_step "更新依赖..."
    
    cd "$APP_DIR"
    
    # 更新依赖
    sudo -u $SERVICE_USER npm install
    
    log_info "依赖更新完成"
}

# 重新构建前端
rebuild_frontend() {
    log_step "重新构建前端..."
    
    cd "$APP_DIR"
    
    # 构建前端
    sudo -u $SERVICE_USER npm run build
    
    if [ ! -d "$APP_DIR/dist" ]; then
        log_error "前端构建失败"
        log_info "正在恢复备份..."
        restore_backup
        exit 1
    fi
    
    log_info "前端构建完成"
}

# 重启服务
restart_services() {
    log_step "重启服务..."
    
    # 重启后端服务
    systemctl restart ${PROJECT_NAME}-backend
    
    log_info "后端服务已重启"
    
    # 重启Nginx
    systemctl reload nginx
    
    log_info "Nginx已重新加载"
    
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
        log_info "正在恢复备份..."
        restore_backup
        exit 1
    fi
    
    # 检查Nginx
    if systemctl is-active --quiet nginx; then
        log_info "Nginx运行正常"
    else
        log_error "Nginx启动失败"
        log_info "正在恢复备份..."
        restore_backup
        exit 1
    fi
}

# 恢复备份
restore_backup() {
    log_warn "正在恢复备份..."
    
    systemctl stop ${PROJECT_NAME}-backend
    
    rm -rf "$APP_DIR"
    mv "$BACKUP_DIR" "$APP_DIR"
    
    systemctl start ${PROJECT_NAME}-backend
    
    log_info "备份已恢复"
}

# 清理旧备份
cleanup_old_backups() {
    log_step "清理旧备份..."
    
    # 保留最近5个备份
    ls -td /opt/${PROJECT_NAME}_backup_* | tail -n +6 | xargs rm -rf
    
    log_info "旧备份已清理"
}

# 显示更新信息
show_update_info() {
    log_step "更新完成！"
    echo ""
    echo "=========================================="
    echo "  好嗨靓仔境翻牌游戏 - 更新信息"
    echo "=========================================="
    echo ""
    echo "应用目录: $APP_DIR"
    echo "备份目录: $BACKUP_DIR"
    echo ""
    echo "服务状态:"
    systemctl status ${PROJECT_NAME}-backend --no-pager
    echo ""
    echo "=========================================="
    echo ""
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  好嗨靓仔境翻牌游戏 - 更新部署脚本"
    echo "=========================================="
    echo ""
    
    # 检查root权限
    check_root
    
    # 检查应用是否存在
    check_app_exists
    
    # 备份当前版本
    backup_current_version
    
    # 复制更新文件
    copy_updated_files
    
    # 更新依赖
    update_dependencies
    
    # 重新构建前端
    rebuild_frontend
    
    # 重启服务
    restart_services
    
    # 检查服务
    check_services
    
    # 清理旧备份
    cleanup_old_backups
    
    # 显示更新信息
    show_update_info
    
    log_info "更新成功完成！"
}

# 运行主函数
main
