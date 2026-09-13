import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';
import { isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { demoProjects } from '@/lib/projects/demo-data';
import type { ProjectRecord, ProjectRegisterData } from '@/lib/projects/types';

function toDateInput(date: Date | null) {
  return date?.toISOString().slice(0, 10) ?? null;
}

function metrics(projects: ProjectRecord[]) {
  const activeProjects = projects.filter(
    (project) => project.status === 'ACTIVE',
  );
  return {
    active: activeProjects.length,
    needsAttention: activeProjects.filter(
      (project) => project.health !== 'ON_TRACK',
    ).length,
    poValue: activeProjects
      .reduce(
        (sum, project) => sum.plus(project.poValue),
        new Prisma.Decimal(0),
      )
      .toString(),
  };
}

export async function getProjectRegisterData(
  user: CurrentUser,
): Promise<ProjectRegisterData> {
  const permissions = {
    canCreate: user.role === 'ADMIN',
    canAssignManager: user.role === 'ADMIN',
    canArchive: user.role === 'ADMIN',
    canEdit: user.role !== 'VIEWER',
  };

  if (isLocalDemoMode()) {
    return {
      projects: demoProjects,
      managers: [
        { id: 'demo-user', displayName: 'Andi Pratama', username: 'demo' },
      ],
      metrics: metrics(demoProjects),
      demoMode: true,
      permissions,
    };
  }

  const [rows, managers] = await Promise.all([
    prisma.project.findMany({
      where: accessibleProjectWhere(user),
      orderBy: [{ updatedAt: 'desc' }, { code: 'asc' }],
      include: {
        projectManager: {
          select: { id: true, displayName: true },
        },
        _count: {
          select: {
            members: true,
            materials: true,
            documents: { where: { deletedAt: null } },
            actionItems: { where: { status: { not: 'RESOLVED' } } },
          },
        },
      },
    }),
    user.role === 'ADMIN'
      ? prisma.user.findMany({
          where: {
            isActive: true,
            role: { in: ['ADMIN', 'PROJECT_MANAGER'] },
          },
          orderBy: { displayName: 'asc' },
          select: { id: true, displayName: true, username: true },
        })
      : Promise.resolve([]),
  ]);

  const projects: ProjectRecord[] = rows.map((project) => ({
    id: project.id,
    code: project.code,
    name: project.name,
    clientName: project.clientName,
    status: project.status,
    health: project.health,
    phase: project.phase,
    progressPct: project.progressPct.toNumber(),
    poValue: project.poValue.toString(),
    budgetValue: project.budgetValue.toString(),
    actualCost: project.actualCost.toString(),
    forecastCost: project.forecastCost.toString(),
    address: project.address,
    latitude: project.latitude?.toNumber() ?? null,
    longitude: project.longitude?.toNumber() ?? null,
    plannedStart: toDateInput(project.plannedStart),
    plannedFinish: toDateInput(project.plannedFinish),
    actualFinish: toDateInput(project.actualFinish),
    projectManagerId: project.projectManagerId,
    projectManagerName: project.projectManager?.displayName ?? null,
    membersCount: project._count.members,
    materialsCount: project._count.materials,
    documentsCount: project._count.documents,
    actionsCount: project._count.actionItems,
    updatedAt: project.updatedAt.toISOString(),
    canEdit:
      user.role === 'ADMIN' ||
      (user.role === 'PROJECT_MANAGER' && project.projectManagerId === user.id),
  }));

  return {
    projects,
    managers,
    metrics: metrics(projects),
    demoMode: false,
    permissions,
  };
}
