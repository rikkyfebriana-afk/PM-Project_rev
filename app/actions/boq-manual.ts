'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { lockEditableProject } from '@/lib/operations/transaction';
import type { MutationState } from '@/lib/operations/validation';
import { validateBoqImportPayload } from '@/lib/boq/validation';

export async function saveManualBoq(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role === 'VIEWER' || isLocalDemoMode())
    return { status: 'error', message: 'Akses input manual BoQ ditolak.' };
  const request = z
    .object({
      projectId: z.string().min(1).max(128),
      expectedVersion: z.coerce.number().int().min(0),
      manualRows: z.string().max(250000),
      confirm: z.literal('yes'),
    })
    .safeParse(Object.fromEntries(form));
  if (!request.success)
    return {
      status: 'error',
      message:
        'Data tidak lengkap. Centang konfirmasi revisi dan periksa input.',
    };
  let rows: unknown;
  try {
    rows = JSON.parse(request.data.manualRows);
  } catch {
    return { status: 'error', message: 'Format baris BoQ tidak valid.' };
  }
  if (!Array.isArray(rows) || rows.length > 200)
    return {
      status: 'error',
      message: 'Input manual maksimal 200 baris per revisi.',
    };
  const parsed = validateBoqImportPayload({
    projectId: request.data.projectId,
    fileName: 'Input manual web',
    sheetName: 'Manual',
    rows,
  });
  if (!parsed.success)
    return {
      status: 'error',
      message: parsed.issues
        .slice(0, 10)
        .map((i) => `${i.row ? `Baris ${i.row}: ` : ''}${i.message}`)
        .join(' '),
    };
  try {
    const message = await prisma.$transaction(
      async (tx) => {
        const project = await lockEditableProject(
          tx,
          parsed.data.projectId,
          user,
        );
        if (project.status === 'CLOSED' || project.status === 'CANCELLED')
          throw new Error('Buka kembali proyek sebelum membuat BoQ baru.');
        const duplicate = await tx.boq.findFirst({
          where: { projectId: project.id, sourceHash: parsed.data.sourceHash },
          select: { version: true },
        });
        if (duplicate)
          return `Data yang sama sudah tersimpan sebagai BoQ versi ${duplicate.version}. Tidak dibuat duplikat.`;
        const latest = await tx.boq.aggregate({
          where: { projectId: project.id },
          _max: { version: true },
        });
        const version = latest._max.version ?? 0;
        if (version !== request.data.expectedVersion)
          throw new Error(
            'Revisi BoQ sudah berubah. Muat ulang halaman dan periksa revisi terbaru sebelum menyimpan.',
          );
        const prior = await tx.boq.updateMany({
          where: { projectId: project.id, status: 'DRAFT' },
          data: { status: 'SUPERSEDED' },
        });
        const boq = await tx.boq.create({
          data: {
            projectId: project.id,
            createdById: user.id,
            version: version + 1,
            status: 'DRAFT',
            sourceHash: parsed.data.sourceHash,
            sourceFileName: 'Input manual web',
            sourceSheetName: 'Manual',
          },
        });
        await tx.boqItem.createMany({
          data: parsed.data.rows.map((r, i) => ({
            ...r,
            boqId: boq.id,
            sortOrder: i,
          })),
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            projectId: project.id,
            entityType: 'Boq',
            entityId: boq.id,
            action: 'BOQ_MANUAL_CREATED',
            metadata: {
              version: boq.version,
              source: 'MANUAL_WEB',
              itemCount: parsed.data.rows.length,
              totalValue: parsed.data.totalValue,
              sourceHash: parsed.data.sourceHash,
              supersededDraftCount: prior.count,
            },
          },
        });
        return `BoQ manual versi ${boq.version} tersimpan sebagai Draft (${parsed.data.rows.length} item). Menunggu approval Admin.`;
      },
      { timeout: 15000 },
    );
    revalidatePath('/boq');
    return { status: 'success', message };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error && !('code' in error)
          ? error.message
          : 'BoQ belum dapat disimpan. Muat ulang dan coba lagi.',
    };
  }
}
