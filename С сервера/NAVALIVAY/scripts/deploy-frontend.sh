#!/bin/bash
set -e

echo "🚀 Starting frontend deployment..."

FRONTEND_DIR="/var/www/NAVALIVAY/frontend"
cd "$FRONTEND_DIR"

# 1. Сборка фронтенда
echo "📦 Building frontend..."
NODE_OPTIONS="--max-old-space-size=512" npm run build-only

# 2. Обновление версии Service Worker кеша
echo "🔄 Updating Service Worker cache version..."
NEW_VERSION="navalivay-$(date +%Y%m%d-%H%M%S)"
sed -i "s/const CACHE_NAME = '[^']*'/const CACHE_NAME = '$NEW_VERSION'/" dist/sw.js
echo "✅ Cache version: $NEW_VERSION"

# 3. Перезагрузка Nginx
echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo "✅ Frontend deployment completed!"
echo "🌐 Site: https://navalivay.store"
