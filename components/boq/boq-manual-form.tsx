'use client';
import { useActionState, useState } from 'react';
import { saveManualBoq } from '@/app/actions/boq-manual';
import type { BoqImportRowInput, BoqWorkspaceProject } from '@/lib/boq/types';
import { idleState } from '@/lib/operations/validation';
import { exactPoMoney } from '@/lib/finance/po-summary';
import {
  Field,
  inputClass,
  buttonClass,
  MutationFeedback,
} from '@/components/modules/workspace-ui';
const emptyRow = (n: number): BoqImportRowInput => ({
  itemNo: String(n),
  itemCode: '',
  itemType: 'MATERIAL',
  description: '',
  unit: 'PCS',
  quantity: '1',
  unitPrice: '0',
});
function rowTotal(row: BoqImportRowInput) {
  if (
    !/^\d{1,14}(\.\d{1,4})?$/.test(row.quantity) ||
    !/^\d{1,16}(\.\d{1,2})?$/.test(row.unitPrice)
  )
    return null;
  const scaled = (s: string, n: number) => {
    const [a, b = ''] = s.split('.');
    return BigInt(a) * 10n ** BigInt(n) + BigInt(b.padEnd(n, '0'));
  };
  return (scaled(row.quantity, 4) * scaled(row.unitPrice, 2) + 5000n) / 10000n;
}
const amount = (c: bigint) =>
  exactPoMoney(`${c / 100n}.${String(c % 100n).padStart(2, '0')}`);
export function BoqManualForm({
  project,
  version,
  enabled,
}: {
  project: BoqWorkspaceProject;
  version: number;
  enabled: boolean;
}) {
  const [rows, setRows] = useState<BoqImportRowInput[]>([emptyRow(1)]);
  const [state, action, pending] = useActionState(saveManualBoq, idleState);
  const totals = rows.map(rowTotal);
  const update = (index: number, key: keyof BoqImportRowInput, value: string) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  return (
    <details className="min-w-0 border border-teal-200 bg-teal-50/40 p-3 text-center text-slate-800 sm:p-4">
      <summary className="cursor-pointer text-base font-semibold text-teal-900">
        Input manual BoQ — tanpa Excel
      </summary>
      <p className="mt-3 break-words text-sm leading-6">
        Proyek:{' '}
        <strong>
          {project.code} — {project.name}
        </strong>
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        Isi seluruh item untuk revisi baru, bukan hanya item tambahan. Draft
        sebelumnya akan menjadi Superseded; baseline approved dan material tetap
        sampai Admin menyetujui revisi baru. Form belum tersimpan sampai tombol
        Simpan ditekan. Berpindah proyek atau memuat ulang akan mengosongkan
        input.
      </p>
      <form action={action} className="mx-auto mt-4 w-full min-w-0 max-w-4xl space-y-4 [&_input:not([type=checkbox])]:text-center [&_select]:text-center">
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="expectedVersion" value={version} />
        <input type="hidden" name="manualRows" value={JSON.stringify(rows)} />
        <fieldset disabled={!enabled || pending} className="space-y-4">
          {rows.map((r, index) => (
            <div key={index} className="min-w-0 border border-slate-200 bg-white p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold">
                <span>Baris {index + 1}</span>
                <button
                  type="button"
                  disabled={rows.length === 1}
                  onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  className="text-red-700 disabled:opacity-40"
                >
                  Hapus baris {index + 1}
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nomor item">
                  <input
                    aria-label={`Nomor item baris ${index + 1}`}
                    className={inputClass}
                    required
                    maxLength={40}
                    value={r.itemNo}
                    onChange={(e) => update(index, 'itemNo', e.target.value)}
                  />
                </Field>
                <Field label="Tipe">
                  <select
                    aria-label={`Tipe baris ${index + 1}`}
                    className={inputClass}
                    value={r.itemType}
                    onChange={(e) => update(index, 'itemType', e.target.value)}
                  >
                    <option value="MATERIAL">Material</option>
                    <option value="SERVICE">Jasa</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </Field>
                <Field label="Kode item (wajib material)">
                  <input
                    aria-label={`Kode item baris ${index + 1}`}
                    className={inputClass}
                    required={r.itemType === 'MATERIAL'}
                    maxLength={80}
                    value={r.itemCode ?? ''}
                    onChange={(e) => update(index, 'itemCode', e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Deskripsi">
                    <input
                      aria-label={`Deskripsi baris ${index + 1}`}
                      className={inputClass}
                      required
                      maxLength={500}
                      value={r.description}
                      onChange={(e) =>
                        update(index, 'description', e.target.value)
                      }
                    />
                  </Field>
                </div>
                <Field label="Satuan">
                  <input
                    aria-label={`Satuan baris ${index + 1}`}
                    className={inputClass}
                    required
                    maxLength={32}
                    value={r.unit}
                    onChange={(e) => update(index, 'unit', e.target.value)}
                  />
                </Field>
                <Field label="Quantity">
                  <input
                    aria-label={`Quantity baris ${index + 1}`}
                    className={inputClass}
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    required
                    value={r.quantity}
                    onChange={(e) => update(index, 'quantity', e.target.value)}
                  />
                </Field>
                <Field label="Harga satuan (Rp)">
                  <input
                    aria-label={`Harga satuan baris ${index + 1}`}
                    className={inputClass}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={r.unitPrice}
                    onChange={(e) => update(index, 'unitPrice', e.target.value)}
                  />
                </Field>
              </div>
              <p className="mt-3 break-words text-center text-sm font-semibold">
                Subtotal:{' '}
                {totals[index] === null
                  ? 'Periksa angka'
                  : amount(totals[index]!)}
              </p>
            </div>
          ))}
          <button
            type="button"
            disabled={rows.length >= 200}
            className="border bg-white px-4 py-2 text-sm"
            onClick={() => {
              const used = new Set(rows.map((r) => r.itemNo));
              let n = rows.length + 1;
              while (used.has(String(n))) n++;
              setRows([...rows, emptyRow(n)]);
            }}
          >
            + Tambah baris ({rows.length}/200)
          </button>
          <p className="break-words text-lg font-semibold">
            Total:{' '}
            {totals.some((v) => v === null)
              ? 'Periksa angka'
              : amount(totals.reduce<bigint>((s, v) => s + (v ?? 0n), 0n))}
          </p>
          <p className="text-xs text-slate-500">
            Quantity maksimal 4 desimal; harga 2 desimal. Gunakan titik desimal
            tanpa pemisah ribuan. Total dihitung ulang dan divalidasi server.
          </p>
          <label className="mx-auto flex max-w-2xl items-start justify-center gap-2 text-left text-sm leading-6">
            <input type="checkbox" name="confirm" value="yes" required />
            Saya sudah memeriksa seluruh item dan setuju membuat revisi Draft
            baru, menggantikan Draft sebelumnya bila ada.
          </label>
          <button className={buttonClass} disabled={!enabled || pending}>
            {pending ? 'Menyimpan…' : 'Simpan BoQ manual sebagai Draft'}
          </button>
        </fieldset>
        <MutationFeedback state={state} />
        {!enabled && (
          <p className="text-xs text-slate-500">
            Input hanya untuk Admin atau PM penanggung jawab; mode demo hanya
            baca.
          </p>
        )}
      </form>
    </details>
  );
}
