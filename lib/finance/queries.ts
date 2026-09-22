import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getProjectRegisterData } from '@/lib/projects/queries';
import { accessibleProjectWhere } from '@/lib/projects/access';
export async function getFinanceData(user: CurrentUser) {
  const register = await getProjectRegisterData(user);
  const rows = register.demoMode
    ? []
    : await prisma.costEntry.findMany({
        where: { project: accessibleProjectWhere(user) },
        orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }],
        include: { project: { select: { code: true } } },
      });
  const sum = (
    field: 'poValue' | 'budgetValue' | 'actualCost' | 'forecastCost',
  ) =>
    register.projects
      .reduce((s, p) => s.plus(p[field]), new Prisma.Decimal(0))
      .toFixed(2);
  return {
    ...register,
    requestId: randomUUID(),
    totals: {
      poValue: sum('poValue'),
      budgetValue: sum('budgetValue'),
      actualCost: sum('actualCost'),
      forecastCost: sum('forecastCost'),
    },
    canApprove: user.role === 'ADMIN',
    entries: rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectCode: r.project.code,
      category: r.category,
      description: r.description,
      referenceNo: r.referenceNo,
      amount: r.amount.toString(),
      spentAt: r.spentAt.toISOString().slice(0, 10),
      voided: !!r.voidedAt,
      voidReason: r.voidReason,
    })),
  };
}
export type FinanceData = Awaited<ReturnType<typeof getFinanceData>>;
