#!/bin/bash
set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_NAME="NAVALIVAY"
PROJECT_DIR="/var/www/${PROJECT_NAME}"
SERVER_DIR="${PROJECT_DIR}/server"

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}  Деплой ${PROJECT_NAME}${NC}"
echo -e "${GREEN}=======================================${NC}"

# Проверка что скрипт запущен не от root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Не запускайте этот скрипт от root!${NC}"
    exit 1
fi

# Проверка существования проекта
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Директория ${PROJECT_DIR} не найдена!${NC}"
    echo -e "${YELLOW}Сначала разместите проект на сервере${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

# 1. Обновление кода
echo -e "\n${YELLOW}[1/6] Обновление кода...${NC}"
if [ -d ".git" ]; then
    git pull
    echo -e "${GREEN}✓ Код обновлен${NC}"
else
    echo -e "${YELLOW}! Git репозиторий не найден, пропускаем git pull${NC}"
fi

# 2. Установка зависимостей
echo -e "\n${YELLOW}[2/6] Установка зависимостей сервера...${NC}"
cd "$SERVER_DIR"
npm ci --production
echo -e "${GREEN}✓ Зависимости установлены${NC}"

# 3. Проверка .env файла
echo -e "\n${YELLOW}[3/6] Проверка конфигурации...${NC}"
if [ ! -f "${SERVER_DIR}/.env" ]; then
    echo -e "${YELLOW}! Файл .env не найден, продолжаем с настройками по умолчанию${NC}"
    echo -e "${YELLOW}  При необходимости добавьте ${SERVER_DIR}/.env с секретами и override-переменными${NC}"
else
    echo -e "${GREEN}✓ Файл .env найден${NC}"
fi

# 4. Проверка директорий
echo -e "\n${YELLOW}[4/6] Проверка директорий данных...${NC}"
mkdir -p "${SERVER_DIR}/data"
mkdir -p "${PROJECT_DIR}/uploads"
echo -e "${GREEN}✓ Директории проверены${NC}"

# 5. Перезапуск сервисов
echo -e "\n${YELLOW}[5/6] Перезапуск сервисов...${NC}"

# Если на сервере PM2 — рестартуем через ecosystem (production setup),
# иначе фоллбэкаемся на systemd (dev/staging).
if command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q 'navalivay-api'; then
    echo -e "${YELLOW}  Используем PM2${NC}"
    pm2 startOrReload "${SERVER_DIR}/ecosystem.config.cjs" --env production
    pm2 save
    echo -e "${GREEN}✓ PM2 процессы перезапущены${NC}"
else
    sudo systemctl restart navalivay-server
    if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'navalivay-bot.service'; then
        sudo systemctl restart navalivay-bot
    else
        echo -e "${YELLOW}! navalivay-bot.service не установлен, пропускаем${NC}"
    fi
    echo -e "${GREEN}✓ Сервисы перезапущены через systemd${NC}"
fi

# 6. Проверка статуса
echo -e "\n${YELLOW}[6/6] Проверка статуса сервисов...${NC}"
sleep 2

if systemctl is-active --quiet navalivay-server; then
    echo -e "${GREEN}✓ navalivay-server: активен${NC}"
else
    echo -e "${RED}✗ navalivay-server: не активен${NC}"
    echo -e "${YELLOW}Логи:${NC}"
    sudo journalctl -u navalivay-server -n 20 --no-pager
    exit 1
fi

if systemctl is-active --quiet navalivay-bot; then
    echo -e "${GREEN}✓ navalivay-bot: активен${NC}"
else
    echo -e "${YELLOW}⚠ navalivay-bot: не активен${NC}"
fi

# Health check
echo -e "\n${YELLOW}Проверка health endpoint...${NC}"
sleep 1
if curl -sf http://127.0.0.1:8082/api/health > /dev/null; then
    echo -e "${GREEN}✓ API отвечает${NC}"
else
    echo -e "${RED}✗ API не отвечает${NC}"
    exit 1
fi

# Userbot smoke-test: ждём connected:true до 30с, иначе жалуемся, но
# деплой всё равно считаем успешным — auto-notify фоллбэкнется на Business mode.
if pm2 jlist 2>/dev/null | grep -q 'navalivay-userbot'; then
    echo -e "\n${YELLOW}Проверка userbot /health...${NC}"
    USERBOT_OK=false
    for i in $(seq 1 15); do
        if response=$(curl -fsS -m 2 http://127.0.0.1:8083/health 2>/dev/null) && \
           echo "$response" | grep -q '"connected":true'; then
            echo -e "${GREEN}✓ Userbot connected (попытка ${i})${NC}"
            USERBOT_OK=true
            break
        fi
        sleep 2
    done
    if ! $USERBOT_OK; then
        echo -e "${YELLOW}⚠ Userbot не вышел в connected:true за 30с${NC}"
        echo -e "${YELLOW}  auto-notify будет работать через Business mode (fallback)${NC}"
        echo -e "${YELLOW}  логи: pm2 logs navalivay-userbot --lines 50${NC}"
    fi
fi

echo -e "\n${GREEN}=======================================${NC}"
echo -e "${GREEN}  Деплой завершен успешно! 🚀${NC}"
echo -e "${GREEN}=======================================${NC}"
echo -e "\n${YELLOW}Полезные команды:${NC}"
echo -e "  Логи сервера: ${YELLOW}sudo journalctl -u navalivay-server -f${NC}"
echo -e "  Логи бота:    ${YELLOW}sudo journalctl -u navalivay-bot -f${NC}"
echo -e "  Статус:       ${YELLOW}sudo systemctl status navalivay-server${NC}"
echo -e "  Рестарт:      ${YELLOW}sudo systemctl restart navalivay-server${NC}"
