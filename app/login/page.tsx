import { CheckCircle2, Database, LockKeyhole, ShieldCheck } from 'lucide-react';

import { LoginForm } from '@/components/auth/login-form';
import { isLocalDemoMode } from '@/lib/auth/session';

export const metadata = { title: 'Login' };
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-[#eff3f5] lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.7fr)]">
      <section className="relative hidden overflow-hidden bg-[#0f2638] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute inset-0 login-grid opacity-35" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid size-11 place-items-center bg-[#f36b3e] font-mono text-sm font-bold">
            PC
          </span>
          <span>
            <strong className="block text-lg">Project Control</strong>
            <small className="text-xs uppercase tracking-[0.18em] text-white/45">
              Operations center
            </small>
          </span>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#ff8b64]">
            Delivery intelligence
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.045em] xl:text-5xl">
            Satu pusat kendali untuk setiap proyek.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/62">
            Pantau progress, material, milestone, biaya, dan dokumen proyek
            dengan akses yang aman untuk tim Anda.
          </p>
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            {[
              'Portfolio visibility',
              'Cost & margin control',
              'Milestone tracking',
              'Secure documents',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72"
              >
                <CheckCircle2 className="size-4 text-[#5fd0ae]" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/35">
          Internal system · Authorized access only
        </p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[430px] border border-[#dbe2e6] bg-white p-7 shadow-[0_24px_70px_rgba(19,44,60,0.1)] sm:p-10">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center bg-[#17364a] font-mono text-sm font-bold text-white">
              PC
            </span>
            <strong className="text-base text-[#17364a]">
              Project Control
            </strong>
          </div>
          <div className="mt-8 lg:mt-0">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#d85c38]">
              Secure sign in
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#172d3e]">
              Selamat datang
            </h2>
            <p className="mt-3 text-base leading-6 text-[#71808a]">
              Gunakan akun yang diberikan administrator untuk mengakses
              workspace.
            </p>
          </div>
          <LoginForm demoMode={isLocalDemoMode()} />
          <div className="mt-8 grid grid-cols-3 gap-2 border-t border-[#e7ebed] pt-5 text-center text-xs text-[#7d8a93]">
            <span>
              <ShieldCheck className="mx-auto mb-1.5 size-4 text-[#1c8d74]" />
              Protected
            </span>
            <span>
              <LockKeyhole className="mx-auto mb-1.5 size-4 text-[#1c8d74]" />
              Encrypted
            </span>
            <span>
              <Database className="mx-auto mb-1.5 size-4 text-[#1c8d74]" />
              Private data
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
