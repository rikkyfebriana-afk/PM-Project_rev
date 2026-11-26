'use client';

import { useActionState, useState } from 'react';
import {
  cancelMaterialOrder,
  confirmMaterialOrder,
  createMaterialOrder,
  receiveMaterialOrder,
  updateMaterialOrder,
} from '@/app/actions/material-orders';
import type {
  MaterialOrderRow,
  OrderStockRow,
} from '@/lib/material-orders/types';
import { idleState, type MutationState } from '@/lib/operations/validation';
import { cn } from '@/lib/utils';
import { formatOrderQuantity } from './format-quantity';
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

export type OrderDialogSelection =
  | { mode: 'create'; item: OrderStockRow }
  | {
      mode: 'edit' | 'confirm' | 'receive' | 'cancel';
      order: MaterialOrderRow;
    };

export function MaterialOrderForm({
  selection,
  demo,
  requestId,
  actorName,
  onClose,
  onSaved,
}: {
  selection: OrderDialogSelection;
  demo: boolean;
  requestId: string;
  actorName: string;
  onClose: () => void;
  onSaved: (state: MutationState) => void;
}) {
  const mode = selection.mode;
  const order = 'order' in selection ? selection.order : null;
  const item = selection.mode === 'create' ? selection.item : null;
  const [fields, setFields] = useState(() => ({
    quantity: mode === 'edit' ? (order?.quantity ?? '') : '',
    supplier: order?.supplier ?? '',
    referenceNo: mode === 'edit' ? (order?.referenceNo ?? '') : '',
    expectedArrival: order?.expectedArrival ?? '',
    notes: mode === 'edit' ? (order?.notes ?? '') : '',
    recipient: actorName,
    reason: '',
  }));
  const updateField = (name: keyof typeof fields, value: string) =>
    setFields((previous) => ({ ...previous, [name]: value }));
  const actionForMode = {
    create: createMaterialOrder,
    edit: updateMaterialOrder,
    confirm: confirmMaterialOrder,
    receive: receiveMaterialOrder,
    cancel: cancelMaterialOrder,
  }[mode];
  const [state, action, pending] = useActionState(
    async (previous: MutationState, form: FormData) => {
      const result = await actionForMode(previous, form);
      if (result.status === 'success') onSaved(result);
      return result;
    },
    idleState,
  );
  const isDraft = mode === 'create' || mode === 'edit';
  const titles = {
    create: 'Buat draft order material',
    edit: 'Edit draft order material',
    confirm: 'Tandai sudah dipesan',
    receive: 'Terima material ke gudang',
    cancel: 'Batalkan sisa order',
  };
  const descriptions = {
    create:
      'Isi jumlah pembelian yang dibutuhkan. Menyimpan draft belum menambah stok atau mengirim pesanan ke supplier.',
    edit: 'Perbarui rencana pembelian sebelum order ditandai sudah dipesan.',
    confirm:
      'Gunakan setelah pemesanan ke supplier dilakukan. Aplikasi hanya mencatat status order dan tidak mengirim pesanan.',
    receive:
      'Catat barang yang benar-benar diterima. Stok gudang bertambah setelah penerimaan dikonfirmasi.',
    cancel:
      'Pembatalan berlaku untuk sisa yang belum diterima. Barang yang sudah diterima tetap berada di stok gudang.',
  };
  const submitLabels = {
    create: 'Simpan draft order',
    edit: 'Simpan perubahan',
    confirm: 'Tandai sudah dipesan',
    receive: 'Konfirmasi penerimaan',
    cancel: 'Batalkan sisa order',
  };
  const code = item?.code ?? order?.code ?? '';
  const description = item?.description ?? order?.description ?? '';
  const unit = item?.unit ?? order?.unit ?? '';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-xl sm:p-6"
        showCloseButton={!pending}
      >
        <DialogHeader className="pr-7">
          <DialogTitle className="text-xl font-semibold">
            {titles[mode]}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {descriptions[mode]}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="break-all font-mono font-semibold text-[#17364a]">
            {code}
          </p>
          <p className="mt-1 break-words text-slate-600">{description}</p>
          {item && (
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Stok {formatOrderQuantity(item.quantity)} {unit} · Minimum{' '}
              {formatOrderQuantity(item.minQty)} {unit} · Dalam order{' '}
              {formatOrderQuantity(item.openQty)} {unit}
            </p>
          )}
          {order && (
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Dipesan {formatOrderQuantity(order.quantity)} {unit} · Diterima{' '}
              {formatOrderQuantity(order.receivedQty)} {unit} · Sisa{' '}
              {formatOrderQuantity(order.remainingQty)} {unit}
            </p>
          )}
        </div>

        <form action={action} aria-busy={pending} className="space-y-4">
          {isDraft && (
            <input
              type="hidden"
              name="warehouseItemId"
              value={item?.id ?? order?.warehouseItemId ?? ''}
            />
          )}
          {order && mode !== 'receive' && (
            <>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="updatedAt" value={order.updatedAt} />
            </>
          )}
          {mode === 'create' && (
            <input type="hidden" name="requestId" value={requestId} />
          )}
          {mode === 'receive' && (
            <>
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="orderId" value={order?.id ?? ''} />
              <input type="hidden" name="expectedUnit" value={unit} />
            </>
          )}
          <fieldset disabled={demo || pending} className="space-y-4">
            {isDraft && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`Jumlah dipesan (${unit})`}>
                    <input
                      className={inputClass}
                      name="quantity"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      inputMode="decimal"
                      value={fields.quantity}
                      onChange={(event) =>
                        updateField('quantity', event.target.value)
                      }
                      required
                      placeholder="Isi jumlah yang akan dibeli"
                      autoFocus
                    />
                  </Field>
                  <Field label="Supplier">
                    <input
                      className={inputClass}
                      name="supplier"
                      maxLength={200}
                      value={fields.supplier}
                      onChange={(event) =>
                        updateField('supplier', event.target.value)
                      }
                      placeholder="Dapat dilengkapi pada draft"
                    />
                  </Field>
                  <Field label="Nomor order / referensi supplier">
                    <input
                      className={inputClass}
                      name="referenceNo"
                      maxLength={100}
                      value={fields.referenceNo}
                      onChange={(event) =>
                        updateField('referenceNo', event.target.value)
                      }
                      placeholder="Bukan PO Customer"
                    />
                  </Field>
                  <Field label="Perkiraan tiba (ETA)">
                    <input
                      className={inputClass}
                      name="expectedArrival"
                      type="date"
                      value={fields.expectedArrival}
                      onChange={(event) =>
                        updateField('expectedArrival', event.target.value)
                      }
                    />
                  </Field>
                </div>
                <Field label="Catatan order">
                  <textarea
                    className={inputClass}
                    name="notes"
                    rows={2}
                    maxLength={1000}
                    value={fields.notes}
                    onChange={(event) =>
                      updateField('notes', event.target.value)
                    }
                    placeholder="Kebutuhan atau keterangan pembelian (opsional)"
                  />
                </Field>
                <p className="text-xs leading-5 text-slate-500">
                  Jumlah diisi manual sesuai kebutuhan. Lengkapi supplier dan
                  nomor referensi sebelum menandai sudah dipesan.
                </p>
              </>
            )}
            {mode === 'confirm' && order && (
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900">
                <p>
                  <span className="font-semibold">Supplier:</span>{' '}
                  {order.supplier || 'Belum diisi'}
                </p>
                <p>
                  <span className="font-semibold">Referensi:</span>{' '}
                  {order.referenceNo || 'Belum diisi'}
                </p>
                <p className="mt-2">
                  Order akan berstatus <strong>Sudah dipesan</strong>. Stok
                  belum bertambah sampai barang diterima.
                </p>
              </div>
            )}
            {mode === 'receive' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`Jumlah diterima (${unit})`}>
                    <input
                      className={inputClass}
                      name="quantity"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      max={order?.remainingQty}
                      inputMode="decimal"
                      value={fields.quantity}
                      onChange={(event) =>
                        updateField('quantity', event.target.value)
                      }
                      required
                      placeholder="Isi jumlah penerimaan saat ini"
                      autoFocus
                    />
                  </Field>
                  <Field label="Nomor bukti penerimaan">
                    <input
                      className={inputClass}
                      name="referenceNo"
                      required
                      maxLength={100}
                      value={fields.referenceNo}
                      onChange={(event) =>
                        updateField('referenceNo', event.target.value)
                      }
                      placeholder="Nomor surat jalan / bon gudang"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Nama penerima">
                      <input
                        className={inputClass}
                        name="recipient"
                        required
                        maxLength={120}
                        value={fields.recipient}
                        onChange={(event) =>
                          updateField('recipient', event.target.value)
                        }
                      />
                    </Field>
                  </div>
                </div>
                <Field label="Catatan penerimaan">
                  <textarea
                    className={inputClass}
                    name="notes"
                    rows={2}
                    maxLength={1000}
                    value={fields.notes}
                    onChange={(event) =>
                      updateField('notes', event.target.value)
                    }
                    placeholder="Keterangan penerimaan (opsional)"
                  />
                </Field>
                <p className="text-xs leading-5 text-slate-500">
                  Penerimaan sebagian diperbolehkan, maksimal sisa order.
                  Material masuk ke gudang; pengambilan proyek tetap mengikuti
                  BoQ. Biaya aktual dicatat melalui Finance.
                </p>
              </>
            )}
            {mode === 'cancel' && (
              <Field label="Alasan pembatalan">
                <textarea
                  className={inputClass}
                  name="reason"
                  rows={3}
                  required
                  minLength={2}
                  maxLength={1000}
                  value={fields.reason}
                  onChange={(event) =>
                    updateField('reason', event.target.value)
                  }
                  placeholder="Jelaskan alasan pembatalan sisa order"
                  autoFocus
                />
              </Field>
            )}
          </fieldset>
          <MutationFeedback state={state} />
          {state.status === 'error' && (
            <p className="text-xs leading-5 text-slate-500">
              Jika data sudah berubah, tutup form dan muat ulang daftar sebelum
              mencoba kembali.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={
                demo ||
                pending ||
                (mode === 'confirm' &&
                  (!order?.supplier.trim() || !order?.referenceNo.trim()))
              }
              className={cn(
                buttonClass,
                mode === 'cancel' && 'bg-red-700 hover:bg-red-800',
              )}
            >
              {pending ? 'Menyimpan…' : submitLabels[mode]}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
