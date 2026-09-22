import 'server-only';
import type { CurrentUser } from '@/lib/auth/session';
import { isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { demoProjects } from '@/lib/projects/demo-data';
import type { OperationPhase } from './validation';

export type OperationRecord = {
  id: string;
  projectId: string;
  projectCode: string;
  phase: OperationPhase;
  title: string;
  plannedDate: string;
  progressPct: string;
  status: string;
  notes: string;
  referenceNo: string;
  responsible: string;
  updatedAt: string;
  documents: { id: string; originalName: string; category: string }[];
  canEdit: boolean;
};
export type ActionRecord = {
  id: string;
  projectId: string;
  projectCode: string;
  milestoneId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueAt: string;
  updatedAt: string;
  canEdit: boolean;
};
export type OperationsData = {
  demoMode: boolean;
  projects: { id: string; code: string; name: string; canEdit: boolean }[];
  operations: OperationRecord[];
  actions: ActionRecord[];
};
export async function getOperationsData(
  user: CurrentUser,
  phases: OperationPhase[],
): Promise<OperationsData> {
  if (isLocalDemoMode()) {
    const operations = phases.flatMap((phase, i) =>
      demoProjects.slice(0, 2).map((p, j) => ({
        id: `demo-${phase}-${j}`,
        projectId: p.id,
        projectCode: p.code,
        phase,
        title: {
          PRODUCTION: 'Assembly panel',
          FAT: 'Functional test panel',
          DELIVERY: 'Pengiriman panel utama',
          INSTALLATION: 'Instalasi dan commissioning',
          BAST: 'Serah terima pekerjaan',
        }[phase],
        plannedDate: `2026-09-${24 + i + j}`,
        progressPct: j ? '35' : '75',
        status: j ? 'AT_RISK' : 'UPCOMING',
        notes: 'Contoh data untuk pratinjau.',
        referenceNo: '',
        responsible: p.projectManagerName ?? '',
        updatedAt: '2026-09-20T00:00:00.000Z',
        documents: [],
        canEdit: false,
      })),
    );
    const actions: ActionRecord[] = [
      {
        id: 'demo-punch',
        projectId: demoProjects[0].id,
        projectCode: demoProjects[0].code,
        milestoneId: phases.includes('FAT') ? 'demo-FAT-0' : '',
        title: 'Verifikasi label terminal',
        description: 'Lengkapi label dan verifikasi bersama QC.',
        priority: 'HIGH',
        status: 'OPEN',
        dueAt: '2026-09-25',
        updatedAt: '2026-09-20T00:00:00.000Z',
        canEdit: false,
      },
    ];
    return {
      demoMode: true,
      projects: demoProjects.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        canEdit: false,
      })),
      operations,
      actions,
    };
  }
  const scope = accessibleProjectWhere(user);
  const [projects, rows, actions] = await Promise.all([
    prisma.project.findMany({
      where: scope,
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, projectManagerId: true },
    }),
    prisma.milestone.findMany({
      where: { project: scope, phase: { in: phases } },
      orderBy: { plannedDate: 'asc' },
      include: {
        project: { select: { code: true, projectManagerId: true } },
        documents: {
          where: { status: 'READY', deletedAt: null },
          select: { id: true, originalName: true, category: true },
        },
      },
    }),
    prisma.actionItem.findMany({
      where: {
        project: scope,
        ...(phases.length ? { milestone: { phase: { in: phases } } } : {}),
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      include: { project: { select: { code: true, projectManagerId: true } } },
    }),
  ]);
  const editable = (manager: string | null) =>
    user.role === 'ADMIN' ||
    (user.role === 'PROJECT_MANAGER' && manager === user.id);
  return {
    demoMode: false,
    projects: projects.map((p) => ({
      ...p,
      canEdit: editable(p.projectManagerId),
    })),
    operations: rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectCode: r.project.code,
      phase: r.phase as OperationPhase,
      title: r.title,
      plannedDate: r.plannedDate.toISOString().slice(0, 10),
      progressPct: r.progressPct.toString(),
      status: r.status,
      notes: r.notes ?? '',
      referenceNo: r.referenceNo ?? '',
      responsible: r.responsible ?? '',
      updatedAt: r.updatedAt.toISOString(),
      documents: r.documents,
      canEdit: editable(r.project.projectManagerId),
    })),
    actions: actions.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectCode: r.project.code,
      milestoneId: r.milestoneId ?? '',
      title: r.title,
      description: r.description ?? '',
      priority: r.priority,
      status: r.status,
      dueAt: r.dueAt?.toISOString().slice(0, 10) ?? '',
      updatedAt: r.updatedAt.toISOString(),
      canEdit: editable(r.project.projectManagerId),
    })),
  };
}
