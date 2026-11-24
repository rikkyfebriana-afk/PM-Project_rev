'use client';

import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  UserRound,
} from 'lucide-react';
import { useActionState, useState } from 'react';

import { loginAction, type LoginState } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const initialState: LoginState = {};

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} aria-busy={pending} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="username"
          className="mb-2.5 block text-sm font-semibold text-[#2b4050]"
        >
          Username
        </label>
        <div className="relative">
          <UserRound
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#87929a]"
          />
          <Input
            id="username"
            name="username"
            autoComplete="username"
            defaultValue={demoMode ? 'demo' : ''}
            required
            minLength={3}
            className="h-[54px] rounded-xl border-[#e1e5e7] bg-[#fbfaf8] pl-12 text-base text-[#183448] shadow-none placeholder:text-[#687984] hover:border-[#bdc8cf] focus-visible:border-[#947743] focus-visible:bg-white focus-visible:ring-[#b99b61]/15 md:text-base"
            placeholder="Username Anda"
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-2.5 block text-sm font-semibold text-[#2b4050]"
        >
          Password
        </label>
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#87929a]"
          />
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            defaultValue={demoMode ? 'development' : ''}
            required
            minLength={8}
            className="h-[54px] rounded-xl border-[#e1e5e7] bg-[#fbfaf8] pl-12 pr-14 text-base text-[#183448] shadow-none placeholder:text-[#687984] hover:border-[#bdc8cf] focus-visible:border-[#947743] focus-visible:bg-white focus-visible:ring-[#b99b61]/15 md:text-base"
            placeholder="Password Anda"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={
              showPassword ? 'Sembunyikan password' : 'Tampilkan password'
            }
            aria-pressed={showPassword}
            className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-[#7d8b95] transition-colors hover:bg-[#eef1f2] hover:text-[#183448] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#947743]"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-[18px]" />
            ) : (
              <Eye aria-hidden="true" className="size-[18px]" />
            )}
          </button>
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-[#f1d4cd] bg-[#fff5f2] px-4 py-3 text-sm leading-6 text-[#a74031]"
        >
          {state.error}
        </p>
      )}
      {demoMode && (
        <p className="rounded-xl border border-[#dce9e7] bg-[#f1f7f6] px-4 py-3 text-sm leading-6 text-[#49626e]">
          Mode preview lokal aktif. Kredensial demo sudah terisi.
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="group h-[54px] w-full justify-center gap-3 rounded-xl bg-[#16374a] px-5 text-sm font-semibold text-white shadow-[0_8px_18px_-9px_rgba(22,55,74,0.55)] transition-all hover:bg-[#214b60] hover:shadow-[0_10px_22px_-9px_rgba(22,55,74,0.5)] focus-visible:ring-[#b99b61]/40"
      >
        {pending ? (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />{' '}
            Memeriksa...
          </>
        ) : (
          <>
            Masuk ke dashboard
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </>
        )}
      </Button>
      <p className="text-center text-xs leading-5 text-[#687983]">
        Butuh akses? Hubungi administrator Anda.
      </p>
    </form>
  );
}
