'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { hasFullAccess } from '@/lib/auth/roles';
import type { MutationState } from '@/lib/operations/validation';
import { WarehouseError } from '@/lib/warehouse/validation';
import {
  MaterialOrderError,
  materialOrderCreateSchema,
  materialOrderUpdateSchema,
  materialOrderVersionSchema,
  materialOrderCancelSchema,
  materialOrderReceiptSchema,
} from '@/lib/material-orders/validation';
import {
  createMaterialOrderTransaction,
  updateMaterialOrderTransaction,
  confirmMaterialOrderTransaction,
  cancelMaterialOrderTransaction,
  receiveMaterialOrderTransaction,
} from '@/lib/material-orders/transactions';

const denied: MutationState = {
  status: 'error',
  message: 'Pesanan material hanya dapat dikelola Admin atau Project Manager.',
};
function refresh() {
  for (const path of [
    '/materials',
    '/warehouse',
    '/boq',
    '/boq/materials',
    '/dashboard',
    '/actions',
    '/reports',
  ])
    revalidatePath(path);
}
function failure(error: unknown): MutationState {
  if (error instanceof MaterialOrderError || error instanceof WarehouseError)
    return { status: 'error', message: error.message };
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'UNKNOWN';
  console.error('Material order transaction failed', { code });
  if (code === 'P2002')
    return {
      status: 'error',
      message:
        'Material ini sudah memiliki pesanan aktif atau nomor permintaan sudah dipakai. Muat ulang daftar.',
    };
  if (['P2028', 'P2034', 'P2024'].includes(code))
    return {
      status: 'error',
      message:
        'Pesanan belum tersimpan karena antrean atau perubahan bersamaan. Coba simpan kembali dengan form yang sama.',
    };
  return {
    status: 'error',
    message:
      'Pesanan material belum dapat disimpan. Coba kembali dengan form yang sama.',
  };
}

export async function createMaterialOrder(
  _: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || !hasFullAccess(user.role) || isLocalDemoMode()) return denied;
  const parsed = materialOrderCreateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message:
        parsed.error.issues[0]?.message ?? 'Periksa data pesanan material.',
    };
  try {
    const result = await createMaterialOrderTransaction(user, parsed.data);
    refresh();
    return {
      status: 'success',
      message: result.duplicate
        ? 'Draft pesanan sudah tercatat; tidak dibuat dua kali.'
        : 'Draft pesanan material dibuat. Lengkapi supplier dan nomor order sebelum menandai sudah dipesan.',
    };
  } catch (error) {
    return failure(error);
  }
}

export async function updateMaterialOrder(
  _: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || !hasFullAccess(user.role) || isLocalDemoMode()) return denied;
  const parsed = materialOrderUpdateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message:
        parsed.error.issues[0]?.message ??
        'Periksa data draft dan muat ulang bila form sudah lama dibuka.',
    };
  try {
    await updateMaterialOrderTransaction(user, parsed.data);
    refresh();
    return {
      status: 'success',
      message: 'Draft pesanan material berhasil diperbarui.',
    };
  } catch (error) {
    return failure(error);
  }
}

export async function confirmMaterialOrder(
  _: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || !hasFullAccess(user.role) || isLocalDemoMode()) return denied;
  const parsed = materialOrderVersionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Versi pesanan tidak valid. Muat ulang daftar.',
    };
  try {
    await confirmMaterialOrderTransaction(user, parsed.data);
    refresh();
    return {
      status: 'success',
      message:
        'Pesanan ditandai sudah dipesan. Stok gudang bertambah saat penerimaan dicatat.',
    };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelMaterialOrder(
  _: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || !hasFullAccess(user.role) || isLocalDemoMode()) return denied;
  const parsed = materialOrderCancelSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message:
        parsed.error.issues[0]?.message ??
        'Isi alasan pembatalan dan muat ulang bila form sudah lama dibuka.',
    };
  try {
    await cancelMaterialOrderTransaction(user, parsed.data);
    refresh();
    return {
      status: 'success',
      message:
        'Sisa pesanan dibatalkan. Barang yang sudah diterima tetap tercatat di stok dan riwayat gudang.',
    };
  } catch (error) {
    return failure(error);
  }
}

export async function receiveMaterialOrder(
  _: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || !hasFullAccess(user.role) || isLocalDemoMode()) return denied;
  const parsed = materialOrderReceiptSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: 'error',
      message:
        parsed.error.issues[0]?.message ??
        'Periksa bukti dan jumlah penerimaan.',
    };
  try {
    const result = await receiveMaterialOrderTransaction(user, parsed.data);
    refresh();
    return {
      status: 'success',
      message: result.duplicate
        ? 'Penerimaan sudah tercatat; stok tidak ditambahkan dua kali.'
        : 'Penerimaan tercatat. Stok gudang dan status pesanan diperbarui bersama.',
    };
  } catch (error) {
    return failure(error);
  }
}
