// Decimal values arrive as strings so grouping never rounds stock quantities.
export function formatOrderQuantity(value: string) {
  const [integer, fraction = ''] = value.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals = fraction.replace(/0+$/, '');
  return decimals ? `${grouped},${decimals}` : grouped;
}
