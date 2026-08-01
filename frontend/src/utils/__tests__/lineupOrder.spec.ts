/**
 * Порядок линеек в разделе. Закрепление новинки живёт только здесь: позиция
 * линейки нигде не переписывается, поэтому после истечения срока она обязана
 * вернуться ровно туда, где стояла.
 */

import { describe, expect, it } from 'vitest'
import { compareLineups, type OrderedLineup } from '@/utils/lineupOrder'

const lineup = (
  name: string,
  order: number,
  extra: Partial<OrderedLineup> = {},
): OrderedLineup & { name: string } => ({ name, order, ...extra })

const sortedNames = (items: Array<OrderedLineup & { name: string }>) =>
  [...items].sort(compareLineups).map((item) => item.name)

describe('порядок линеек', () => {
  it('без новинок сохраняет обычный порядок', () => {
    const items = [lineup('третья', 3), lineup('первая', 1), lineup('вторая', 2)]
    expect(sortedNames(items)).toEqual(['первая', 'вторая', 'третья'])
  })

  it('поднимает новинку наверх, даже если она стояла пятнадцатой', () => {
    const items = [
      lineup('первая', 1),
      lineup('вторая', 2),
      lineup('пятнадцатая', 15, { isNew: true, newSince: '2026-07-30 10:00:00' }),
    ]
    expect(sortedNames(items)).toEqual(['пятнадцатая', 'первая', 'вторая'])
  })

  it('среди новинок свежая идёт выше', () => {
    const items = [
      lineup('давняя', 2, { isNew: true, newSince: '2026-07-01 10:00:00' }),
      lineup('свежая', 9, { isNew: true, newSince: '2026-07-30 10:00:00' }),
      lineup('обычная', 1),
    ]
    expect(sortedNames(items)).toEqual(['свежая', 'давняя', 'обычная'])
  })

  it('после истечения срока линейка возвращается на своё место', () => {
    const pinned = [
      lineup('первая', 1),
      lineup('пятнадцатая', 15, { isNew: true, newSince: '2026-07-30 10:00:00' }),
      lineup('шестнадцатая', 16),
    ]
    expect(sortedNames(pinned)[0]).toBe('пятнадцатая')

    // Сервер перестал присылать признак: больше ничего менять не нужно.
    const expired = pinned.map((item) => ({ ...item, isNew: false }))
    expect(sortedNames(expired)).toEqual(['первая', 'пятнадцатая', 'шестнадцатая'])
  })

  it('новинки без даты отметки не роняют сортировку', () => {
    const items = [
      lineup('без даты', 4, { isNew: true }),
      lineup('с датой', 8, { isNew: true, newSince: '2026-07-30 10:00:00' }),
      lineup('обычная', 1),
    ]
    expect(sortedNames(items)).toEqual(['с датой', 'без даты', 'обычная'])
  })
})
