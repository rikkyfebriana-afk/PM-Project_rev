'use client';
import Link from 'next/link';
import { TimePlanSheet } from './time-plan-sheet';
import { useActionState, useState } from 'react';
import {
  savePlanTask,
  archivePlanTask,
  setPlanActive,
} from '@/app/actions/time-plan';
import type { TimePlanData } from '@/lib/time-plan/queries';
import { planPhases, phaseLabels, taskStatus } from '@/lib/time-plan/model';
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
type Project = TimePlanData['projects'][number];
type Task = Project['tasks'][number];
function Identity({ p }: { p: Project }) {
  return (
    <>
      <input type="hidden" name="projectId" value={p.id} />
      <input type="hidden" name="updatedAt" value={p.updatedAt} />
    </>
  );
}
function TaskForm({ p, t, today }: { p: Project; t?: Task; today: string }) {
  const [state, action, pending] = useActionState(savePlanTask, idleState);
  return (
    <form action={action} className="mt-4 space-y-4">
      <Identity p={p} />
      <input type="hidden" name="id" value={t?.id ?? ''} />
      <fieldset
        disabled={!p.canEdit || pending}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <Field label="Tahapan">
          <select
            name="phase"
            className={inputClass}
            defaultValue={t?.phase ?? 'ENGINEERING'}
          >
            {planPhases.map((s) => (
              <option key={s} value={s}>
                {phaseLabels[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nama pekerjaan">
          <input
            name="title"
            className={inputClass}
            required
            minLength={3}
            maxLength={200}
            defaultValue={t?.title ?? ''}
          />
        </Field>
        <Field label="PIC / penanggung jawab">
          <input
            name="responsible"
            className={inputClass}
            required
            minLength={2}
            maxLength={160}
            defaultValue={t?.responsible ?? ''}
          />
        </Field>
        <Field label="Bobot terhadap proyek (%)">
          <input
            name="weight"
            className={inputClass}
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            required
            defaultValue={t?.weight ?? ''}
          />
        </Field>
        <Field label="Progres pekerjaan (%)">
          <input
            name="progressPct"
            className={inputClass}
            type="number"
            min="0"
            max="100"
            step="0.01"
            required
            defaultValue={t?.progressPct ?? '0'}
          />
        </Field>
        <Field label="Urutan tampilan">
          <input
            name="sortOrder"
            className={inputClass}
            type="number"
            min="0"
            max="9999"
            step="1"
            required
            defaultValue={t?.sortOrder ?? p.tasks.length + 1}
          />
        </Field>
        <Field label="Mulai rencana">
          <input
            name="plannedStart"
            className={inputClass}
            type="date"
            required
            defaultValue={t?.plannedStart ?? ''}
          />
        </Field>
        <Field label="Selesai rencana">
          <input
            name="plannedFinish"
            className={inputClass}
            type="date"
            required
            defaultValue={t?.plannedFinish ?? ''}
          />
        </Field>
        <Field label="Pekerjaan pendahulu (selesai → mulai)">
          <select
            name="predecessorId"
            className={inputClass}
            defaultValue={t?.predecessorId ?? ''}
          >
            <option value="">Tidak ada / paralel</option>
            {p.tasks
              .filter((row) => row.id !== t?.id)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {phaseLabels[row.phase]} — {row.title}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Mulai aktual">
          <input
            name="actualStart"
            className={inputClass}
            type="date"
            max={today}
            defaultValue={t?.actualStart ?? ''}
          />
        </Field>
        <Field label="Selesai aktual (untuk progres 100%)">
          <input
            name="actualFinish"
            className={inputClass}
            type="date"
            max={today}
            defaultValue={t?.actualFinish ?? ''}
          />
        </Field>
        <Field label="Catatan">
          <textarea
            name="notes"
            className={inputClass}
            maxLength={2000}
            defaultValue={t?.notes ?? ''}
          />
        </Field>
      </fieldset>
      <MutationFeedback state={state} />
      {p.canEdit && (
        <button className={buttonClass} disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan pekerjaan'}
        </button>
      )}
    </form>
  );
}
function ArchiveForm({ p, t }: { p: Project; t: Task }) {
  const [state, action, pending] = useActionState(archivePlanTask, idleState);
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-xs text-red-700">
        Arsipkan pekerjaan
      </summary>
      <form action={action} className="mt-3 space-y-2">
        <Identity p={p} />
        <input name="id" type="hidden" value={t.id} />
        <p className="text-xs text-slate-500">
          Pekerjaan akan dikeluarkan dari rencana dan bobot. Riwayat tetap
          disimpan. Hanya tersedia ketika rencana Draft.
        </p>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" required />
          Saya ingin mengarsipkan pekerjaan ini.
        </label>
        <button className={buttonClass} disabled={pending || p.timePlanActive}>
          Konfirmasi arsip
        </button>
        <MutationFeedback state={state} />
      </form>
    </details>
  );
}
function Activation({ p }: { p: Project }) {
  const [state, action, pending] = useActionState(setPlanActive, idleState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <Identity p={p} />
      <input
        type="hidden"
        name="active"
        value={p.timePlanActive ? 'false' : 'true'}
      />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" required className="mt-1" />
        {p.timePlanActive
          ? 'Kembalikan ke Draft untuk menyusun ulang bobot. Progres proyek terakhir tetap disimpan.'
          : `Gunakan rencana ini untuk mengganti progres proyek dari ${p.progressPct}% menjadi ${p.summary.progress}%.`}
      </label>
      <button
        className={buttonClass}
        disabled={
          pending || (!p.timePlanActive && (!p.summary.ready || !p.canEdit))
        }
      >
        {p.timePlanActive
          ? 'Nonaktifkan acuan progres'
          : 'Aktifkan sebagai acuan progres proyek'}
      </button>
      <MutationFeedback state={state} />
    </form>
  );
}
export function TimePlanWorkspace({
  data,
  initialProjectId,
}: {
  data: TimePlanData;
  initialProjectId?: string;
}) {
  const [selected, setSelected] = useState(initialProjectId ?? '');
  const p = data.projects.find((p) => p.id === selected);
  return (
    <main className="mx-auto max-w-[1600px] space-y-5 p-4 pb-24 md:p-7">
      <WorkspaceIntro
        title="Time Plan"
        description="Rencana proyek per tahapan dan rincian pekerjaan. Atur bobot, jadwal, PIC, pekerjaan pendahulu, dan pantau progres tertimbang."
        demo={data.demoMode}
      />
      {data.projects.length > 0 && (
        <>
          <Field label="Pilih proyek">
            <select
              aria-label="Pilih proyek"
              value={p?.id ?? ''}
              onChange={(e) => setSelected(e.target.value)}
              className={inputClass}
            >
              <option value="">Semua proyek</option>
              {data.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} — {project.name}
                </option>
              ))}
            </select>
          </Field>
          <TimePlanSheet
            projects={p ? [p] : data.projects}
            today={data.today}
            onSelect={setSelected}
          />
        </>
      )}
      {!p ? (
        <section className={panelClass}>
          <p className="mb-4">
            {data.projects.length
              ? 'Pilih satu proyek untuk menambah atau mengedit pekerjaan dan mengaktifkan bobot. Tampilan semua proyek hanya merangkum proyek yang boleh Anda akses.'
              : 'Buat proyek terlebih dahulu untuk menyusun Time Plan.'}
          </p>
          <Link href="/projects" className={buttonClass}>
            Buka Projects
          </Link>
        </section>
      ) : (
        <>
          <Metrics
            items={[
              {
                label: 'Total bobot / target 100%',
                value: `${p.summary.totalWeight}%`,
              },
              {
                label: 'Progres tertimbang rencana',
                value: `${p.summary.progress}%`,
              },
              { label: 'Progres proyek saat ini', value: `${p.progressPct}%` },
              {
                label: 'Pekerjaan terlambat',
                value: p.tasks.filter(
                  (t) => taskStatus(t, data.today) === 'Terlambat',
                ).length,
              },
            ]}
          />
          <section className={panelClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">
                {p.timePlanActive
                  ? 'Aktif — tersinkron ke dashboard'
                  : 'Draft — belum mengubah progres proyek'}
              </h3>
              <span className="text-xs text-slate-500">
                {p.tasks.length} pekerjaan · {p.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Bobot setiap pekerjaan adalah persentase dari seluruh proyek.
              Kontribusi = bobot × progres ÷ 100. Total bobot harus tepat 100%
              untuk diaktifkan; jadwal ini tidak otomatis mengubah milestone
              FAT/BAST atau menutup proyek.
            </p>
            {!p.summary.ready && (
              <p className="mt-3 text-sm text-amber-700">
                Sisa bobot yang perlu dialokasikan:{' '}
                {(100 - Number(p.summary.totalWeight)).toFixed(2)}%.
              </p>
            )}
            {data.canActivate && !data.demoMode && (
              <Activation key={`${p.id}-${p.updatedAt}`} p={p} />
            )}
          </section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {p.summary.stages.map((s) => (
              <div key={s.phase} className={panelClass}>
                <p className="text-sm font-semibold">{phaseLabels[s.phase]}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {s.count} pekerjaan · Bobot proyek {s.weight}%
                </p>
                <p className="mt-3 text-xl font-semibold">{s.progress}%</p>
                <div className="mt-2 h-1.5 bg-slate-100">
                  <div
                    className="h-full bg-teal-600"
                    style={{ width: `${s.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {p.canEdit && (
            <details className={panelClass} key={`new-${p.id}-${p.updatedAt}`}>
              <summary className="cursor-pointer font-semibold">
                + Tambah rincian pekerjaan
              </summary>
              <TaskForm p={p} today={data.today} />
            </details>
          )}
          {!p.tasks.length && (
            <p className={panelClass}>
              Belum ada rincian pekerjaan. Mulai dengan Engineering, pengadaan,
              produksi, FAT, delivery, instalasi, dan BAST sesuai kebutuhan
              proyek.
            </p>
          )}
          {planPhases.map((phase) => {
            const group = p.tasks.filter((t) => t.phase === phase);
            return group.length ? (
              <section key={phase} className={panelClass}>
                <h3 className="text-lg font-semibold">{phaseLabels[phase]}</h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="border-b text-xs text-slate-500">
                      <tr>
                        {[
                          'Pekerjaan / PIC',
                          'Rencana',
                          'Aktual',
                          'Bobot',
                          'Progres',
                          'Kontribusi',
                          'Status',
                        ].map((v) => (
                          <th key={v} className="px-2 py-3">
                            {v}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((t) => (
                        <tr key={t.id} className="border-b border-slate-100">
                          <td className="max-w-[260px] px-2 py-3">
                            <strong>{t.title}</strong>
                            <p className="text-xs text-slate-500">
                              {t.responsible}
                            </p>
                            {t.predecessorId && (
                              <p className="mt-1 text-xs text-slate-500">
                                Setelah:{' '}
                                {
                                  p.tasks.find((x) => x.id === t.predecessorId)
                                    ?.title
                                }
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-3 text-xs">
                            {t.plannedStart}
                            <br />
                            {t.plannedFinish}
                          </td>
                          <td className="px-2 py-3 text-xs">
                            {t.actualStart || '—'}
                            <br />
                            {t.actualFinish || '—'}
                          </td>
                          <td className="px-2 py-3">{t.weight}%</td>
                          <td className="px-2 py-3">{t.progressPct}%</td>
                          <td className="px-2 py-3">
                            {(
                              (Number(t.weight) * Number(t.progressPct)) /
                              100
                            ).toFixed(2)}
                            %
                          </td>
                          <td
                            className={`px-2 py-3 text-xs font-semibold ${taskStatus(t, data.today) === 'Terlambat' ? 'text-red-700' : 'text-teal-700'}`}
                          >
                            {taskStatus(t, data.today)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {group.map((t) => (
                  <details
                    className="mt-4 border-t pt-3"
                    key={`${t.id}-${p.updatedAt}`}
                  >
                    <summary className="cursor-pointer text-sm font-semibold">
                      {p.canEdit ? 'Edit' : 'Detail'} · {t.title}
                    </summary>
                    <TaskForm p={p} t={t} today={data.today} />
                    {p.canEdit && <ArchiveForm p={p} t={t} />}
                  </details>
                ))}
              </section>
            ) : null;
          })}
        </>
      )}
    </main>
  );
}
