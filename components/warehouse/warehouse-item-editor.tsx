'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';

import { updateWarehouseItem } from '@/app/actions/warehouse';
import { idleState, type MutationState } from '@/lib/operations/validation';
import type { WarehouseItemRow } from '@/lib/warehouse/types';
import {
  buttonClass,
  Field,
  inputClass,
  MutationFeedback,
} from '@/components/modules/workspace-ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function WarehouseItemEditor({
  item,
  demo,
  onClose,
  onSaved,
}: {
  item: WarehouseItemRow;
  demo: boolean;
  onClose: () => void;
  onSaved: (state: MutationState) => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState(item.code);
  const [description, setDescription] = useState(item.description);
  const [unit, setUnit] = useState(item.unit);
  const [minQty, setMinQty] = useState(item.minQty);
  const [state, action, pending] = useActionState(
    async (previous: MutationState, form: FormData): Promise<MutationState> => {
      const result = await updateWarehouseItem(previous, form);
      if (result.status === 'success') onSaved(result);
      return result;
    },
    idleState,
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-lg sm:p-6"
        showCloseButton={!pending}
      >
        <DialogHeader className="pr-7">
          <DialogTitle className="text-xl font-semibold">
            Edit material gudang
          </DialogTitle>
          <DialogDescription>
            Perbarui kode, nama, satuan, dan batas minimum material gudang.
          </DialogDescription>
        </DialogHeader>

        <form action={action} aria-busy={pending} className="space-y-4">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="updatedAt" value={item.updatedAt} />
          <fieldset disabled={demo || pending} className="space-y-4">
            <Field label="Kode material / SKU">
              <input
                name="code"
                className={inputClass}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                maxLength={80}
                autoFocus
              />
            </Field>
            <Field label="Nama / deskripsi material">
              <input
                name="description"
                className={inputClass}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                minLength={2}
                maxLength={300}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="Satuan">
                  <input
                    name="unit"
                    className={`${inputClass} read-only:bg-slate-100 read-only:text-slate-600`}
                    value={unit}
                    onChange={(event) => setUnit(event.target.value)}
                    readOnly={!item.canEditUnit}
                    aria-describedby="warehouse-edit-unit-help"
                    required
                    maxLength={32}
                  />
                </Field>
                <p
                  id="warehouse-edit-unit-help"
                  className="mt-2 text-xs leading-5 text-slate-500"
                >
                  {item.canEditUnit
                    ? 'Satuan dapat diubah selama stok masih nol dan belum ada riwayat transaksi.'
                    : 'Satuan dikunci karena material sudah memiliki stok atau riwayat transaksi. Jumlah stok dan retur memakai satuan yang tercatat.'}
                </p>
              </div>
              <div>
                <Field label="Batas stok minimum">
                  <input
                    name="minQty"
                    type="number"
                    min="0"
                    step="0.0001"
                    inputMode="decimal"
                    className={inputClass}
                    value={minQty}
                    onChange={(event) => setMinQty(event.target.value)}
                    aria-describedby="warehouse-edit-minimum-help"
                    required
                  />
                </Field>
                <p
                  id="warehouse-edit-minimum-help"
                  className="mt-2 text-xs leading-5 text-slate-500"
                >
                  Stok pada atau di bawah batas ini ditandai untuk restock.
                </p>
              </div>
            </div>
          </fieldset>

          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <span className="font-semibold">
              Stok tersedia: {item.quantity} {item.unit}
            </span>
            <p className="mt-1 text-xs leading-5">
              Untuk pengambilan berikutnya, kode dan satuan gudang harus sesuai
              dengan material pada BoQ yang disetujui.
            </p>
          </div>

          <MutationFeedback state={state} />
          {state.status === 'error' && (
            <button
              type="button"
              onClick={() => {
                router.refresh();
                onClose();
              }}
              disabled={pending}
              className="text-sm font-medium text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Muat ulang daftar
            </button>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={demo || pending}
              className={`${buttonClass} gap-2`}
            >
              <Save aria-hidden="true" className="size-4" />
              {pending ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
