import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';
import { isLocalDemoMode } from '@/lib/auth/session';
import type { BoqWorkspaceData, BoqWorkspaceRevision } from '@/lib/boq/types';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { demoProjects } from '@/lib/projects/demo-data';

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

function workspaceMetrics(boqs: BoqWorkspaceRevision[], versionCount = boqs.length) {
  const approvedBoqs = boqs.filter((boq) => boq.status === 'APPROVED');
  const totalValue = approvedBoqs.reduce(
    (sum, boq) => sum.plus(boq.totalValue),
    new Prisma.Decimal(0),
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
): Promise<BoqWorkspaceData> {
  if (isLocalDemoMode()) {
    const projects = demoProjects.map((project) => ({
      id: project.id,
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      canEdit:
        user.role === 'ADMIN' ||
        (user.role === 'PROJECT_MANAGER' &&
          project.projectManagerId === user.id),
    }));
    return {
      demoMode: true,
      canApprove: user.role === 'ADMIN',
      projects,
      boqs: demoBoqs,
      metrics: workspaceMetrics(demoBoqs),
    };
  }

  const scopedBoqs = { project: accessibleProjectWhere(user) };
  const [projectRows, activeBoqs, recentHistory, versionCount] = await Promise.all([
    prisma.project.findMany({
      where: accessibleProjectWhere(user),
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

  return {
    demoMode: false,
    canApprove: user.role === 'ADMIN',
    projects: projectRows.map((project) => ({
      id: project.id,
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      canEdit:
        user.role === 'ADMIN' ||
        (user.role === 'PROJECT_MANAGER' &&
          project.projectManagerId === user.id),
    })),
    boqs,
    metrics: workspaceMetrics(boqs, versionCount),
  };
}
