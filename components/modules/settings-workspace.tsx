'use client';
import { useActionState, useState } from 'react';
import { hasFullAccess } from '@/lib/auth/roles';
import {
  createUser,
  setUserActive,
  saveMembership,
  changePassword,
} from '@/app/actions/settings';
import type { SettingsData } from '@/lib/settings/queries';
import { idleState } from '@/lib/operations/validation';
import {
  WorkspaceIntro,
  Field,
  inputClass,
  buttonClass,
  panelClass,
  MutationFeedback,
} from './workspace-ui';
function UserForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(createUser, idleState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <fieldset
        disabled={disabled || pending}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Field label="Username">
          <input
            name="username"
            minLength={3}
            maxLength={50}
            required
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <Field label="Nama pengguna">
          <input
            name="displayName"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>
        <Field label="Role">
          <select name="role" className={inputClass}>
            <option>VIEWER</option>
            <option>PROJECT_MANAGER</option>
            <option>ADMIN</option>
          </select>
        </Field>
        <Field label="Password awal (minimal 12 karakter)">
          <input
            name="password"
            type="password"
            minLength={12}
            maxLength={72}
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </Field>
      </fieldset>
      <MutationFeedback state={state} />
      <button disabled={disabled || pending} className={buttonClass}>
        Buat akun
      </button>
    </form>
  );
}
function ActiveForm({ id, active }: { id: string; active: boolean }) {
  const [state, action, pending] = useActionState(setUserActive, idleState);
  return (
    <form action={action}>
      <input name="id" value={id} type="hidden" />
      <input name="active" value={active ? 'false' : 'true'} type="hidden" />
      <button disabled={pending} className="text-xs text-teal-700 underline">
        {active ? 'Nonaktifkan' : 'Aktifkan'}
      </button>
      <MutationFeedback state={state} />
    </form>
  );
}
function MemberForm({ data }: { data: SettingsData }) {
  const [state, action, pending] = useActionState(saveMembership, idleState);
  const [selected, setSelected] = useState<string[]>([]);
  const [operation, setOperation] = useState('add');
  const activeUsers = data.users.filter(u => u.isActive);
  const [userId, setUserId] = useState(activeUsers[0]?.id ?? '');
  const target = activeUsers.find(u => u.id === userId);
  const selectedIds = selected.filter(id => data.projects.some(p => p.id === id));
  const allSelected = data.projects.length > 0 && selectedIds.length === data.projects.length;
  return (
    <form action={action} className="mt-4 space-y-3">
      <fieldset
        disabled={data.demoMode || pending}
        className="grid gap-3 sm:grid-cols-3"
      >
        <div className="space-y-2 sm:col-span-3">
          <label className="flex items-center gap-3 border bg-slate-50 p-3 font-semibold">
            <input type="checkbox" checked={allSelected} disabled={!data.projects.length}
              onChange={e => setSelected(e.target.checked ? data.projects.map(p => p.id) : [])}/>
            Pilih semua PO / proyek
          </label>
          <p className="text-sm text-slate-600" aria-live="polite">{selectedIds.length} dari {data.projects.length} proyek dipilih. Berlaku untuk proyek yang terdaftar saat ini.</p>
          <div className="grid max-h-64 gap-2 overflow-y-auto border p-3 sm:grid-cols-2">
            {data.projects.map(p => <label key={p.id} className="flex min-w-0 items-start gap-2 rounded p-2 hover:bg-slate-50">
              <input type="checkbox" name="projectIds" value={p.id} checked={selectedIds.includes(p.id)} className="mt-1 shrink-0"
                onChange={e => setSelected(ids => e.target.checked ? [...ids,p.id] : ids.filter(id => id !== p.id))}/>
              <span className="min-w-0 break-words text-sm"><strong>{p.code}</strong><span className="block text-slate-600">{p.name}</span></span>
            </label>)}
            {!data.projects.length && <p className="text-sm">Belum ada proyek.</p>}
          </div>
        </div>
        <Field label="Pengguna">
          <select name="userId" value={userId} onChange={e => setUserId(e.target.value)} className={inputClass}>
            {data.users
              .filter((u) => u.isActive)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.role})
                </option>
              ))}
          </select>
        </Field>
        <Field label="Perubahan akses">
          <select name="operation" value={operation} onChange={e => setOperation(e.target.value)} className={inputClass}>
            <option value="add">Tambahkan akses baca</option>
            <option value="remove">Cabut akses anggota</option>
          </select>
        </Field>
        {target && hasFullAccess(target.role) && <p className="text-sm text-teal-800 sm:col-span-3">Akun ADMIN dan PROJECT_MANAGER sudah memiliki akses penuh ke semua proyek dan PO. Keanggotaan tambahan tidak diperlukan dan tidak mencabut akses penuh akun tersebut.</p>}
        {target?.role === 'VIEWER' && <p className="text-sm text-amber-800 sm:col-span-3">Untuk membuka semua data Proyek, PO, Material dan BoQ bagi Viewer, gunakan Pengaturan Izin Viewer di atas. Keanggotaan tidak mengganti izin Viewer.</p>}
        {operation === 'remove' && selectedIds.length > 1 && <label className="flex items-start gap-2 text-sm text-red-800 sm:col-span-3">
          <input key={`${userId}-${selectedIds.join(',')}`} type="checkbox" name="confirmBulkRemove" value="yes" required/>
          Saya mengonfirmasi pencabutan keanggotaan pengguna ini dari {selectedIds.length} proyek yang dipilih. Akses penuh Admin dan Project Manager tidak berubah.
        </label>}
      </fieldset>
      <MutationFeedback state={state} />
      <button disabled={data.demoMode || pending || !selectedIds.length || !target} className={buttonClass}>
        {pending ? 'Menyimpan…' : `Simpan akses (${selectedIds.length} proyek)`}
      </button>
    </form>
  );
}
function PasswordForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(changePassword, idleState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <fieldset
        disabled={disabled || pending}
        className="grid gap-3 sm:grid-cols-3"
      >
        <Field label="Password saat ini">
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
        <Field label="Password baru">
          <input
            type="password"
            name="password"
            minLength={12}
            maxLength={72}
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </Field>
        <Field label="Ulangi password baru">
          <input
            type="password"
            name="confirmation"
            minLength={12}
            maxLength={72}
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </Field>
      </fieldset>
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}{' '}
          {state.status === 'success' && (
            <a href="/login" className="underline">
              Login kembali
            </a>
          )}
        </p>
      )}
      <button disabled={disabled || pending} className={buttonClass}>
        Ganti password
      </button>
    </form>
  );
}
export function SettingsWorkspace({ data }: { data: SettingsData }) {
  return (
    <main className="mx-auto max-w-[1400px] space-y-5 p-4 pb-24 md:p-7">
      <WorkspaceIntro
        title="Settings"
        description="Kelola akun, akses anggota project, password, dan riwayat aktivitas."
        demo={data.demoMode}
      />
      <section className={panelClass}>
        <h3 className="font-semibold">Password akun Anda</h3>
        <PasswordForm disabled={data.demoMode} />
      </section>
      {data.isAdmin && (
        <>
          <details className={panelClass}>
            <summary className="cursor-pointer font-semibold">
              + Tambah pengguna
            </summary>
            <UserForm disabled={data.demoMode} />
          </details>
          <section className={panelClass}>
            <h3 className="font-semibold">Pengguna</h3>
            <div className="mt-3 divide-y">
              {data.users.map((u) => (
                <div
                  className="flex flex-wrap justify-between gap-3 py-3"
                  key={u.id}
                >
                  <div>
                    <p className="text-sm font-semibold">{u.displayName}</p>
                    <p className="text-xs text-slate-500">
                      {u.username} · {u.role} ·{' '}
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </p>
                  </div>
                  {u.id !== data.currentUserId && (
                    <ActiveForm id={u.id} active={u.isActive} />
                  )}
                </div>
              ))}
              {!data.users.length && (
                <p className="text-sm text-slate-500">
                  Daftar akun tersedia setelah database terhubung.
                </p>
              )}
            </div>
          </section>
          <section className={panelClass}>
            <h3 className="font-semibold">Akses anggota project</h3>
            <p className="mt-2 text-xs text-slate-500">
              Untuk akses Viewer sekaligus, gunakan Pengaturan Izin Viewer di atas.
              Keanggotaan ini tidak membuka izin tambahan Viewer. Admin dan Project
              Manager sudah memiliki akses penuh ke seluruh proyek tanpa assignment tambahan.
            </p>
            <MemberForm data={data} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.projects.map((p) => (
                <div key={p.id} className="border-t pt-3 text-sm">
                  <strong>{p.code}</strong>
                  <p className="text-slate-500">
                    {p.members.map((m) => m.user.displayName).join(', ') ||
                      'Belum ada anggota tambahan'}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section className={panelClass}>
            <h3 className="font-semibold">50 aktivitas terakhir</h3>
            <div className="mt-3 divide-y">
              {data.logs.map((l) => (
                <p key={l.id} className="py-3 text-xs text-slate-600">
                  <time>{l.createdAt.replace('T', ' ').slice(0, 19)} UTC</time>{' '}
                  · {l.user?.displayName ?? 'System'} ·{' '}
                  {l.project?.code ?? 'Account'} · <strong>{l.action}</strong>
                </p>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
