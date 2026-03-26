<template>
  <div class="placeholder-page">
    <div class="placeholder-content">
      <h2 class="placeholder-title">Пока не готово</h2>
      <p class="placeholder-text">Здесь пока ничего нету, но мы добавим сюда полезный функционал</p>
    </div>
  </div>
</template>

<style scoped>
.placeholder-page {
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  padding-bottom: 16px;
}

.placeholder-content {
  text-align: center;
  max-width: 300px;
}

.placeholder-title {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #191919;
  margin: 0 0 12px;
}

.placeholder-text {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 16px;
  line-height: 22px;
  color: #aab2bd;
  margin: 0;
}
</style>
