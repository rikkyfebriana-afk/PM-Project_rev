'use client';
import { useActionState } from 'react';
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
  return (
    <form action={action} className="mt-4 space-y-3">
      <fieldset
        disabled={data.demoMode || pending}
        className="grid gap-3 sm:grid-cols-3"
      >
        <Field label="Project">
          <select name="projectId" className={inputClass}>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pengguna">
          <select name="userId" className={inputClass}>
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
          <select name="operation" className={inputClass}>
            <option value="add">Tambahkan akses baca</option>
            <option value="remove">Cabut akses anggota</option>
          </select>
        </Field>
      </fieldset>
      <MutationFeedback state={state} />
      <button disabled={data.demoMode || pending} className={buttonClass}>
        Simpan akses
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
              Anggota memperoleh akses baca. Hak edit Project Manager mengikuti
              assignment manager pada Project Register.
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
