'use client';
import { useActionState, useState } from 'react';
import { saveOperation, saveActionItem } from '@/app/actions/operations';
import type {
  OperationsData,
  OperationRecord,
  ActionRecord,
} from '@/lib/operations/queries';
import { idleState, type OperationPhase } from '@/lib/operations/validation';
import {
  Field,
  inputClass,
  buttonClass,
  panelClass,
  MutationFeedback,
  WorkspaceIntro,
  Metrics,
} from './workspace-ui';
import { DocumentUpload } from './document-upload';

function OperationForm({
  data,
  phases,
  record,
}: {
  data: OperationsData;
  phases: OperationPhase[];
  record?: OperationRecord;
}) {
  const [state, action, pending] = useActionState(saveOperation, idleState);
  const enabled =
    !data.demoMode &&
    (record ? record.canEdit : data.projects.some((p) => p.canEdit));
  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={record?.id ?? ''} />
      <input type="hidden" name="updatedAt" value={record?.updatedAt ?? ''} />
      <fieldset
        disabled={!enabled || pending}
        className="grid gap-4 md:grid-cols-2"
      >
        <Field label="Project">
          {record ? (
            <>
              <input type="hidden" name="projectId" value={record.projectId} />
              <span>{record.projectCode}</span>
            </>
          ) : (
            <select name="projectId" required className={inputClass}>
              {data.projects
                .filter((p) => p.canEdit)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <Field label="Fase">
          <select
            name="phase"
            className={inputClass}
            defaultValue={record?.phase ?? phases[0]}
          >
            {(record ? [record.phase] : phases).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Pekerjaan / pemeriksaan">
          <input
            name="title"
            required
            minLength={3}
            maxLength={180}
            defaultValue={record?.title}
            className={inputClass}
          />
        </Field>
        <Field label="Target selesai">
          <input
            name="plannedDate"
            type="date"
            required
            defaultValue={record?.plannedDate}
            className={inputClass}
          />
        </Field>
        <Field label="Progress (%)">
          <input
            name="progressPct"
            type="number"
            min="0"
            max="100"
            step="0.01"
            required
            defaultValue={record?.progressPct ?? '0'}
            className={inputClass}
          />
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={record?.status ?? 'UPCOMING'}
            className={inputClass}
          >
            <option value="UPCOMING">Berjalan / sesuai rencana</option>
            <option value="AT_RISK">Perlu perhatian</option>
            <option value="OVERDUE">Terlambat</option>
            <option value="COMPLETED">Selesai</option>
          </select>
        </Field>
        <Field label="Penanggung jawab">
          <input
            name="responsible"
            maxLength={120}
            defaultValue={record?.responsible}
            className={inputClass}
          />
        </Field>
        <Field label="Nomor laporan / DO / BAST">
          <input
            name="referenceNo"
            maxLength={100}
            defaultValue={record?.referenceNo}
            className={inputClass}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Catatan hasil, lokasi, atau kendala">
            <textarea
              name="notes"
              maxLength={4000}
              rows={3}
              defaultValue={record?.notes}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>
      <MutationFeedback state={state} />
      <button className={buttonClass} disabled={!enabled || pending}>
        {pending ? 'Menyimpan…' : 'Simpan milestone'}
      </button>
    </form>
  );
}

export function ActionForm({
  data,
  record,
  milestone,
}: {
  data: OperationsData;
  record?: ActionRecord;
  milestone?: OperationRecord;
}) {
  const [state, action, pending] = useActionState(saveActionItem, idleState);
  const enabled =
    !data.demoMode &&
    (record
      ? record.canEdit
      : milestone
        ? milestone.canEdit
        : data.projects.some((p) => p.canEdit));
  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="id" value={record?.id ?? ''} />
      <input type="hidden" name="updatedAt" value={record?.updatedAt ?? ''} />
      <input
        type="hidden"
        name="milestoneId"
        value={record?.milestoneId ?? milestone?.id ?? ''}
      />
      <fieldset
        disabled={!enabled || pending}
        className="grid gap-3 md:grid-cols-2"
      >
        <Field label="Project">
          {record || milestone ? (
            <>
              <input
                name="projectId"
                type="hidden"
                value={record?.projectId ?? milestone?.projectId}
              />
              <span>{record?.projectCode ?? milestone?.projectCode}</span>
            </>
          ) : (
            <select name="projectId" className={inputClass}>
              {data.projects
                .filter((p) => p.canEdit)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <Field label="Temuan / tindakan">
          <input
            name="title"
            required
            minLength={3}
            maxLength={180}
            defaultValue={record?.title}
            className={inputClass}
          />
        </Field>
        <Field label="Prioritas">
          <select
            name="priority"
            defaultValue={record?.priority ?? 'MEDIUM'}
            className={inputClass}
          >
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={record?.status ?? 'OPEN'}
            className={inputClass}
          >
            {['OPEN', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Batas waktu">
          <input
            name="dueAt"
            type="date"
            defaultValue={record?.dueAt}
            className={inputClass}
          />
        </Field>
        <Field label="Detail / bukti penyelesaian">
          <textarea
            name="description"
            maxLength={4000}
            defaultValue={record?.description}
            className={inputClass}
          />
        </Field>
      </fieldset>
      <MutationFeedback state={state} />
      <button className={buttonClass} disabled={!enabled || pending}>
        {pending ? 'Menyimpan…' : 'Simpan action'}
      </button>
    </form>
  );
}

export function OperationsWorkspace({
  data,
  phases,
  title,
  description,
}: {
  data: OperationsData;
  phases: OperationPhase[];
  title: string;
  description: string;
}) {
  const [project, setProject] = useState('');
  const [search, setSearch] = useState('');
  const rows = data.operations.filter(
    (r) =>
      (!project || r.projectId === project) &&
      `${r.title} ${r.referenceNo} ${r.responsible}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const completed = rows.filter((r) => r.status === 'COMPLETED').length;
  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 pb-24 md:p-7 lg:pb-9">
      <WorkspaceIntro
        title={title}
        description={description}
        demo={data.demoMode}
      />
      <Metrics
        items={[
          { label: 'Milestone', value: rows.length },
          { label: 'Selesai', value: completed },
          {
            label: 'Perlu perhatian',
            value: rows.filter((r) => ['AT_RISK', 'OVERDUE'].includes(r.status))
              .length,
          },
          {
            label: 'Action terbuka',
            value: data.actions.filter(
              (a) =>
                a.status !== 'RESOLVED' &&
                (!project || a.projectId === project),
            ).length,
          },
        ]}
      />
      <div className={`${panelClass} grid gap-3 sm:grid-cols-2`}>
        <Field label="Project">
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
        <Field label="Cari pekerjaan">
          <input
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pekerjaan, nomor, penanggung jawab"
          />
        </Field>
      </div>
      <details className={panelClass}>
        <summary className="cursor-pointer font-semibold">
          + Tambah milestone {title}
        </summary>
        <OperationForm data={data} phases={phases} />
      </details>
      {rows.length === 0 && (
        <p className={panelClass}>Belum ada milestone yang sesuai filter.</p>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {rows.map((r) => (
          <article key={r.id} className={panelClass}>
            <div className="flex justify-between gap-3 text-xs">
              <span className="font-semibold text-[#d85832]">
                {r.projectCode} · {r.phase}
              </span>
              <span
                className={
                  r.status === 'COMPLETED'
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }
              >
                {r.status}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">{r.title}</h3>
            <p className="mt-2 text-xs text-slate-500">
              Target {r.plannedDate} · {r.responsible || 'PIC belum ditetapkan'}
            </p>
            <div className="mt-4 h-2 bg-slate-100">
              <div
                className="h-full bg-teal-600"
                style={{ width: `${r.progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-right font-mono text-xs">
              {r.progressPct}%
            </p>
            <details>
              <summary className="mt-3 cursor-pointer text-sm font-semibold">
                Detail & pembaruan
              </summary>
              <OperationForm
                key={r.updatedAt}
                data={data}
                phases={phases}
                record={r}
              />
              <div className="mt-4 space-y-2">
                {r.documents.map((d) => (
                  <a
                    className="block break-all text-sm text-teal-700 underline"
                    key={d.id}
                    href={`/api/documents/${d.id}/download`}
                  >
                    {d.originalName}
                  </a>
                ))}
              </div>
              {r.canEdit && !data.demoMode && (
                <DocumentUpload
                  projectId={r.projectId}
                  milestoneId={r.id}
                  category={
                    r.phase === 'FAT'
                      ? 'FAT'
                      : r.phase === 'DELIVERY'
                        ? 'DELIVERY_ORDER'
                        : r.phase === 'BAST'
                          ? 'BAST'
                          : 'PROGRESS_PHOTO'
                  }
                />
              )}
            </details>
            {data.actions
              .filter((a) => a.milestoneId === r.id)
              .map((a) => (
                <details key={a.id} className="mt-4 border-t pt-3">
                  <summary className="cursor-pointer text-sm">
                    {a.status === 'RESOLVED' ? '✓' : '!'} {a.title} · {a.status}
                  </summary>
                  <ActionForm key={a.updatedAt} data={data} record={a} />
                </details>
              ))}
            {r.status !== 'COMPLETED' && (
              <details className="mt-4 border-t pt-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  + Temuan / punch list
                </summary>
                <ActionForm data={data} milestone={r} />
              </details>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}

export function ActionsWorkspace({ data }: { data: OperationsData }) {
  const [openOnly, setOpenOnly] = useState(true);
  return (
    <main className="mx-auto max-w-[1400px] space-y-5 p-4 pb-24 md:p-7">
      <WorkspaceIntro
        title="Action Center"
        description="Temuan, kendala, dan tindakan tindak lanjut dari seluruh project yang dapat Anda akses."
        demo={data.demoMode}
      />
      <details className={panelClass}>
        <summary className="cursor-pointer font-semibold">
          + Tambah action
        </summary>
        <ActionForm data={data} />
      </details>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={openOnly}
          onChange={(e) => setOpenOnly(e.target.checked)}
        />
        Hanya action terbuka
      </label>
      {data.actions
        .filter((a) => !openOnly || a.status !== 'RESOLVED')
        .map((a) => (
          <details key={a.id} className={panelClass}>
            <summary className="cursor-pointer">
              <span className="text-xs text-[#d85832]">
                {a.projectCode} · {a.priority}
              </span>
              <strong className="mt-2 block">{a.title}</strong>
              <span className="text-xs text-slate-500">
                {a.status} · {a.dueAt || 'Tanpa batas waktu'}
              </span>
            </summary>
            <ActionForm key={a.updatedAt} data={data} record={a} />
          </details>
        ))}
      {data.actions.filter((a) => !openOnly || a.status !== 'RESOLVED')
        .length === 0 && (
        <p className={panelClass}>Tidak ada action yang sesuai.</p>
      )}
    </main>
  );
}
