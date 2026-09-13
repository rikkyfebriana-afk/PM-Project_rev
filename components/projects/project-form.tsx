'use client';

import { useActionState, useEffect } from 'react';
import { Archive, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  archiveProjectAction,
  createProjectAction,
  updateProjectAction,
} from '@/app/actions/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { initialProjectActionState } from '@/lib/projects/action-state';
import {
  healthLabels,
  phaseLabels,
  statusLabels,
} from '@/lib/projects/presentation';
import {
  projectHealthValues,
  projectPhases,
  projectStatuses,
  type ProjectManagerOption,
  type ProjectRecord,
} from '@/lib/projects/types';

type ProjectFormProps = {
  project: ProjectRecord | null;
  managers: ProjectManagerOption[];
  canAssignManager: boolean;
  canArchive: boolean;
  demoMode: boolean;
  onClose: () => void;
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1.5 text-xs text-[#c94e3b]">{messages[0]}</p>;
}

function FormField({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={name} className="mb-2 text-xs text-[#526672]">
        {label}
      </Label>
      {children}
      <FieldError messages={error} />
    </div>
  );
}

function StaticSelect({
  name,
  value,
  label,
}: {
  name: string;
  value: string;
  label: string;
}) {
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <div className="flex h-10 items-center border border-[#dce2e6] bg-[#f4f6f7] px-3 text-sm text-[#526672]">
        {label}
      </div>
    </>
  );
}

export function ProjectForm({
  project,
  managers,
  canAssignManager,
  canArchive,
  demoMode,
  onClose,
}: ProjectFormProps) {
  const router = useRouter();
  const action = project ? updateProjectAction : createProjectAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialProjectActionState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveProjectAction,
    initialProjectActionState,
  );
  const masterEditable = canAssignManager;
  const disabled = pending || demoMode;
  const currentManagerIsLegacy = Boolean(
    project?.projectManagerId &&
    !managers.some((manager) => manager.id === project.projectManagerId),
  );

  useEffect(() => {
    if (state.status === 'success' || archiveState.status === 'success') {
      router.refresh();
      onClose();
    }
  }, [archiveState.status, onClose, router, state.status]);

  return (
    <section
      id="project-editor"
      tabIndex={-1}
      aria-labelledby="project-editor-title"
      className="scroll-mt-24 border border-[#ccd7dc] bg-white shadow-[0_18px_45px_rgba(23,45,62,0.08)] outline-none"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#e4e9ec] bg-[#f8fafb] px-5 py-5 md:px-7">
        <div>
          <p className="section-kicker text-[#d85832]!">
            {project ? 'Update project' : 'New project'}
          </p>
          <h2
            id="project-editor-title"
            className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#173044]"
          >
            {project
              ? `${project.code} · ${project.name}`
              : 'Create project record'}
          </h2>
          <p className="mt-2 text-xs leading-5 text-[#74838d]">
            {masterEditable
              ? 'Lengkapi master data, delivery control, komersial, jadwal, dan lokasi.'
              : 'Anda dapat memperbarui progress, fase, health, jadwal, dan lokasi project yang dikelola.'}
          </p>
        </div>
        <Button
          type="button"
          aria-label="Close editor"
          variant="ghost"
          size="icon"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      {demoMode && (
        <div className="border-b border-[#f0d5b2] bg-[#fff8ec] px-5 py-3 text-xs text-[#94621e] md:px-7">
          Mode demo hanya baca. Form aktif otomatis setelah PostgreSQL
          terhubung.
        </div>
      )}

      <form action={formAction}>
        {project && (
          <>
            <input type="hidden" name="id" value={project.id} />
            <input type="hidden" name="updatedAt" value={project.updatedAt} />
          </>
        )}
        <div className="grid gap-8 p-5 md:p-7 xl:grid-cols-2">
          <fieldset className="space-y-5" disabled={pending}>
            <legend className="mb-5 border-b border-[#e7ebed] pb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#324c5c]">
              Identity & control
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Project code"
                name="code"
                error={state.fieldErrors?.code}
              >
                <Input
                  id="code"
                  name="code"
                  required
                  readOnly={!masterEditable}
                  defaultValue={project?.code ?? ''}
                  placeholder="PCC-036"
                  className="h-10 rounded-none read-only:bg-[#f4f6f7]"
                />
              </FormField>
              <FormField
                label="Client"
                name="clientName"
                error={state.fieldErrors?.clientName}
              >
                <Input
                  id="clientName"
                  name="clientName"
                  readOnly={!masterEditable}
                  defaultValue={project?.clientName ?? ''}
                  placeholder="PT Client Indonesia"
                  className="h-10 rounded-none read-only:bg-[#f4f6f7]"
                />
              </FormField>
            </div>
            <FormField
              label="Project name"
              name="name"
              error={state.fieldErrors?.name}
            >
              <Input
                id="name"
                name="name"
                required
                readOnly={!masterEditable}
                defaultValue={project?.name ?? ''}
                placeholder="Nama project"
                className="h-10 rounded-none read-only:bg-[#f4f6f7]"
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Status"
                name="status"
                error={state.fieldErrors?.status}
              >
                {masterEditable ? (
                  <NativeSelect
                    className="w-full"
                    id="status"
                    name="status"
                    defaultValue={project?.status ?? 'ACTIVE'}
                  >
                    {projectStatuses.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {statusLabels[value]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <StaticSelect
                    name="status"
                    value={project?.status ?? 'ACTIVE'}
                    label={statusLabels[project?.status ?? 'ACTIVE']}
                  />
                )}
              </FormField>
              <FormField
                label="Health"
                name="health"
                error={state.fieldErrors?.health}
              >
                <NativeSelect
                  className="w-full"
                  id="health"
                  name="health"
                  defaultValue={project?.health ?? 'ON_TRACK'}
                >
                  {projectHealthValues.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {healthLabels[value]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField
                label="Phase"
                name="phase"
                error={state.fieldErrors?.phase}
              >
                <NativeSelect
                  className="w-full"
                  id="phase"
                  name="phase"
                  defaultValue={project?.phase ?? 'PLANNING'}
                >
                  {projectPhases.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {phaseLabels[value]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField
                label="Progress (%)"
                name="progressPct"
                error={state.fieldErrors?.progressPct}
              >
                <Input
                  id="progressPct"
                  name="progressPct"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  defaultValue={project?.progressPct ?? 0}
                  className="h-10 rounded-none"
                />
              </FormField>
            </div>
            <FormField
              label="Project manager"
              name="projectManagerId"
              error={state.fieldErrors?.projectManagerId}
            >
              {canAssignManager ? (
                <NativeSelect
                  className="w-full"
                  id="projectManagerId"
                  name="projectManagerId"
                  defaultValue={project?.projectManagerId ?? ''}
                >
                  <NativeSelectOption value="">Unassigned</NativeSelectOption>
                  {currentManagerIsLegacy && project?.projectManagerId && (
                    <NativeSelectOption value={project.projectManagerId}>
                      {project.projectManagerName ?? 'Unknown user'} · current
                      assignment
                    </NativeSelectOption>
                  )}
                  {managers.map((manager) => (
                    <NativeSelectOption key={manager.id} value={manager.id}>
                      {manager.displayName} · {manager.username}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : (
                <StaticSelect
                  name="projectManagerId"
                  value={project?.projectManagerId ?? ''}
                  label={project?.projectManagerName ?? 'Unassigned'}
                />
              )}
            </FormField>
          </fieldset>

          <div className="space-y-8">
            <fieldset className="space-y-5" disabled={pending}>
              <legend className="mb-5 border-b border-[#e7ebed] pb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#324c5c]">
                Commercial
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ['poValue', 'PO value', project?.poValue ?? '0'],
                    ['budgetValue', 'Budget', project?.budgetValue ?? '0'],
                    ['actualCost', 'Actual cost', project?.actualCost ?? '0'],
                    [
                      'forecastCost',
                      'Forecast cost',
                      project?.forecastCost ?? '0',
                    ],
                  ] as const
                ).map(([name, label, value]) => (
                  <FormField
                    key={name}
                    label={label}
                    name={name}
                    error={state.fieldErrors?.[name]}
                  >
                    <Input
                      id={name}
                      name={name}
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      readOnly={!masterEditable}
                      defaultValue={value}
                      className="h-10 rounded-none font-mono read-only:bg-[#f4f6f7]"
                    />
                  </FormField>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-5" disabled={pending}>
              <legend className="mb-5 border-b border-[#e7ebed] pb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#324c5c]">
                Schedule & location
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  label="Planned start"
                  name="plannedStart"
                  error={state.fieldErrors?.plannedStart}
                >
                  <Input
                    id="plannedStart"
                    name="plannedStart"
                    type="date"
                    defaultValue={project?.plannedStart ?? ''}
                    className="h-10 rounded-none"
                  />
                </FormField>
                <FormField
                  label="Planned finish"
                  name="plannedFinish"
                  error={state.fieldErrors?.plannedFinish}
                >
                  <Input
                    id="plannedFinish"
                    name="plannedFinish"
                    type="date"
                    defaultValue={project?.plannedFinish ?? ''}
                    className="h-10 rounded-none"
                  />
                </FormField>
                <FormField
                  label="Actual finish"
                  name="actualFinish"
                  error={state.fieldErrors?.actualFinish}
                >
                  <Input
                    id="actualFinish"
                    name="actualFinish"
                    type="date"
                    defaultValue={project?.actualFinish ?? ''}
                    className="h-10 rounded-none"
                  />
                </FormField>
              </div>
              <FormField
                label="Address"
                name="address"
                error={state.fieldErrors?.address}
              >
                <Textarea
                  id="address"
                  name="address"
                  defaultValue={project?.address ?? ''}
                  placeholder="Alamat site project"
                  className="min-h-20 rounded-none"
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Latitude"
                  name="latitude"
                  error={state.fieldErrors?.latitude}
                >
                  <Input
                    id="latitude"
                    name="latitude"
                    type="number"
                    min="-90"
                    max="90"
                    step="0.000001"
                    defaultValue={project?.latitude ?? ''}
                    placeholder="-6.200000"
                    className="h-10 rounded-none font-mono"
                  />
                </FormField>
                <FormField
                  label="Longitude"
                  name="longitude"
                  error={state.fieldErrors?.longitude}
                >
                  <Input
                    id="longitude"
                    name="longitude"
                    type="number"
                    min="-180"
                    max="180"
                    step="0.000001"
                    defaultValue={project?.longitude ?? ''}
                    placeholder="106.816666"
                    className="h-10 rounded-none font-mono"
                  />
                </FormField>
              </div>
            </fieldset>
          </div>
        </div>

        {state.status === 'error' && (
          <p
            role="alert"
            className="mx-5 mb-5 border border-[#efc8c1] bg-[#fff3f0] px-4 py-3 text-xs text-[#b94735] md:mx-7"
          >
            {state.message}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-[#e4e9ec] bg-[#f8fafb] px-5 py-4 sm:flex-row sm:items-center sm:justify-end md:px-7">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 rounded-none px-5"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={disabled}
            className="h-10 rounded-none bg-[#17364a] px-5 text-white"
          >
            <Save />{' '}
            {pending ? 'Saving…' : project ? 'Save changes' : 'Create project'}
          </Button>
        </div>
      </form>

      {project && canArchive && (
        <form
          action={archiveAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `Archive ${project.code}? Data tidak dihapus permanen.`,
              )
            )
              event.preventDefault();
          }}
          className="border-t border-[#eadbd8] bg-[#fff8f6] px-5 py-4 md:px-7"
        >
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="updatedAt" value={project.updatedAt} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6c4038]">
                Archive project
              </p>
              <p className="mt-1 text-xs text-[#96736d]">
                Project disembunyikan dari workspace tetapi audit history tetap
                tersimpan.
              </p>
            </div>
            <Button
              type="submit"
              variant="destructive"
              disabled={archivePending || demoMode}
              className="h-9 rounded-none px-4"
            >
              <Archive /> {archivePending ? 'Archiving…' : 'Archive'}
            </Button>
          </div>
          {archiveState.status === 'error' && (
            <p role="alert" className="mt-3 text-xs text-[#b94735]">
              {archiveState.message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
