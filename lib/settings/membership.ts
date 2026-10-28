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

export class MembershipInputError extends Error {}

export function membershipErrorCode(error:unknown) {
  if(typeof error==='object'&&error!==null&&'code' in error&&typeof error.code==='string'&&/^P\d{4}$/.test(error.code)) return error.code;
  return 'UNKNOWN';
}

export function membershipErrorMessage(error:unknown) {
  if(error instanceof MembershipInputError) return error.message;
  const code=membershipErrorCode(error);
  if(code==='P2028'||code==='P2024') return 'Penyimpanan melewati batas waktu. Tidak ada perubahan yang disimpan. Muat ulang halaman lalu coba lagi.';
  if(code==='P2034') return 'Ada perubahan bersamaan. Tidak ada perubahan yang disimpan. Muat ulang halaman lalu coba lagi.';
  if(code==='P1001'||code==='P1002') return 'Koneksi database belum tersedia. Coba kembali beberapa saat lagi.';
  return 'Akses belum dapat diperbarui. Muat ulang halaman lalu coba lagi; bila tetap gagal, hubungi Admin.';
}
