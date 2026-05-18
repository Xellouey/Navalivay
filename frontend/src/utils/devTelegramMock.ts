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

function injectMockWebApp(identity: DevMockIdentity): void {
  const w = window as unknown as { Telegram?: { WebApp?: unknown } }
  const existing = w.Telegram?.WebApp as { initData?: string } | undefined
  if (existing && String(existing.initData || '').trim()) {
    // Реальный Mini App уже подмонтирован — не перезаписываем.
    return
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

  injectMockWebApp(identity)

  ;(window as unknown as { clearDevTelegramMock: () => void }).clearDevTelegramMock = () => {
    try {
      sessionStorage.removeItem(DEV_MOCK_KEY)
    } catch {
      /* noop */
    }
    delete (window as unknown as { Telegram?: unknown }).Telegram
    window.location.reload()
  }

  showDevBanner(identity)

  // eslint-disable-next-line no-console
  console.warn('[dev] Telegram WebApp mock applied', identity)
}
