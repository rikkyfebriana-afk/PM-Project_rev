import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';
import { isLocalDemoMode } from '@/lib/auth/session';
import { hasFullAccess } from '@/lib/auth/roles';
import type {
  BoqItemTypeValue,
  BoqProjectCosting,
  BoqWorkspaceData,
  BoqWorkspaceRevision,
} from '@/lib/boq/types';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { demoProjects } from '@/lib/projects/demo-data';

// Portfolio/revision sums can exceed the precision of a single Decimal(18, 2) item.
const CostDecimal = Prisma.Decimal.clone({ precision: 40 });

const demoBoqs: BoqWorkspaceRevision[] = [
  {
    id: 'demo-boq-cirebon-2',
    projectId: 'demo-cirebon',
    projectCode: 'PCC-024',
    projectName: 'Cirebon Substation Upgrade',
    version: 2,
    status: 'DRAFT',
    sourceFileName: 'BoQ_Cirebon_Rev02.xlsx',
    sourceSheetName: 'BoQ Import',
    itemCount: 86,
    totalValue: '1875000000.00',
    createdAt: '2026-09-12T04:20:00.000Z',
    approvedAt: null,
    approvedByName: null,
  },
  {
    id: 'demo-boq-bogor-1',
    projectId: 'demo-bogor',
    projectCode: 'PCC-031',
    projectName: 'Bogor Control Panel',
    version: 1,
    status: 'APPROVED',
    sourceFileName: 'BoQ_Bogor_Final.xlsx',
    sourceSheetName: 'BOQ',
    itemCount: 64,
    totalValue: '1398000000.00',
    createdAt: '2026-09-08T02:15:00.000Z',
    approvedAt: '2026-09-08T04:10:00.000Z',
    approvedByName: 'Siti Rahma',
  },
  {
    id: 'demo-boq-bekasi-3',
    projectId: 'demo-bekasi',
    projectCode: 'PCC-018',
    projectName: 'Bekasi Switchgear Revamp',
    version: 3,
    status: 'APPROVED',
    sourceFileName: 'Bekasi_BoQ_Rev03.xlsx',
    sourceSheetName: 'Material BoQ',
    itemCount: 112,
    totalValue: '1720000000.00',
    createdAt: '2026-09-05T08:45:00.000Z',
    approvedAt: '2026-09-05T10:15:00.000Z',
    approvedByName: 'Siti Rahma',
  },
];

function workspaceMetrics(
  boqs: BoqWorkspaceRevision[],
  versionCount = boqs.length,
) {
  const approvedBoqs = boqs.filter((boq) => boq.status === 'APPROVED');
  const totalValue = approvedBoqs.reduce(
    (sum, boq) => sum.plus(boq.totalValue),
    new CostDecimal(0),
  );
  return {
    versions: versionCount,
    approved: approvedBoqs.length,
    drafts: boqs.filter((boq) => boq.status === 'DRAFT').length,
    items: approvedBoqs.reduce((sum, boq) => sum + boq.itemCount, 0),
    totalValue: totalValue.toFixed(2),
  };
}

export async function getBoqWorkspaceData(
  user: CurrentUser,
  selection: { projectId?: string; revisionId?: string } = {},
): Promise<BoqWorkspaceData> {
  if (isLocalDemoMode()) {
    const projects = demoProjects.map((project) => ({
      id: project.id,
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      canEdit: hasFullAccess(user.role),
    }));
    return {
      demoMode: true,
      canApprove: hasFullAccess(user.role),
      projects,
      boqs: demoBoqs,
      costing: null,
      metrics: workspaceMetrics(demoBoqs),
    };
  }

  const scopedBoqs = { project: accessibleProjectWhere(user, 'BOQ') };
  const [projectRows, activeBoqs, recentHistory, versionCount] =
    await Promise.all([
      prisma.project.findMany({
        where: accessibleProjectWhere(user, 'BOQ'),
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          clientName: true,
          projectManagerId: true,
        },
      }),
      prisma.boq.findMany({
        where: { ...scopedBoqs, status: { in: ['DRAFT', 'APPROVED'] } },
        orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
        select: {
          id: true,
          projectId: true,
          version: true,
          status: true,
          sourceFileName: true,
          sourceSheetName: true,
          approvedAt: true,
          createdAt: true,
          approvedBy: { select: { displayName: true } },
          project: { select: { code: true, name: true } },
        },
      }),
      prisma.boq.findMany({
        where: { ...scopedBoqs, status: 'SUPERSEDED' },
        orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
        take: 100,
        select: {
          id: true,
          projectId: true,
          version: true,
          status: true,
          sourceFileName: true,
          sourceSheetName: true,
          approvedAt: true,
          createdAt: true,
          approvedBy: { select: { displayName: true } },
          project: { select: { code: true, name: true } },
        },
      }),
      prisma.boq.count({ where: scopedBoqs }),
    ]);

  const boqRows = [...activeBoqs, ...recentHistory].sort(
    (left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() ||
      right.version - left.version,
  );

  const aggregates =
    boqRows.length === 0
      ? []
      : await prisma.boqItem.groupBy({
          by: ['boqId'],
          where: { boqId: { in: boqRows.map((boq) => boq.id) } },
          _count: { _all: true },
          _sum: { lineTotal: true },
        });
  const aggregateByBoq = new Map(
    aggregates.map((aggregate) => [aggregate.boqId, aggregate]),
  );

  const boqs: BoqWorkspaceRevision[] = boqRows.map((boq) => {
    const aggregate = aggregateByBoq.get(boq.id);
    return {
      id: boq.id,
      projectId: boq.projectId,
      projectCode: boq.project.code,
      projectName: boq.project.name,
      version: boq.version,
      status: boq.status,
      sourceFileName: boq.sourceFileName,
      sourceSheetName: boq.sourceSheetName,
      itemCount: aggregate?._count._all ?? 0,
      totalValue: aggregate?._sum.lineTotal?.toFixed(2) ?? '0.00',
      createdAt: boq.createdAt.toISOString(),
      approvedAt: boq.approvedAt?.toISOString() ?? null,
      approvedByName: boq.approvedBy?.displayName ?? null,
    };
  });

  // Only the selected, BOQ-authorized project is loaded with cost and usage details.
  // MATERIALS access alone must never expose unit prices through this payload.
  const selectedProjectId = selection.projectId ?? projectRows[0]?.id;
  let costing: BoqProjectCosting | null = null;
  if (
    selectedProjectId &&
    projectRows.some((project) => project.id === selectedProjectId)
  ) {
    const defaultRevision =
      boqs.find(
        (boq) =>
          boq.projectId === selectedProjectId && boq.status === 'APPROVED',
      ) ?? boqs.find((boq) => boq.projectId === selectedProjectId);
    const [project, approved, selectedRevision] = await Promise.all([
      prisma.project.findFirst({
        where: {
          AND: [accessibleProjectWhere(user, 'BOQ'), { id: selectedProjectId }],
        },
        select: { id: true, budgetValue: true, updatedAt: true },
      }),
      prisma.boq.findFirst({
        where: { projectId: selectedProjectId, status: 'APPROVED' },
        select: {
          id: true,
          version: true,
          items: { select: { lineTotal: true } },
        },
      }),
      prisma.boq.findFirst({
        where: {
          projectId: selectedProjectId,
          id: selection.revisionId ?? defaultRevision?.id ?? '__no_revision__',
        },
        select: {
          id: true,
          version: true,
          status: true,
          items: {
            orderBy: [{ sortOrder: 'asc' }, { itemNo: 'asc' }],
            select: {
              id: true,
              itemNo: true,
              itemCode: true,
              itemType: true,
              description: true,
              unit: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
              material: {
                select: {
                  projectId: true,
                  receivedQty: true,
                  installedQty: true,
                  warehouseIssuedQty: true,
                },
              },
            },
          },
        },
      }),
    ]);
    if (project) {
      const approvedTotal =
        approved?.items.reduce(
          (sum, item) => sum.plus(item.lineTotal),
          new CostDecimal(0),
        ) ?? null;
      const subtotals: Record<BoqItemTypeValue, Prisma.Decimal> = {
        MATERIAL: new CostDecimal(0),
        SERVICE: new CostDecimal(0),
        OTHER: new CostDecimal(0),
      };
      for (const item of selectedRevision?.items ?? [])
        subtotals[item.itemType] = subtotals[item.itemType].plus(
          item.lineTotal,
        );
      costing = {
        projectId: project.id,
        projectUpdatedAt: project.updatedAt.toISOString(),
        projectBudgetValue: project.budgetValue.toFixed(2),
        approvedBoqId: approved?.id ?? null,
        approvedVersion: approved?.version ?? null,
        approvedTotalValue: approvedTotal?.toFixed(2) ?? null,
        differenceValue:
          approvedTotal?.minus(project.budgetValue).toFixed(2) ?? null,
        revision: selectedRevision
          ? {
              id: selectedRevision.id,
              version: selectedRevision.version,
              status: selectedRevision.status,
              totalValue: Object.values(subtotals)
                .reduce((sum, value) => sum.plus(value), new CostDecimal(0))
                .toFixed(2),
              subtotals: {
                MATERIAL: subtotals.MATERIAL.toFixed(2),
                SERVICE: subtotals.SERVICE.toFixed(2),
                OTHER: subtotals.OTHER.toFixed(2),
              },
              zeroHppCount: selectedRevision.items.filter((item) =>
                item.unitPrice.eq(0),
              ).length,
              items: selectedRevision.items.map((item) => {
                const material =
                  item.material?.projectId === project.id
                    ? item.material
                    : null;
                return {
                  id: item.id,
                  itemNo: item.itemNo,
                  itemCode: item.itemCode,
                  itemType: item.itemType,
                  description: item.description,
                  unit: item.unit,
                  quantity: item.quantity.toFixed(4),
                  unitPrice: item.unitPrice.toFixed(2),
                  lineTotal: item.lineTotal.toFixed(2),
                  receivedQty: material?.receivedQty.toFixed(4) ?? null,
                  installedQty: material?.installedQty.toFixed(4) ?? null,
                  warehouseIssuedQty:
                    material?.warehouseIssuedQty.toFixed(4) ?? null,
                };
              }),
            }
          : null,
      };
    }
  }

  return {
    demoMode: false,
    canApprove: hasFullAccess(user.role),
    projects: projectRows.map((project) => ({
      id: project.id,
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      canEdit: hasFullAccess(user.role),
    })),
    boqs,
    costing,
    metrics: workspaceMetrics(boqs, versionCount),
  };
}
