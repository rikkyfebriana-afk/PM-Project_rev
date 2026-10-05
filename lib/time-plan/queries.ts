import 'server-only';
import type { CurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { getProjectRegisterData } from '@/lib/projects/queries';
import { dateOnlyInTimeZone } from '@/lib/business-date';
import { serializeTask } from './serialize';
import { summarizeTasks } from './model';
export async function getTimePlanData(user: CurrentUser) {
  const register = await getProjectRegisterData(user);
  const tasks = register.demoMode
    ? []
    : await prisma.planTask.findMany({
        where: { archivedAt: null, project: accessibleProjectWhere(user) },
        orderBy: [{ sortOrder: 'asc' }, { plannedStart: 'asc' }, { id: 'asc' }],
      });
  return {
    demoMode: register.demoMode,
    canActivate: user.role === 'ADMIN',
    today: dateOnlyInTimeZone(
      new Date(),
      process.env.APP_TIME_ZONE || 'Asia/Jakarta',
    )
      .toISOString()
      .slice(0, 10),
    projects: register.projects.map((p) => {
      const rows = tasks.filter((t) => t.projectId === p.id).map(serializeTask);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        customerPoNumber: p.customerPoNumber ?? null,
        clientName: p.clientName,
        plannedStart: p.plannedStart,
        projectManagerName: p.projectManagerName,
        status: p.status,
        updatedAt: p.updatedAt,
        progressPct: p.progressPct,
        timePlanActive: p.timePlanActive ?? false,
        canEdit:
          p.canEdit &&
          !register.demoMode &&
          p.status !== 'CLOSED' &&
          p.status !== 'CANCELLED',
        tasks: rows,
        summary: summarizeTasks(rows),
      };
    }),
  };
}
export type TimePlanData = Awaited<ReturnType<typeof getTimePlanData>>;
