import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';
import { isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { demoProjects } from '@/lib/projects/demo-data';

function historyDetail(metadata: Prisma.JsonValue) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    return '';
  const before = (metadata.before ?? {}) as Record<string, unknown>;
  const after = (metadata.after ?? {}) as Record<string, unknown>;
  const labels: Record<string, string> = {
    customerPoNumber: 'Nomor PO',
    clientName: 'Customer',
    customerPoDate: 'Tanggal PO',
    customerPoDescription: 'Pekerjaan',
    poValue: 'Nilai PO (IDR)',
    customerPoTax: 'PPN (IDR)',
    customerPoDelivery: 'Delivery',
    customerPoStatus: 'Status',
    customerPoNotes: 'Catatan',
  };
  return Object.entries(labels)
    .filter(([key]) => String(before[key] ?? '') !== String(after[key] ?? ''))
    .map(
      ([key, label]) =>
        `${label}: ${String(before[key] ?? '—')} → ${String(after[key] ?? '—')}`,
    )
    .join('\n');
}

export async function getCustomerPoData(user: CurrentUser) {
  const demoMode = isLocalDemoMode();
  const rows = demoMode
    ? demoProjects.map((p) => ({
        ...p,
        customerPoNumber: null,
        customerPoDate: null,
        customerPoDescription: null,
        customerPoTax: new Prisma.Decimal(0),
        customerPoDelivery: null,
        customerPoStatus: 'DRAFT',
        customerPoNotes: null,
        documents: [],
        auditLogs: [],
      }))
    : await prisma.project.findMany({
        where: accessibleProjectWhere(user),
        orderBy: [{ updatedAt: 'desc' }, { code: 'asc' }],
        include: {
          documents: {
            where: {
              category: 'PURCHASE_ORDER',
              status: 'READY',
              deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, originalName: true, createdAt: true },
          },
          auditLogs: {
            where: { entityType: 'CustomerPO' },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { user: { select: { displayName: true } } },
          },
        },
      });
  const projects = rows.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    clientName: p.clientName ?? '',
    projectStatus: p.status,
    poValue: p.poValue.toString(),
    customerPoNumber: p.customerPoNumber ?? '',
    customerPoDate: p.customerPoDate?.toISOString().slice(0, 10) ?? '',
    customerPoDescription: p.customerPoDescription ?? '',
    customerPoTax: p.customerPoTax.toString(),
    customerPoDelivery: p.customerPoDelivery?.toISOString().slice(0, 10) ?? '',
    customerPoStatus: p.customerPoStatus,
    customerPoNotes: p.customerPoNotes ?? '',
    total: new Prisma.Decimal(p.poValue).plus(p.customerPoTax).toFixed(2),
    updatedAt:
      typeof p.updatedAt === 'string' ? p.updatedAt : p.updatedAt.toISOString(),
    documents: p.documents.map((d) => ({
      id: d.id,
      name: d.originalName,
      date: d.createdAt.toISOString().slice(0, 10),
    })),
    history: p.auditLogs.map((a) => ({
      id: a.id,
      date: a.createdAt.toISOString(),
      actor: a.user?.displayName ?? 'Sistem',
      action: a.action,
      detail: historyDetail(a.metadata),
    })),
  }));
  return {
    projects,
    demoMode,
    canEdit: user.role === 'ADMIN',
    totals: {
      registered: projects.filter((p) => p.customerPoNumber).length,
      missing: projects.filter((p) => !p.customerPoNumber).length,
      value: projects
        .filter((p) => p.projectStatus === 'ACTIVE')
        .reduce((s, p) => s.plus(p.poValue), new Prisma.Decimal(0))
        .toFixed(2),
      tax: projects
        .filter((p) => p.projectStatus === 'ACTIVE')
        .reduce((s, p) => s.plus(p.customerPoTax), new Prisma.Decimal(0))
        .toFixed(2),
    },
  };
}
export type CustomerPoData = Awaited<ReturnType<typeof getCustomerPoData>>;
