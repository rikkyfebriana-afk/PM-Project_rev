'use server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { lockEditableProject } from '@/lib/operations/transaction';
import type { MutationState } from '@/lib/operations/validation';
import { customerPoSchema } from '@/lib/customer-po/validation';
import { dateOnlyInTimeZone } from '@/lib/business-date';

export async function saveCustomerPo(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN' || isLocalDemoMode())
    return {
      status: 'error',
      message: 'Hanya administrator yang dapat memperbarui PO Customer.',
    };
  const parsed = customerPoSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: parsed.error.issues.map((i) => i.message).join(' '),
    };
  try {
    const today = dateOnlyInTimeZone(
      new Date(),
      process.env.APP_TIME_ZONE || 'Asia/Jakarta',
    )
      .toISOString()
      .slice(0, 10);
    if (parsed.data.customerPoCompletedDate > today)
      throw new Error('Tanggal selesai PO tidak boleh di masa depan.');
    await prisma.$transaction(async (tx) => {
      const { projectId, updatedAt, ...fields } = parsed.data;
      const p = await lockEditableProject(tx, projectId, user);
      if (p.updatedAt.toISOString() !== updatedAt)
        throw new Error(
          'Data proyek sudah berubah. Muat ulang sebelum menyimpan PO.',
        );
      // Update the existing project's value, never add it to previous revenue.
      await tx.project.update({
        where: { id: p.id },
        data: {
          ...fields,
          customerPoDate: new Date(`${fields.customerPoDate}T00:00:00Z`),
          customerPoCompletedDate: fields.customerPoCompletedDate
            ? new Date(`${fields.customerPoCompletedDate}T00:00:00Z`)
            : null,
          customerPoDelivery: fields.customerPoDelivery
            ? new Date(`${fields.customerPoDelivery}T00:00:00Z`)
            : null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId: p.id,
          entityType: 'CustomerPO',
          entityId: p.id,
          action: p.customerPoNumber
            ? 'CUSTOMER_PO_UPDATED'
            : 'CUSTOMER_PO_CREATED',
          metadata: {
            before: {
              customerPoNumber: p.customerPoNumber,
              customerPoCompletedDate:
                p.customerPoCompletedDate?.toISOString().slice(0, 10) ?? '',
              customerPoStatus: p.customerPoStatus,
              poValue: p.poValue.toString(),
              customerPoTax: p.customerPoTax.toString(),
              clientName: p.clientName,
              customerPoDate:
                p.customerPoDate?.toISOString().slice(0, 10) ?? '',
              customerPoDelivery:
                p.customerPoDelivery?.toISOString().slice(0, 10) ?? '',
              customerPoDescription: p.customerPoDescription,
              customerPoNotes: p.customerPoNotes,
            },
            after: fields,
          },
        },
      });
    });
    for (const path of [
      '/customer-po',
      '/projects',
      '/dashboard',
      '/finance',
      '/reports',
    ])
      revalidatePath(path);
    return {
      status: 'success',
      message:
        'PO Customer tersimpan. Nilai proyek dan dashboard telah disinkronkan.',
    };
  } catch (e) {
    return {
      status: 'error',
      message:
        e instanceof Error && !('code' in e)
          ? e.message
          : 'PO belum dapat disimpan. Silakan coba lagi.',
    };
  }
}
