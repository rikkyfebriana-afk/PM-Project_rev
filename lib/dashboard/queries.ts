import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { demoDashboardData } from '@/lib/dashboard/demo-data';
import type { DashboardData, DashboardHealth } from '@/lib/dashboard/types';
import type { CurrentUser } from '@/lib/auth/session';
import { isLocalDemoMode } from '@/lib/auth/session';
import { dateOnlyInTimeZone } from '@/lib/business-date';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { formatRupiahShort } from '@/lib/projects/presentation';

const phaseShort: Record<string, string> = {
  PLANNING: 'PLAN',
  ENGINEERING: 'ENG',
  PROCUREMENT: 'PROC',
  PRODUCTION: 'PROD',
  FAT: 'FAT',
  DELIVERY: 'DLV',
  INSTALLATION: 'INST',
  BAST: 'BAST',
  CLOSED: 'CLS',
};

const healthLabel: Record<string, DashboardHealth> = {
  ON_TRACK: 'On track',
  ATTENTION: 'Attention',
  CRITICAL: 'Critical',
};

function percentage(numerator: Prisma.Decimal, denominator: Prisma.Decimal) {
  if (denominator.isZero()) return 0;
  return numerator.dividedBy(denominator).times(100).toNumber();
}

function cityFromAddress(address: string | null, fallback: string) {
  return address?.split(',')[0]?.trim() || fallback;
}

export async function getDashboardData(
  user: CurrentUser,
): Promise<DashboardData> {
  if (isLocalDemoMode()) return demoDashboardData;

  const projects = await prisma.project.findMany({
    where: accessibleProjectWhere(user),
    orderBy: [{ updatedAt: 'desc' }, { code: 'asc' }],
    include: {
      materials: {
        where: { isActive: true },
        select: {
          status: true,
          requiredQty: true,
          receivedQty: true,
        },
      },
      actionItems: {
        where: { status: { not: 'RESOLVED' } },
        select: { id: true, title: true },
      },
    },
  });
  const active = projects.filter((project) => project.status === 'ACTIVE');
  const closed = projects.filter((project) => project.status === 'CLOSED');
  const projectIds = active.map((project) => project.id);
  const today = dateOnlyInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || 'Asia/Jakarta',
  );
  const thirtyDays = new Date(today);
  thirtyDays.setUTCDate(thirtyDays.getUTCDate() + 30);
  const milestones = projectIds.length
    ? await prisma.milestone.findMany({
        where: {
          projectId: { in: projectIds },
          status: { not: 'COMPLETED' },
          plannedDate: { gte: today, lte: thirtyDays },
        },
        orderBy: { plannedDate: 'asc' },
        take: 4,
        include: { project: { select: { name: true, clientName: true } } },
      })
    : [];

  const sum = (
    field: 'poValue' | 'budgetValue' | 'actualCost' | 'forecastCost',
  ) =>
    active.reduce(
      (total, project) => total.plus(project[field]),
      new Prisma.Decimal(0),
    );
  const poValue = sum('poValue');
  const budget = sum('budgetValue');
  const actual = sum('actualCost');
  const forecast = sum('forecastCost');
  const margin = poValue.isZero()
    ? 0
    : poValue.minus(forecast).dividedBy(poValue).times(100).toNumber();

  const shortageMaterials = active.flatMap((project) =>
    project.materials
      .filter((material) => material.status === 'SHORTAGE')
      .map(() => project.id),
  );
  const shortageProjects = new Set(shortageMaterials);
  const delayed = active.filter(
    (project) =>
      project.plannedFinish &&
      project.plannedFinish < today &&
      project.progressPct.lessThan(100),
  );
  const averageDelay = delayed.length
    ? Math.round(
        delayed.reduce(
          (days, project) =>
            days +
            Math.max(
              0,
              Math.floor(
                (today.getTime() - project.plannedFinish!.getTime()) /
                  86_400_000,
              ),
            ),
          0,
        ) / delayed.length,
      )
    : 0;
  const fatActions = active
    .filter((project) => project.phase === 'FAT')
    .reduce((count, project) => count + project.actionItems.length, 0);
  const budgetRisk = active.filter(
    (project) =>
      !project.budgetValue.isZero() &&
      project.forecastCost
        .dividedBy(project.budgetValue)
        .greaterThanOrEqualTo(0.95),
  ).length;

  return {
    demoMode: false,
    portfolioStatus: [
      {
        label: 'Active',
        value: String(active.length),
        note: 'All live projects',
        tone: 'navy',
      },
      {
        label: 'On track',
        value: String(
          active.filter((project) => project.health === 'ON_TRACK').length,
        ),
        note: 'Healthy delivery',
        tone: 'green',
      },
      {
        label: 'Attention',
        value: String(
          active.filter((project) => project.health === 'ATTENTION').length,
        ),
        note: 'Needs follow-up',
        tone: 'amber',
      },
      {
        label: 'Critical',
        value: String(
          active.filter((project) => project.health === 'CRITICAL').length,
        ),
        note: 'Immediate action',
        tone: 'red',
      },
      {
        label: 'Closed',
        value: String(closed.length),
        note: 'Accessible records',
        tone: 'slate',
      },
    ],
    finance: [
      {
        label: 'PO Value',
        value: formatRupiahShort(poValue.toString()),
        change: 'Active portfolio',
        direction: 'flat',
      },
      {
        label: 'Budget',
        value: formatRupiahShort(budget.toString()),
        change: `${percentage(budget, poValue).toFixed(1)}% of PO`,
        direction: 'flat',
      },
      {
        label: 'Actual',
        value: formatRupiahShort(actual.toString()),
        change: `${percentage(actual, budget).toFixed(1)}% used`,
        direction: 'flat',
      },
      {
        label: 'Forecast',
        value: formatRupiahShort(forecast.toString()),
        change: `${formatRupiahShort(budget.minus(forecast).abs().toString())} ${forecast.lessThanOrEqualTo(budget) ? 'under' : 'over'}`,
        direction: forecast.lessThanOrEqualTo(budget) ? 'up' : 'down',
      },
      {
        label: 'Margin',
        value: `${margin.toFixed(1)}%`,
        change: 'Forecast gross margin',
        direction: margin >= 0 ? 'up' : 'down',
      },
    ],
    alerts: [
      {
        title: 'Material shortage',
        count: shortageMaterials.length,
        detail: `${shortageProjects.size} projects impacted`,
        tone: 'red',
      },
      {
        title: 'Delayed project',
        count: delayed.length,
        detail: delayed.length
          ? `Avg. ${averageDelay} days behind`
          : 'No overdue projects',
        tone: 'red',
      },
      {
        title: 'FAT punch list',
        count: fatActions,
        detail: `${fatActions} open action items`,
        tone: 'amber',
      },
      {
        title: 'Budget risk',
        count: budgetRisk,
        detail: 'Forecast at or over 95%',
        tone: 'amber',
      },
    ],
    mapProjects: active
      .filter(
        (project) => project.latitude !== null && project.longitude !== null,
      )
      .slice(0, 30)
      .map((project) => ({
        id: project.code,
        city: cityFromAddress(project.address, project.code),
        project: project.name,
        latitude: project.latitude!.toNumber(),
        longitude: project.longitude!.toNumber(),
        tone:
          project.health === 'CRITICAL'
            ? 'red'
            : project.health === 'ATTENTION'
              ? 'amber'
              : 'green',
      })),
    milestones: milestones.map((milestone) => ({
      day: String(milestone.plannedDate.getUTCDate()).padStart(2, '0'),
      month: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        timeZone: 'UTC',
      }).format(milestone.plannedDate),
      label: milestone.title,
      meta: milestone.project.clientName ?? milestone.project.name,
      state:
        milestone.status === 'AT_RISK' || milestone.status === 'OVERDUE'
          ? 'risk'
          : 'upcoming',
    })),
    projects: projects
      .filter((project) => project.status !== 'CANCELLED')
      .map((project) => {
        const readiness = project.materials
          .filter((material) => material.requiredQty.gt(0))
          .map((material) =>
            Prisma.Decimal.min(
              1,
              material.receivedQty.dividedBy(material.requiredQty),
            ).times(100),
          );
        const gm = project.poValue.isZero()
          ? 0
          : project.poValue
              .minus(project.forecastCost)
              .dividedBy(project.poValue)
              .times(100)
              .toNumber();
        return {
          id: project.code,
          name: project.name,
          city: cityFromAddress(project.address, '—'),
          progress: project.progressPct.toNumber(),
          material: readiness.length
            ? readiness
                .reduce(
                  (total, value) => total.plus(value),
                  new Prisma.Decimal(0),
                )
                .dividedBy(readiness.length)
                .toDecimalPlaces(1)
                .toNumber()
            : 0,
          phase: phaseShort[project.phase] ?? project.phase,
          finish: project.plannedFinish
            ? new Intl.DateTimeFormat('en-GB', {
                day: '2-digit',
                month: 'short',
                timeZone: 'UTC',
              }).format(project.plannedFinish)
            : '—',
          health: healthLabel[project.health],
          gm,
        };
      }),
  };
}
