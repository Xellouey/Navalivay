const bynFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'BYN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})

export function formatBynCurrency(amount: number): string {
  return bynFormatter.format(Number.isFinite(amount) ? amount : 0)
}
