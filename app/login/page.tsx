import {
  ArrowUpRight,
  CalendarRange,
  Layers3,
  ShieldCheck,
} from 'lucide-react';

import { LoginForm } from '@/components/auth/login-form';
import { CompanyLogo, companyName } from '@/components/brand/company-logo';
import { isLocalDemoMode } from '@/lib/auth/session';

import styles from './login.module.css';

export const metadata = { title: 'Login' };
export const dynamic = 'force-dynamic';

const capabilities = [
  {
    icon: Layers3,
    title: 'Proyek terpusat',
    description: 'Satu gambaran menyeluruh.',
  },
  {
    icon: CalendarRange,
    title: 'Tim selaras',
    description: 'Setiap langkah terencana.',
  },
  {
    icon: ShieldCheck,
    title: 'Akses terkelola',
    description: 'Sesuai peran setiap anggota.',
  },
];

export default function LoginPage() {
  return (
    <main
      className={`${styles.page} flex min-h-svh items-center justify-center px-4 py-6 sm:p-8 lg:p-10`}
    >
      <div className="relative grid w-full max-w-[1440px] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_28px_90px_-28px_rgba(24,43,52,0.22)] lg:min-h-[760px] lg:grid-cols-[1.12fr_1fr]">
        <section
          className={`${styles.story} relative hidden flex-col justify-between overflow-hidden px-12 py-11 text-white lg:flex xl:px-14`}
          aria-label="Project Control PT. Arsko Sukses Bersama"
        >
          <div className={styles.blueprint} aria-hidden="true" />
          <div className={styles.orbit} aria-hidden="true" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl bg-[#fffdf7] p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
              <CompanyLogo className="size-full" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-semibold tracking-[-0.025em] text-white">
                Project Control
              </p>
              <p className="mt-1.5 text-[13px] leading-5 text-[#c4cfd4]">
                {companyName}
              </p>
            </div>
          </div>

          <div className="relative z-10 py-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px w-8 bg-[#d9bb80]" aria-hidden="true" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ddc79d]">
                Terencana. Terpantau. Terkendali.
              </p>
            </div>
            <h2 className="text-[clamp(2.9rem,4.4vw,4.25rem)] font-medium leading-[1.1] tracking-[-0.05em]">
              Setiap proyek.
              <br />
              <span className="font-serif font-normal italic tracking-[-0.055em] text-[#e6cd9c]">
                Satu kendali.
              </span>
            </h2>
            <p className="mt-7 max-w-[400px] text-[15px] leading-7 text-[#c2cdd3]">
              Rencanakan pekerjaan, selaraskan tim, dan pantau setiap pencapaian
              dalam satu ruang kerja.
            </p>

            <div className="mt-7 max-w-[430px] rounded-2xl border border-white/[0.13] bg-white/[0.045] p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[#b7c8d1]">
                  Alur kerja yang terhubung
                </p>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-[#d9bb80]"
                />
              </div>
              <ol
                className="mt-5 grid grid-cols-4 gap-2"
                aria-label="Tahapan proyek"
              >
                {[
                  'PO Customer',
                  'Perencanaan',
                  'Pelaksanaan',
                  'Serah terima',
                ].map((label, index) => (
                  <li key={label} className="relative min-w-0">
                    <div className="mb-3 flex items-center" aria-hidden="true">
                      <span className="z-10 flex size-5 shrink-0 items-center justify-center rounded-full border border-[#dcc591]/65 bg-[#18394a] text-[9px] font-semibold text-[#ead5ad]">
                        {index + 1}
                      </span>
                      {index < 3 && (
                        <span className="h-px w-full bg-white/20" />
                      )}
                    </div>
                    <p className="text-[11px] leading-4 text-[#d4dee3]">
                      {label}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-5 border-t border-white/15 pt-6">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <div key={title} className="min-w-0">
                <Icon
                  aria-hidden="true"
                  className="mb-3 size-[18px] stroke-[1.5] text-[#d8c18f]"
                />
                <p className="text-xs font-semibold text-[#edf1f3]">{title}</p>
                <p className="mt-1.5 text-[11px] leading-[1.6] text-[#9eb1bc]">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="relative flex flex-col justify-between bg-[#fffefd] px-6 py-7 sm:px-10 sm:py-8 lg:px-12 lg:py-9 xl:px-16"
          aria-labelledby="login-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#65757d]">
              Project workspace
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#e7e5dd] bg-[#f8f7f3] px-3 py-1.5 text-[10px] font-medium text-[#67776f]">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[#7f977e]"
              />{' '}
              Portal tim
            </span>
          </div>

          <div className="mx-auto w-full max-w-[390px] py-10 lg:py-6">
            <div className="mb-9 flex items-center gap-3 border-b border-[#eeede8] pb-7 lg:hidden">
              <CompanyLogo className="size-14" />
              <div className="min-w-0">
                <p className="text-base font-semibold tracking-tight text-[#18384a]">
                  Project Control
                </p>
                <p className="mt-1 text-xs leading-5 text-[#61727b]">
                  {companyName}
                </p>
              </div>
            </div>

            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#80683d]">
              Ruang kerja terpusat
            </p>
            <h1
              id="login-heading"
              className="text-[34px] font-semibold leading-[1.15] tracking-[-0.045em] text-[#183345] sm:text-[38px]"
            >
              Selamat datang<span className="text-[#b49a64]">.</span>
            </h1>
            <p className="mt-4 max-w-[340px] text-sm leading-6 text-[#61727b]">
              Masuk untuk melanjutkan rencana dan pencapaian tim Anda hari ini.
            </p>

            <LoginForm demoMode={isLocalDemoMode()} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#ecebe6] pt-5 text-[10px] leading-5 text-[#63737d]">
            <span>{companyName}</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck
                aria-hidden="true"
                className="size-3.5 text-[#819389]"
              />{' '}
              Akses internal perusahaan
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
