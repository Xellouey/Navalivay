<template>
  <div class="min-h-screen bg-brand-primary tg-safe-area">
    <header class="sticky top-0 z-50 bg-brand-primary/95 backdrop-blur-telegram border-b border-brand-dark/10">
      <div class="flex-between px-4 py-3">
        <h1 class="text-xl font-bold text-brand-dark tracking-tight">TOLSOVKA</h1>
        <div class="flex items-center space-x-2">
          <router-link to="/admin" class="px-3 py-2 rounded-lg border bg-white text-brand-dark hover:border-brand-dark transition-colors" title="Админ-панель">
            Админка
          </router-link>
        </div>
      </div>
    </header>

    <main class="container-safe space-y-6 pb-20 px-4">
      <section class="card-base p-6">
        <h2 class="text-xl font-bold text-brand-dark mb-2">Новый функционал админ-панели</h2>
        <p class="text-gray-600 mb-4">Свежие изменения, оптимизированные для мобильного использования и удобства работы.</p>
        <ul class="list-disc pl-5 space-y-2 text-brand-dark">
          <li>Мобильная нижняя навигация в админке (вариант A): вкладки фиксированы внизу экрана.</li>
          <li>Сортировка стрелками вместо drag & drop:
            <ul class="list-disc pl-5 mt-1 space-y-1">
              <li>Баннеры: перемещение вверх/вниз меняет приоритет показа.</li>
              <li>Категории: приоритет в меню меняется стрелками.</li>
              <li>Фото товаров: порядок изображений задаётся стрелками.</li>
            </ul>
          </li>
          <li>Тёмная тема удалена — единый светлый стиль интерфейса.</li>
          <li>Добавлены юнит-тесты (Vitest) и утилиты для безопасной перестановки.</li>
        </ul>

        <div class="mt-6 flex gap-3">
          <router-link to="/admin" class="btn-primary">Перейти в админку</router-link>
          <router-link to="/test-admin" class="btn-secondary">Открыть тест-админку</router-link>
        </div>
      </section>

      <section class="card-base p-6">
        <h3 class="text-lg font-semibold text-brand-dark mb-2">Как посмотреть изменения</h3>
        <ol class="list-decimal pl-5 space-y-2 text-brand-dark">
          <li>Откройте «Админка» и переключайтесь по вкладкам в нижней навигации (мобайл).</li>
          <li>Во вкладках «Баннеры» и «Категории» используйте стрелки вверх/вниз для изменения порядка.</li>
          <li>В форме товара меняйте порядок фото стрелками.</li>
        </ol>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
// Страница-витрина. Старые данные (баннеры/категории/товары на главной) скрыты.
</script>
