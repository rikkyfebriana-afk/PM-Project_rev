'use client';
import { useActionState, useState } from 'react';
import { saveCost, saveBudget, voidCost } from '@/app/actions/finance';
import type { FinanceData } from '@/lib/finance/queries';
import {
  financePoGroup,
  financePoGroups,
  summarizeFinancePo,
  exactPoMoney,
} from '@/lib/finance/po-summary';
import { idleState } from '@/lib/operations/validation';
import {
  WorkspaceIntro,
  Metrics,
  Field,
  inputClass,
  buttonClass,
  panelClass,
  MutationFeedback,
} from './workspace-ui';
const money = (v: string) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(v));
function CostForm({ data }: { data: FinanceData }) {
  const [state, action, pending] = useActionState(saveCost, idleState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="requestId" value={data.requestId} type="hidden" />
      <fieldset
        disabled={
          data.demoMode || pending || !data.projects.some((p) => p.canEdit)
        }
        className="grid gap-3 md:grid-cols-2"
      >
        <Field label="Project">
          <select name="projectId" className={inputClass}>
            {data.projects
              .filter((p) => p.canEdit)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Tanggal biaya">
          <input name="spentAt" type="date" required className={inputClass} />
        </Field>
        <Field label="Kategori">
          <select name="category" className={inputClass}>
            {['MATERIAL', 'LABOR', 'SUBCONTRACT', 'TRANSPORT', 'OTHER'].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="Nominal (IDR)">
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className={inputClass}
          />
        </Field>
        <Field label="Uraian">
          <input
            name="description"
            minLength={3}
            maxLength={240}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Nomor invoice / referensi">
          <input name="referenceNo" maxLength={100} className={inputClass} />
        </Field>
      </fieldset>
      <MutationFeedback state={state} />
      <button
        className={buttonClass}
        disabled={
          pending || data.demoMode || !data.projects.some((p) => p.canEdit)
        }
      >
        {pending ? 'Mencatat…' : 'Catat biaya'}
      </button>
    </form>
  );
}
function BudgetForm({
  p,
  enabled,
}: {
  p: FinanceData['projects'][number];
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(saveBudget, idleState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="projectId" value={p.id} type="hidden" />
      <input name="updatedAt" value={p.updatedAt} type="hidden" />
      <fieldset
        disabled={!enabled || pending}
        className="grid gap-3 md:grid-cols-3"
      >
        {(
          [
            ['poValue', 'PO value'],
            ['budgetValue', 'Budget'],
            ['forecastCost', 'Forecast'],
          ] as const
        ).map(([name, label]) => (
          <Field key={name} label={`${label} (IDR)`}>
            <input
              name={name}
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={p[name]}
              readOnly={name === 'poValue' && p.hasCustomerPo}
              className={inputClass}
            />
          </Field>
        ))}
      </fieldset>
      <MutationFeedback state={state} />
      <button className={buttonClass} disabled={!enabled || pending}>
        Simpan baseline
      </button>
      {p.hasCustomerPo && (
        <p className="text-xs text-slate-500">
          Nilai PO dikelola melalui menu PO Customer.
        </p>
      )}
    </form>
  );
}
function VoidForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(voidCost, idleState);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input name="id" value={id} type="hidden" />
      <Field label="Alasan pembatalan">
        <input
          name="reason"
          required
          minLength={5}
          maxLength={500}
          className={inputClass}
        />
      </Field>
      <button className={`${buttonClass} bg-red-700`} disabled={pending}>
        Batalkan transaksi biaya
      </button>
      <MutationFeedback state={state} />
    </form>
  );
}
export function FinanceWorkspace({ data }: { data: FinanceData }) {
  const [project, setProject] = useState('');
  const [poStatus, setPoStatus] = useState('');
  const selectedProjects = data.projects.filter(
    (p) => !project || p.id === project,
  );
  const poSummary = summarizeFinancePo(selectedProjects);
  const visibleProjects = selectedProjects.filter(
    (p) => !poStatus || financePoGroup(p) === poStatus,
  );
  const visibleIds = new Set(visibleProjects.map((p) => p.id));
  const visibleEntries = data.entries.filter((e) =>
    visibleIds.has(e.projectId),
  );
  return (
    <main className="mx-auto max-w-[1600px] space-y-5 p-4 pb-24 md:p-7">
      <WorkspaceIntro
        title="Finance"
        description="Baseline komersial, biaya aktual, forecast, dan gross margin. Biaya yang dicatat langsung memperbarui actual cost proyek."
        demo={data.demoMode}
      />
      <Metrics
        items={Object.entries(data.totals).map(([label, value]) => ({
          label,
          value: money(value),
        }))}
      />
      <p className="text-xs text-slate-500">
        Total di atas mencakup seluruh proyek yang dapat Anda akses, termasuk
        Draft, Cancelled, dan PO belum tercatat.
      </p>
      <details className={panelClass}>
        <summary className="cursor-pointer font-semibold">
          + Catat biaya aktual
        </summary>
        <CostForm key={data.requestId} data={data} />
      </details>
      <Field label="Filter project">
        <select
          className={inputClass}
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="">Semua project</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </Field>
      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">
            Nilai berdasarkan status PO Customer
          </h3>
          <button
            type="button"
            onClick={() => setPoStatus('')}
            aria-pressed={!poStatus}
            className="border px-3 py-2 text-sm"
          >
            Semua status
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Mengikuti filter proyek. Nilai PO belum termasuk PPN, bukan penerimaan
          pembayaran. Closed mengikuti PO Selesai, bukan status proyek atau
          pelunasan. Klik kategori untuk menyaring proyek dan riwayat biaya.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {poSummary.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setPoStatus(g.key)}
              aria-pressed={poStatus === g.key}
              className={`min-w-0 border-l-4 p-4 text-left ${poStatus === g.key ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
            >
              <span className="block text-sm font-semibold">{g.label}</span>
              <span className="mt-2 block break-words font-mono text-xl font-bold">
                {exactPoMoney(g.value)}
              </span>
              <span className="mt-2 block text-xs text-slate-600">
                {g.count} proyek · {g.description}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm" role="status">
          Menampilkan {visibleProjects.length} proyek ·{' '}
          {financePoGroups.find((g) => g.key === poStatus)?.label ??
            'Semua status'}
        </p>
      </section>
      {!visibleProjects.length && (
        <p className={panelClass}>
          Tidak ada proyek pada kombinasi filter ini. Pilih Semua status atau
          ubah filter proyek.
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {visibleProjects.map((p) => (
          <article className={panelClass} key={p.id}>
            <p className="text-xs font-semibold text-[#d85832]">{p.code}</p>
            <h3 className="mt-2 font-semibold">{p.name}</h3>
            <p className="mt-2 text-xs text-slate-500">
              PO: {p.customerPoNumber || 'Belum tercatat'} ·{' '}
              {financePoGroups.find((g) => g.key === financePoGroup(p))?.label}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[
                ['PO', p.poValue],
                ['Budget', p.budgetValue],
                ['Actual', p.actualCost],
                ['Forecast', p.forecastCost],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1 font-mono">{money(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm">
              Forecast GM:{' '}
              <strong>
                {Number(p.poValue)
                  ? (
                      (1 - Number(p.forecastCost) / Number(p.poValue)) *
                      100
                    ).toFixed(1) + '%'
                  : '—'}
              </strong>
            </p>
            {Number(p.forecastCost) < Number(p.actualCost) && (
              <p className="mt-2 text-xs text-amber-700">
                Forecast di bawah actual cost. Perbarui estimasi akhir.
              </p>
            )}
            {data.canApprove && (
              <details className="mt-4 border-t pt-3">
                <summary className="cursor-pointer text-sm">
                  Ubah baseline
                </summary>
                <BudgetForm key={p.updatedAt} p={p} enabled={!data.demoMode} />
              </details>
            )}
          </article>
        ))}
      </div>
      <section className={panelClass}>
        <h3 className="text-lg font-semibold">Riwayat biaya</h3>
        <p className="mt-2 text-xs text-slate-500">
          Actual cost = saldo awal proyek + transaksi aktif. Pembatalan tetap
          tercatat dalam riwayat.
        </p>
        <div className="mt-4 divide-y">
          {visibleEntries.map((e) => (
            <div key={e.id} className="py-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">
                    {e.projectCode} · {e.spentAt} · {e.category}
                  </p>
                  <p className="mt-1 font-semibold">{e.description}</p>
                  <p className="text-xs text-slate-500">
                    {e.referenceNo || 'Tanpa nomor referensi'}
                  </p>
                </div>
                <span
                  className={`font-mono ${e.voided ? 'text-slate-400 line-through' : 'text-slate-800'}`}
                >
                  {money(e.amount)}
                </span>
              </div>
              {e.voided ? (
                <p className="mt-2 text-xs text-red-700">
                  Dibatalkan: {e.voidReason}
                </p>
              ) : (
                data.canApprove &&
                !data.demoMode && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-red-700">
                      Koreksi dengan pembatalan
                    </summary>
                    <VoidForm id={e.id} />
                  </details>
                )
              )}
            </div>
          ))}
          {!visibleEntries.length && (
            <p className="py-6 text-sm text-slate-500">
              Belum ada transaksi biaya.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
