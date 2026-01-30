#!/bin/bash

# 壹城翻牌游戏 - 卸载脚本
# 用于完全卸载已部署的应用

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
        log_info "使用命令: sudo bash uninstall.sh"
        exit 1
    fi
}

# 检查应用是否存在
check_app_exists() {
    if [ ! -d "$APP_DIR" ]; then
        log_error "应用目录不存在: $APP_DIR"
        log_info "应用可能已被卸载或未安装"
        exit 1
    fi
}

# 停止服务
stop_services() {
    log_step "停止服务..."
    
    # 停止后端服务
    if systemctl is-active --quiet ${PROJECT_NAME}-backend; then
        systemctl stop ${PROJECT_NAME}-backend
        log_info "后端服务已停止"
    fi
    
    # 禁用后端服务
    if systemctl is-enabled --quiet ${PROJECT_NAME}-backend; then
        systemctl disable ${PROJECT_NAME}-backend
        log_info "后端服务已禁用"
    fi
}

# 删除systemd服务
remove_systemd_services() {
    log_step "删除systemd服务..."
    
    # 删除后端服务文件
    if [ -f "/etc/systemd/system/${PROJECT_NAME}-backend.service" ]; then
        rm -f "/etc/systemd/system/${PROJECT_NAME}-backend.service"
        log_info "后端服务文件已删除"
    fi
    
    # 删除前端服务文件（如果存在）
    if [ -f "/etc/systemd/system/${PROJECT_NAME}-frontend.service" ]; then
        rm -f "/etc/systemd/system/${PROJECT_NAME}-frontend.service"
        log_info "前端服务文件已删除"
    fi
    
    # 重载systemd
    systemctl daemon-reload
    systemctl reset-failed
    
    log_info "systemd服务已删除"
}

# 删除Nginx配置
remove_nginx_config() {
    log_step "删除Nginx配置..."
    
    # 删除站点配置
    if [ -f "/etc/nginx/sites-available/${PROJECT_NAME}" ]; then
        rm -f "/etc/nginx/sites-available/${PROJECT_NAME}"
        log_info "Nginx站点配置已删除"
    fi
    
    # 删除符号链接
    if [ -L "/etc/nginx/sites-enabled/${PROJECT_NAME}" ]; then
        rm -f "/etc/nginx/sites-enabled/${PROJECT_NAME}"
        log_info "Nginx符号链接已删除"
    fi
    
    # 测试Nginx配置
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        log_info "Nginx已重新加载"
    else
        log_warn "Nginx配置测试失败，请手动检查"
    fi
    
    log_info "Nginx配置已删除"
}

# 删除应用文件
remove_app_files() {
    log_step "删除应用文件..."
    
    # 删除应用目录
    if [ -d "$APP_DIR" ]; then
        rm -rf "$APP_DIR"
        log_info "应用目录已删除"
    fi
    
    # 删除备份目录
    ls -d /opt/${PROJECT_NAME}_backup_* 2>/dev/null | while read backup_dir; do
        rm -rf "$backup_dir"
        log_info "备份目录已删除: $backup_dir"
    done
}

# 显示卸载信息
show_uninstall_info() {
    log_step "卸载完成！"
    echo ""
    echo "=========================================="
    echo "  壹城翻牌游戏 - 卸载信息"
    echo "=========================================="
    echo ""
    echo "已删除的内容:"
    echo "  - 应用目录: $APP_DIR"
    echo "  - systemd服务: ${PROJECT_NAME}-backend"
    echo "  - Nginx配置: ${PROJECT_NAME}"
    echo "  - 备份目录: /opt/${PROJECT_NAME}_backup_*"
    echo ""
    echo "注意: 以下内容未删除，需要手动清理:"
    echo "  - Node.js和npm"
    echo "  - Nginx服务器"
    echo "  - 系统依赖包"
    echo ""
    echo "如需完全清理，请手动执行:"
    echo "  sudo apt remove nodejs npm nginx"
    echo "  sudo apt autoremove"
    echo ""
    echo "=========================================="
    echo ""
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  壹城翻牌游戏 - 卸载脚本"
    echo "=========================================="
    echo ""
    
    # 确认卸载
    log_warn "警告: 此操作将完全删除应用及其所有数据！"
    read -p "确定要继续吗? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "卸载已取消"
        exit 0
    fi
    
    echo ""
    
    # 检查root权限
    check_root
    
    # 检查应用是否存在
    check_app_exists
    
    # 停止服务
    stop_services
    
    # 删除systemd服务
    remove_systemd_services
    
    # 删除Nginx配置
    remove_nginx_config
    
    # 删除应用文件
    remove_app_files
    
    # 显示卸载信息
    show_uninstall_info
    
    log_info "卸载成功完成！"
}

# 运行主函数
main
