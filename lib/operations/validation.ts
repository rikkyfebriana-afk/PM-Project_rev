import { z } from 'zod';

export const operationPhases = [
  'PRODUCTION',
  'FAT',
  'DELIVERY',
  'INSTALLATION',
  'BAST',
] as const;
export type OperationPhase = (typeof operationPhases)[number];
export const operationDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  }, 'Tanggal tidak valid.');
export const optionalText = (length: number) =>
  z
    .string()
    .trim()
    .max(length)
    .transform((v) => v || null);
export const operationSchema = z
  .object({
    id: z.string().max(128),
    updatedAt: z.string().max(40),
    projectId: z.string().min(1).max(128),
    phase: z.enum(operationPhases),
    title: z.string().trim().min(3).max(180),
    plannedDate: operationDate,
    progressPct: z
      .string()
      .regex(/^\d{1,3}(?:\.\d{1,2})?$/)
      .refine((v) => Number(v) <= 100),
    status: z.enum(['UPCOMING', 'AT_RISK', 'OVERDUE', 'COMPLETED']),
    notes: optionalText(4000),
    referenceNo: optionalText(100),
    responsible: optionalText(120),
  })
  .superRefine((v, ctx) => {
    if ((v.status === 'COMPLETED') !== (Number(v.progressPct) === 100))
      ctx.addIssue({
        code: 'custom',
        path: ['progressPct'],
        message:
          'Status selesai harus memiliki progress 100%; progress 100% harus berstatus selesai.',
      });
    if (v.id && !z.iso.datetime().safeParse(v.updatedAt).success)
      ctx.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'Versi data tidak valid. Muat ulang halaman.',
      });
  });
export const actionSchema = z
  .object({
    id: z.string().max(128),
    updatedAt: z.string().max(40),
    projectId: z.string().min(1).max(128),
    milestoneId: optionalText(128),
    title: z.string().trim().min(3).max(180),
    description: optionalText(4000),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED']),
    dueAt: z.union([z.literal(''), operationDate]),
  })
  .superRefine((v, ctx) => {
    if (v.id && !z.iso.datetime().safeParse(v.updatedAt).success)
      ctx.addIssue({ code: 'custom', message: 'Versi data tidak valid.' });
  });
export type MutationState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};
export const idleState: MutationState = { status: 'idle', message: '' };
