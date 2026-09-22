'use client';
import { useState } from 'react';
import type { ProjectRegisterData } from '@/lib/projects/types';
import {
  WorkspaceIntro,
  Field,
  inputClass,
  buttonClass,
  panelClass,
} from './workspace-ui';
export function ReportsWorkspace({ data }: { data: ProjectRegisterData }) {
  const [type, setType] = useState('portfolio');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function download(form: FormData) {
    setBusy(true);
    setMessage('');
    try {
      const params = new URLSearchParams();
      for (const [k, v] of form) params.set(k, String(v));
      const response = await fetch(`/api/reports?${params}`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.${form.get('format')}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Laporan berhasil diunduh.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unduhan gagal.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-[1200px] space-y-6 p-4 pb-24 md:p-7">
      <WorkspaceIntro
        title="Reports"
        description="Unduh snapshot portfolio, material, milestone operasional, atau ledger biaya dalam PDF dan Excel."
        demo={data.demoMode}
      />
      <form action={download} className={`${panelClass} space-y-5`}>
        <fieldset disabled={busy} className="grid gap-5 md:grid-cols-2">
          <Field label="Jenis laporan">
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              <option value="portfolio">Project Portfolio</option>
              <option value="materials">Material Register</option>
              <option value="operations">Operational Milestones</option>
              <option value="costs">Cost Ledger</option>
            </select>
          </Field>
          <Field label="Project">
            <select name="projectId" className={inputClass}>
              <option value="">Semua project</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </Field>
          {['costs', 'operations'].includes(type) && (
            <>
              <Field
                label={
                  type === 'costs'
                    ? 'Tanggal biaya mulai'
                    : 'Target milestone mulai'
                }
              >
                <input name="from" type="date" className={inputClass} />
              </Field>
              <Field label="Sampai tanggal">
                <input name="to" type="date" className={inputClass} />
              </Field>
            </>
          )}
          <Field label="Format">
            <select name="format" className={inputClass}>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
          </Field>
        </fieldset>
        <button className={buttonClass} disabled={busy}>
          {busy ? 'Membuat laporan…' : 'Unduh laporan'}
        </button>
        {message && (
          <p role="status" className="text-sm text-slate-600">
            {message}
          </p>
        )}
      </form>
      <section className={panelClass}>
        <h3 className="font-semibold">Cakupan laporan</h3>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Portfolio dan material menampilkan kondisi terkini. Periode milestone
          mengikuti target selesai; periode biaya mengikuti tanggal transaksi.
          Ledger tetap menampilkan transaksi yang dibatalkan beserta alasannya.
          Saldo awal proyek tersedia pada actual cost portfolio, bukan sebagai
          transaksi ledger.
        </p>
      </section>
    </main>
  );
}
