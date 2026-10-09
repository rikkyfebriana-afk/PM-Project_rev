export const dashboardCategories = {
  active: { label: 'Active', description: 'Site/proyek berstatus Active.' },
  'on-track': { label: 'On track', description: 'Proyek aktif dengan health On track.' },
  attention: { label: 'Attention', description: 'Proyek aktif yang membutuhkan perhatian.' },
  critical: { label: 'Critical', description: 'Proyek aktif dengan health Critical.' },
  closed: { label: 'Closed', description: 'Proyek berstatus Closed, bukan proyek yang diarsipkan.' },
  'material-shortage': { label: 'Material shortage', description: 'Proyek aktif dengan material aktif berstatus Shortage. Angka kartu menghitung item material; daftar ini menghitung site terdampak.' },
  delayed: { label: 'Delayed project', description: 'Proyek aktif dengan target selesai sebelum hari ini dan progress kurang dari 100%.' },
  'fat-punch-list': { label: 'FAT punch list', description: 'Proyek aktif dengan action item FAT yang belum Resolved. Angka kartu menghitung action item; daftar ini menghitung site terdampak.' },
  'budget-risk': { label: 'Budget risk', description: 'Proyek aktif dengan budget lebih dari nol dan forecast minimal 95% dari budget.' },
} as const;
export type DashboardCategory = keyof typeof dashboardCategories;
export function isDashboardCategory(value: string): value is DashboardCategory {
  return Object.hasOwn(dashboardCategories, value);
}
const labelCategories: Record<string, DashboardCategory> = {
  Active: 'active', 'On track': 'on-track', Attention: 'attention', Critical: 'critical', Closed: 'closed',
  'Material shortage': 'material-shortage', 'Delayed project': 'delayed', 'FAT punch list': 'fat-punch-list', 'Budget risk': 'budget-risk',
};
export function dashboardCategoryHref(label: string) {
  const category = labelCategories[label];
  return category ? `/dashboard/sites?category=${category}` : '/projects';
}
