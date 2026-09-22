import { z } from 'zod';
import { operationDate, optionalText } from '../operations/validation.ts';
export const moneyInput = z
  .string()
  .trim()
  .regex(
    /^\d{1,16}(?:\.\d{1,2})?$/,
    'Nilai uang maksimal 16 digit dan 2 desimal.',
  );
export const costSchema = z.object({
  projectId: z.string().min(1).max(128),
  requestId: z.uuid(),
  category: z.enum(['MATERIAL', 'LABOR', 'SUBCONTRACT', 'TRANSPORT', 'OTHER']),
  description: z.string().trim().min(3).max(240),
  referenceNo: optionalText(100),
  amount: moneyInput.refine(
    (v) => Number(v) > 0,
    'Biaya harus lebih besar dari nol.',
  ),
  spentAt: operationDate,
});
export const budgetSchema = z.object({
  projectId: z.string().min(1).max(128),
  updatedAt: z.iso.datetime(),
  poValue: moneyInput,
  budgetValue: moneyInput,
  forecastCost: moneyInput,
});
