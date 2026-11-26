'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { syncBoqBudgetAction } from '@/app/actions/boq-budget';
import type { BoqItemTypeValue, BoqWorkspaceData } from '@/lib/boq/types';
import { exactPoMoney } from '@/lib/finance/po-summary';
import { idleState } from '@/lib/operations/validation';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const typeLabels: Record<BoqItemTypeValue, string> = {
  MATERIAL: 'Material',
  SERVICE: 'Jasa',
  OTHER: 'Lainnya',
};
const selectClass =
  'min-w-0 w-full rounded border border-[#cbd7df] bg-white px-3 py-2.5 text-sm text-[#17364a]';

function quantity(value: string | null) {
  if (value === null) return '—';
  const [whole, decimal = ''] = value.split('.');
  const fraction = decimal.replace(/0+$/, '');
  return `${BigInt(whole).toLocaleString('id-ID')}${fraction ? `,${fraction}` : ''}`;
}

export function BoqCostWorkspace({ data }: { data: BoqWorkspaceData }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    syncBoqBudgetAction,
    idleState,
  );
  const costing = data.costing;
  const revision = costing?.revision;
  const selectedProject = data.projects.find(
    (project) => project.id === costing?.projectId,
  );
  const revisions = data.boqs.filter(
    (boq) => boq.projectId === costing?.projectId,
  );
  const difference = costing?.differenceValue ?? null;
  const budgetMatches = difference !== null && /^-?0\.00$/.test(difference);
  const proposalTooLarge = costing?.approvedTotalValue
    ? BigInt(costing.approvedTotalValue.replace('.', '')) > 999999999999999999n
    : false;

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  return (
    <section
      className="min-w-0 border border-[#dce2e6] bg-white"
      aria-labelledby="boq-cost-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5e9ec] p-5 md:p-6">
        <div className="min-w-0">
          <p className="section-kicker">Rencana biaya per proyek</p>
          <h3 id="boq-cost-title" className="section-title">
            Kebutuhan material, HPP & budget BoQ
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6e7e88]">
            HPP per satuan × jumlah kebutuhan membentuk total rencana biaya.
            Approval revisi baru menetapkan total seluruh item sebagai budget
            proyek di Finance.
          </p>
        </div>
        {costing && (
          <Link
            className="shrink-0 border border-[#d7e0e4] px-4 py-2.5 text-sm font-medium text-[#17364a] hover:bg-slate-50"
            href={`/boq/materials?projectId=${encodeURIComponent(costing.projectId)}`}
          >
            Lihat pemakaian material
          </Link>
        )}
      </div>

      <div className="grid min-w-0 gap-5 p-5 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className="grid min-w-0 gap-2 text-sm font-medium text-[#425563]">
            Proyek untuk rincian BoQ
            <select
              aria-label="Proyek untuk rincian BoQ"
              className={selectClass}
              value={costing?.projectId ?? ''}
              onChange={(event) =>
                router.push(
                  `/boq?projectId=${encodeURIComponent(event.target.value)}`,
                )
              }
            >
              {!costing && <option value="">Pilih proyek</option>}
              {data.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} — {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-[#425563]">
            Revisi yang ditampilkan
            <select
              aria-label="Revisi yang ditampilkan"
              className={selectClass}
              value={revision?.id ?? ''}
              disabled={!costing || revisions.length === 0}
              onChange={(event) =>
                router.push(
                  `/boq?projectId=${encodeURIComponent(costing!.projectId)}&revisionId=${encodeURIComponent(event.target.value)}`,
                )
              }
            >
              {!revision && <option value="">Belum ada revisi terpilih</option>}
              {revision && !revisions.some((boq) => boq.id === revision.id) && (
                <option value={revision.id}>
                  Versi {revision.version} · {revision.status}
                </option>
              )}
              {revisions.map((boq) => (
                <option key={boq.id} value={boq.id}>
                  Versi {boq.version} · {boq.status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!costing ? (
          <p className="bg-slate-50 p-4 text-sm text-slate-600">
            {data.demoMode
              ? 'Rincian biaya tersimpan tersedia setelah database terhubung.'
              : 'Pilih proyek yang memiliki izin BoQ untuk melihat rencana biaya.'}
          </p>
        ) : (
          <>
            <div className="min-w-0">
              <p className="break-words text-base font-semibold text-[#17364a]">
                {selectedProject?.code} — {selectedProject?.name}
              </p>
              <p className="mt-1 text-xs text-[#6e7e88]">
                {selectedProject?.clientName || 'Customer belum diisi'}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <CostCard
                label="Budget proyek di Finance"
                value={costing.projectBudgetValue}
                note="Budget yang saat ini tersimpan"
              />
              <CostCard
                label={
                  costing.approvedVersion
                    ? `Total BoQ approved · v${costing.approvedVersion}`
                    : 'Total BoQ approved'
                }
                value={costing.approvedTotalValue}
                note="Material + jasa + lainnya pada baseline resmi"
              />
              <CostCard
                label="Selisih BoQ approved terhadap budget"
                value={difference?.replace(/^-/, '') ?? null}
                note={
                  difference === null
                    ? 'Belum ada baseline approved'
                    : budgetMatches
                      ? 'Budget sudah sama dengan BoQ approved'
                      : difference.startsWith('-')
                        ? 'Total BoQ lebih rendah dari budget tersimpan'
                        : 'Total BoQ lebih tinggi dari budget tersimpan'
                }
              />
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4 rounded border border-[#dce5e8] bg-[#f7fafb] p-4">
              <p className="max-w-3xl text-sm leading-6 text-[#526977]">
                Draft hanya rencana dan tidak mengubah budget. Baseline approved
                lama tetap memakai budget tersimpan sampai Admin atau Project
                Manager mengonfirmasi sinkronisasi. Penerimaan, pengambilan
                gudang, dan pemakaian tidak otomatis dicatat sebagai biaya
                aktual.
              </p>
              {data.canApprove && !data.demoMode && costing.approvedBoqId && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto max-w-full whitespace-normal text-left"
                  disabled={budgetMatches || proposalTooLarge}
                  onClick={() => setConfirmOpen(true)}
                >
                  Gunakan total BoQ approved sebagai budget
                </Button>
              )}
            </div>
            {proposalTooLarge && (
              <p role="status" className="text-sm text-amber-800">
                Total BoQ melebihi batas penyimpanan budget. Periksa revisi
                sebelum sinkronisasi.
              </p>
            )}
            {state.status !== 'idle' && (
              <p
                role="status"
                className={`text-sm ${state.status === 'success' ? 'text-emerald-800' : 'text-red-700'}`}
              >
                {state.message}
              </p>
            )}

            {!revision ? (
              <p className="py-4 text-sm text-[#6e7e88]">
                Belum ada rincian revisi BoQ untuk pilihan ini. Buat revisi
                manual atau impor file di bawah.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e9ec] pt-5">
                  <h4 className="font-semibold text-[#17364a]">
                    Rincian versi {revision.version} · {revision.status}
                  </h4>
                  <p className="text-sm text-[#6e7e88]">
                    {revision.items.length} item · total rencana{' '}
                    <strong className="text-[#17364a]">
                      {exactPoMoney(revision.totalValue)}
                    </strong>
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(['MATERIAL', 'SERVICE', 'OTHER'] as const).map((type) => (
                    <CostCard
                      key={type}
                      label={typeLabels[type]}
                      value={revision.subtotals[type]}
                      note={`${revision.items.filter((item) => item.itemType === type).length} item pada revisi terpilih`}
                    />
                  ))}
                </div>
                {revision.zeroHppCount > 0 && (
                  <p
                    role="status"
                    className="rounded border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
                  >
                    {revision.zeroHppCount} item memiliki HPP Rp 0. Nilai ini
                    tetap disimpan dan dihitung; lengkapi HPP jika biaya belum
                    diisi agar rencana budget lebih akurat.
                  </p>
                )}
                <p className="text-xs leading-5 text-[#6e7e88]">
                  Diterima mencakup material yang telah diterima proyek,
                  termasuk dari gudang. Dari gudang adalah bagian dari jumlah
                  diterima, bukan tambahan. Terpakai/terpasang mengikuti catatan
                  proyek. Tanda — berarti tidak ada catatan material yang
                  terhubung pada revisi ini.
                </p>
                <div className="max-h-[640px] overflow-auto rounded border border-[#dce2e6]">
                  <table
                    className="w-full min-w-[1120px] text-left text-sm"
                    aria-label="Rincian HPP dan pemakaian BoQ"
                  >
                    <thead className="sticky top-0 z-10 bg-[#f1f5f7] text-xs text-[#526977]">
                      <tr>
                        <th className="p-3">No.</th>
                        <th className="p-3">Material / pekerjaan</th>
                        <th className="p-3">Jenis</th>
                        <th className="p-3 text-right">Kebutuhan</th>
                        <th className="p-3">Satuan</th>
                        <th className="p-3 text-right">HPP per satuan</th>
                        <th className="p-3 text-right">Total HPP</th>
                        <th className="p-3 text-right">Diterima</th>
                        <th className="p-3 text-right">Dari gudang</th>
                        <th className="p-3 text-right">Terpakai / terpasang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revision.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-[#e5e9ec] align-top"
                        >
                          <td className="p-3 text-[#6e7e88]">{item.itemNo}</td>
                          <td className="min-w-52 max-w-80 p-3">
                            <span className="block break-words font-medium text-[#17364a]">
                              {item.description}
                            </span>
                            <span className="mt-1 block break-words font-mono text-xs text-[#6e7e88]">
                              {item.itemCode ?? 'Tanpa kode'}
                            </span>
                          </td>
                          <td className="p-3">{typeLabels[item.itemType]}</td>
                          <td className="p-3 text-right tabular-nums">
                            {quantity(item.quantity)}
                          </td>
                          <td className="p-3">{item.unit}</td>
                          <td className="whitespace-nowrap p-3 text-right font-mono text-xs">
                            {exactPoMoney(item.unitPrice)}
                          </td>
                          <td className="whitespace-nowrap p-3 text-right font-mono text-xs font-semibold">
                            {exactPoMoney(item.lineTotal)}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {quantity(item.receivedQty)}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {quantity(item.warehouseIssuedQty)}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {quantity(item.installedQty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-[#f7fafb] font-semibold">
                      <tr>
                        <td className="p-3" colSpan={6}>
                          Total rencana biaya revisi {revision.version}
                        </td>
                        <td className="whitespace-nowrap p-3 text-right font-mono text-xs">
                          {exactPoMoney(revision.totalValue)}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Gunakan total BoQ approved sebagai budget?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Periksa budget {selectedProject?.code}. Tindakan ini mengganti
              budget di Finance dengan total baseline approved versi{' '}
              {costing?.approvedVersion}. Biaya aktual dan forecast tidak
              berubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid gap-3 rounded bg-slate-50 p-3 text-sm">
            <div>
              <dt className="text-slate-500">Budget Finance saat ini</dt>
              <dd className="mt-1 font-semibold">
                {exactPoMoney(costing?.projectBudgetValue ?? '0.00')}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Budget dari total BoQ approved</dt>
              <dd className="mt-1 font-semibold">
                {exactPoMoney(costing?.approvedTotalValue ?? '0.00')}
              </dd>
            </div>
          </dl>
          {state.status !== 'idle' && (
            <p
              role="status"
              className={`text-sm ${state.status === 'success' ? 'text-emerald-800' : 'text-red-700'}`}
            >
              {state.message}
            </p>
          )}
          <form action={formAction}>
            <input
              type="hidden"
              name="projectId"
              value={costing?.projectId ?? ''}
            />
            <input
              type="hidden"
              name="expectedApprovedBoqId"
              value={costing?.approvedBoqId ?? ''}
            />
            <input
              type="hidden"
              name="expectedProjectUpdatedAt"
              value={costing?.projectUpdatedAt ?? ''}
            />
            <input
              type="hidden"
              name="expectedBudgetValue"
              value={costing?.projectBudgetValue ?? ''}
            />
            <input type="hidden" name="confirm" value="yes" />
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Tutup
              </AlertDialogCancel>
              <Button
                type="submit"
                disabled={pending || budgetMatches || proposalTooLarge}
              >
                {pending ? 'Menyimpan…' : 'Konfirmasi sinkronisasi budget'}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function CostCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | null;
  note: string;
}) {
  return (
    <article className="min-w-0 rounded border border-[#dce2e6] p-4">
      <p className="text-xs leading-5 text-[#6e7e88]">{label}</p>
      <p className="mt-2 break-words font-mono text-lg font-semibold text-[#17364a]">
        {value === null ? '—' : exactPoMoney(value)}
      </p>
      <p className="mt-2 text-xs leading-5 text-[#6e7e88]">{note}</p>
    </article>
  );
}
