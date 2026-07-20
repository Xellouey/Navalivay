import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminStockTransferModal from '@/components/admin/AdminStockTransferModal.vue'
import { useAdminStore } from '@/stores/admin'

const draftTransfer = {
  id: 'move_1',
  transfer_number: 1,
  source_location: 'warehouse' as const,
  destination_location: 'retail' as const,
  status: 'draft' as const,
  created_at: '2026-07-20 12:00:00',
  created_by: 'admin',
  total_quantity: 2,
  item_count: 1,
  items: [{ id: 'item_1', product_title: 'Манго', quantity: 2 }],
}

describe('AdminStockTransferModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function mountModal() {
    return mount(AdminStockTransferModal, {
      props: { isOpen: false, initialSource: 'warehouse' },
      global: {
        stubs: {
          AdminModal: {
            props: ['isOpen'],
            emits: ['close'],
            template: '<section v-if="isOpen"><slot /><button data-test="modal-close" @click="$emit(\'close\')">x</button></section>',
          },
        },
      },
    })
  }

  it('changes quantity in search results and saves a draft without completing it', async () => {
    const store = useAdminStore()
    vi.spyOn(store, 'fetchInventoryTransfers').mockResolvedValue({
      transfers: [],
      pagination: { page: 1, totalPages: 1 },
    })
    vi.spyOn(store, 'fetchInventoryItems').mockResolvedValue([{
      id: 'product_1',
      title: 'Манго',
      available_stock: 5,
    }] as any)
    const createTransfer = vi.spyOn(store, 'createInventoryTransfer').mockResolvedValue(draftTransfer as any)
    vi.spyOn(store, 'fetchInventoryTransfer').mockResolvedValue(draftTransfer as any)

    const wrapper = mountModal()
    await wrapper.setProps({ isOpen: true })
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()

    const increaseButton = wrapper.get('button[aria-label="Увеличить количество"]')
    expect(wrapper.text()).toContain('0 шт')
    await increaseButton.trigger('click')
    await increaseButton.trigger('click')
    expect(wrapper.text()).toContain('2 шт')

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Создать заявку'))
    await saveButton!.trigger('click')
    await flushPromises()

    expect(createTransfer).toHaveBeenCalledWith(expect.objectContaining({
      source_location: 'warehouse',
      destination_location: 'retail',
      items: [expect.objectContaining({ product_id: 'product_1', quantity: 2 })],
    }))
    expect(wrapper.emitted('saved')).toEqual([[{ number: 1 }]])
    expect(wrapper.emitted('completed')).toBeUndefined()
  })

  it('completes a saved draft only after confirmation', async () => {
    const store = useAdminStore()
    const pendingRefresh = new Promise(() => {})
    vi.spyOn(store, 'fetchInventoryTransfers')
      .mockResolvedValueOnce({
        transfers: [draftTransfer],
        pagination: { page: 1, totalPages: 1 },
      } as any)
      .mockReturnValueOnce(pendingRefresh as any)
    vi.spyOn(store, 'fetchInventoryTransfer').mockResolvedValue(draftTransfer as any)
    const completed = { ...draftTransfer, status: 'completed' as const, completed_at: '2026-07-20 12:30:00' }
    const completeTransfer = vi.spyOn(store, 'completeInventoryTransfer').mockResolvedValue(completed as any)
    vi.stubGlobal('confirm', vi.fn(() => true))

    const wrapper = mountModal()
    await wrapper.setProps({ isOpen: true })
    await flushPromises()
    expect(wrapper.text()).toContain('15:00')
    const openButton = wrapper.findAll('button').find((button) => button.text().includes('Перемещение №1'))
    await openButton!.trigger('click')
    await flushPromises()
    const completeButton = wrapper.findAll('button').find((button) => button.text() === 'Оприходовать')
    await completeButton!.trigger('click')
    await flushPromises()

    expect(completeTransfer).toHaveBeenCalledWith('move_1')
    expect(wrapper.emitted('completed')).toEqual([[{ quantity: 2, destination: 'retail' }]])
    expect(wrapper.text()).toContain('Оприходовано')
    await wrapper.get('[data-test="modal-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('ignores an old next-page response after reopening the modal', async () => {
    const store = useAdminStore()
    let resolveOldPage!: (value: any) => void
    const oldPage = new Promise((resolve) => { resolveOldPage = resolve })
    const freshTransfer = { ...draftTransfer, id: 'move_2', transfer_number: 2, status: 'completed' as const }
    vi.spyOn(store, 'fetchInventoryTransfers')
      .mockResolvedValueOnce({ transfers: [draftTransfer], pagination: { page: 1, totalPages: 2 } } as any)
      .mockReturnValueOnce(oldPage as any)
      .mockResolvedValueOnce({ transfers: [freshTransfer], pagination: { page: 1, totalPages: 1 } } as any)

    const wrapper = mountModal()
    await wrapper.setProps({ isOpen: true })
    await flushPromises()
    const moreButton = wrapper.findAll('button').find((button) => button.text() === 'Показать ещё')
    await moreButton!.trigger('click')

    await wrapper.setProps({ isOpen: false })
    await wrapper.setProps({ isOpen: true })
    await flushPromises()
    resolveOldPage({
      transfers: [{ ...draftTransfer, id: 'stale', transfer_number: 999 }],
      pagination: { page: 2, totalPages: 2 },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Перемещение №2')
    expect(wrapper.text()).not.toContain('Перемещение №999')
  })
})
