import 'server-only';
import { z } from 'zod';
import type { CurrentUser } from '@/lib/auth/session';
import { getProjectRegisterData } from '@/lib/projects/queries';
import { getMaterialWorkspaceData } from '@/lib/materials/queries';
import { getOperationsData } from '@/lib/operations/queries';
import { getFinanceData } from '@/lib/finance/queries';
import { operationDate, operationPhases } from '@/lib/operations/validation';
import type { ReportData } from './render';
export const reportSchema = z
  .object({
    type: z.enum(['portfolio', 'materials', 'operations', 'costs']),
    format: z.enum(['pdf', 'xlsx']),
    projectId: z.string().max(128).default(''),
    from: z.union([z.literal(''), operationDate]).default(''),
    to: z.union([z.literal(''), operationDate]).default(''),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    'Rentang tanggal terbalik.',
  );
export async function getReport(
  user: CurrentUser,
  filter: z.infer<typeof reportSchema>,
): Promise<ReportData> {
  const register = await getProjectRegisterData(user);
  if (
    filter.projectId &&
    !register.projects.some((p) => p.id === filter.projectId)
  )
    throw new Error('Project tidak ditemukan atau akses ditolak.');
  const match = (projectId: string) =>
    !filter.projectId || projectId === filter.projectId;
  const inRange = (date: string) =>
    (!filter.from || date >= filter.from) && (!filter.to || date <= filter.to);
  const selected = register.projects.find((p) => p.id === filter.projectId);
  const report: ReportData = {
    title: '',
    subtitle: `${register.demoMode ? 'DEMO - ' : ''}${selected ? selected.code : 'Seluruh project yang dapat diakses'}${['costs', 'operations'].includes(filter.type) ? ` | Periode ${filter.from || 'awal'} s/d ${filter.to || 'akhir'}` : ' | Snapshot saat ekspor'}`,
    generatedAt: new Date().toISOString(),
    columns: [],
    rows: [],
  };
  if (filter.type === 'portfolio') {
    report.title = 'Project Portfolio';
    report.columns = [
      { label: 'Project', width: 16 },
      { label: 'Nama', width: 32 },
      { label: 'Phase', width: 18 },
      { label: 'Progress %', kind: 'number', width: 12 },
      { label: 'PO (IDR)', kind: 'money', width: 22 },
      { label: 'Budget (IDR)', kind: 'money', width: 22 },
      { label: 'Actual (IDR)', kind: 'money', width: 22 },
      { label: 'Forecast (IDR)', kind: 'money', width: 22 },
      { label: 'Health', width: 16 },
    ];
    report.rows = register.projects
      .filter((p) => match(p.id))
      .map((p) => [
        p.code,
        p.name,
        p.phase,
        p.progressPct,
        p.poValue,
        p.budgetValue,
        p.actualCost,
        p.forecastCost,
        p.health,
      ]);
  } else if (filter.type === 'materials') {
    const data = await getMaterialWorkspaceData(user);
    report.title = 'Material Register';
    report.columns = [
      { label: 'Project', width: 16 },
      { label: 'Kode', width: 22 },
      { label: 'Material', width: 36 },
      { label: 'Unit', width: 10 },
      { label: 'Required', kind: 'number', width: 14 },
      { label: 'Ordered', kind: 'number', width: 14 },
      { label: 'Received', kind: 'number', width: 14 },
      { label: 'Installed', kind: 'number', width: 14 },
      { label: 'Status', width: 16 },
    ];
    report.rows = data.materials
      .filter((m) => match(m.projectId) && m.isActive)
      .map((m) => [
        m.projectCode,
        m.code,
        m.description,
        m.unit,
        m.requiredQty,
        m.orderedQty,
        m.receivedQty,
        m.installedQty,
        m.status,
      ]);
  } else if (filter.type === 'operations') {
    const data = await getOperationsData(user, [...operationPhases]);
    report.title = 'Operational Milestones';
    report.columns = [
      { label: 'Project', width: 16 },
      { label: 'Fase', width: 18 },
      { label: 'Milestone', width: 36 },
      { label: 'Target', kind: 'date', width: 16 },
      { label: 'Progress %', kind: 'number', width: 14 },
      { label: 'Status', width: 18 },
      { label: 'PIC', width: 22 },
      { label: 'Referensi', width: 22 },
    ];
    report.rows = data.operations
      .filter((m) => match(m.projectId) && inRange(m.plannedDate))
      .map((m) => [
        m.projectCode,
        m.phase,
        m.title,
        m.plannedDate,
        m.progressPct,
        m.status,
        m.responsible,
        m.referenceNo,
      ]);
  } else {
    const data = await getFinanceData(user);
    report.title = 'Cost Ledger';
    report.columns = [
      { label: 'Project', width: 16 },
      { label: 'Tanggal', kind: 'date', width: 16 },
      { label: 'Kategori', width: 18 },
      { label: 'Uraian', width: 40 },
      { label: 'Referensi', width: 22 },
      { label: 'Biaya (IDR)', kind: 'money', width: 24 },
      { label: 'Status', width: 14 },
      { label: 'Alasan batal', width: 30 },
    ];
    report.rows = data.entries
      .filter((e) => match(e.projectId) && inRange(e.spentAt))
      .map((e) => [
        e.projectCode,
        e.spentAt,
        e.category,
        e.description,
        e.referenceNo,
        e.amount,
        e.voided ? 'VOID' : 'POSTED',
        e.voidReason,
      ]);
  }
  if (report.rows.length > 5000)
    throw new Error(
      'Laporan melebihi 5.000 baris. Persempit project atau periode.',
    );
  return report;
}
