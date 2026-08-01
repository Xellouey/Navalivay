/**
 * Порядок линеек в разделе.
 *
 * Линейка, отмеченная новинкой, поднимается наверх, пока не вышел срок. Сама
 * позиция при этом нигде не переписывается: когда срок истечёт, сервер перестанет
 * присылать `isNew`, и линейка вернётся туда, где стояла, по своему `order`.
 */
export interface OrderedLineup {
  order?: number | null
  isNew?: boolean | null
  newSince?: string | null
}

export function compareLineups(a: OrderedLineup, b: OrderedLineup): number {
  const aNew = a.isNew ? 1 : 0
  const bNew = b.isNew ? 1 : 0
  if (aNew !== bNew) return bNew - aNew

  if (aNew && bNew) {
    // Свежая новинка выше. Даты приходят из SQLite в виде «YYYY-MM-DD HH:MM:SS»,
    // одинаковая ширина позволяет сравнивать их как обычные строки.
    const aSince = a.newSince ?? ''
    const bSince = b.newSince ?? ''
    if (aSince !== bSince) return aSince < bSince ? 1 : -1
  }

  return (a.order ?? 0) - (b.order ?? 0)
}
