export const financePoGroups = [
  {
    key: 'RECEIVED',
    label: 'Open',
    description: 'PO diterima, belum diproses',
  },
  {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'PO sedang diproses',
  },
  {
    key: 'COMPLETED',
    label: 'Closed',
    description: 'PO selesai, bukan status pembayaran',
  },
  { key: 'DRAFT', label: 'Draft', description: 'PO masih draft' },
  { key: 'CANCELLED', label: 'Cancelled', description: 'PO dibatalkan' },
  {
    key: 'UNRECORDED',
    label: 'Belum tercatat',
    description: 'Belum ada nomor PO / status tidak dikenali',
  },
] as const;
type PoProject = {
  poValue: string;
  customerPoNumber?: string | null;
  customerPoStatus?: string;
};
export function financePoGroup(p: PoProject): string {
  return p.customerPoNumber?.trim() &&
    financePoGroups.some((g) => g.key === p.customerPoStatus)
    ? p.customerPoStatus!
    : 'UNRECORDED';
}
function cents(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function summarizeFinancePo(projects: PoProject[]) {
  return financePoGroups.map((group) => {
    const rows = projects.filter((p) => financePoGroup(p) === group.key);
    const total = rows.reduce((sum, p) => sum + cents(p.poValue), 0n);
    return {
      ...group,
      count: rows.length,
      value: `${total / 100n}.${String(total % 100n).padStart(2, '0')}`,
    };
  });
}
export function exactPoMoney(value: string) {
  const [whole, fraction = '00'] = value.split('.');
  return `Rp ${BigInt(whole).toLocaleString('id-ID')}${Number(fraction) ? ',' + fraction.padEnd(2, '0') : ''}`;
}
