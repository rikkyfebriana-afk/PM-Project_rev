import { z } from 'zod';

import {
  projectHealthValues,
  projectPhases,
  projectStatuses,
} from './types.ts';

const emptyToNull = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const optionalText = (maximum: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(maximum).nullable());

const money = z
  .string()
  .trim()
  .regex(
    /^\d{1,16}(?:\.\d{1,2})?$/,
    'Gunakan angka positif, maksimal 2 desimal.',
  );

const percentage = z
  .string()
  .trim()
  .regex(/^\d{1,3}(?:\.\d{1,2})?$/, 'Gunakan angka 0–100, maksimal 2 desimal.')
  .refine((value) => Number(value) <= 100, 'Nilai tidak boleh lebih dari 100.');

const optionalCoordinate = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .regex(/^-?\d{1,3}(?:\.\d{1,6})?$/, 'Koordinat maksimal 6 desimal.')
    .nullable(),
);

const optionalDate = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid.')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, 'Tanggal kalender tidak valid.')
    .nullable(),
);

const projectFieldsSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  updatedAt: z.string().datetime().optional(),
  code: z
    .string()
    .trim()
    .min(2, 'Kode minimal 2 karakter.')
    .max(30, 'Kode maksimal 30 karakter.')
    .transform((value) => value.toUpperCase())
    .refine(
      (value) => /^[A-Z0-9][A-Z0-9._/-]*$/.test(value),
      'Kode hanya boleh berisi huruf, angka, titik, garis miring, dan tanda hubung.',
    ),
  name: z.string().trim().min(3, 'Nama minimal 3 karakter.').max(160),
  clientName: optionalText(160),
  status: z.enum(projectStatuses),
  health: z.enum(projectHealthValues),
  phase: z.enum(projectPhases),
  progressPct: percentage,
  poValue: money,
  budgetValue: money,
  actualCost: money,
  forecastCost: money,
  address: optionalText(500),
  latitude: optionalCoordinate,
  longitude: optionalCoordinate,
  plannedStart: optionalDate,
  plannedFinish: optionalDate,
  actualFinish: optionalDate,
  projectManagerId: z.preprocess(
    emptyToNull,
    z.string().trim().max(100).nullable(),
  ),
});

export const projectFormSchema = projectFieldsSchema.superRefine(
  (value, context) => {
    const hasLatitude = value.latitude !== null;
    const hasLongitude = value.longitude !== null;
    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: 'custom',
        path: [hasLatitude ? 'longitude' : 'latitude'],
        message: 'Latitude dan longitude harus diisi berpasangan.',
      });
    }

    if (value.latitude !== null && Math.abs(Number(value.latitude)) > 90) {
      context.addIssue({
        code: 'custom',
        path: ['latitude'],
        message: 'Latitude harus berada di antara -90 dan 90.',
      });
    }
    if (value.longitude !== null && Math.abs(Number(value.longitude)) > 180) {
      context.addIssue({
        code: 'custom',
        path: ['longitude'],
        message: 'Longitude harus berada di antara -180 dan 180.',
      });
    }

    if (
      value.plannedStart &&
      value.plannedFinish &&
      value.plannedStart > value.plannedFinish
    ) {
      context.addIssue({
        code: 'custom',
        path: ['plannedFinish'],
        message: 'Target selesai tidak boleh sebelum tanggal mulai.',
      });
    }

    const isClosed = value.status === 'CLOSED' || value.phase === 'CLOSED';
    if (isClosed && (value.status !== 'CLOSED' || value.phase !== 'CLOSED')) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Status dan fase harus sama-sama Closed.',
      });
    }
    if (isClosed && Number(value.progressPct) !== 100) {
      context.addIssue({
        code: 'custom',
        path: ['progressPct'],
        message: 'Project Closed harus memiliki progress 100%.',
      });
    }
    if (isClosed && !value.actualFinish) {
      context.addIssue({
        code: 'custom',
        path: ['actualFinish'],
        message: 'Tanggal selesai aktual wajib untuk project Closed.',
      });
    }
  },
);

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
