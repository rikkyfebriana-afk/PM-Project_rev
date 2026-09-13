'use client';

import { Eye, EyeOff, Loader2, LockKeyhole, UserRound } from 'lucide-react';
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
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="username"
          className="mb-2 block text-sm font-semibold text-[#314654]"
        >
          Username
        </label>
        <div className="relative">
          <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#82909a]" />
          <Input
            id="username"
            name="username"
            autoComplete="username"
            defaultValue={demoMode ? 'demo' : ''}
            required
            minLength={3}
            className="h-12 border-[#d8e0e4] bg-white pl-10 text-base shadow-none"
            placeholder="Masukkan username"
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-semibold text-[#314654]"
        >
          Password
        </label>
        <div className="relative">
          <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#82909a]" />
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            defaultValue={demoMode ? 'development' : ''}
            required
            minLength={8}
            className="h-12 border-[#d8e0e4] bg-white px-10 text-base shadow-none"
            placeholder="Masukkan password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={
              showPassword ? 'Sembunyikan password' : 'Tampilkan password'
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#82909a] hover:text-[#203b4c]"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="border-l-2 border-[#dc5945] bg-[#fff2ef] px-3 py-2.5 text-sm text-[#b44231]"
        >
          {state.error}
        </p>
      )}
      {demoMode && (
        <p className="bg-[#eef5f5] px-3 py-2.5 text-sm text-[#49626e]">
          Mode preview lokal aktif. Kredensial demo sudah terisi.
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full bg-[#17364a] text-sm text-white hover:bg-[#0f2a3b]"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Memeriksa...
          </>
        ) : (
          'Masuk ke dashboard'
        )}
      </Button>
    </form>
  );
}
