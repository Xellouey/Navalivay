/**
 * Dev-only утилита для тестирования клиентского интерфейса в обычном браузере
 * без реального Telegram Mini App.
 *
 * Активируется query-параметром `?telegram_id=...` (или короткое `?as=...`).
 * Дополнительно можно передать `?username=...&first_name=...`.
 *
 * После применения параметры удаляются из URL, identity сохраняется в sessionStorage,
 * и `window.Telegram.WebApp` инжектится с полем `initDataUnsafe.user`.
 *
 * Гард `import.meta.env.DEV` гарантирует tree-shaking из прод-сборки:
 * Vite на этапе сборки заменит выражение на `false`, и весь код функции
 * будет удалён минификатором.
 */

const DEV_MOCK_KEY = 'navalivay_dev_telegram_mock'

interface DevMockIdentity {
  id: string
  username: string
  first_name: string
}

function readStoredIdentity(): DevMockIdentity | null {
  try {
    const raw = sessionStorage.getItem(DEV_MOCK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DevMockIdentity>
    if (!parsed?.id) return null
    return {
      id: String(parsed.id),
      username: String(parsed.username || ''),
      first_name: String(parsed.first_name || `Dev User ${parsed.id}`),
    }
  } catch {
    return null
  }
}

function persistIdentity(identity: DevMockIdentity): void {
  try {
    sessionStorage.setItem(DEV_MOCK_KEY, JSON.stringify(identity))
  } catch {
    /* noop: приватный режим / квота */
  }
}

function injectMockWebApp(identity: DevMockIdentity): boolean {
  const w = window as unknown as { Telegram?: { WebApp?: unknown } }
  const existing = w.Telegram?.WebApp as { initData?: string } | undefined
  if (existing && String(existing.initData || '').trim()) {
    // Реальный Mini App уже подмонтирован — не перезаписываем.
    return false
  }

  const noop = () => {}

  w.Telegram = {
    WebApp: {
      initData: '',
      initDataUnsafe: {
        user: {
          id: Number(identity.id),
          is_bot: false,
          first_name: identity.first_name,
          username: identity.username || undefined,
          language_code: 'ru',
        },
        auth_date: Math.floor(Date.now() / 1000),
        hash: '',
      },
      colorScheme: 'light',
      themeParams: {},
      headerColor: '#ffffff',
      backgroundColor: '#ffffff',
      isExpanded: true,
      viewportHeight: window.innerHeight,
      viewportStableHeight: window.innerHeight,
      isFullscreen: false,
      isActive: true,
      ready: noop,
      expand: noop,
      close: noop,
      setHeaderColor: noop,
      setBottomBarColor: noop,
      setBackgroundColor: noop,
      onEvent: noop,
      offEvent: noop,
      sendData: noop,
      openLink: (url: string) => window.open(url, '_blank', 'noopener,noreferrer'),
      openTelegramLink: (url: string) => window.open(url, '_blank', 'noopener,noreferrer'),
      showAlert: (msg: string, cb?: () => void) => {
        window.alert(msg)
        cb?.()
      },
      showConfirm: (msg: string, cb?: (ok: boolean) => void) => {
        cb?.(window.confirm(msg))
      },
      showPopup: (params: { message?: string }, cb?: (id: string) => void) => {
        window.alert(params?.message || '')
        cb?.('')
      },
      MainButton: {
        text: '',
        isVisible: false,
        isActive: true,
        setText: noop,
        onClick: noop,
        offClick: noop,
        show: noop,
        hide: noop,
        enable: noop,
        disable: noop,
        showProgress: noop,
        hideProgress: noop,
      },
      BackButton: {
        isVisible: false,
        onClick: noop,
        offClick: noop,
        show: noop,
        hide: noop,
      },
      SettingsButton: {
        isVisible: false,
        onClick: noop,
        offClick: noop,
        show: noop,
        hide: noop,
      },
      HapticFeedback: {
        impactOccurred: noop,
        notificationOccurred: noop,
        selectionChanged: noop,
      },
      version: '7.0',
      platform: 'web',
      isVersionAtLeast: () => true,
    },
  }

  return true
}

/**
 * Патчит `window.fetch` чтобы для всех запросов к `/api/*` (кроме `/api/admin/*`)
 * автоматически подкладывался `telegram_id` из мок-идентичности — в query для
 * GET/HEAD/DELETE и в JSON-тело для POST/PUT/PATCH.
 *
 * Это нужно потому что мок не может подделать `initData` с валидной подписью,
 * поэтому бэкенд-аутентификация падает на проверке HMAC. Insecure-fallback
 * на бэке (`getInsecureFallbackIdentity`) читает `telegram_id` из query/body,
 * так что прокидываем identity именно туда.
 *
 * Гард `import.meta.env.DEV` гарантирует что патч полностью вырезается
 * из прод-сборки tree-shaking'ом.
 */
function patchFetchForDevMock(identity: DevMockIdentity): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return

  const flagKey = '__navalivayDevFetchPatched' as const
  const flagged = window as unknown as Record<string, unknown>
  if (flagged[flagKey]) return
  flagged[flagKey] = true

  const originalFetch = window.fetch.bind(window)

  const isJsonContentType = (value: string | null): boolean => {
    if (!value) return false
    return value.toLowerCase().includes('application/json')
  }

  const ensureQueryParams = (urlObj: URL): boolean => {
    let mutated = false
    if (!urlObj.searchParams.has('telegram_id')) {
      urlObj.searchParams.set('telegram_id', identity.id)
      mutated = true
    }
    if (identity.username && !urlObj.searchParams.has('telegram_username')) {
      urlObj.searchParams.set('telegram_username', identity.username)
      mutated = true
    }
    if (identity.first_name && !urlObj.searchParams.has('first_name')) {
      urlObj.searchParams.set('first_name', identity.first_name)
      mutated = true
    }
    return mutated
  }

  const ensureJsonBodyFields = (
    body: Record<string, unknown>,
  ): { body: Record<string, unknown>; mutated: boolean } => {
    let mutated = false
    if (typeof body.telegram_id === 'undefined' || body.telegram_id === null || body.telegram_id === '') {
      body.telegram_id = identity.id
      mutated = true
    }
    if (
      identity.username &&
      (typeof body.telegram_username === 'undefined' ||
        body.telegram_username === null ||
        body.telegram_username === '')
    ) {
      body.telegram_username = identity.username
      mutated = true
    }
    if (
      identity.first_name &&
      (typeof body.first_name === 'undefined' || body.first_name === null || body.first_name === '')
    ) {
      body.first_name = identity.first_name
      mutated = true
    }
    return { body, mutated }
  }

  const patchedFetch: typeof window.fetch = async (input, init) => {
    try {
      // Только Request/string/URL — все стандартные типы.
      const isRequest = typeof Request !== 'undefined' && input instanceof Request
      const rawUrl = isRequest ? (input as Request).url : String(input)

      let urlObj: URL
      try {
        urlObj = new URL(rawUrl, window.location.origin)
      } catch {
        return originalFetch(input as RequestInfo, init)
      }

      // Только same-origin.
      if (urlObj.origin !== window.location.origin) {
        return originalFetch(input as RequestInfo, init)
      }

      const path = urlObj.pathname
      // Админ-эндпоинты используют отдельный токен — не трогаем.
      if (!path.startsWith('/api/') || path.startsWith('/api/admin/')) {
        return originalFetch(input as RequestInfo, init)
      }

      const method = String(
        (init?.method || (isRequest ? (input as Request).method : 'GET')) || 'GET',
      ).toUpperCase()

      // GET/HEAD/DELETE: подкладываем в query.
      if (method === 'GET' || method === 'HEAD' || method === 'DELETE') {
        const mutated = ensureQueryParams(urlObj)
        if (!mutated) {
          return originalFetch(input as RequestInfo, init)
        }
        // Если был Request — пересобираем его с новым URL, сохраняя headers/body/credentials.
        if (isRequest) {
          const req = input as Request
          const cloned = new Request(urlObj.toString(), req)
          return originalFetch(cloned, init)
        }
        return originalFetch(urlObj.toString(), init)
      }

      // POST/PUT/PATCH с JSON-телом: парсим, инжектим, перепаковываем.
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        let headersObj: Headers
        let bodyText: string | null = null
        let credentials: RequestCredentials | undefined
        let mode: RequestMode | undefined
        let cache: RequestCache | undefined
        let redirect: RequestRedirect | undefined
        let referrer: string | undefined
        let integrity: string | undefined
        let keepalive: boolean | undefined
        let signal: AbortSignal | null | undefined

        if (isRequest) {
          const req = input as Request
          headersObj = new Headers(req.headers)
          // init может переопределить headers/body/method — учитываем это.
          if (init?.headers) {
            const overrideHeaders = new Headers(init.headers as HeadersInit)
            overrideHeaders.forEach((v, k) => headersObj.set(k, v))
          }
          if (init?.body !== undefined) {
            bodyText = typeof init.body === 'string' ? init.body : null
          } else {
            try {
              bodyText = await req.clone().text()
            } catch {
              bodyText = null
            }
          }
          credentials = init?.credentials ?? req.credentials
          mode = init?.mode ?? req.mode
          cache = init?.cache ?? req.cache
          redirect = init?.redirect ?? req.redirect
          referrer = init?.referrer ?? req.referrer
          integrity = init?.integrity ?? req.integrity
          keepalive = init?.keepalive ?? req.keepalive
          signal = init?.signal ?? req.signal
        } else {
          headersObj = new Headers((init?.headers as HeadersInit) || {})
          bodyText = typeof init?.body === 'string' ? (init?.body as string) : null
          credentials = init?.credentials
          mode = init?.mode
          cache = init?.cache
          redirect = init?.redirect
          referrer = init?.referrer
          integrity = init?.integrity
          keepalive = init?.keepalive
          signal = init?.signal
        }

        const contentType = headersObj.get('content-type')
        const isJson = isJsonContentType(contentType)

        // Если не JSON или тело не строкой (FormData/Blob/...) — fallback в query.
        if (!isJson || typeof bodyText !== 'string') {
          const mutated = ensureQueryParams(urlObj)
          if (!mutated) {
            return originalFetch(input as RequestInfo, init)
          }
          if (isRequest) {
            const req = input as Request
            const cloned = new Request(urlObj.toString(), req)
            return originalFetch(cloned, init)
          }
          return originalFetch(urlObj.toString(), init)
        }

        // Парсим JSON.
        let parsed: unknown = null
        if (bodyText.trim()) {
          try {
            parsed = JSON.parse(bodyText)
          } catch {
            // Невалидный JSON — fallback в query.
            const mutated = ensureQueryParams(urlObj)
            if (!mutated) {
              return originalFetch(input as RequestInfo, init)
            }
            if (isRequest) {
              const req = input as Request
              const cloned = new Request(urlObj.toString(), req)
              return originalFetch(cloned, init)
            }
            return originalFetch(urlObj.toString(), init)
          }
        }

        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          // Только plain-object body можем расширить.
          parsed = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
        }

        const { body: nextBody, mutated } = ensureJsonBodyFields(
          parsed as Record<string, unknown>,
        )

        if (!mutated) {
          return originalFetch(input as RequestInfo, init)
        }

        const nextBodyText = JSON.stringify(nextBody)

        const nextInit: RequestInit = {
          method,
          headers: headersObj,
          body: nextBodyText,
          credentials,
          mode,
          cache,
          redirect,
          referrer,
          integrity,
          keepalive,
          signal: signal ?? undefined,
        }

        return originalFetch(urlObj.toString(), nextInit)
      }

      return originalFetch(input as RequestInfo, init)
    } catch (err) {
       
      console.warn('[dev] fetch patch error, falling back to original', err)
      return originalFetch(input as RequestInfo, init)
    }
  }

  window.fetch = patchedFetch as typeof window.fetch

   
  console.info('[dev] fetch patched for dev Telegram identity')
}

function showDevBanner(identity: DevMockIdentity): void {
  if (document.getElementById('navalivay-dev-mock-banner')) return

  const mount = () => {
    if (document.getElementById('navalivay-dev-mock-banner')) return
    const el = document.createElement('div')
    el.id = 'navalivay-dev-mock-banner'
    el.textContent = `dev mock: tg_id=${identity.id}${
      identity.username ? ` @${identity.username}` : ''
    } · clearDevTelegramMock()`
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '8px',
      left: '8px',
      zIndex: '2147483647',
      padding: '4px 8px',
      borderRadius: '6px',
      background: 'rgba(220, 38, 38, 0.92)',
      color: '#fff',
      font: '11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace',
      pointerEvents: 'auto',
      cursor: 'pointer',
      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
      maxWidth: 'calc(100vw - 16px)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    } as Partial<CSSStyleDeclaration>)
    el.title = 'Click to clear dev mock and reload'
    el.addEventListener('click', () => {
      ;(window as unknown as { clearDevTelegramMock?: () => void }).clearDevTelegramMock?.()
    })
    document.body.appendChild(el)
  }

  if (document.body) {
    mount()
  } else {
    document.addEventListener('DOMContentLoaded', mount, { once: true })
  }
}

export function applyDevTelegramMockIfNeeded(): void {
  if (!import.meta.env.DEV) return
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  const queryId =
    url.searchParams.get('telegram_id') || url.searchParams.get('as') || ''
  const queryUsername = url.searchParams.get('username') || ''
  const queryFirstName = url.searchParams.get('first_name') || ''

  const stored = readStoredIdentity()

  let identity: DevMockIdentity | null = stored

  if (queryId.trim()) {
    identity = {
      id: queryId.trim(),
      username: queryUsername.trim() || stored?.username || '',
      first_name:
        queryFirstName.trim() ||
        stored?.first_name ||
        `Dev User ${queryId.trim()}`,
    }
    persistIdentity(identity)

    url.searchParams.delete('telegram_id')
    url.searchParams.delete('as')
    url.searchParams.delete('username')
    url.searchParams.delete('first_name')
    window.history.replaceState({}, '', url.toString())
  }

  if (!identity) return

  const injected = injectMockWebApp(identity)

  ;(window as unknown as { clearDevTelegramMock: () => void }).clearDevTelegramMock = () => {
    try {
      sessionStorage.removeItem(DEV_MOCK_KEY)
    } catch {
      /* noop */
    }
    delete (window as unknown as { Telegram?: unknown }).Telegram
    window.location.reload()
  }

  // Если реальный Mini App уже подмонтирован — не патчим fetch и не показываем баннер.
  if (!injected) return

  patchFetchForDevMock(identity)

   
  console.warn('[dev] Telegram WebApp mock applied', identity)
}
