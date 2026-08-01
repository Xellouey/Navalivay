/**
 * Порядок линеек в разделе.
 *
 * Линейка, отмеченная новинкой, поднимается наверх, пока не вышел срок. Сама
 * позиция при этом нигде не переписывается: когда срок истечёт, сервер перестанет
 * присылать `isNew`, и линейка вернётся туда, где стояла, по своему `order`.
 *
 * Новинка внутри линейки поднимает и её родителя: иначе отметка у подлинейки
 * никак не видна снаружи, ведь до раскрытия родителя её просто нет на экране.
 */
export interface OrderedLineup {
  order?: number | null
  isNew?: boolean | null
  newSince?: string | null
}

interface TreeLineup extends OrderedLineup {
  children?: TreeLineup[]
}

/**
 * Самая свежая отметка в ветке, считая саму линейку. Пусто означает, что новинок
 * в ветке нет. Даты приходят из SQLite в виде «YYYY-MM-DD HH:MM:SS», одинаковая
 * ширина позволяет сравнивать их как обычные строки.
 */
function branchNewSince(node: TreeLineup): string {
  let latest = node.isNew ? node.newSince || ' ' : ''
  for (const child of node.children ?? []) {
    const childLatest = branchNewSince(child)
    if (childLatest > latest) latest = childLatest
  }
  return latest
}

export function compareLineups(a: OrderedLineup, b: OrderedLineup): number {
  const aSince = branchNewSince(a as TreeLineup)
  const bSince = branchNewSince(b as TreeLineup)
  if (Boolean(aSince) !== Boolean(bSince)) return aSince ? -1 : 1
  if (aSince && bSince && aSince !== bSince) return aSince < bSince ? 1 : -1
  return (a.order ?? 0) - (b.order ?? 0)
}

/** Сортирует дерево линеек на месте, вместе со всеми уровнями вложенности. */
export function sortLineupTree<T extends TreeLineup>(nodes: T[]): T[] {
  nodes.sort(compareLineups)
  for (const node of nodes) {
    if (node.children?.length) sortLineupTree(node.children)
  }
  return nodes
}
