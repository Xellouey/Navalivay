// Очистка кэшей - агрессивная для админки, щадящая для пользователей
(function() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  
  // Для админки - всегда очищаем всё
  // Для пользователей - проверяем была ли уже очистка в этой сессии
  if (!isAdmin && sessionStorage.getItem('cache_cleared')) {
    return; // Уже очищено в этой сессии (для обычных пользователей)
  }
  
  console.log('[CACHE CLEAR] Starting cache clearing...', isAdmin ? '(admin mode)' : '(user mode)');
  
  // 1. Очистка Service Workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister();
        console.log('[CACHE CLEAR] Service Worker unregistered');
      }
    });
  }
  
  // 2. Очистка всех Cache API кэшей
  if ('caches' in window) {
    caches.keys().then(function(names) {
      for(let name of names) {
        caches.delete(name);
        console.log('[CACHE CLEAR] Cache deleted:', name);
      }
    });
  }
  
  // 3. Очистка localStorage - ТОЛЬКО для админки
  if (isAdmin) {
    try {
      localStorage.clear();
      console.log('[CACHE CLEAR] localStorage cleared (admin)');
    } catch(e) {}
  }
  
  // 4. Очистка sessionStorage - ТОЛЬКО для админки
  if (isAdmin) {
    try {
      sessionStorage.clear();
      console.log('[CACHE CLEAR] sessionStorage cleared (admin)');
    } catch(e) {}
  }
  
  // 5. Установка метки что очистка выполнена
  sessionStorage.setItem('cache_cleared', Date.now());
  
  console.log('[CACHE CLEAR] All caches cleared successfully');
})();
