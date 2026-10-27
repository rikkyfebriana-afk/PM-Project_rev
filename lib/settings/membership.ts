import { z } from 'zod';

export const membershipSchema = z.object({
  projectIds: z.array(z.string().min(1).max(128)).min(1).max(1000)
    .transform(ids => [...new Set(ids)].sort()),
  userId: z.string().min(1).max(128),
  operation: z.enum(['add', 'remove']),
  confirmBulkRemove: z.boolean().default(false),
}).refine(value => value.operation !== 'remove' || value.projectIds.length < 2 || value.confirmBulkRemove, {
  message: 'Konfirmasi pencabutan akses untuk beberapa proyek terlebih dahulu.',
});
