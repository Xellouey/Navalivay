#!/bin/bash
# Скрипт для автоматического обновления версии кеша Service Worker

FRONTEND_DIR="/var/www/NAVALIVAY/frontend"
SW_FILE="$FRONTEND_DIR/dist/sw.js"

# Генерируем новую версию на основе текущего времени
NEW_VERSION="navalivay-$(date +%Y%m%d-%H%M%S)"

# Обновляем версию в Service Worker
if [ -f "$SW_FILE" ]; then
    sed -i "s/const CACHE_NAME = '[^']*'/const CACHE_NAME = '$NEW_VERSION'/" "$SW_FILE"
    echo "✅ Service Worker cache version updated to: $NEW_VERSION"
else
    echo "❌ Service Worker file not found at $SW_FILE"
    exit 1
fi
