'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function ProjectsError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-82px)] max-w-[1600px] place-items-center p-6">
      <section className="max-w-md border border-[#e7cbc5] bg-white p-7 text-center shadow-sm">
        <div className="mx-auto grid size-12 place-items-center bg-[#fff0ed] text-[#d85842]">
          <AlertTriangle className="size-5" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-[#243947]">
          Project register belum dapat dimuat
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#75838d]">
          Periksa koneksi PostgreSQL, kemudian coba kembali. Detail teknis tidak
          ditampilkan agar informasi server tetap aman.
        </p>
        <Button
          type="button"
          onClick={reset}
          className="mt-5 h-10 rounded-none bg-[#17364a] px-5 text-white"
        >
          <RefreshCw /> Try again
        </Button>
      </section>
    </main>
  );
}
