// Агрессивная очистка всех кэшей
(function() {
  console.log('[CACHE CLEAR] Starting aggressive cache clearing...');
  
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
  
  // 3. Очистка localStorage
  try {
    localStorage.clear();
    console.log('[CACHE CLEAR] localStorage cleared');
  } catch(e) {}
  
  // 4. Очистка sessionStorage
  try {
    sessionStorage.clear();
    console.log('[CACHE CLEAR] sessionStorage cleared');
  } catch(e) {}
  
  // 5. Установка метки что очистка выполнена
  sessionStorage.setItem('cache_cleared', Date.now());
  
  console.log('[CACHE CLEAR] All caches cleared successfully');
})();
