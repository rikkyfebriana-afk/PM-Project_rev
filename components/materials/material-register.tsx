'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  Download,
  Edit3,
  PackageCheck,
  Save,
  Search,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { buildCsv } from '@/lib/csv';
import {
  initialMaterialActionState,
  materialStatuses,
  type MaterialActionState,
  type MaterialRecord,
  type MaterialStatusValue,
  type MaterialWorkspaceData,
} from '@/lib/materials/types';

type Props = {
  data: MaterialWorkspaceData;
  updateAction: (
    state: MaterialActionState,
    formData: FormData,
  ) => Promise<MaterialActionState>;
};

const numberFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 4,
});

const statusLabels: Record<MaterialStatusValue, string> = {
  PLANNED: 'Planned',
  ORDERED: 'Ordered',
  PARTIAL: 'Partial',
  RECEIVED: 'Received',
  INSTALLED: 'Installed',
  SHORTAGE: 'Shortage',
};

function formatQuantity(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? numberFormatter.format(parsed) : value;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function readiness(material: MaterialRecord) {
  const required = Number(material.requiredQty);
  if (!Number.isFinite(required) || required <= 0) return 0;
  return Math.min(
    100,
    Math.round((Number(material.receivedQty) / required) * 100),
  );
}

function statusStyle(status: MaterialStatusValue) {
  return {
    PLANNED: 'border-[#d6e0e4] bg-[#f5f8f9] text-[#526875]',
    ORDERED: 'border-[#c7d9e8] bg-[#eef6fb] text-[#2c6e96]',
    PARTIAL: 'border-[#efd7a8] bg-[#fff8e9] text-[#9a681e]',
    RECEIVED: 'border-[#b9dfd4] bg-[#edf8f4] text-[#17765f]',
    INSTALLED: 'border-[#acd7c9] bg-[#e3f5ee] text-[#116a53]',
    SHORTAGE: 'border-[#efc4bd] bg-[#fff1ee] text-[#c44735]',
  }[status];
}

function StatusBadge({ status }: { status: MaterialStatusValue }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${statusStyle(status)}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-[#bd4634]">{messages[0]}</p>;
}

function MaterialEditor({
  material,
  updateAction,
  onClose,
}: {
  material: MaterialRecord;
  updateAction: Props['updateAction'];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    updateAction,
    initialMaterialActionState,
  );

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [router, state.status]);

  const inputClass =
    'h-10 rounded-none border-[#d3dde2] bg-white font-mono text-sm focus-visible:border-[#315e73]';

  return (
    <section
      id="material-editor"
      tabIndex={-1}
      className="scroll-mt-4 border border-[#cbd7dc] bg-white outline-none"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#e5e9ec] p-5 md:p-6">
        <div>
          <p className="section-kicker">Supply update</p>
          <h3 className="section-title">
            {material.code || 'Material'} · {material.projectCode}
          </h3>
          <p className="mt-2 text-xs leading-5 text-[#71818b]">
            Requirement {formatQuantity(material.requiredQty)} {material.unit}{' '}
            berasal dari baseline BoQ approved.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Tutup editor"
          className="rounded-none"
        >
          <X />
        </Button>
      </div>

      <form action={formAction} className="space-y-5 p-5 md:p-6">
        <input type="hidden" name="id" value={material.id} />
        <input type="hidden" name="updatedAt" value={material.updatedAt} />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['orderedQty', 'Ordered quantity', material.orderedQty],
            ['receivedQty', 'Received quantity', material.receivedQty],
            ['installedQty', 'Installed quantity', material.installedQty],
          ].map(([name, label, value]) => (
            <label
              key={name}
              className="grid gap-2 text-xs font-semibold text-[#536873]"
            >
              {label}
              <Input
                name={name}
                type="number"
                min="0"
                step="0.0001"
                required
                defaultValue={value}
                className={inputClass}
              />
              <FieldError messages={state.fieldErrors?.[name]} />
            </label>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-2 text-xs font-semibold text-[#536873]">
            Supplier
            <Input
              name="supplier"
              defaultValue={material.supplier ?? ''}
              maxLength={160}
              className="h-10 rounded-none border-[#d3dde2]"
            />
            <FieldError messages={state.fieldErrors?.supplier} />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#536873]">
            Purchase order
            <Input
              name="purchaseOrderNo"
              defaultValue={material.purchaseOrderNo ?? ''}
              maxLength={100}
              className="h-10 rounded-none border-[#d3dde2] font-mono"
            />
            <FieldError messages={state.fieldErrors?.purchaseOrderNo} />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#536873]">
            Status
            <NativeSelect name="status" defaultValue={material.status}>
              {materialStatuses.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {statusLabels[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError messages={state.fieldErrors?.status} />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#536873]">
            Need-by date
            <Input
              name="needByDate"
              type="date"
              defaultValue={material.needByDate ?? ''}
              className="h-10 rounded-none border-[#d3dde2]"
            />
            <FieldError messages={state.fieldErrors?.needByDate} />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#536873]">
            Estimated arrival
            <Input
              name="estimatedArrival"
              type="date"
              defaultValue={material.estimatedArrival ?? ''}
              className="h-10 rounded-none border-[#d3dde2]"
            />
            <FieldError messages={state.fieldErrors?.estimatedArrival} />
          </label>
        </div>

        {state.status !== 'idle' && (
          <div
            role="status"
            className={`border px-4 py-3 text-sm ${
              state.status === 'success'
                ? 'border-[#b9dfd4] bg-[#edf8f4] text-[#17765f]'
                : 'border-[#efc4bd] bg-[#fff1ee] text-[#b94333]'
            }`}
          >
            {state.message}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-[#e7ecee] pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="rounded-none"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="rounded-none bg-[#d85832] text-white hover:bg-[#bd4727]"
          >
            <Save /> {isPending ? 'Saving…' : 'Save supply update'}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function MaterialRegister({ data, updateAction }: Props) {
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('ALL');
  const [status, setStatus] = useState<'ALL' | MaterialStatusValue>('ALL');
  const [activeOnly, setActiveOnly] = useState(true);
  const [editorId, setEditorId] = useState<string | null>(null);
  const editorMaterial =
    data.materials.find((item) => item.id === editorId) ?? null;

  useEffect(() => {
    if (!editorId) return;
    document.getElementById('material-editor')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [editorId]);

  const projects = useMemo(
    () =>
      [
        ...new Map(
          data.materials.map((item) => [
            item.projectId,
            {
              id: item.projectId,
              code: item.projectCode,
              name: item.projectName,
            },
          ]),
        ).values(),
      ].sort((left, right) => left.code.localeCompare(right.code)),
    [data.materials],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('id-ID');
    return data.materials.filter((material) => {
      const matchesSearch =
        !needle ||
        [
          material.code,
          material.description,
          material.projectCode,
          material.projectName,
          material.supplier,
          material.purchaseOrderNo,
        ]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase('id-ID').includes(needle));
      return (
        matchesSearch &&
        (projectId === 'ALL' || material.projectId === projectId) &&
        (status === 'ALL' || material.status === status) &&
        (!activeOnly || material.isActive)
      );
    });
  }, [activeOnly, data.materials, projectId, search, status]);

  function exportMaterials() {
    const csv = buildCsv([
      [
        'Project',
        'Code',
        'Description',
        'Unit',
        'Required',
        'Ordered',
        'Received',
        'Installed',
        'Status',
        'Supplier',
        'PO',
        'Need By',
        'ETA',
        'Active',
      ],
      ...visible.map((material) => [
        material.projectCode,
        material.code ?? '',
        material.description,
        material.unit,
        material.requiredQty,
        material.orderedQty,
        material.receivedQty,
        material.installedQty,
        statusLabels[material.status],
        material.supplier ?? '',
        material.purchaseOrderNo ?? '',
        material.needByDate ?? '',
        material.estimatedArrival ?? '',
        material.isActive ? 'Yes' : 'No',
      ]),
    ]);
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'material-register.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 pb-24 md:p-7 lg:pb-9 xl:p-9">
      <section className="border border-[#dce2e6] bg-white p-5 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="section-kicker text-[#d85832]!">Supply readiness</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[#172d3e] md:text-3xl">
              Material Register
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6e7e88]">
              Pantau requirement dari baseline BoQ, purchase order, penerimaan,
              instalasi, supplier, ETA, dan shortage per project.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={exportMaterials}
            className="h-10 rounded-none border-[#d7e0e4] px-4"
          >
            <Download /> Export CSV
          </Button>
        </div>
        {data.demoMode && (
          <div className="mt-5 flex items-start gap-3 border border-[#ecd6b1] bg-[#fff9ee] px-4 py-3 text-xs leading-5 text-[#8e6224]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Mode demo
            menampilkan contoh material read-only. Data live terbentuk saat BoQ
            disetujui.
          </div>
        )}
      </section>

      <section className="grid overflow-hidden border border-[#dce2e6] bg-white sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Readiness',
            value: `${data.metrics.readinessPct}%`,
            note: 'Rata-rata penerimaan per item',
            icon: PackageCheck,
            accent: 'bg-[#1c9377]',
          },
          {
            label: 'Active materials',
            value: data.metrics.active,
            note: 'Dari baseline approved',
            icon: Boxes,
            accent: 'bg-[#17364a]',
          },
          {
            label: 'Shortages',
            value: data.metrics.shortage,
            note: 'Perlu tindakan procurement',
            icon: AlertTriangle,
            accent: 'bg-[#d85832]',
          },
          {
            label: 'Late ETA',
            value: data.metrics.lateEta,
            note: 'ETA lewat, belum lengkap',
            icon: CalendarClock,
            accent: 'bg-[#b87b23]',
          },
        ].map((metric, index) => (
          <article
            key={metric.label}
            className={`relative min-h-32 p-5 ${index % 2 ? 'sm:border-l sm:border-[#e5e9ec]' : ''} ${index ? 'xl:border-l xl:border-[#e5e9ec]' : ''}`}
          >
            <span
              className={`absolute inset-y-0 left-0 w-1 ${metric.accent}`}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7d8b95]">
                {metric.label}
              </p>
              <metric.icon className="size-4 text-[#82929b]" />
            </div>
            <p className="mt-4 font-mono text-3xl font-semibold tracking-[-0.05em] text-[#17364a]">
              {metric.value}
            </p>
            <p className="mt-2 text-[11px] text-[#88949c]">{metric.note}</p>
          </article>
        ))}
      </section>

      {editorMaterial && (
        <MaterialEditor
          key={`${editorMaterial.id}-${editorMaterial.updatedAt}`}
          material={editorMaterial}
          updateAction={updateAction}
          onClose={() => setEditorId(null)}
        />
      )}

      <section className="border border-[#dce2e6] bg-white">
        <div className="grid gap-3 border-b border-[#e5e9ec] p-4 md:grid-cols-[minmax(240px,1fr)_220px_180px_auto] md:p-5">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#86939b]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari code, material, supplier, PO…"
              className="h-10 rounded-none border-[#d7e0e4] pl-10"
            />
          </label>
          <NativeSelect
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <NativeSelectOption value="ALL">All projects</NativeSelectOption>
            {projects.map((project) => (
              <NativeSelectOption key={project.id} value={project.id}>
                {project.code} — {project.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as 'ALL' | MaterialStatusValue)
            }
          >
            <NativeSelectOption value="ALL">All statuses</NativeSelectOption>
            {materialStatuses.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {statusLabels[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <label className="flex h-10 items-center gap-2 border border-[#d7e0e4] px-3 text-xs font-semibold text-[#596e7a]">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(event) => setActiveOnly(event.target.checked)}
              className="accent-[#17364a]"
            />{' '}
            Active only
          </label>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead className="bg-[#f4f7f8] text-[9px] font-bold uppercase tracking-[0.11em] text-[#71818b]">
              <tr>
                <th className="px-4 py-3">Project / material</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Required</th>
                <th className="px-4 py-3 text-right">Ordered</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Installed</th>
                <th className="px-4 py-3">Supplier / PO</th>
                <th className="px-4 py-3">Need by / ETA</th>
                <th className="w-24 px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f2] text-xs text-[#435966]">
              {visible.map((material) => (
                <tr
                  key={material.id}
                  className={
                    !material.isActive ? 'bg-[#f7f8f8] opacity-65' : undefined
                  }
                >
                  <td className="max-w-sm px-4 py-4 align-top">
                    <p className="font-mono text-[10px] font-semibold text-[#d85832]">
                      {material.projectCode} · {material.boqItemNo || 'Manual'}
                    </p>
                    <p className="mt-1 font-semibold text-[#263f4e]">
                      {material.code || 'No code'} · {material.description}
                    </p>
                    <div className="mt-3 h-1.5 w-40 bg-[#e7ecee]">
                      <div
                        className="h-full bg-[#1c9377]"
                        style={{ width: `${readiness(material)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <StatusBadge status={material.status} />
                  </td>
                  {[
                    material.requiredQty,
                    material.orderedQty,
                    material.receivedQty,
                    material.installedQty,
                  ].map((value, index) => (
                    <td
                      key={index}
                      className="px-4 py-4 text-right font-mono align-top"
                    >
                      {formatQuantity(value)} {index === 0 ? material.unit : ''}
                    </td>
                  ))}
                  <td className="px-4 py-4 align-top">
                    <p>{material.supplier || '—'}</p>
                    <p className="mt-1 font-mono text-[10px] text-[#87949c]">
                      {material.purchaseOrderNo || 'No PO'}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p>Need {formatDate(material.needByDate)}</p>
                    <p className="mt-1 text-[10px] text-[#87949c]">
                      ETA {formatDate(material.estimatedArrival)}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    {material.canEdit && material.isActive ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditorId(material.id)}
                        aria-label={`Update ${material.code || material.description}`}
                        className="rounded-none"
                      >
                        <Edit3 />
                      </Button>
                    ) : (
                      <span className="text-[#9da8ae]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-[#edf0f2] lg:hidden">
          {visible.map((material) => (
            <article
              key={material.id}
              className={`p-5 ${!material.isActive ? 'bg-[#f7f8f8] opacity-65' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] font-semibold text-[#d85832]">
                    {material.projectCode} · {material.code || 'No code'}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-[#263f4e]">
                    {material.description}
                  </h3>
                </div>
                <StatusBadge status={material.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 bg-[#f6f8f9] p-3 text-[10px] sm:grid-cols-4">
                {[
                  ['Required', material.requiredQty],
                  ['Ordered', material.orderedQty],
                  ['Received', material.receivedQty],
                  ['Installed', material.installedQty],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="uppercase tracking-[0.08em] text-[#85929a]">
                      {label}
                    </p>
                    <p className="mt-1 font-mono font-semibold text-[#2f4654]">
                      {formatQuantity(value)} {material.unit}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[#667985]">
                <span className="flex items-center gap-1.5">
                  <Truck className="size-3.5" />{' '}
                  {material.supplier || 'Supplier belum diisi'}
                </span>
                <span>{readiness(material)}%</span>
              </div>
              {material.canEdit && material.isActive && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditorId(material.id)}
                  className="mt-4 w-full rounded-none"
                >
                  <Edit3 /> Update supply
                </Button>
              )}
            </article>
          ))}
        </div>

        {!visible.length && (
          <div className="grid min-h-56 place-items-center p-8 text-center">
            <div>
              <Boxes className="mx-auto size-8 text-[#a2adb3]" />
              <p className="mt-4 text-sm font-semibold text-[#526875]">
                Tidak ada material yang cocok
              </p>
              <p className="mt-1 text-xs text-[#8a969e]">
                Ubah filter atau approve baseline BoQ untuk membuat Material
                Register.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
