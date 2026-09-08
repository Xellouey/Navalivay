/**
 * Анимация смены раздела в админке.
 *
 * Сторож нужен потому, что это место ломалось дважды подряд. Сначала переход
 * стоял в App.vue и уводил всю админку целиком — содержимое подменялось до
 * начала анимации. Потом ключ верхнего RouterView починили, и вместе с лишней
 * пересборкой пропала и сама анимация: смена вкладки стала мгновенной.
 *
 * Проверяется ровно то, что обеспечивает правильный порядок: содержимое
 * раздела лежит внутри <Transition>, и у него есть ключ, который меняется при
 * смене раздела. Без ключа переход не сработает, без <Transition> подмена
 * снова станет мгновенной.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import AdminView from '@/views/AdminView.vue'
import { useAdminStore } from '@/stores/admin'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(() => Promise.resolve()) }),
  useRoute: () => ({ path: '/admin', query: {} }),
}))

/**
 * RouterView в AdminView не импортируется — его регистрирует плагин роутера.
 * В тесте плагина нет, поэтому подставляем свой: вне разделов CRM настоящий
 * отдаёт Component равным undefined, и ветку вкладок выбирает v-if внутри.
 */
const RouterViewStub = {
  name: 'RouterView',
  render(this: { $slots: Record<string, (arg: unknown) => unknown> }) {
    return this.$slots.default?.({ Component: undefined, route: { fullPath: '/admin' } })
  },
}

describe('AdminView: смена раздела', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    // Экраны админки тянут данные при показе. Сеть в тесте не нужна: важна
    // разметка перехода, а не содержимое разделов.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve('{}'),
        }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function mountAdmin() {
    // Токен нужен только чтобы загрузчики разделов не сыпали в вывод «No
    // authentication token»: сеть всё равно заглушена.
    localStorage.setItem('admin_token', 'test-token')
    const adminStore = useAdminStore()
    vi.spyOn(adminStore, 'checkAuth').mockResolvedValue(true)
    adminStore.isAuthenticated = true

    const wrapper = shallowMount(AdminView, {
      global: {
        stubs: {
          AdminLayout: { template: '<div class="layout-stub"><slot /></div>' },
          RouterView: RouterViewStub,
          // Переход не подменяем: он и есть предмет проверки.
          transition: false,
        },
      },
    })
    await flushPromises()
    return wrapper
  }

  /** Два кадра: столько нужно Vue, чтобы довести уход до конца. */
  const nextFrames = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
    )

  it('меняет раздел после ухода старого, а не мгновенно', async () => {
    const wrapper = await mountAdmin()

    const vm = wrapper.vm as unknown as { activeTab: string }
    const before = wrapper.find('.layout-stub > div')
    expect(before.exists()).toBe(true)

    vm.activeTab = 'settings'
    await nextTick()
    await flushPromises()

    // Главное: сразу после смены раздела в DOM всё ещё старый узел. Он уходит.
    // Уберут <Transition> — Vue заменит узел в тот же тик, и это упадёт.
    expect(wrapper.find('.layout-stub > div').element).toBe(before.element)

    // И он там один. Уберут mode="out-in" — новый раздел встанет рядом с
    // уходящим, разделов станет два, и пользователь увидит их наложение.
    expect(wrapper.findAll('.layout-stub > div')).toHaveLength(1)

    await nextFrames()
    await flushPromises()
    await nextTick()

    // А когда уход закончился, узел уже новый: ключ заставил пересобрать, а не
    // пропатчить старый. Уберут :key — узел останется тем же, и это упадёт.
    const after = wrapper.find('.layout-stub > div')
    expect(after.exists()).toBe(true)
    expect(after.element).not.toBe(before.element)

    wrapper.unmount()
  })
})
