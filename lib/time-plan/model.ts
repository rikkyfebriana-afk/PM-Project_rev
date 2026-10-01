import { z } from 'zod';
export const planPhases = [
  'PLANNING',
  'ENGINEERING',
  'PROCUREMENT',
  'PRODUCTION',
  'FAT',
  'DELIVERY',
  'INSTALLATION',
  'BAST',
] as const;
export const phaseLabels: Record<string, string> = {
  PLANNING: 'Perencanaan',
  ENGINEERING: 'Engineering',
  PROCUREMENT: 'Pengadaan',
  PRODUCTION: 'Produksi',
  FAT: 'FAT',
  DELIVERY: 'Delivery',
  INSTALLATION: 'Instalasi',
  BAST: 'BAST',
};
const pct = z
  .string()
  .trim()
  .regex(/^\d{1,3}(?:\.\d{1,2})?$/, 'Persentase maksimal 2 desimal.')
  .refine((v) => Number(v) <= 100, 'Persentase maksimal 100.');
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Tanggal kalender tidak valid.');
export const taskSchema = z
  .object({
    projectId: z.string().min(1).max(100),
    updatedAt: z.string().datetime(),
    id: z.string().max(100).default(''),
    phase: z.enum(planPhases),
    title: z.string().trim().min(3).max(200),
    responsible: z.string().trim().min(2).max(160),
    sortOrder: z.coerce.number().int().min(0).max(9999),
    weight: pct.refine((v) => Number(v) > 0, 'Bobot harus lebih dari 0.'),
    progressPct: pct,
    plannedStart: date,
    plannedFinish: date,
    actualStart: z.union([date, z.literal('')]),
    actualFinish: z.union([date, z.literal('')]),
    predecessorId: z.string().max(100),
    notes: z.string().trim().max(2000),
  })
  .superRefine((v, c) => {
    const fail = (message: string) => c.addIssue({ code: 'custom', message });
    if (v.plannedStart > v.plannedFinish)
      fail('Tanggal selesai rencana harus sesudah atau sama dengan mulai.');
    if (v.actualFinish && (!v.actualStart || v.actualFinish < v.actualStart))
      fail('Tanggal aktual tidak berurutan.');
    if (Number(v.progressPct) > 0 && !v.actualStart)
      fail('Isi mulai aktual untuk pekerjaan yang sudah berjalan.');
    if ((Number(v.progressPct) === 100) !== Boolean(v.actualFinish))
      fail('Progres 100% harus disertai selesai aktual, dan sebaliknya.');
  });
export type TaskValue = {
  id: string;
  phase: string;
  title: string;
  weight: string;
  progressPct: string;
  plannedStart: string;
  plannedFinish: string;
  actualStart: string;
  actualFinish: string;
  predecessorId: string;
};
export function scaled(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
const display = (n: bigint) =>
  `${n / 100n}.${String(n % 100n).padStart(2, '0')}`;
export function summarizeTasks(tasks: TaskValue[]) {
  const total = tasks.reduce((s, t) => s + scaled(t.weight), 0n);
  const earned = tasks.reduce(
    (s, t) => s + scaled(t.weight) * scaled(t.progressPct),
    0n,
  );
  let progress = (earned + 5000n) / 10000n;
  if (earned < 100000000n && progress >= 10000n) progress = 9999n;
  return {
    totalWeight: display(total),
    progress: display(progress),
    ready: tasks.length > 0 && total === 10000n,
    stages: planPhases
      .map((phase) => {
        const group = tasks.filter((t) => t.phase === phase);
        const weight = group.reduce((s, t) => s + scaled(t.weight), 0n);
        const e = group.reduce(
          (s, t) => s + scaled(t.weight) * scaled(t.progressPct),
          0n,
        );
        let stageProgress = weight ? (e + weight / 2n) / weight : 0n;
        if (e < weight * 10000n && stageProgress >= 10000n)
          stageProgress = 9999n;
        return {
          phase,
          weight: display(weight),
          progress: display(stageProgress),
          count: group.length,
        };
      })
      .filter((s) => s.count > 0),
  };
}
export function validatePlan(tasks: TaskValue[], today: string) {
  if (tasks.length > 500) throw new Error('Maksimal 500 pekerjaan per proyek.');
  if (tasks.reduce((s, t) => s + scaled(t.weight), 0n) > 10000n)
    throw new Error(
      'Total bobot tidak boleh melebihi 100%. Kurangi bobot pekerjaan lain terlebih dahulu.',
    );
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const t of tasks) {
    if (t.actualStart > today || t.actualFinish > today)
      throw new Error('Tanggal aktual tidak boleh di masa depan.');
    const seen = new Set([t.id]);
    let next = t.predecessorId;
    while (next) {
      if (seen.has(next))
        throw new Error('Hubungan pendahulu membentuk siklus.');
      seen.add(next);
      const p = byId.get(next);
      if (!p)
        throw new Error(
          'Pendahulu harus pekerjaan aktif pada proyek yang sama.',
        );
      next = p.predecessorId;
    }
    if (t.predecessorId) {
      const p = byId.get(t.predecessorId)!;
      if (t.plannedStart < p.plannedFinish)
        throw new Error(
          'Rencana mulai harus sesudah atau sama dengan selesai pendahulu.',
        );
      if (
        (Number(t.progressPct) > 0 || Boolean(t.actualStart)) &&
        (Number(p.progressPct) !== 100 ||
          !p.actualFinish ||
          t.actualStart < p.actualFinish)
      )
        throw new Error(
          'Selesaikan pendahulu dahulu dan periksa tanggal mulai aktual pekerjaan penerus.',
        );
    }
  }
}
export function taskStatus(t: TaskValue, today: string) {
  return Number(t.progressPct) === 100
    ? 'Selesai'
    : t.plannedFinish < today
      ? 'Terlambat'
      : Number(t.progressPct) > 0 || Boolean(t.actualStart)
        ? 'Berjalan'
        : 'Belum mulai';
}
