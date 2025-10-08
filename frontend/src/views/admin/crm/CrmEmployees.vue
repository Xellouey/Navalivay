<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="max-w-7xl mx-auto">
      <!-- Back Button -->
      <button @click="$router.push('/admin?tab=crm')" class="mb-4 inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
        Назад в админку
      </button>
      
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Сотрудники</h1>
          <p class="text-gray-600 mt-2">Управление командой</p>
        </div>
        <button @click="showCreateModal = true" class="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Добавить сотрудника</button>
      </div>

      <div v-if="loadingEmployees" class="text-center py-12">
        <div class="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p class="mt-4 text-gray-600">Загрузка...</p>
      </div>

      <div v-else-if="employees.length > 0" class="bg-white rounded-lg shadow-sm">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Логин</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Должность</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="employee in employees" :key="employee.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ employee.first_name }} {{ employee.last_name }}</td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ employee.username }}</td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ employee.position || 'Не указана' }}</td>
              <td class="px-6 py-4">
                <span :class="employee.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'" class="px-2 py-1 rounded-full text-xs font-medium">
                  {{ employee.active ? 'Активен' : 'Неактивен' }}
                </span>
              </td>
              <td class="px-6 py-4 text-right text-sm">
                <button @click="editEmployee(employee)" class="text-blue-600 hover:text-blue-900 mr-3">Редактировать</button>
                <button @click="deleteEmployeeConfirm(employee)" class="text-red-600 hover:text-red-900">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="text-center py-12 bg-white rounded-lg shadow-sm">
        <p class="text-gray-600">Сотрудников нет</p>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <AdminModal
      :isOpen="showCreateModal || !!editingEmployee"
      :title="editingEmployee ? 'Редактировать сотрудника' : 'Добавить сотрудника'"
      description="Заполните данные сотрудника."
      size="sm"
      :showActions="false"
      @close="closeModal"
      @cancel="closeModal"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Имя</label>
          <input v-model="form.first_name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Фамилия</label>
          <input v-model="form.last_name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div v-if="!editingEmployee">
          <label class="block text-sm font-medium text-gray-700 mb-1">Логин</label>
          <input v-model="form.username" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div v-if="!editingEmployee">
          <label class="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
          <input v-model="form.password" type="password" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Должность</label>
          <input v-model="form.position" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div class="flex gap-3 pt-2">
          <button @click="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Сохранить</button>
          <button @click="closeModal" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Отмена</button>
        </div>
      </div>
    </AdminModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCrmStore } from '@/stores/crm'
import { storeToRefs } from 'pinia'
import type { Employee } from '@/stores/crm'
import AdminModal from '@/components/AdminModal.vue'

const crmStore = useCrmStore()
const { employees, loadingEmployees } = storeToRefs(crmStore)
const showCreateModal = ref(false)
const editingEmployee = ref<Employee | null>(null)
const form = ref({ first_name: '', last_name: '', username: '', password: '', position: '' })

onMounted(() => {
  crmStore.fetchEmployees()
})

function editEmployee(employee: Employee) {
  editingEmployee.value = employee
  form.value = { first_name: employee.first_name, last_name: employee.last_name, username: '', password: '', position: employee.position || '' }
}

function closeModal() {
  showCreateModal.value = false
  editingEmployee.value = null
  form.value = { first_name: '', last_name: '', username: '', password: '', position: '' }
}

async function submit() {
  try {
    if (editingEmployee.value) {
      await crmStore.updateEmployee(editingEmployee.value.id, {
        first_name: form.value.first_name,
        last_name: form.value.last_name,
        position: form.value.position || null
      })
    } else {
      await crmStore.createEmployee({
        username: form.value.username,
        password: form.value.password,
        first_name: form.value.first_name,
        last_name: form.value.last_name,
        position: form.value.position || undefined
      })
    }
    closeModal()
    await crmStore.fetchEmployees()
  } catch (error) {
    alert('Ошибка сохранения')
  }
}

async function deleteEmployeeConfirm(employee: Employee) {
  if (!confirm(`Удалить сотрудника ${employee.first_name} ${employee.last_name}?`)) return
  try {
    await crmStore.deleteEmployee(employee.id)
    await crmStore.fetchEmployees()
  } catch (error) {
    alert('Ошибка удаления')
  }
}
</script>
