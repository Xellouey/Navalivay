import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useAdminStore } from '@/stores/admin'

const requireAdminAuth = (to: any, from: any, next: any) => {
  const adminStore = useAdminStore()
  if (!adminStore.isAuthenticated) {
    next('/admin')
  } else {
    next()
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/p/:id',
      name: 'product',
      component: () => import('../views/ProductView.vue'),
      props: true
    },
    {
      path: '/category/:slug',
      name: 'category',
      component: () => import('../views/CategoryView.vue'),
      props: true
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/views/AdminView.vue'),
      children: [
        {
          path: 'crm',
          redirect: { name: 'CrmDashboard' }
        },
        {
          path: 'crm/dashboard',
          name: 'CrmDashboard',
          component: () => import('@/views/admin/crm/CrmDashboard.vue'),
          beforeEnter: requireAdminAuth
        },
        {
          path: 'crm/orders',
          name: 'CrmOrders',
          component: () => import('@/views/admin/crm/CrmOrders.vue'),
          beforeEnter: requireAdminAuth
        },
        {
          path: 'crm/orders/:id',
          name: 'CrmOrderDetail',
          component: () => import('@/views/admin/crm/CrmOrderDetail.vue'),
          props: true,
          beforeEnter: requireAdminAuth
        },
        {
          path: 'crm/customers',
          name: 'CrmCustomers',
          component: () => import('@/views/admin/crm/CrmCustomers.vue'),
          beforeEnter: requireAdminAuth
        },
        {
          path: 'crm/customers/:id',
          name: 'CrmCustomerDetail',
          component: () => import('@/views/admin/crm/CrmCustomerDetail.vue'),
          props: true,
          beforeEnter: requireAdminAuth
        },
        {
          path: 'crm/procurements',
          name: 'CrmProcurements',
          component: () => import('@/views/admin/crm/CrmProcurements.vue'),
          beforeEnter: requireAdminAuth
        },
        {
          path: 'crm/finances',
          name: 'CrmFinances',
          component: () => import('@/views/admin/crm/CrmFinances.vue'),
          beforeEnter: requireAdminAuth
        },
        {
          path: 'crm/employees',
          name: 'CrmEmployees',
          component: () => import('@/views/admin/crm/CrmEmployees.vue'),
          beforeEnter: requireAdminAuth
        },
        {
          path: 'crm/write-offs',
          name: 'CrmWriteOffs',
          component: () => import('@/views/admin/crm/CrmWriteOffs.vue'),
          beforeEnter: requireAdminAuth
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      redirect: '/'
    }
  ]
})

const visitLogger = typeof window !== 'undefined' ? createVisitLogger() : null

if (visitLogger) {
  router.afterEach((to) => {
    visitLogger.log(to)
  })

  router.isReady().then(() => {
    visitLogger.log(router.currentRoute.value)
  })
}

export default router

function createVisitLogger() {
  let lastPath = ''
  let lastLoggedAt = 0

  function shouldLog(path: string) {
    if (!path) return false
    if (path.startsWith('/admin')) return false
    const now = Date.now()
    if (path === lastPath && now - lastLoggedAt < 2000) return false
    return true
  }

  function resolveAction(path: string) {
    if (path === '/') return 'view_home'
    if (path.startsWith('/p/')) return 'view_product'
    if (path.startsWith('/category/')) return 'view_category'
    return 'view_page'
  }

  async function log(route: { fullPath: string }) {
    try {
      const fullPath = route.fullPath
      if (!shouldLog(fullPath)) return

      const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user
      if (!telegramUser?.id) return

      const payload = {
        telegram_id: String(telegramUser.id),
        telegram_username: telegramUser.username ?? null,
        first_name: telegramUser.first_name ?? null,
        last_name: telegramUser.last_name ?? null,
        page_path: fullPath,
        action: resolveAction(fullPath)
      }

      await fetch('/api/visits/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      lastPath = fullPath
      lastLoggedAt = Date.now()
    } catch (error) {
      console.warn('[visitLogger] Failed to log visit', error)
    }
  }

  return { log }
}
