'use client';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { MutationState } from '@/lib/operations/validation';

export const inputClass =
  'w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:bg-slate-100';
export const buttonClass =
  'inline-flex items-center justify-center rounded bg-[#17364a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-[#24536b]';
export const panelClass = 'border border-slate-200 bg-white p-5 md:p-6';
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}
export function MutationFeedback({ state }: { state: MutationState }) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);
  return state.message ? (
    <p
      role="status"
      className={`my-3 text-sm ${state.status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}
    >
      {state.message}
    </p>
  ) : null;
}
export function WorkspaceIntro({
  title,
  description,
  demo,
}: {
  title: string;
  description: string;
  demo: boolean;
}) {
  return (
    <section className={panelClass}>
      <p className="section-kicker text-[#d85832]!">Project operations</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
        {description}
      </p>
      {demo && (
        <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Mode demo: contoh data. Penyimpanan memerlukan koneksi database.
        </p>
      )}
    </section>
  );
}
export function Metrics({
  items,
}: {
  items: { label: string; value: string | number }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((i) => (
        <div
          key={i.label}
          className={`${panelClass} border-l-4 border-l-teal-600`}
        >
          <p className="text-xs uppercase tracking-wider text-slate-500">
            {i.label}
          </p>
          <p className="mt-3 break-words font-mono text-2xl font-semibold">
            {i.value}
          </p>
        </div>
      ))}
    </div>
  );
}
