import type { PlanTask } from '@/generated/prisma/client';
export function serializeTask(t: PlanTask) {
  return {
    ...t,
    weight: t.weight.toFixed(2),
    progressPct: t.progressPct.toFixed(2),
    plannedStart: t.plannedStart.toISOString().slice(0, 10),
    plannedFinish: t.plannedFinish.toISOString().slice(0, 10),
    actualStart: t.actualStart?.toISOString().slice(0, 10) ?? '',
    actualFinish: t.actualFinish?.toISOString().slice(0, 10) ?? '',
    predecessorId: t.predecessorId ?? '',
    notes: t.notes ?? '',
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    archivedAt: t.archivedAt?.toISOString() ?? null,
  };
}
